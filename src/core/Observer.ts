import { Model } from './Model';
import { ModelData } from '../types';

/**
 * Observer interface for Model lifecycle hooks
 *
 * Implement this interface to create observers that respond to model events.
 * All methods are optional - only implement the hooks you need.
 *
 * @example
 * ```typescript
 * class AccountObserver implements Observer<Account> {
 *   async beforeCreate(instance: Account): Promise<void> {
 *     // Validate or modify before creation
 *     if (!instance.Name) {
 *       throw new Error('Account name is required');
 *     }
 *   }
 *
 *   async afterCreate(instance: Account): Promise<void> {
 *     // Log or trigger actions after creation
 *     console.log(`Account created: ${instance.Id}`);
 *   }
 * }
 *
 * // Register the observer
 * Account.observe(new AccountObserver());
 * ```
 */
export interface Observer<T extends Model> {
  /**
   * Called before a new record is created
   * Use this to validate data or set default values
   *
   * @param instance - The model instance being created (no Id yet)
   * @throws Error to prevent creation
   */
  beforeCreate?(instance: T): Promise<void> | void;

  /**
   * Called after a new record is successfully created
   * Use this for logging, notifications, or triggering side effects
   *
   * @param instance - The created model instance (has Id)
   */
  afterCreate?(instance: T): Promise<void> | void;

  /**
   * Called before an existing record is updated
   * Use this to validate changes or modify update data
   *
   * @param instance - The model instance being updated
   * @param changes - The fields being changed
   * @throws Error to prevent update
   */
  beforeUpdate?(instance: T, changes: Partial<ModelData>): Promise<void> | void;

  /**
   * Called after a record is successfully updated
   * Use this for audit logging or triggering workflows
   *
   * @param instance - The updated model instance
   * @param changes - The fields that were changed
   */
  afterUpdate?(instance: T, changes: Partial<ModelData>): Promise<void> | void;

  /**
   * Called before save() - applies to both create and update
   * Use this for common validation logic
   *
   * @param instance - The model instance being saved
   * @param isNew - True if creating, false if updating
   * @throws Error to prevent save
   */
  beforeSave?(instance: T, isNew: boolean): Promise<void> | void;

  /**
   * Called after save() - applies to both create and update
   * Use this for common post-save actions
   *
   * @param instance - The saved model instance
   * @param isNew - True if it was created, false if updated
   */
  afterSave?(instance: T, isNew: boolean): Promise<void> | void;

  /**
   * Called before a record is deleted
   * Use this to prevent deletion or clean up related data
   *
   * @param instance - The model instance being deleted
   * @throws Error to prevent deletion
   */
  beforeDelete?(instance: T): Promise<void> | void;

  /**
   * Called after a record is successfully deleted
   * Use this for cleanup or audit logging
   *
   * @param instance - The deleted model instance (marked as deleted)
   */
  afterDelete?(instance: T): Promise<void> | void;

  /**
   * Called after a record is found by ID
   * Use this to modify or enrich the loaded data
   *
   * @param instance - The model instance that was found
   */
  afterFind?(instance: T): Promise<void> | void;

  /**
   * Called after a query returns results
   * Use this to post-process query results
   *
   * @param instances - Array of model instances from the query
   */
  afterQuery?(instances: T[]): Promise<void> | void;
}

/**
 * Observer execution options
 */
export interface ObserverOptions {
  /**
   * Stop executing remaining observers if one throws an error
   * Default: true
   */
  stopOnError?: boolean;

  /**
   * Execute observers in parallel instead of sequentially
   * Default: false (sequential execution)
   */
  parallel?: boolean;
}
