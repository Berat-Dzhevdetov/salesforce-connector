import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

describe('LambdaModel.select()', () => {
  describe('Basic field selection', () => {
    it('should select a single field', () => {
      const query = Account.select(x => ({ Name: x.Name }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Name FROM Account');
    });

    it('should select multiple fields', () => {
      const query = Account.select(x => ({
        Id: x.Id,
        Name: x.Name,
        Industry: x.Industry
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Id, Name, Industry FROM Account');
    });

    it('should select all common fields', () => {
      const query = Account.select(x => ({
        Id: x.Id,
        Name: x.Name,
        Industry: x.Industry,
        Type: x.Type,
        AnnualRevenue: x.AnnualRevenue,
        NumberOfEmployees: x.NumberOfEmployees,
        Rating: x.Rating,
        Active__c: x.Active__c
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Id, Name, Industry, Type, AnnualRevenue, NumberOfEmployees, Rating, Active__c FROM Account');
    });
  });

  describe('Nested property selection', () => {
    it('should select a single nested property', () => {
      const query = Account.select(x => ({
        Street: x.BillingAddress.Street
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT BillingAddress.Street FROM Account');
    });

    it('should select multiple nested properties from same parent', () => {
      const query = Account.select(x => ({
        Street: x.BillingAddress.Street,
        City: x.BillingAddress.City,
        State: x.BillingAddress.State
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT BillingAddress.Street, BillingAddress.City, BillingAddress.State FROM Account');
    });

    it('should select nested properties from different parents', () => {
      const query = Account.select(x => ({
        BillingCity: x.BillingAddress.City,
        ShippingCity: x.ShippingAddress.City
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT BillingAddress.City, ShippingAddress.City FROM Account');
    });

    it('should mix regular and nested properties', () => {
      const query = Account.select(x => ({
        Id: x.Id,
        Name: x.Name,
        BillingCity: x.BillingAddress.City,
        ShippingStreet: x.ShippingAddress.Street
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Id, Name, BillingAddress.City, ShippingAddress.Street FROM Account');
    });
  });

  describe('Relationship (subquery) selection', () => {
    it('should select a simple relationship with basic fields', () => {
      const query = Account.select(x => ({
        Name: x.Name,
        Contacts: x.Contacts.select(c => ({
          Id: c.Id,
          Name: c.Name
        }))
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Name, (SELECT Id, Name FROM Contacts) FROM Account');
    });

    it('should select relationship with all contact fields', () => {
      const query = Account.select(x => ({
        Name: x.Name,
        Contacts: x.Contacts.select(c => ({
          Id: c.Id,
          Name: c.Name,
          Email: c.Email,
          Phone: c.Phone,
          Title: c.Title
        }))
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Name, (SELECT Id, Name, Email, Phone, Title FROM Contacts) FROM Account');
    });

    it('should select multiple relationships', () => {
      const query = Account.select(x => ({
        Name: x.Name,
        Contacts: x.Contacts.select(c => ({ Name: c.Name })),
        Opportunities: x.Opportunities.select(o => ({ Name: o.Name, Amount: o.Amount }))
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Name, (SELECT Name FROM Contacts), (SELECT Name, Amount FROM Opportunities) FROM Account');
    });
  });

  describe('Field aliasing in selection', () => {
    it('should allow aliasing fields with different names', () => {
      const query = Account.select(x => ({
        AccountName: x.Name,
        CompanyIndustry: x.Industry
      }));
      const soql = query.toSOQL();

      // Note: SOQL doesn't use aliases in SELECT, but the returned object will have these keys
      expect(soql).toBe('SELECT Name, Industry FROM Account');
    });

    it('should allow aliasing nested properties', () => {
      const query = Account.select(x => ({
        City: x.BillingAddress.City,
        MailingCity: x.ShippingAddress.City
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT BillingAddress.City, ShippingAddress.City FROM Account');
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', () => {
      const query = Contact.select(x => ({
        Id: x.Id,
        Name: x.Name,
        Email: x.Email
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Id, Name, Email FROM Contact');
    });

    it('should work with custom boolean fields', () => {
      const query = Account.select(x => ({
        Name: x.Name,
        Active__c: x.Active__c
      }));
      const soql = query.toSOQL();

      expect(soql).toBe('SELECT Name, Active__c FROM Account');
    });
  });

  describe('Method chaining readiness', () => {
    it('should return TypedQueryBuilder that can be chained', () => {
      const query = Account.select(x => ({ Name: x.Name }));

      expect(query).toHaveProperty('where');
      expect(query).toHaveProperty('orderBy');
      expect(query).toHaveProperty('limit');
      expect(query).toHaveProperty('offset');
      expect(query).toHaveProperty('toSOQL');
      expect(query).toHaveProperty('get');
      expect(query).toHaveProperty('first');
      expect(query).toHaveProperty('paginate');
    });

    it('should maintain query builder after selection', () => {
      const query = Account.select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology'");
    });
  });
});
