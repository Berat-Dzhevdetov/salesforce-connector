import { Observer } from '../../core/Observer';
import { Model } from '../../core/Model';

/**
 * Example Observer: Validation Observer
 *
 * Validates data before create/update operations.
 * Demonstrates how to prevent operations by throwing errors.
 *
 * @example
 * ```typescript
 * import { Account } from './models';
 * import { ValidationObserver } from './observers/ValidationObserver';
 *
 * Account.observe(new ValidationObserver());
 *
 * // This will throw an error
 * await Account.create({ Name: 'AB' }); // Name too short
 * ```
 */
export class ValidationObserver<T extends Model> implements Observer<T> {
  /**
   * Validate before creating a record
   */
  async beforeCreate(instance: T): Promise<void> {
    const data = instance.getData();

    // Example: Validate that Name field exists and has minimum length
    if (data.Name !== undefined) {
      if (typeof data.Name !== 'string' || data.Name.trim().length < 3) {
        throw new Error('Name must be at least 3 characters long');
      }
    }

    // Example: Validate email format if present
    if (data.Email !== undefined && data.Email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.Email as string)) {
        throw new Error('Invalid email format');
      }
    }
  }

  /**
   * Validate before updating a record
   */
  async beforeUpdate(instance: T): Promise<void> {
    // Apply same validations for updates
    await this.beforeCreate(instance);
  }

  /**
   * Prevent deletion of certain records
   */
  async beforeDelete(instance: T): Promise<void> {
    const data = instance.getData();

    // Example: Prevent deletion of records marked as critical
    if (data.IsCritical__c === true) {
      throw new Error('Cannot delete critical records');
    }

    // Example: Prevent deletion of records created in the last 24 hours
    if (data.CreatedDate) {
      const createdDate = new Date(data.CreatedDate as string);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (createdDate > oneDayAgo) {
        throw new Error('Cannot delete records created in the last 24 hours');
      }
    }
  }
}
