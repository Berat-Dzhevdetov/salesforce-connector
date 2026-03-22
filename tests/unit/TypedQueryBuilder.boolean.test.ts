import { describe, it, expect, beforeEach } from 'vitest';
import { Account } from '../fixtures/TestModels';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('TypedQueryBuilder - Boolean Field Support', () => {
  beforeEach(() => {
    SalesforceConfig.initialize({
      instanceUrl: 'https://test.salesforce.com',
      apiVersion: '60.0'
    });
    SalesforceConfig.setAccessToken('test-token');
  });

  describe('Standalone boolean fields', () => {
    it('should convert x.IsActive to WHERE IsActive = TRUE', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
    });

    it('should support boolean field in complex condition', () => {
      const industry = 'Technology';
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && x.Industry === industry);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain('AND');
    });

    it('should support multiple boolean fields', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
    });
  });

  describe('Negated boolean fields', () => {
    it('should convert !x.IsActive to WHERE IsActive = FALSE', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => !x.Active__c);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = FALSE');
    });

    it('should support negated boolean in complex condition', () => {
      const industry = 'Technology';
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => !x.Active__c && x.Industry === industry);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = FALSE');
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain('AND');
    });

    it('should support OR with negated boolean', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => !x.Active__c || x.Industry === 'Healthcare');

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = FALSE');
      expect(soql).toContain("Industry = 'Healthcare'");
      expect(soql).toContain('OR');
    });
  });

  describe('Explicit boolean comparisons (should still work)', () => {
    it('should support x.IsActive === true', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
    });

    it('should support x.IsActive === false', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c === false);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = FALSE');
    });

    it('should support x.IsActive !== true', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c !== true);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c != TRUE');
    });

    it('should support boolean with closure variable', () => {
      const isActive = true;
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c === isActive);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
    });
  });

  describe('Complex boolean scenarios', () => {
    it('should handle grouped boolean conditions', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && (x.Industry === 'Technology' || x.Industry === 'Finance'));

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain("Industry = 'Finance'");
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Active__c = TRUE AND (Industry = 'Technology' OR Industry = 'Finance')")
    });

    it('should handle mixed boolean and non-boolean conditions', () => {
      const minRevenue = 1000000;
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && x.AnnualRevenue > minRevenue && !x.Active__c);

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain('AnnualRevenue > 1000000');
      expect(soql).toContain('Active__c = FALSE');
    });

    it('should support chained where with boolean', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c)
        .where(x => x.Industry === 'Technology');

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain('AND');
    });
  });

  describe('Advanced grouping scenarios', () => {
    it('should handle OR group at the beginning with AND', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => (x.Industry === 'Technology' || x.Industry === 'Finance') && x.Active__c);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE (Industry = 'Technology' OR Industry = 'Finance') AND Active__c = TRUE");
    });

    it('should handle multiple OR groups in AND', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => (x.Industry === 'Technology' || x.Industry === 'Finance') && (x.Type === 'Customer' || x.Type === 'Partner'));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE (Industry = 'Technology' OR Industry = 'Finance') AND (Type = 'Customer' OR Type = 'Partner')");
    });

    it('should handle nested AND inside OR', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology' || (x.Industry === 'Finance' && x.Active__c));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' OR (Industry = 'Finance' AND Active__c = TRUE)");
    });

    it('should handle complex three-level nesting', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && ((x.Industry === 'Technology' && x.AnnualRevenue > 1000000) || x.Rating === 'Hot'));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Active__c = TRUE AND ((Industry = 'Technology' AND AnnualRevenue > 1000000) OR Rating = 'Hot')");
    });

    it('should handle OR group with negated boolean', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => (x.Industry === 'Technology' || !x.Active__c) && x.Type === 'Customer');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE (Industry = 'Technology' OR Active__c = FALSE) AND Type = 'Customer'");
    });

    it('should handle multiple conditions with mixed operators in groups', () => {
      const minRevenue = 500000;
      const maxRevenue = 5000000;
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && (x.AnnualRevenue > minRevenue && x.AnnualRevenue < maxRevenue || x.Rating === 'Hot'));

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain('AnnualRevenue > 500000');
      expect(soql).toContain('AnnualRevenue < 5000000');
      expect(soql).toContain("Rating = 'Hot'");
    });

    it('should handle all OR conditions (no AND)', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry === 'Technology' || x.Industry === 'Finance' || x.Industry === 'Healthcare');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Industry = 'Technology' OR Industry = 'Finance' OR Industry = 'Healthcare'");
    });

    it('should handle all AND conditions (no OR)', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && x.Industry === 'Technology' && x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Active__c = TRUE AND Industry = 'Technology' AND AnnualRevenue > 1000000");
    });

    it('should handle parentheses with boolean fields only', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Active__c && (!x.Active__c || x.Active__c));

      const soql = query.toSOQL();
      expect(soql).toContain('Active__c = TRUE');
      expect(soql).toContain('Active__c = FALSE');
      expect(soql).toContain('OR');
    });

    it('should handle deeply nested groups', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => (x.Industry === 'Technology' || x.Industry === 'Finance') && (x.Type === 'Customer' || (x.Type === 'Partner' && x.Active__c)));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE (Industry = 'Technology' OR Industry = 'Finance') AND (Type = 'Customer' OR (Type = 'Partner' AND Active__c = TRUE))");
    });
  });
});
