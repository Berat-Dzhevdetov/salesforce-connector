import { Observer } from '../../core/Observer';
import { Model } from '../../core/Model';

/**
 * Example Observer: Timestamp Observer
 *
 * Automatically sets timestamp fields on create/update.
 * Useful for custom timestamp fields beyond Salesforce's standard ones.
 *
 * @example
 * ```typescript
 * import { CustomObject } from './models';
 * import { TimestampObserver } from './observers/TimestampObserver';
 *
 * CustomObject.observe(new TimestampObserver());
 *
 * const obj = await CustomObject.create({ Name: 'Test' });
 * console.log(obj.get('ProcessedAt__c')); // Current timestamp
 * ```
 */
export class TimestampObserver<T extends Model> implements Observer<T> {
  /**
   * Set creation timestamp
   */
  async beforeCreate(instance: T): Promise<void> {
    const now = new Date();

    // Set custom timestamp field if it exists
    if (instance.getData().ProcessedAt__c !== undefined) {
      instance.set('ProcessedAt__c' as keyof T, now as any);
    }

    if (instance.getData().LastModifiedByUser__c !== undefined) {
      // You could get current user from context/config
      instance.set('LastModifiedByUser__c' as keyof T, 'System' as any);
    }
  }

  /**
   * Update modification timestamp
   */
  async beforeUpdate(instance: T): Promise<void> {
    const now = new Date();

    // Update last processed timestamp
    if (instance.getData().ProcessedAt__c !== undefined) {
      instance.set('ProcessedAt__c' as keyof T, now as any);
    }

    if (instance.getData().LastModifiedByUser__c !== undefined) {
      instance.set('LastModifiedByUser__c' as keyof T, 'System' as any);
    }
  }
}
