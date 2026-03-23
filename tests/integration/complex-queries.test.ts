import { describe, it, expect } from 'vitest';
import { Account, Contact, Opportunity } from '../fixtures/TestModels';

/**
 * Integration tests for complex query combinations
 * These tests ensure that all query methods work together correctly
 */
describe('Complex Query Integration Tests', () => {
  describe('Multi-clause queries', () => {
    it('should combine SELECT + WHERE + ORDER BY + LIMIT', () => {
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry FROM Account WHERE Industry = 'Technology' ORDER BY Name ASC LIMIT 10");
    });

    it('should combine SELECT + multiple WHERE + ORDER BY + LIMIT + OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Revenue: x.AnnualRevenue }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000 && x.Active__c === true)
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(25)
        .offset(50);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, AnnualRevenue FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 AND Active__c = TRUE ORDER BY AnnualRevenue DESC LIMIT 25 OFFSET 50");
    });

    it('should combine nested WHERE conditions with other clauses', () => {
      const query = Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .where(x => x.Industry === 'Technology' || x.Industry === 'Finance')
        .orderBy(x => x.BillingAddress.City, 'ASC')
        .limit(100);

      const soql = query.toSOQL();
      expect(soql).toContain("Industry = 'Technology' OR Industry = 'Finance'");
      expect(soql).toContain('ORDER BY BillingAddress.City ASC');
      expect(soql).toContain('LIMIT 100');
    });
  });

  describe('Nested properties in complex queries', () => {
    it('should handle nested properties across all clauses', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Street: x.BillingAddress.Street,
          City: x.BillingAddress.City,
          State: x.BillingAddress.State
        }))
        .where(x => x.BillingAddress.State === 'CA')
        .where(x => x.BillingAddress.City !== 'Los Angeles')
        .orderBy(x => x.BillingAddress.City, 'ASC')
        .limit(50);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, BillingAddress.Street, BillingAddress.City, BillingAddress.State FROM Account WHERE BillingAddress.State = 'CA' AND BillingAddress.City != 'Los Angeles' ORDER BY BillingAddress.City ASC LIMIT 50");
    });

    it('should mix regular and nested properties in filters', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Industry: x.Industry,
          City: x.BillingAddress.City,
          ShippingCity: x.ShippingAddress.City
        }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toContain('Industry = \'Technology\'');
      expect(soql).toContain('AnnualRevenue > 1000000');
    });
  });

  describe('String method queries', () => {
    it('should combine multiple string methods with other conditions', () => {
      const prefix = 'Acme';
      const searchTerm = 'Corp';

      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.startsWith(prefix))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC')
        .limit(20);

      const soql = query.toSOQL();
      expect(soql).toContain("Name LIKE 'Acme%'");
      expect(soql).toContain("Industry = 'Technology'");
    });
  });

  describe('Comparison operator combinations', () => {
    it('should handle range queries with >= and <=', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Employees: x.NumberOfEmployees }))
        .where(x => x.NumberOfEmployees >= 100 && x.NumberOfEmployees <= 1000 && x.AnnualRevenue >= 1000000 && x.AnnualRevenue <= 10000000)
        .orderBy(x => x.NumberOfEmployees, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, NumberOfEmployees FROM Account WHERE NumberOfEmployees >= 100 AND NumberOfEmployees <= 1000 AND AnnualRevenue >= 1000000 AND AnnualRevenue <= 10000000 ORDER BY NumberOfEmployees ASC');
    });

    it('should handle NOT EQUAL with other conditions', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry !== 'Government')
        .where(x => x.Rating !== 'Cold')
        .where(x => x.AnnualRevenue > 0)
        .limit(100);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Industry FROM Account WHERE Industry != 'Government' AND Rating != 'Cold' AND AnnualRevenue > 0 LIMIT 100");
    });
  });

  describe('Boolean field combinations', () => {
    it('should combine multiple boolean conditions', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Active: x.Active__c }))
        .where(x => x.Active__c === true)
        .where(x => x.AnnualRevenue > 0)
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Active__c FROM Account WHERE Active__c = TRUE AND AnnualRevenue > 0 ORDER BY Name ASC');
    });
  });

  describe('Field ordering different from select', () => {
    it('should allow ordering by field not in SELECT', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' ORDER BY AnnualRevenue DESC LIMIT 10");
    });

    it('should filter and order by different nested properties', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.BillingAddress.State === 'CA')
        .orderBy(x => x.BillingAddress.City, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE BillingAddress.State = 'CA' ORDER BY BillingAddress.City ASC");
    });
  });

  describe('Different object type complex queries', () => {
    it('should work with Contact complex queries', () => {
      const query = Contact
        .select(x => ({ Name: x.Name, Email: x.Email, Phone: x.Phone }))
        .where(x => x.Active__c === true)
        .where(x => x.Email.includes('@example.com'))
        .orderBy(x => x.Name, 'ASC')
        .limit(50)
        .offset(25);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Email, Phone FROM Contact WHERE Active__c = TRUE AND Email LIKE '%@example.com%' ORDER BY Name ASC LIMIT 50 OFFSET 25");
    });
  });

  describe('Realistic business scenarios', () => {
    it('should handle high-value tech accounts query', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Revenue: x.AnnualRevenue,
          City: x.BillingAddress.City
        }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue >= 10000000 && x.Active__c === true)
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(25);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry, AnnualRevenue, BillingAddress.City FROM Account WHERE Industry = 'Technology' AND AnnualRevenue >= 10000000 AND Active__c = TRUE ORDER BY AnnualRevenue DESC LIMIT 25");
    });
  });

  describe('Method chaining order independence', () => {
    it('should produce same SOQL regardless of where/orderBy/limit order', () => {
      const query1 = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC')
        .limit(10);

      const query2 = Account
        .select(x => ({ Name: x.Name }))
        .limit(10)
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC');

      const query3 = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10)
        .where(x => x.Industry === 'Technology');

      const expectedSOQL = "SELECT Name FROM Account WHERE Industry = 'Technology' ORDER BY Name ASC LIMIT 10";

      expect(query1.toSOQL()).toBe(expectedSOQL);
      expect(query2.toSOQL()).toBe(expectedSOQL);
      expect(query3.toSOQL()).toBe(expectedSOQL);
    });
  });

  describe('WHERE IN clause integration', () => {
    it('should combine WHERE IN with ORDER BY and LIMIT', () => {
      const industries = ['Technology', 'Finance', 'Healthcare'];
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry.includes(industries))
        .orderBy(x => x.Name, 'ASC')
        .limit(50);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry FROM Account WHERE Industry IN ('Technology', 'Finance', 'Healthcare') ORDER BY Name ASC LIMIT 50");
    });

    it('should combine WHERE IN with multiple WHERE clauses using AND', () => {
      const industries = ['Technology', 'Finance'];
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry, Revenue: x.AnnualRevenue }))
        .where(x => x.Industry.includes(industries))
        .where(x => x.AnnualRevenue > 1000000)
        .where(x => x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Industry, AnnualRevenue FROM Account WHERE Industry IN ('Technology', 'Finance') AND AnnualRevenue > 1000000 AND Active__c = TRUE");
    });

    it('should combine WHERE IN with OR conditions inside single where clause', () => {
      const industries = ['Technology', 'Finance'];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries) || x.AnnualRevenue > 10000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance') OR AnnualRevenue > 10000000");
    });

    it('should handle multiple WHERE IN clauses combined with AND', () => {
      const industries = ['Technology', 'Finance'];
      const ratings = ['Hot', 'Warm'];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries) && x.Rating.includes(ratings));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance') AND Rating IN ('Hot', 'Warm')");
    });

    it('should combine WHERE IN with complex nested conditions', () => {
      const industries = ['Technology', 'Finance', 'Healthcare'];
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry }))
        .where(x =>
          (x.Industry.includes(industries) && x.AnnualRevenue > 5000000) ||
          (x.Rating === 'Hot' && x.Active__c === true)
        );

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Industry FROM Account WHERE (Industry IN ('Technology', 'Finance', 'Healthcare') AND AnnualRevenue > 5000000) OR (Rating = 'Hot' AND Active__c = TRUE)");
    });

    it('should combine WHERE IN with nested properties', () => {
      const states = ['CA', 'NY', 'TX'];
      const query = Account
        .select(x => ({ Name: x.Name, State: x.BillingAddress.State }))
        .where(x => x.BillingAddress.State.includes(states))
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, BillingAddress.State FROM Account WHERE BillingAddress.State IN ('CA', 'NY', 'TX') ORDER BY Name ASC");
    });

    it('should handle WHERE IN across full query chain', () => {
      const industries = ['Technology', 'Finance'];
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Revenue: x.AnnualRevenue,
          City: x.BillingAddress.City
        }))
        .where(x => x.Industry.includes(industries))
        .where(x => x.AnnualRevenue >= 10000000)
        .where(x => x.Active__c === true)
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(25)
        .offset(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry, AnnualRevenue, BillingAddress.City FROM Account WHERE Industry IN ('Technology', 'Finance') AND AnnualRevenue >= 10000000 AND Active__c = TRUE ORDER BY AnnualRevenue DESC LIMIT 25 OFFSET 10");
    });

    it('should handle WHERE IN with numeric arrays in complex queries', () => {
      const employeeCounts = [100, 500, 1000, 5000];
      const query = Account
        .select(x => ({ Name: x.Name, Employees: x.NumberOfEmployees }))
        .where(x => x.NumberOfEmployees.includes(employeeCounts) && x.Active__c === true)
        .orderBy(x => x.NumberOfEmployees, 'DESC')
        .limit(100);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, NumberOfEmployees FROM Account WHERE NumberOfEmployees IN (100, 500, 1000, 5000) AND Active__c = TRUE ORDER BY NumberOfEmployees DESC LIMIT 100");
    });

    it('should preserve order independence with WHERE IN', () => {
      const industries = ['Technology', 'Finance'];

      const query1 = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries))
        .orderBy(x => x.Name, 'ASC')
        .limit(10);

      const query2 = Account
        .select(x => ({ Name: x.Name }))
        .limit(10)
        .where(x => x.Industry.includes(industries))
        .orderBy(x => x.Name, 'ASC');

      const query3 = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10)
        .where(x => x.Industry.includes(industries));

      const expectedSOQL = "SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance') ORDER BY Name ASC LIMIT 10";

      expect(query1.toSOQL()).toBe(expectedSOQL);
      expect(query2.toSOQL()).toBe(expectedSOQL);
      expect(query3.toSOQL()).toBe(expectedSOQL);
    });
  });
});
