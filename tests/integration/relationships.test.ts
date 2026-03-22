import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

/**
 * Integration tests for relationship queries (subqueries)
 * Tests the lambda-based subquery syntax
 */
describe('Relationship/Subquery Integration Tests', () => {
  describe('Basic relationship queries', () => {
    it('should select parent with child relationship', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({
            Id: c.Id,
            Name: c.Name
          }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Id, Name, (SELECT Id, Name FROM Contacts) FROM Account');
    });

    it('should select multiple fields in child relationship', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({
            Id: c.Id,
            Name: c.Name,
            Email: c.Email,
            Phone: c.Phone
          }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Id, Name, Email, Phone FROM Contacts) FROM Account');
    });

    it('should select parent fields with empty child selection', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Contacts: x.Contacts.select(c => ({ Id: c.Id }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Id, Name, Industry, (SELECT Id FROM Contacts) FROM Account');
    });
  });

  describe('Multiple relationship queries', () => {
    it('should select multiple child relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({
            Name: c.Name,
            Email: c.Email
          })),
          Opportunities: x.Opportunities.select(o => ({
            Name: o.Name,
            Amount: o.Amount
          }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Name, Email FROM Contacts), (SELECT Name, Amount FROM Opportunities) FROM Account');
    });

    it('should mix regular fields with multiple relationships', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Revenue: x.AnnualRevenue,
          Contacts: x.Contacts.select(c => ({ Id: c.Id, Name: c.Name })),
          Opportunities: x.Opportunities.select(o => ({ Id: o.Id, Name: o.Name, StageName: o.StageName }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Id, Name, Industry, AnnualRevenue, (SELECT Id, Name FROM Contacts), (SELECT Id, Name, StageName FROM Opportunities) FROM Account');
    });
  });

  describe('Relationships with WHERE clauses', () => {
    it('should apply WHERE to parent object', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name }))
        }))
        .where(x => x.Industry === 'Technology');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name FROM Contacts) FROM Account WHERE Industry = 'Technology'");
    });

    it('should apply multiple WHERE clauses with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name, Email: c.Email }))
        }))
        .where(x => x.Industry === 'Technology')
        .where(x => x.AnnualRevenue > 1000000);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Email FROM Contacts) FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000");
    });
  });

  describe('Relationships with ORDER BY', () => {
    it('should order parent objects with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name }))
        }))
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Name FROM Contacts) FROM Account ORDER BY Name ASC');
    });

    it('should order by different field than selected with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name }))
        }))
        .orderBy(x => x.AnnualRevenue, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Name FROM Contacts) FROM Account ORDER BY AnnualRevenue DESC');
    });
  });

  describe('Relationships with LIMIT and OFFSET', () => {
    it('should apply LIMIT to parent query with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name }))
        }))
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Name FROM Contacts) FROM Account LIMIT 10');
    });

    it('should apply LIMIT and OFFSET with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name, Email: c.Email }))
        }))
        .limit(20)
        .offset(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Name, Email FROM Contacts) FROM Account LIMIT 20 OFFSET 10');
    });
  });

  describe('Complete relationship queries', () => {
    it('should combine relationships with all query clauses', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Contacts: x.Contacts.select(c => ({
            Id: c.Id,
            Name: c.Name,
            Email: c.Email
          }))
        }))
        .where(x => x.Industry === 'Technology')
        .where(x => x.AnnualRevenue > 1000000)
        .orderBy(x => x.Name, 'ASC')
        .limit(25)
        .offset(0);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry, (SELECT Id, Name, Email FROM Contacts) FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 ORDER BY Name ASC LIMIT 25 OFFSET 0");
    });

    it('should handle multiple relationships with all clauses', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          City: x.BillingAddress.City,
          Contacts: x.Contacts.select(c => ({ Name: c.Name })),
          Opportunities: x.Opportunities.select(o => ({ Name: o.Name, Amount: o.Amount }))
        }))
        .where(x => x.BillingAddress.State === 'CA')
        .where(x => x.Active__c === true)
        .orderBy(x => x.Name, 'DESC')
        .limit(50);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, BillingAddress.City, (SELECT Name FROM Contacts), (SELECT Name, Amount FROM Opportunities) FROM Account WHERE BillingAddress.State = 'CA' AND Active__c = TRUE ORDER BY Name DESC LIMIT 50");
    });
  });

  describe('Nested properties in parent with relationships', () => {
    it('should select nested parent properties with child relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          BillingCity: x.BillingAddress.City,
          BillingState: x.BillingAddress.State,
          Contacts: x.Contacts.select(c => ({ Name: c.Name }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, BillingAddress.City, BillingAddress.State, (SELECT Name FROM Contacts) FROM Account');
    });

    it('should filter by nested parent property with relationships', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name, Email: c.Email }))
        }))
        .where(x => x.BillingAddress.City === 'San Francisco');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Email FROM Contacts) FROM Account WHERE BillingAddress.City = 'San Francisco'");
    });
  });

  describe('Realistic business scenarios with relationships', () => {
    it('should query tech companies with their contacts', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Industry: x.Industry,
          Revenue: x.AnnualRevenue,
          Contacts: x.Contacts.select(c => ({
            Id: c.Id,
            Name: c.Name,
            Email: c.Email,
            Title: c.Title
          }))
        }))
        .where(x => x.Industry === 'Technology')
        .where(x => x.AnnualRevenue > 5000000)
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(25);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Id, Name, Industry, AnnualRevenue, (SELECT Id, Name, Email, Title FROM Contacts) FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 5000000 ORDER BY AnnualRevenue DESC LIMIT 25");
    });

    it('should query accounts with both contacts and opportunities', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Type: x.Type,
          Contacts: x.Contacts.select(c => ({
            Name: c.Name,
            Email: c.Email,
            Active__c: c.Active__c
          })),
          Opportunities: x.Opportunities.select(o => ({
            Name: o.Name,
            Amount: o.Amount,
            StageName: o.StageName,
            CloseDate: o.CloseDate
          }))
        }))
        .where(x => x.Type === 'Customer')
        .where(x => x.Active__c === true)
        .orderBy(x => x.Name, 'ASC')
        .limit(100);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Type, (SELECT Name, Email, Active__c FROM Contacts), (SELECT Name, Amount, StageName, CloseDate FROM Opportunities) FROM Account WHERE Type = 'Customer' AND Active__c = TRUE ORDER BY Name ASC LIMIT 100");
    });
  });

  describe('Relationship field ordering', () => {
    it('should maintain field order in subquery', () => {
      const query = Account
        .select(x => ({
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({
            Id: c.Id,
            Name: c.Name,
            Email: c.Email,
            Phone: c.Phone,
            Title: c.Title,
            Active__c: c.Active__c
          }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, (SELECT Id, Name, Email, Phone, Title, Active__c FROM Contacts) FROM Account');
    });
  });

  describe('Mixed relationship and regular field positions', () => {
    it('should allow relationship in the middle of regular fields', () => {
      const query = Account
        .select(x => ({
          Id: x.Id,
          Name: x.Name,
          Contacts: x.Contacts.select(c => ({ Name: c.Name })),
          Industry: x.Industry,
          Revenue: x.AnnualRevenue
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Id, Name, (SELECT Name FROM Contacts), Industry, AnnualRevenue FROM Account');
    });

    it('should allow relationships at start and end', () => {
      const query = Account
        .select(x => ({
          Contacts: x.Contacts.select(c => ({ Name: c.Name })),
          Name: x.Name,
          Industry: x.Industry,
          Opportunities: x.Opportunities.select(o => ({ Name: o.Name }))
        }));

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT (SELECT Name FROM Contacts), Name, Industry, (SELECT Name FROM Opportunities) FROM Account');
    });
  });

  describe('Subquery filtering with closure variables', () => {
    it('should filter subquery with simple closure variable', () => {
      const activeStatus = true;
      const query = Account
        .select(x => ({
          Name: x.Name,
          ActiveContacts: x.Contacts.select(c => ({ Name: c.Name })).where(c => c.Active__c === activeStatus)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name FROM Contacts WHERE Active__c = TRUE) FROM Account");
    });

    it('should filter subquery with object property closure variable', () => {
      const filters = { minAmount: 50000, stage: 'Closed Won' };
      const query = Account
        .select(x => ({
          Name: x.Name,
          BigOpportunities: x.Opportunities.select(o => ({ Name: o.Name, Amount: o.Amount }))
            .where(o => o.Amount > filters.minAmount)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Amount FROM Opportunities WHERE Amount > 50000) FROM Account");
    });

    it('should filter subquery with nested object property closure variable', () => {
      const config = {
        contacts: {
          filters: {
            title: 'VP Sales'
          }
        }
      };
      const query = Account
        .select(x => ({
          Name: x.Name,
          VPContacts: x.Contacts.select(c => ({ Name: c.Name, Title: c.Title }))
            .where(c => c.Title === config.contacts.filters.title)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Title FROM Contacts WHERE Title = 'VP Sales') FROM Account");
    });

    it('should filter subquery with multiple closure variables', () => {
      const minAmount = 100000;
      const stage = 'Prospecting';
      const query = Account
        .select(x => ({
          Name: x.Name,
          FilteredOpps: x.Opportunities.select(o => ({ Name: o.Name }))
            .where(o => o.Amount > minAmount && o.StageName === stage)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name FROM Opportunities WHERE Amount > 100000 AND StageName = 'Prospecting') FROM Account");
    });

    it('should filter subquery with OR conditions using closure variables', () => {
      const title1 = 'VP Sales';
      const title2 = 'VP Marketing';
      const query = Account
        .select(x => ({
          Name: x.Name,
          VPContacts: x.Contacts.select(c => ({ Name: c.Name }))
            .where(c => c.Title === title1 || c.Title === title2)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name FROM Contacts WHERE Title = 'VP Sales' OR Title = 'VP Marketing') FROM Account");
    });

    it('should filter subquery with mixed literals and closure variables', () => {
      const minAmount = 75000;
      const query = Account
        .select(x => ({
          Name: x.Name,
          QualifiedOpps: x.Opportunities.select(o => ({ Name: o.Name, Amount: o.Amount }))
            .where(o => o.StageName === 'Qualification' && o.Amount >= minAmount)
        }));

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Amount FROM Opportunities WHERE StageName = 'Qualification' AND Amount >= 75000) FROM Account");
    });

    it('should support multiple subqueries with different closure filters', () => {
      const activeStatus = true;
      const minOppAmount = 50000;
      const query = Account
        .select(x => ({
          Name: x.Name,
          ActiveContacts: x.Contacts.select(c => ({ Name: c.Name }))
            .where(c => c.Active__c === activeStatus),
          BigOpportunities: x.Opportunities.select(o => ({ Name: o.Name, Amount: o.Amount }))
            .where(o => o.Amount > minOppAmount)
        }));

      const soql = query.toSOQL();
      expect(soql).toContain("(SELECT Name FROM Contacts WHERE Active__c = TRUE)");
      expect(soql).toContain("(SELECT Name, Amount FROM Opportunities WHERE Amount > 50000)");
    });

    it('should combine subquery filter with parent where clause using closures', () => {
      const activeStatus = true;
      const industry = 'Technology';
      const query = Account
        .select(x => ({
          Name: x.Name,
          ActiveContacts: x.Contacts.select(c => ({ Name: c.Name, Email: c.Email }))
            .where(c => c.Active__c === activeStatus)
        }))
        .where(x => x.Industry === industry);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, (SELECT Name, Email FROM Contacts WHERE Active__c = TRUE) FROM Account WHERE Industry = 'Technology'");
    });
  });
});
