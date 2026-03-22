import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('TypedQueryBuilder.first()', () => {
  beforeEach(() => {
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue('https://test.salesforce.com/services/data/v58.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic first() functionality', () => {
    it('should automatically add LIMIT 1 to the query', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'Test Account' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 1');
    });

    it('should return the first record when records exist', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [
            { Id: '001xxx', Name: 'First Account' },
            { Id: '001yyy', Name: 'Second Account' }
          ],
          done: true
        }
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .first();

      expect(result).toEqual({ Id: '001xxx', Name: 'First Account' });
    });

    it('should return null when no records exist', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [],
          done: true
        }
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .first();

      expect(result).toBeNull();
    });
  });

  describe('first() with WHERE clause', () => {
    it('should apply WHERE clause before LIMIT 1', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'Tech Corp' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' LIMIT 1");
    });

    it('should work with multiple WHERE clauses', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'Large Tech Corp' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000)
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 LIMIT 1");
    });
  });

  describe('first() with ORDER BY', () => {
    it('should apply ORDER BY before LIMIT 1', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'AAA Corp' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account ORDER BY Name ASC LIMIT 1');
    });

    it('should work with descending order', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'ZZZ Corp', AnnualRevenue: 10000000 }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name, Revenue: x.AnnualRevenue }))
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name, AnnualRevenue FROM Account ORDER BY AnnualRevenue DESC LIMIT 1');
    });
  });

  describe('first() with nested properties', () => {
    it('should work with nested property selection', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{
            Name: 'Test Account',
            BillingAddress: { City: 'San Francisco' }
          }],
          done: true
        }
      } as any);

      const result = await Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .first();

      expect(result).toEqual({
        Name: 'Test Account',
        City: 'San Francisco'
      });
    });

    it('should work with nested property in WHERE', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Name: 'SF Account' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.BillingAddress.City === 'San Francisco')
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Name FROM Account WHERE BillingAddress.City = 'San Francisco' LIMIT 1");
    });
  });

  describe('first() with relationships', () => {
    it('should work with subquery selection', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{
            Name: 'Test Account',
            Contacts: {
              records: [
                { Id: 'c001', Name: 'John Doe' },
                { Id: 'c002', Name: 'Jane Smith' }
              ],
              done: true
            }
          }],
          done: true
        }
      } as any);

      const result = await Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Id: c.Id, Name: c.Name }))
        }))
        .first();

      expect(result).toEqual({
        Name: 'Test Account',
        Contacts: [
          { Id: 'c001', Name: 'John Doe' },
          { Id: 'c002', Name: 'Jane Smith' }
        ]
      });
    });
  });

  describe('Complete query combinations', () => {
    it('should work with all query clauses', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'Top Tech Corp' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .where(x => x.AnnualRevenue > 1000000)
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 ORDER BY AnnualRevenue DESC LIMIT 1");
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: 'c001', Name: 'John Doe', Email: 'john@example.com' }],
          done: true
        }
      } as any);

      const result = await Contact
        .select(x => ({ Id: x.Id, Name: x.Name, Email: x.Email }))
        .first();

      expect(result).toEqual({
        Id: 'c001',
        Name: 'John Doe',
        Email: 'john@example.com'
      });
    });
  });

  describe('Existing LIMIT handling', () => {
    it('should override existing LIMIT with 1', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {
          records: [{ Id: '001xxx', Name: 'Test' }],
          done: true
        }
      } as any);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .limit(10)
        .first();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 1');
    });
  });

  describe('Error handling', () => {
    it('should return null when API response is malformed', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {}
      } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .first();

      expect(result).toBeNull();
    });

    it('should throw error when query execution fails', async () => {
      vi.spyOn(SalesforceClient, 'get').mockRejectedValue(new Error('Network error'));

      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .first()
      ).rejects.toThrow('Query execution failed: Network error');
    });
  });

  describe('Query immutability', () => {
    it('should not mutate original query builder when calling first()', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { records: [], done: true }
      } as any);

      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology');

      // Call first()
      await query.first();

      // Original query should not have LIMIT 1
      const originalSOQL = query.toSOQL();
      expect(originalSOQL).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology'");
    });
  });
});
