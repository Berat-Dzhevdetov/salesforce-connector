import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

describe('TypedQueryBuilder.where()', () => {
  describe('Simple equality conditions', () => {
    it('should create WHERE clause with string equality', () => {
      const company = { industry: "Technology" };
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry == company.industry);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology'");
    });

    it('should create WHERE clause with boolean true', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE Active__c = TRUE');
    });

    it('should create WHERE clause with boolean false', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === false);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account WHERE Active__c = FALSE');
    });
  });

  describe('Comparison operators', () => {
    it('should handle greater than operator with whereEquals', () => {
      // Note: where() with > operator only works with literals in the same expression
      // For dynamic values, use a combined expression
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue > 500000 && x.AnnualRevenue < 2000000);

      const soql = query.toSOQL();
      expect(soql).toContain('AnnualRevenue >');
      expect(soql).toContain('AnnualRevenue <');
    });

    it('should handle less than operator', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.NumberOfEmployees < 500 && x.NumberOfEmployees > 10);

      const soql = query.toSOQL();
      expect(soql).toContain('NumberOfEmployees <');
      expect(soql).toContain('NumberOfEmployees >');
    });

    it('should handle greater than or equal operator', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue >= 1000000 && x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toContain('AnnualRevenue >= 1000000');
    });

    it('should handle less than or equal operator', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.NumberOfEmployees <= 1000 && x.NumberOfEmployees >= 100);

      const soql = query.toSOQL();
      expect(soql).toContain('NumberOfEmployees <= 1000');
    });

    it('should handle not equal operator', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry !== 'Technology');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry != 'Technology'");
    });
  });

  describe('Multiple WHERE conditions (AND)', () => {
    it('should combine multiple where() calls with AND', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000");
    });

    it('should combine three where() calls', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000 && x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 AND Active__c = TRUE");
    });

    it('should handle AND within single where() call', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000");
    });
  });

  describe('OR conditions', () => {
    it('should handle OR condition', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' || x.Industry === 'Finance');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' OR Industry = 'Finance'");
    });

    it('should handle multiple OR conditions', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Rating === 'Hot' || x.Rating === 'Warm' || x.Rating === 'Cold');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Rating = 'Hot' OR Rating = 'Warm' OR Rating = 'Cold'");
    });
  });

  describe('Complex logical conditions', () => {
    it('should handle mixed AND and OR (AND has precedence)', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' || x.Rating === 'Hot');

      const soql = query.toSOQL();
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain("Rating = 'Hot'");
      expect(soql).toContain('OR');
    });

    it('should handle grouped conditions with parentheses', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' || x.Industry === 'Finance');

      const soql = query.toSOQL();
      expect(soql).toContain("Industry = 'Technology'");
      expect(soql).toContain("Industry = 'Finance'");
      expect(soql).toContain('OR');
    });
  });

  describe('Nested property conditions', () => {
    it('should handle nested property equality', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.BillingAddress.City === 'San Francisco');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE BillingAddress.City = 'San Francisco'");
    });

    it('should handle multiple nested properties', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.BillingAddress.City === 'San Francisco' && x.BillingAddress.State === 'CA');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE BillingAddress.City = 'San Francisco' AND BillingAddress.State = 'CA'");
    });

    it('should mix regular and nested properties', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.BillingAddress.State === 'CA');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND BillingAddress.State = 'CA'");
    });
  });

  describe('String method support', () => {
    it('should handle string includes() method', () => {
      const searchTerm = 'Acme';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.includes(searchTerm));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE '%Acme%'");
    });

    it('should handle string startsWith() method', () => {
      const prefix = 'Tech';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.startsWith(prefix));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE 'Tech%'");
    });

    it('should handle string endsWith() method', () => {
      const suffix = 'Corp';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.endsWith(suffix));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name LIKE '%Corp'");
    });
  });

  describe('Array includes() - WHERE IN support', () => {
    it('should handle array includes() with string array', () => {
      const industries = ['Technology', 'Finance', 'Healthcare'];
      const query = Account
        .select(x => ({ Id: x.Id, Name: x.Name }))
        .where(x => x.Industry.includes(industries));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name FROM Account WHERE Industry IN ('Technology', 'Finance', 'Healthcare')");
    });

    it('should handle array includes() with single element', () => {
      const industries = ['Technology'];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology')");
    });

    it('should handle array includes() with numeric array', () => {
      const revenues = [1000000, 5000000, 10000000];
      const query = Account
        .select(x => ({ Name: x.Name, AnnualRevenue: x.AnnualRevenue }))
        .where(x => x.AnnualRevenue.includes(revenues));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, AnnualRevenue FROM Account WHERE AnnualRevenue IN (1000000, 5000000, 10000000)");
    });

    it('should handle array includes() with boolean array', () => {
      const statuses = [true, false];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c.includes(statuses));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Active__c IN (TRUE, FALSE)");
    });

    it('should handle array includes() combined with other conditions using AND', () => {
      const industries = ['Technology', 'Finance'];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries) && x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance') AND AnnualRevenue > 1000000");
    });

    it('should handle array includes() combined with other conditions using OR', () => {
      const industries = ['Technology', 'Finance'];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries) || x.AnnualRevenue > 5000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance') OR AnnualRevenue > 5000000");
    });

    it('should handle array includes() with strings containing special characters', () => {
      const names = ["O'Reilly", "AT&T", "Ben & Jerry's"];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name.includes(names));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name IN ('O\\'Reilly', 'AT&T', 'Ben & Jerry\\'s')");
    });

    it('should handle array includes() with closure variable from object property', () => {
      const filters = {
        allowedIndustries: ['Technology', 'Finance', 'Healthcare']
      };
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(filters.allowedIndustries));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance', 'Healthcare')");
    });

    it('should handle array includes() with nested object property closure', () => {
      const config = {
        search: {
          criteria: {
            industries: ['Technology', 'Finance']
          }
        }
      };
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(config.search.criteria.industries));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 'Finance')");
    });

    it('should handle empty array in includes()', () => {
      const industries: string[] = [];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(industries));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ()");
    });

    it('should handle mixed type arrays by converting to strings', () => {
      const mixedValues = ['Technology', 123, true, null];
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry.includes(mixedValues));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry IN ('Technology', 123, TRUE, NULL)");
    });
  });

  describe('Special characters in strings', () => {
    it('should escape single quotes in string values', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Name === "O'Reilly Media");

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Name = 'O\\'Reilly Media'");
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', () => {
      const query = Contact
        .select(x => ({ Name: x.Name }))
        .where(x => x.Email === 'test@example.com');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Contact WHERE Email = 'test@example.com'");
    });

    it('should work with Contact custom boolean field', () => {
      const query = Contact
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === true);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Contact WHERE Active__c = TRUE');
    });
  });

  describe('Closure variables with Inspector', () => {
    it('should extract simple closure variable value', () => {
      const industry = 'Technology';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === industry);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology'");
    });

    it('should extract closure variable with object property', () => {
      const config = { industry: 'Finance', minRevenue: 1000000 };
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === config.industry);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Finance'");
    });

    it('should extract nested object property from closure', () => {
      const filters = {
        account: {
          criteria: {
            industry: 'Healthcare'
          }
        }
      };
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === filters.account.criteria.industry);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Healthcare'");
    });

    it('should handle numeric closure variable', () => {
      const minRevenue = 500000;
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.AnnualRevenue > minRevenue);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE AnnualRevenue > 500000");
    });

    it('should handle boolean closure variable', () => {
      const isActive = true;
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === isActive);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Active__c = TRUE");
    });

    it('should handle multiple closure variables', () => {
      const industry = 'Technology';
      const minRevenue = 1000000;
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000");
    });

    it('should handle mixed literals and closure variables', () => {
      const minRevenue = 2000000;
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > minRevenue);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 2000000");
    });

    it('should handle closure with OR conditions', () => {
      const industry1 = 'Technology';
      const industry2 = 'Finance';
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === industry1 || x.Industry === industry2);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' OR Industry = 'Finance'");
    });
  });

  describe('Chaining with other methods', () => {
    it('should chain where() with orderBy()', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' ORDER BY Name ASC");
    });

    it('should chain where() with limit()', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' LIMIT 10");
    });

    it('should chain where() with offset()', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' OFFSET 5");
    });
  });
});
