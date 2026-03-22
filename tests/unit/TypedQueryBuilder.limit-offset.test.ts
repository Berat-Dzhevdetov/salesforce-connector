import { describe, it, expect } from 'vitest';
import { Account, Contact } from '../fixtures/TestModels';

describe('TypedQueryBuilder.limit() and offset()', () => {
  describe('LIMIT clause', () => {
    it('should add LIMIT clause with positive number', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 10');
    });

    it('should add LIMIT 1', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(1);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 1');
    });

    it('should add LIMIT with large number', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(2000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 2000');
    });

    it('should handle LIMIT 0', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 0');
    });
  });

  describe('OFFSET clause', () => {
    it('should add OFFSET clause with positive number', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 5');
    });

    it('should add OFFSET 1', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(1);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 1');
    });

    it('should add OFFSET with large number', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(1000);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 1000');
    });

    it('should handle OFFSET 0', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 0');
    });
  });

  describe('LIMIT and OFFSET together', () => {
    it('should combine LIMIT and OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(10)
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 10 OFFSET 5');
    });

    it('should work with offset before limit', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(5)
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 10 OFFSET 5');
    });

    it('should handle pagination pattern (page 1)', () => {
      const pageSize = 20;
      const page = 1;
      const offset = (page - 1) * pageSize;

      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(pageSize)
        .offset(offset);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 20 OFFSET 0');
    });

    it('should handle pagination pattern (page 3)', () => {
      const pageSize = 20;
      const page = 3;
      const offset = (page - 1) * pageSize;

      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(pageSize)
        .offset(offset);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 20 OFFSET 40');
    });
  });

  describe('Chaining with WHERE', () => {
    it('should combine WHERE with LIMIT', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' LIMIT 10");
    });

    it('should combine WHERE with OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' OFFSET 5");
    });

    it('should combine WHERE with LIMIT and OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .limit(10)
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' LIMIT 10 OFFSET 5");
    });
  });

  describe('Chaining with ORDER BY', () => {
    it('should combine ORDER BY with LIMIT', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC LIMIT 10');
    });

    it('should combine ORDER BY with OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'DESC')
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name DESC OFFSET 5');
    });

    it('should combine ORDER BY with LIMIT and OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10)
        .offset(5);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC LIMIT 10 OFFSET 5');
    });
  });

  describe('Complete query with all clauses', () => {
    it('should build complete query with WHERE, ORDER BY, LIMIT, and OFFSET', () => {
      const query = Account
        .select(x => ({ Name: x.Name, Industry: x.Industry }))
        .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000)
        .orderBy(x => x.Name, 'ASC')
        .limit(20)
        .offset(10);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, Industry FROM Account WHERE Industry = 'Technology' AND AnnualRevenue > 1000000 ORDER BY Name ASC LIMIT 20 OFFSET 10");
    });

    it('should work with nested properties', () => {
      const query = Account
        .select(x => ({ Name: x.Name, City: x.BillingAddress.City }))
        .where(x => x.BillingAddress.State === 'CA')
        .orderBy(x => x.BillingAddress.City, 'ASC')
        .limit(50)
        .offset(25);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name, BillingAddress.City FROM Account WHERE BillingAddress.State = 'CA' ORDER BY BillingAddress.City ASC LIMIT 50 OFFSET 25");
    });
  });

  describe('Different object types', () => {
    it('should work with Contact and LIMIT', () => {
      const query = Contact
        .select(x => ({ Name: x.Name, Email: x.Email }))
        .limit(15);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Email FROM Contact LIMIT 15');
    });

    it('should work with Contact and OFFSET', () => {
      const query = Contact
        .select(x => ({ Name: x.Name, Email: x.Email }))
        .offset(10);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name, Email FROM Contact OFFSET 10');
    });

    it('should work with Contact and both LIMIT and OFFSET', () => {
      const query = Contact
        .select(x => ({ Name: x.Name }))
        .where(x => x.Active__c === true)
        .orderBy(x => x.Name, 'ASC')
        .limit(25)
        .offset(50);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Contact WHERE Active__c = TRUE ORDER BY Name ASC LIMIT 25 OFFSET 50');
    });
  });

  describe('Multiple calls to limit/offset (last wins)', () => {
    it('should use last LIMIT value when called multiple times', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .limit(10)
        .limit(20);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account LIMIT 20');
    });

    it('should use last OFFSET value when called multiple times', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .offset(5)
        .offset(15);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account OFFSET 15');
    });
  });

  describe('Realistic pagination scenarios', () => {
    it('should handle first page pagination', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .orderBy(x => x.Name, 'ASC')
        .limit(10)
        .offset(0);

      const soql = query.toSOQL();
      expect(soql).toBe('SELECT Name FROM Account ORDER BY Name ASC LIMIT 10 OFFSET 0');
    });

    it('should handle middle page pagination', () => {
      const query = Account
        .select(x => ({ Name: x.Name }))
        .where(x => x.Industry === 'Technology')
        .orderBy(x => x.AnnualRevenue, 'DESC')
        .limit(25)
        .offset(75);

      const soql = query.toSOQL();
      expect(soql).toBe("SELECT Name FROM Account WHERE Industry = 'Technology' ORDER BY AnnualRevenue DESC LIMIT 25 OFFSET 75");
    });
  });
});
