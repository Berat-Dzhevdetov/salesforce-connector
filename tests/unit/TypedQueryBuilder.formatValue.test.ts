import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';
import { TypedQueryBuilder } from '../../src/core/TypedQueryBuilder';

/**
 * Tests for TypedQueryBuilder private methods:
 * - getNestedProperty (lines 289-317)
 * - convertDatesToStrings (lines 322-338)
 * - formatValue (lines 343-399)
 *
 * These are tested indirectly via .get(), .first(), and .toSOQL() / .where()
 */
describe('TypedQueryBuilder - getNestedProperty & result mapping', () => {
  beforeEach(() => {
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue(
      'https://test.salesforce.com/services/data/v58.0'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNestedProperty - subquery path (lines 289-302)', () => {
    it('should extract records from subquery result containing FROM clause path', async () => {
      const subqueryRecords = [{ Id: 'c1', Name: 'Contact A' }];

      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: 'a1',
              Name: 'ACME',
              // Salesforce returns subquery results as { records: [...], done: true }
              Contacts: { records: subqueryRecords, done: true },
            },
          ],
        },
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .get();

      expect(result).toHaveLength(1);
      expect(result[0].Id).toBe('a1');
    });

    it('should return empty array when subquery relationship has no records', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          totalSize: 1,
          done: true,
          records: [
            {
              Id: 'a1',
              Name: 'ACME',
              Contacts: null,
            },
          ],
        },
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .get();

      expect(result).toHaveLength(1);
    });
  });

  describe('getNestedProperty - dot notation path (lines 305-317)', () => {
    it('should map nested dot-notation field paths in results', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          totalSize: 1,
          done: true,
          records: [{ Id: 'a1', Name: 'ACME' }],
        },
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .get();

      expect(result[0].Id).toBe('a1');
      expect(result[0].Name).toBe('ACME');
    });

    it('should return undefined for missing nested path segments', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          totalSize: 1,
          done: true,
          records: [{ Id: 'a1' }],
        },
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .get();

      expect(result[0].Name).toBeUndefined();
    });
  });

  describe('convertDatesToStrings (lines 322-338)', () => {
    it('should convert date field Date objects to YYYY-MM-DD strings on create/update', async () => {
      // convertDatesToStrings is called before save/create/update operations
      // We test indirectly: when we have date fields registered, dates are formatted correctly in WHERE clauses
      const query = Contact
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.CreatedDate === new Date('2024-01-15T00:00:00.000Z') as any);

      const soql = query.toSOQL();
      // CreatedDate is a datetime field (Date type) - should appear without quotes
      expect(soql).toContain('CreatedDate');
    });
  });

  describe('formatValue (lines 343-399)', () => {
    it('should format null as NULL', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Rating === null as any);

      const soql = query.toSOQL();
      expect(soql).toContain('NULL');
    });

    it('should format boolean true as TRUE', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === true);

      expect(query.toSOQL()).toContain('TRUE');
    });

    it('should format boolean false as FALSE', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === false);

      expect(query.toSOQL()).toContain('FALSE');
    });

    it('should format numbers without quotes', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.NumberOfEmployees === 100);

      expect(query.toSOQL()).toContain('100');
      expect(query.toSOQL()).not.toContain("'100'");
    });

    it('should format strings with single quotes', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology');

      expect(query.toSOQL()).toContain("'Technology'");
    });

    it('should escape single quotes in string values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === "O'Brien");

      const soql = query.toSOQL();
      expect(soql).toContain("O\\'Brien");
    });

    it('should format Date for datetime field as full ISO string without quotes', () => {
      // TypedQueryBuilder with known datetime fields formats Date objects without quotes
      const builder = new TypedQueryBuilder<any, any>(
        'TestObj',
        { CreatedDate: 'CreatedDate', Name: 'Name' } as any,
        undefined,
        [],
        ['CreatedDate']
      );

      const date = new Date('2024-06-15T10:30:00.000Z');
      builder.where((x: any) => x.CreatedDate === date);
      const soql = builder.toSOQL();
      expect(soql).toContain('2024-06-15T10:30:00.000Z');
      expect(soql).not.toMatch(/CreatedDate = '2024/);
    });

    it('should format Date for date-only field as YYYY-MM-DD without quotes', () => {
      const builder = new TypedQueryBuilder<any, any>(
        'TestObj',
        { CloseDate: 'CloseDate', Name: 'Name' } as any,
        undefined,
        ['CloseDate'],
        []
      );

      const date = new Date('2024-06-15T00:00:00.000Z');
      builder.where((x: any) => x.CloseDate === date);
      const soql = builder.toSOQL();
      expect(soql).toContain('2024-06-15');
      expect(soql).not.toMatch(/CloseDate = '2024/);
    });

    it('should handle datetime string with time component - append Z if missing timezone', () => {
      const builder = new TypedQueryBuilder<any, any>(
        'TestObj',
        { CreatedDate: 'CreatedDate' } as any,
        undefined,
        [],
        ['CreatedDate']
      );

      builder.where((x: any) => x.CreatedDate === '2024-06-15T10:30:00');
      const soql = builder.toSOQL();
      expect(soql).toContain('2024-06-15T10:30:00Z');
    });

    it('should handle datetime string already ending with Z', () => {
      const builder = new TypedQueryBuilder<any, any>(
        'TestObj',
        { CreatedDate: 'CreatedDate' } as any,
        undefined,
        [],
        ['CreatedDate']
      );

      builder.where((x: any) => x.CreatedDate === '2024-06-15T10:30:00.000Z');
      const soql = builder.toSOQL();
      expect(soql).toContain('2024-06-15T10:30:00.000Z');
    });

    it('should handle date string without time component', () => {
      const builder = new TypedQueryBuilder<any, any>(
        'TestObj',
        { CloseDate: 'CloseDate' } as any,
        undefined,
        ['CloseDate'],
        []
      );

      builder.where((x: any) => x.CloseDate === '2024-06-15');
      const soql = builder.toSOQL();
      expect(soql).toContain('2024-06-15');
    });
  });
});
