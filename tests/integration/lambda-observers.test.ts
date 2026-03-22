import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LambdaModel } from '../../src/core/LambdaModel';
import { ModelData } from '../../src/types';
import { Observer } from '../../src/core/Observer';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

// Mock Salesforce client
vi.mock('../../src/core/SalesforceClient');

interface TestAccountData extends ModelData {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
}

class TestAccount extends LambdaModel<TestAccountData> {
  protected static objectName = 'Account';

  get Id(): string { return this.get('Id') || ''; }
  get Name(): string { return this.get('Name') || ''; }
  get Industry(): string { return this.get('Industry') || ''; }
  get AnnualRevenue(): number { return this.get('AnnualRevenue') || 0; }
}

describe('LambdaModel - Observer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestAccount.clearObservers();

    // Configure Salesforce
    SalesforceConfig.initialize({
      instanceUrl: 'https://test.salesforce.com',
      apiVersion: '60.0'
    });
    SalesforceConfig.setAccessToken('test-token');
  });

  describe('beforeCreate observer', () => {
    it('should call beforeCreate hook when creating a record', async () => {
      const beforeCreateSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async beforeCreate(instance: TestAccount): Promise<void> {
          beforeCreateSpy(instance.get('Name'));
        }
      }

      TestAccount.observe(new TestObserver());

      // Mock the API response
      vi.mocked(SalesforceClient.post).mockResolvedValue({
        data: { id: '001xxx', success: true }
      } as any);

      await TestAccount.create({
        Name: 'Test Company',
        Industry: 'Technology'
      });

      expect(beforeCreateSpy).toHaveBeenCalledWith('Test Company');
      expect(beforeCreateSpy).toHaveBeenCalledTimes(1);
    });

    it('should prevent creation if beforeCreate throws error', async () => {
      class ValidationObserver implements Observer<TestAccount> {
        async beforeCreate(instance: TestAccount): Promise<void> {
          const name = instance.get('Name') as string;
          if (!name || name.length < 3) {
            throw new Error('Name must be at least 3 characters');
          }
        }
      }

      TestAccount.observe(new ValidationObserver());

      await expect(
        TestAccount.create({ Name: 'AB' })
      ).rejects.toThrow('Name must be at least 3 characters');

      // Should not have called the API
      expect(SalesforceClient.post).not.toHaveBeenCalled();
    });
  });

  describe('afterCreate observer', () => {
    it('should call afterCreate hook after successful creation', async () => {
      const afterCreateSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async afterCreate(instance: TestAccount): Promise<void> {
          afterCreateSpy(instance.get('Id'), instance.get('Name'));
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.post).mockResolvedValue({
        data: { id: '001xxx', success: true }
      } as any);

      await TestAccount.create({
        Name: 'Test Company',
        Industry: 'Technology'
      });

      expect(afterCreateSpy).toHaveBeenCalledWith('001xxx', 'Test Company');
      expect(afterCreateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeUpdate observer', () => {
    it('should call beforeUpdate hook when updating a record', async () => {
      const beforeUpdateSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async beforeUpdate(instance: TestAccount, changes: Partial<ModelData>): Promise<void> {
          beforeUpdateSpy(changes);
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.patch).mockResolvedValue({
        data: { success: true }
      } as any);

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Old Name',
        Industry: 'Technology'
      });

      account.set('Name', 'New Name');
      await account.save();

      expect(beforeUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ Name: 'New Name' })
      );
      expect(beforeUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should prevent update if beforeUpdate throws error', async () => {
      class ValidationObserver implements Observer<TestAccount> {
        async beforeUpdate(instance: TestAccount, changes: Partial<ModelData>): Promise<void> {
          if (changes.Name && (changes.Name as string).length < 3) {
            throw new Error('Name must be at least 3 characters');
          }
        }
      }

      TestAccount.observe(new ValidationObserver());

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Valid Name',
        Industry: 'Technology'
      });

      account.set('Name', 'AB');

      await expect(account.save()).rejects.toThrow('Name must be at least 3 characters');
      expect(SalesforceClient.patch).not.toHaveBeenCalled();
    });
  });

  describe('afterUpdate observer', () => {
    it('should call afterUpdate hook after successful update', async () => {
      const afterUpdateSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async afterUpdate(instance: TestAccount, changes: Partial<ModelData>): Promise<void> {
          afterUpdateSpy(instance.get('Id'), changes);
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.patch).mockResolvedValue({
        data: { success: true }
      } as any);

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Old Name',
        Industry: 'Technology'
      });

      account.set('Name', 'New Name');
      await account.save();

      expect(afterUpdateSpy).toHaveBeenCalledWith(
        '001xxx',
        expect.objectContaining({ Name: 'New Name' })
      );
      expect(afterUpdateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('beforeDelete observer', () => {
    it('should call beforeDelete hook when deleting a record', async () => {
      const beforeDeleteSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async beforeDelete(instance: TestAccount): Promise<void> {
          beforeDeleteSpy(instance.get('Id'), instance.get('Name'));
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.delete).mockResolvedValue({
        data: { success: true }
      } as any);

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Test Company',
        Industry: 'Technology'
      });

      await account.delete();

      expect(beforeDeleteSpy).toHaveBeenCalledWith('001xxx', 'Test Company');
      expect(beforeDeleteSpy).toHaveBeenCalledTimes(1);
    });

    it('should prevent deletion if beforeDelete throws error', async () => {
      class ProtectionObserver implements Observer<TestAccount> {
        async beforeDelete(instance: TestAccount): Promise<void> {
          const name = instance.get('Name') as string;
          if (name === 'Protected Account') {
            throw new Error('Cannot delete protected account');
          }
        }
      }

      TestAccount.observe(new ProtectionObserver());

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Protected Account',
        Industry: 'Technology'
      });

      await expect(account.delete()).rejects.toThrow('Cannot delete protected account');
      expect(SalesforceClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('afterDelete observer', () => {
    it('should call afterDelete hook after successful deletion', async () => {
      const afterDeleteSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async afterDelete(instance: TestAccount): Promise<void> {
          afterDeleteSpy(instance.get('Id'));
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.delete).mockResolvedValue({
        data: { success: true }
      } as any);

      const account = new TestAccount({
        Id: '001xxx',
        Name: 'Test Company',
        Industry: 'Technology'
      });

      await account.delete();

      expect(afterDeleteSpy).toHaveBeenCalledWith('001xxx');
      expect(afterDeleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple observers', () => {
    it('should execute all registered observers in order', async () => {
      const executionOrder: number[] = [];

      class Observer1 implements Observer<TestAccount> {
        async beforeCreate(_instance: TestAccount): Promise<void> {
          executionOrder.push(1);
        }
      }

      class Observer2 implements Observer<TestAccount> {
        async beforeCreate(_instance: TestAccount): Promise<void> {
          executionOrder.push(2);
        }
      }

      class Observer3 implements Observer<TestAccount> {
        async beforeCreate(_instance: TestAccount): Promise<void> {
          executionOrder.push(3);
        }
      }

      TestAccount.observe(new Observer1());
      TestAccount.observe(new Observer2());
      TestAccount.observe(new Observer3());

      vi.mocked(SalesforceClient.post).mockResolvedValue({
        data: { id: '001xxx', success: true }
      } as any);

      await TestAccount.create({ Name: 'Test' });

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('observer with lambda queries', () => {
    it('should work with lambda-style create', async () => {
      const beforeCreateSpy = vi.fn();
      const afterCreateSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async beforeCreate(instance: TestAccount): Promise<void> {
          beforeCreateSpy(instance.get('Name'));
          // Modify data in beforeCreate
          instance.set('Industry', 'Modified Industry');
        }

        async afterCreate(instance: TestAccount): Promise<void> {
          afterCreateSpy(instance.get('Id'));
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.post).mockResolvedValue({
        data: { id: '001xxx', success: true }
      } as any);

      const account = await TestAccount.create({
        Name: 'Test Company',
        Industry: 'Technology'
      });

      expect(beforeCreateSpy).toHaveBeenCalledWith('Test Company');
      expect(afterCreateSpy).toHaveBeenCalledWith('001xxx');
      expect(account.get('Industry')).toBe('Modified Industry');
    });

    it('should work when finding records', async () => {
      const afterFindSpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async afterFind(instance: TestAccount): Promise<void> {
          afterFindSpy(instance.get('Name'));
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.get).mockResolvedValue({
        data: {
          Id: '001xxx',
          Name: 'Found Account',
          Industry: 'Technology'
        }
      } as any);

      await TestAccount.find('001xxx');

      expect(afterFindSpy).toHaveBeenCalledWith('Found Account');
      expect(afterFindSpy).toHaveBeenCalledTimes(1);
    });

    it('should work with afterQuery when querying multiple records', async () => {
      const afterQuerySpy = vi.fn();

      class TestObserver implements Observer<TestAccount> {
        async afterQuery(instances: TestAccount[]): Promise<void> {
          afterQuerySpy(instances.length, instances[0]?.Name);
        }
      }

      TestAccount.observe(new TestObserver());

      vi.mocked(SalesforceClient.get).mockResolvedValue({
        data: {
          records: [
            { Id: '001xxx1', Name: 'Account 1', Industry: 'Technology' },
            { Id: '001xxx2', Name: 'Account 2', Industry: 'Finance' },
            { Id: '001xxx3', Name: 'Account 3', Industry: 'Healthcare' }
          ],
          totalSize: 3,
          done: true
        }
      } as any);

      const industry = 'Technology';
      await TestAccount
        .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
        .where(x => x.get('Industry') === industry)
        .get();

      expect(afterQuerySpy).toHaveBeenCalledWith(3, 'Account 1');
      expect(afterQuerySpy).toHaveBeenCalledTimes(1);
    });
  });
});
