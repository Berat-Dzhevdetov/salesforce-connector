import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

/**
 * Edge case tests for Lambda Model
 * Tests unusual inputs, special characters, null values, etc.
 */
describe('Edge Cases and Special Scenarios', () => {
  describe('Special characters in values', () => {
    it('should escape single quotes in string values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === "O'Reilly Media");

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = 'O\\'Reilly Media'");
    });

    it('should handle unicode characters', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === 'Café François');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = 'Café François'");
    });

    it('should handle emojis in values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === 'Company 🚀');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = 'Company 🚀'");
    });
  });

  describe('Empty and null values', () => {
    it('should handle empty string in where clause', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === '');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = ''");
    });
  });

  describe('Zero and boundary values', () => {
    it('should handle zero in numeric comparison', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue === 0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE AnnualRevenue = 0');
    });

    it('should handle very large numbers', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue > 999999999999);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE AnnualRevenue > 999999999999');
    });
  });

  describe('Very long strings', () => {
    it('should handle very long field selections', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Type: x.Type,
          Rating: x.Rating,
          Active__c: x.Active__c,
          AnnualRevenue: x.AnnualRevenue,
          NumberOfEmployees: x.NumberOfEmployees,
          BillingStreet: x.BillingAddress.Street,
          BillingCity: x.BillingAddress.City,
          BillingState: x.BillingAddress.State,
          BillingPostalCode: x.BillingAddress.PostalCode,
          ShippingStreet: x.ShippingAddress.Street,
          ShippingCity: x.ShippingAddress.City
        }));

      const soql = query.toSOQL();
      expect(soql).toContain('SELECT Id, Name, Industry, Type, Rating, Active__c, AnnualRevenue, NumberOfEmployees');
      expect(soql).toContain('BillingAddress.Street');
      expect(soql).toContain('ShippingAddress.City');
    });
  });

  describe('Case sensitivity', () => {
    it('should preserve case in field names', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Active__c: x.Active__c }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Active__c FROM Account');
    });

    it('should preserve case in string values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology');

      const soql = query.toSOQL();
      expect(soql).toContain("'Technology'");
      expect(soql).not.toContain("'technology'");
    });
  });

  describe('Boolean edge cases', () => {
    it('should handle boolean true explicitly', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE Active__c = TRUE');
    });

    it('should handle boolean false explicitly', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === false);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE Active__c = FALSE');
    });
  });

  describe('LIMIT and OFFSET boundary values', () => {
    it('should handle LIMIT 0', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 0');
    });

    it('should handle LIMIT 1', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(1);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 1');
    });

    it('should handle very large LIMIT', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(50000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 50000');
    });

    it('should handle OFFSET 0', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 0');
    });

    it('should handle very large OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(100000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 100000');
    });
  });

  describe('Multiple operators on same field', () => {
    it('should handle range queries (>= and <=)', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue >= 1000000 && x.AnnualRevenue <= 10000000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE AnnualRevenue >= 1000000 AND AnnualRevenue <= 10000000');
    });

    it('should handle multiple conditions on same field', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.NumberOfEmployees > 100 && x.NumberOfEmployees < 1000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE NumberOfEmployees > 100 AND NumberOfEmployees < 1000');
    });
  });

  describe('Whitespace handling', () => {
    it('should handle leading whitespace in values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === '  Leading Space');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = '  Leading Space'");
    });

    it('should handle trailing whitespace in values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === 'Trailing Space  ');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = 'Trailing Space  '");
    });
  });

  describe('String method edge cases', () => {
    it('should handle includes with empty string', () => {
      const searchTerm = '';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.includes(searchTerm));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE '%%'");
    });

    it('should handle startsWith with single character', () => {
      const prefix = 'A';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.startsWith(prefix));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE 'A%'");
    });

    it('should handle endsWith with single character', () => {
      const suffix = 'Z';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.endsWith(suffix));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE '%Z'");
    });

    it('should handle includes with special characters', () => {
      const searchTerm = "Test";
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.includes(searchTerm));

      const soql = query.toSOQL();
      expect(soql).toContain("LIKE '%Test%'");
    });
  });

  describe('Deeply nested properties', () => {
    it('should handle 2-level nested properties', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          City: x.BillingAddress.City
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, BillingAddress.City FROM Account');
    });

    it('should handle multiple nested properties from same parent', () => {
      const query = Account
        .select(x => ({
          BillingStreet: x.BillingAddress.Street,
          BillingCity: x.BillingAddress.City,
          BillingState: x.BillingAddress.State,
          BillingPostal: x.BillingAddress.PostalCode,
          BillingCountry: x.BillingAddress.Country
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT BillingAddress.Street, BillingAddress.City, BillingAddress.State, BillingAddress.PostalCode, BillingAddress.Country FROM Account');
    });
  });

  describe('Query builder reuse', () => {
    it('should allow building multiple queries from same select', () => {
      const query1 = Account.select(x => ({ Name: x.Name, Industry: x.Industry })).where(x => x.Industry === 'Technology');
      const query2 = Account.select(x => ({ Name: x.Name, Industry: x.Industry })).where(x => x.Industry === 'Finance');

      const soql1 = query1.toSOQL();
      const soql2 = query2.toSOQL();

      expect(soql1).toBe("SELECT Name, Industry FROM Account WHERE Industry = 'Technology'");
      expect(soql2).toBe("SELECT Name, Industry FROM Account WHERE Industry = 'Finance'");
    });
  });

  describe('Object type variations', () => {
    it('should work with Contact edge cases', () => {
      const query = Contact
        .select(x => ({ Email: x.Email }))
        .where(x => x.Email.includes('@'))
        .where(x => x.Active__c === true)
        .orderBy(x => x.Name, 'ASC')
        .limit(0);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Email FROM Contact WHERE Email LIKE '%@%' AND Active__c = TRUE ORDER BY Name ASC LIMIT 0");
    });
  });
});
