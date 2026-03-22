import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('LambdaModel.exists()', () => {
  beforeEach(() => {
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue('https://test.salesforce.com/services/data/v58.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic existence checks', () => {
    it('should generate correct SOQL with simple condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.Name === 'Acme Corp');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Name = 'Acme Corp'");
    });

    it('should return true when records exist', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 5 }
      } as any);

      const exists = await Account.exists(x => x.Industry === 'Technology');

      expect(exists).toBe(true);
    });

    it('should return false when no records exist', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 0 }
      } as any);

      const exists = await Account.exists(x => x.Industry === 'NonExistent');

      expect(exists).toBe(false);
    });

    it('should return true even if only one record exists', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const exists = await Account.exists(x => x.Name === 'Unique Name');

      expect(exists).toBe(true);
    });
  });

  describe('Exists with different data types', () => {
    it('should check existence with string field', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.Type === 'Customer');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Type = 'Customer'");
    });

    it('should check existence with numeric field', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.AnnualRevenue > 10000000 && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toContain('AnnualRevenue > 10000000');
    });

    it('should check existence with boolean field', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT COUNT() FROM Account WHERE Active__c = TRUE');
    });
  });

  describe('Exists with complex conditions', () => {
    it('should check existence with AND condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.Industry === 'Technology' && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' AND Active__c = TRUE");
    });

    it('should check existence with OR condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.Rating === 'Hot' || x.Rating === 'Warm');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Rating = 'Hot' OR Rating = 'Warm'");
    });

    it('should check existence with multiple operators', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.NumberOfEmployees >= 100 && x.NumberOfEmployees <= 1000 && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toContain('NumberOfEmployees >= 100');
      expect(decodedQuery).toContain('NumberOfEmployees <= 1000');
    });
  });

  describe('Exists with nested properties', () => {
    it('should check existence with nested property', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.BillingAddress.State === 'CA');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE BillingAddress.State = 'CA'");
    });

    it('should check existence with multiple nested properties', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Account.exists(x => x.BillingAddress.City === 'San Francisco' && x.BillingAddress.State === 'CA');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE BillingAddress.City = 'San Francisco' AND BillingAddress.State = 'CA'");
    });
  });

  describe('Closure variables with Inspector', () => {
    it('should check existence with simple closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const targetName = 'Acme Corp';

      await Account.exists(x => x.Name === targetName);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Name = 'Acme Corp'");
    });

    it('should check existence with object property closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const criteria = { industry: 'Technology', active: true };

      await Account.exists(x => x.Industry === criteria.industry);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology'");
    });

    it('should check existence with nested object property closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const settings = {
        search: {
          account: {
            rating: 'Hot'
          }
        }
      };

      await Account.exists(x => x.Rating === settings.search.account.rating);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Rating = 'Hot'");
    });

    it('should check existence with multiple closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const industry = 'Finance';
      const minEmployees = 100;

      await Account.exists(x => x.Industry === industry && x.NumberOfEmployees >= minEmployees);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Finance' AND NumberOfEmployees >= 100");
    });

    it('should check existence with numeric closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const revenueThreshold = 5000000;

      await Account.exists(x => x.AnnualRevenue > revenueThreshold);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE AnnualRevenue > 5000000");
    });

    it('should check existence with boolean closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const activeStatus = false;

      await Account.exists(x => x.Active__c === activeStatus);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Active__c = FALSE");
    });

    it('should check existence with mixed literals and closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const minRevenue = 750000;

      await Account.exists(x => x.Industry === 'Healthcare' && x.AnnualRevenue >= minRevenue);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Healthcare' AND AnnualRevenue >= 750000");
    });

    it('should check existence with OR conditions using closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      const rating1 = 'Hot';
      const rating2 = 'Warm';

      await Account.exists(x => x.Rating === rating1 || x.Rating === rating2);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Rating = 'Hot' OR Rating = 'Warm'");
    });

    it('should return correct boolean result with closure variables', async () => {
      const industry = 'Technology';

      // Test true case
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 5 }
      } as any);

      const existsTrue = await Account.exists(x => x.Industry === industry);
      expect(existsTrue).toBe(true);

      // Test false case
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 0 }
      } as any);

      const existsFalse = await Account.exists(x => x.Industry === industry);
      expect(existsFalse).toBe(false);
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 1 }
      } as any);

      await Contact.exists(x => x.Email === 'test@example.com');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Contact WHERE Email = 'test@example.com'");
    });
  });

  describe('Error handling', () => {
    it('should return false when API response is malformed', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {}
      } as any);

      const exists = await Account.exists(x => x.Name === 'Test');

      expect(exists).toBe(false);
    });

    it('should return false when totalSize is null', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: null }
      } as any);

      const exists = await Account.exists(x => x.Name === 'Test');

      expect(exists).toBe(false);
    });

    it('should return false when totalSize is undefined', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: undefined }
      } as any);

      const exists = await Account.exists(x => x.Name === 'Test');

      expect(exists).toBe(false);
    });
  });
});
