import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('LambdaModel.count()', () => {
  beforeEach(() => {
    // Mock SalesforceConfig
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue('https://test.salesforce.com/services/data/v58.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Count without conditions', () => {
    it('should generate correct SOQL for count all', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 100 }
      } as any);

      await Account.count();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT COUNT() FROM Account');
    });

    it('should return the total count', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 42 }
      } as any);

      const count = await Account.count();

      expect(count).toBe(42);
    });

    it('should return 0 when no records exist', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 0 }
      } as any);

      const count = await Account.count();

      expect(count).toBe(0);
    });

    it('should work with different object types', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 25 }
      } as any);

      await Contact.count();

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT COUNT() FROM Contact');
    });
  });

  describe('Count with simple conditions', () => {
    it('should count with simple equality condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 15 }
      } as any);

      await Account.count(x => x.Industry === 'Technology');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology'");
    });

    it('should count with numeric comparison', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 8 }
      } as any);

      await Account.count(x => x.AnnualRevenue > 1000000 && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toContain('AnnualRevenue > 1000000');
    });

    it('should count with boolean field', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 50 }
      } as any);

      await Account.count(x => x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe('SELECT COUNT() FROM Account WHERE Active__c = TRUE');
    });
  });

  describe('Count with complex conditions', () => {
    it('should count with AND condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 5 }
      } as any);

      await Account.count(x => x.Industry === 'Technology' && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' AND Active__c = TRUE");
    });

    it('should count with OR condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 20 }
      } as any);

      await Account.count(x => x.Industry === 'Technology' || x.Industry === 'Finance');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' OR Industry = 'Finance'");
    });

    it('should count with multiple comparison operators', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 3 }
      } as any);

      await Account.count(x => x.AnnualRevenue >= 1000000 && x.NumberOfEmployees < 500 && x.Active__c === true);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toContain('AnnualRevenue >= 1000000');
      expect(decodedQuery).toContain('NumberOfEmployees < 500');
    });
  });

  describe('Count with nested properties', () => {
    it('should count with nested property condition', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 12 }
      } as any);

      await Account.count(x => x.BillingAddress.City === 'San Francisco');

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE BillingAddress.City = 'San Francisco'");
    });
  });

  describe('Count with closure variables (Inspector)', () => {
    it('should count with simple closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 12 }
      } as any);

      const cityName = "San Francisco";

      await Account.count(x => x.BillingAddress.City === cityName);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE BillingAddress.City = 'San Francisco'");
    });

    it('should count with object property closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 8 }
      } as any);

      const filters = { industry: 'Technology', minRevenue: 1000000 };

      await Account.count(x => x.Industry === filters.industry);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology'");
    });

    it('should count with nested object property closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 5 }
      } as any);

      const config = {
        filters: {
          account: {
            targetIndustry: 'Healthcare'
          }
        }
      };

      await Account.count(x => x.Industry === config.filters.account.targetIndustry);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Healthcare'");
    });

    it('should count with multiple closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 3 }
      } as any);

      const industry = 'Technology';
      const minRevenue = 2000000;

      await Account.count(x => x.Industry === industry && x.AnnualRevenue > minRevenue);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 2000000");
    });

    it('should count with numeric closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 10 }
      } as any);

      const threshold = 500000;

      await Account.count(x => x.AnnualRevenue >= threshold);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE AnnualRevenue >= 500000");
    });

    it('should count with boolean closure variable', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 25 }
      } as any);

      const isActive = true;

      await Account.count(x => x.Active__c === isActive);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Active__c = TRUE");
    });

    it('should count with mixed literals and closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 7 }
      } as any);

      const minRevenue = 1500000;

      await Account.count(x => x.Industry === 'Technology' && x.AnnualRevenue > minRevenue);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1500000");
    });

    it('should count with OR conditions using closure variables', async () => {
      const mockGet = vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: 15 }
      } as any);

      const industry1 = 'Technology';
      const industry2 = 'Finance';

      await Account.count(x => x.Industry === industry1 || x.Industry === industry2);

      const callUrl = mockGet.mock.calls[0][0] as string;
      const decodedQuery = decodeURIComponent(callUrl.split('?q=')[1]);

      expect(decodedQuery).toBe("SELECT COUNT() FROM Account WHERE Industry = 'Technology' OR Industry = 'Finance'");
    });
  })

  describe('Error handling', () => {
    it('should return 0 when API response is malformed', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: {}
      } as any);

      const count = await Account.count();

      expect(count).toBe(0);
    });

    it('should return 0 when totalSize is null', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValue({
        data: { totalSize: null }
      } as any);

      const count = await Account.count();

      expect(count).toBe(0);
    });
  });
});
