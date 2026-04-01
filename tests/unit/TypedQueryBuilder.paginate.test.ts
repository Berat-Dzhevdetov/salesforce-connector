import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('TypedQueryBuilder.paginate()', () => {
  beforeEach(() => {
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue('https://test.salesforce.com/services/data/v58.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to mock both COUNT and data queries
  function mockPaginateGet(totalSize: number, records: any[]) {
    return vi.spyOn(SalesforceClient, 'get')
      .mockResolvedValueOnce({
        data: { totalSize, done: true, records: [{ 'expr0': totalSize }] }
      } as any)
      .mockResolvedValueOnce({
        data: { records, totalSize: records.length, done: records.length < totalSize }
      } as any);
  }

  describe('Basic pagination', () => {
    it('should paginate with default parameters (page 1, 20 items)', async () => {
      const records = Array(20).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Account ${i}` }));
      const mockGet = mockPaginateGet(100, records);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate();

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 20 OFFSET 0');
      expect(result.records).toHaveLength(20);
      expect(result.totalSize).toBe(100);
      expect(result.hasNextPage).toBe(true);
    });

    it('should paginate page 1 with custom items per page', async () => {
      const records = Array(10).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Account ${i}` }));
      const mockGet = mockPaginateGet(50, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(1, 10);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 10 OFFSET 0');
    });

    it('should paginate page 2 correctly', async () => {
      const records = Array(20).fill(null).map((_, i) => ({ Id: `00${i + 20}`, Name: `Account ${i + 20}` }));
      const mockGet = mockPaginateGet(100, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(2, 20);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 20 OFFSET 20');
    });

    it('should paginate page 5 with custom page size', async () => {
      const records = Array(25).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Account ${i}` }));
      const mockGet = mockPaginateGet(200, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(5, 25);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      // Page 5, items per page 25 = offset (5-1) * 25 = 100
      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 25 OFFSET 100');
    });
  });

  describe('Pagination response structure', () => {
    it('should return correct structure with records, totalSize, and hasNextPage', async () => {
      const records = [
        { Id: '001', Name: 'Account 1' },
        { Id: '002', Name: 'Account 2' }
      ];
      mockPaginateGet(50, records);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(1, 2);

      expect(result).toHaveProperty('records');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('hasNextPage');
      expect(result.records).toHaveLength(2);
      expect(result.totalSize).toBe(50);
      expect(result.hasNextPage).toBe(true);
    });

    it('should set hasNextPage to false when on the last page', async () => {
      const records = [{ Id: '001', Name: 'Last Account' }];
      mockPaginateGet(21, records);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(2, 20);

      expect(result.hasNextPage).toBe(false);
    });

    it('should return empty array when no records on page', async () => {
      mockPaginateGet(10, []);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(5, 20);

      expect(result.records).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe('Pagination with WHERE clause', () => {
    it('should apply WHERE clause before pagination', async () => {
      const records = Array(20).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Tech ${i}` }));
      const mockGet = mockPaginateGet(45, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .paginate(1, 20);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' LIMIT 20 OFFSET 0");
    });

    it('should work with multiple WHERE clauses', async () => {
      const records = Array(10).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Account ${i}` }));
      const mockGet = mockPaginateGet(25, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.Active__c === true)
        .paginate(2, 10);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' AND Active__c = TRUE LIMIT 10 OFFSET 10");
    });
  });

  describe('Pagination with ORDER BY', () => {
    it('should apply ORDER BY before pagination', async () => {
      const records = Array(20).fill(null).map((_, i) => ({ Id: `00${i}`, Name: `Account ${i}` }));
      const mockGet = mockPaginateGet(100, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .paginate(1, 20);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account ORDER BY Name ASC LIMIT 20 OFFSET 0');
    });
  });

  describe('Complete query with pagination', () => {
    it('should combine WHERE, ORDER BY, and pagination', async () => {
      const records = Array(25).fill(null).map((_, i) => ({
        Id: `00${i}`,
        Name: `Account ${i}`,
        Industry: 'Technology'
      }));
      const mockGet = mockPaginateGet(150, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry === 'Technology' && x.Active__c === true)
        .orderBy(x => x.Name, 'ASC')
        .paginate(3, 25);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT Id, Name, Industry FROM Account WHERE Industry = 'Technology' AND Active__c = TRUE ORDER BY Name ASC LIMIT 25 OFFSET 50");
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', async () => {
      const records = Array(15).fill(null).map((_, i) => ({
        Id: `c00${i}`,
        Name: `Contact ${i}`,
        Email: `contact${i}@example.com`
      }));
      mockPaginateGet(75, records);

      const result = await Contact
        .select(x => ({ Id: x.Id, Name: x.Name, Email: x.Email }))
        .paginate(1, 15);

      expect(result.records).toHaveLength(15);
      expect(result.totalSize).toBe(75);
    });
  });

  describe('Edge cases and validation', () => {
    it('should throw error for page number less than 1', async () => {
      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .paginate(0, 20)
      ).rejects.toThrow('Page number must be 1 or greater');
    });

    it('should throw error for negative page number', async () => {
      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .paginate(-1, 20)
      ).rejects.toThrow('Page number must be 1 or greater');
    });

    it('should throw error for items per page less than 1', async () => {
      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .paginate(1, 0)
      ).rejects.toThrow('Items per page must be 1 or greater');
    });

    it('should throw error for negative items per page', async () => {
      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .paginate(1, -5)
      ).rejects.toThrow('Items per page must be 1 or greater');
    });

    it('should handle page 1 with 1 item per page', async () => {
      const records = [{ Id: '001', Name: 'Single Account' }];
      const mockGet = mockPaginateGet(100, records);

      await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(1, 1);

      const callUrl = mockGet.mock.calls[1][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT Id, Name FROM Account LIMIT 1 OFFSET 0');
    });
  });

  describe('Error handling', () => {
    it('should return empty result when API response is malformed', async () => {
      vi.spyOn(SalesforceClient, 'get')
        .mockResolvedValueOnce({
          data: { totalSize: 0, done: true, records: [{ 'expr0': 0 }] }
        } as any)
        .mockResolvedValueOnce({
          data: null
        } as any);

      const result = await Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .paginate(1, 20);

      expect(result).toEqual({
        records: [],
        totalSize: 0,
        hasNextPage: false
      });
    });

    it('should throw error when query execution fails', async () => {
      vi.spyOn(SalesforceClient, 'get').mockRejectedValue(new Error('Network error'));

      await expect(
        Account
          .select(x => ({ Id: x.Id, Name: x.Name }))
          .paginate(1, 20)
      ).rejects.toThrow('Paginated query execution failed:');
    });
  });

  describe('Query immutability', () => {
    it('should not mutate original query when calling paginate', async () => {
      mockPaginateGet(0, []);

      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology');

      // Call paginate
      await query.paginate(2, 25);

      // Original query should not have LIMIT/OFFSET
      const originalSOQL = query.toSOQL();
      expect(originalSOQL).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology'");
    });
  });

  describe('Data mapping', () => {
    it('should correctly map nested properties in paginated results', async () => {
      const records = [{
        Name: 'Test Account',
        BillingAddress: { City: 'San Francisco', State: 'CA' }
      }];
      mockPaginateGet(1, records);

      const result = await Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .paginate(1, 20);

      expect(result.records[0]).toEqual({
        Name: 'Test Account',
        City: 'San Francisco'
      });
    });
  });
});
