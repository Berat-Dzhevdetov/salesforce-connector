import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

describe('TypedQueryBuilder.orderBy()', () => {
  describe('Basic ordering', () => {
    it('should order by single field ascending', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC');
    });

    it('should order by single field descending', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name DESC');
    });

    it('should default to ASC when direction not specified', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC');
    });
  });

  describe('Different field types', () => {
    it('should order by string field', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry }))
        .orderBy(x => x.Industry, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Industry FROM Account ORDER BY Industry ASC');
    });

    it('should order by numeric field', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Revenue: x.AnnualRevenue }))
        .orderBy(x => x.AnnualRevenue, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, AnnualRevenue FROM Account ORDER BY AnnualRevenue DESC');
    });

    it('should order by boolean field', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Active: x.Active__c }))
        .orderBy(x => x.Active__c, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Active__c FROM Account ORDER BY Active__c ASC');
    });
  });

  describe('Nested property ordering', () => {
    it('should order by nested property', () => {
      const query = Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .orderBy(x => x.BillingAddress.City, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, BillingAddress.City FROM Account ORDER BY BillingAddress.City ASC');
    });

    it('should order by nested property descending', () => {
      const query = Account
        .select(x => ({ Name: x.Name, State: x.BillingAddress.State }))
        .orderBy(x => x.BillingAddress.State, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, BillingAddress.State FROM Account ORDER BY BillingAddress.State DESC');
    });
  });

  describe('Chaining with WHERE', () => {
    it('should combine where and orderBy', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' ORDER BY Name ASC");
    });

    it('should work with multiple where clauses', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000)
        .orderBy(x => x.Name, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 ORDER BY Name DESC");
    });
  });

  describe('Chaining with LIMIT and OFFSET', () => {
    it('should combine orderBy with limit', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC LIMIT 10');
    });

    it('should combine orderBy with offset', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC OFFSET 5');
    });

    it('should combine orderBy with limit and offset', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'DESC')
        .limit(20)
        .offset(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name DESC LIMIT 20 OFFSET 10');
    });
  });

  describe('Complex query combinations', () => {
    it('should combine all query clauses in correct order', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000)
        .orderBy(x => x.Name, 'ASC')
        .limit(10)
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Industry FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 ORDER BY Name ASC LIMIT 10 OFFSET 5");
    });

    it('should work with nested properties in where and orderBy', () => {
      const query = Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .where(x => x.BillingAddress.State === 'CA')
        .orderBy(x => x.BillingAddress.City, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, BillingAddress.City FROM Account WHERE BillingAddress.State = 'CA' ORDER BY BillingAddress.City ASC");
    });
  });

  describe('Different object types', () => {
    it('should work with Contact object', () => {
      const query = Contact
        .select(x => ({ Name: x.Name, Email: x.Email }))
        .orderBy(x => x.Name, 'ASC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Email FROM Contact ORDER BY Name ASC');
    });

    it('should work with Contact nested property', () => {
      const query = Contact
        .select(x => ({ Name: x.Name, Email: x.Email }))
        .where(x => x.Active__c === true)
        .orderBy(x => x.Email, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Email FROM Contact WHERE Active__c = TRUE ORDER BY Email DESC');
    });
  });

  describe('Ordering fields not in select', () => {
    it('should allow ordering by field not in select clause', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.AnnualRevenue, 'DESC');

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY AnnualRevenue DESC');
    });
  });

  describe('Multiple orderBy calls (last wins)', () => {
    it('should use the last orderBy when called multiple times', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .orderBy(x => x.Industry, 'DESC');

      const soql = query.toSOQL();
      // Current implementation: last orderBy overwrites previous
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Industry DESC');
    });
  });
});
