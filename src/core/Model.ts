import { QueryBuilder } from './QueryBuilder';
import { SalesforceClient } from './SalesforceClient';
import { SalesforceConfig } from './SalesforceConfig';
import { ModelData } from '../types';
import { RelationshipProxy } from './RelationshipProxy';
import { HasManyProxy } from './HasManyProxy';
import { Observer, ObserverOptions } from './Observer';

/**
 * Base Model class for Salesforce objects
 * Provides ActiveRecord-style ORM interface
 */
export class Model<T extends ModelData = ModelData> {
  protected static objectName: string;
  protected static dateFields: string[] = [];
  protected static dateTimeFields: string[] = [];
  protected data: Partial<T> = {};
  protected _isNew: boolean = true;
  protected _isDeleted: boolean = false;

  // Observer registry - stores observers per model class
  private static observers: Map<string, Observer<any>[]> = new Map();
  private static observerOptions: ObserverOptions = {
    stopOnError: true,
    parallel: false
  };

  constructor(data?: Partial<T>) {
    if (data) {
      this.data = { ...data };
      // Convert date/datetime strings to Date objects
      this.convertDatesToObjects();
      // If data has an Id, this is an existing record
      if (data.Id) {
        this._isNew = false;
      }
    }
  }

  /**
   * Convert date/datetime string fields to Date objects
   */
  private convertDatesToObjects(): void {
    const constructor = this.constructor as typeof Model;
    const dateFields = (constructor as any).dateFields || [];
    const dateTimeFields = (constructor as any).dateTimeFields || [];
    const allDateFields = [...dateFields, ...dateTimeFields];

    for (const field of allDateFields) {
      const value = this.data[field as keyof T];
      if (value && typeof value === 'string') {
        try {
          (this.data as any)[field] = new Date(value);
        } catch (error) {
          // If conversion fails, keep the original value
          console.warn(`Failed to convert field ${field} to Date:`, error);
        }
      }
    }
  }

  /**
   * Convert Date objects to ISO strings for Salesforce API
   */
  private convertDatesToStrings(data: Partial<T>): Partial<T> {
    const constructor = this.constructor as typeof Model;
    const dateFields = (constructor as any).dateFields || [];
    const dateTimeFields = (constructor as any).dateTimeFields || [];
    const allDateFields = [...dateFields, ...dateTimeFields];

    const result = { ...data };

    for (const field of allDateFields) {
      const value: any = result[field as keyof T];
      if (value instanceof Date) {
        // For date fields, use YYYY-MM-DD format
        // For datetime fields, use full ISO string
        if (dateFields.includes(field)) {
          (result as any)[field] = value.toISOString().split('T')[0];
        } else {
          (result as any)[field] = value.toISOString();
        }
      }
    }

    return result;
  }

  /**
   * Get the Salesforce object name for this model
   * Must be overridden in subclasses
   */
  protected static getObjectName(): string {
    if (!this.objectName) {
      throw new Error(`objectName not defined for ${this.name}. Override getObjectName() or set static objectName property.`);
    }
    return this.objectName;
  }

  /**
   * Register an observer for this model
   * Observers respond to lifecycle events (create, update, delete, etc.)
   *
   * @param observer - The observer instance to register
   *
   * @example
   * ```typescript
   * class AccountObserver implements Observer<Account> {
   *   async beforeCreate(account: Account) {
   *     console.log('Creating account:', account.Name);
   *   }
   * }
   *
   * Account.observe(new AccountObserver());
   * ```
   */
  public static observe<T extends Model>(observer: Observer<T>): void {
    const modelName = this.getObjectName();

    if (!this.observers.has(modelName)) {
      this.observers.set(modelName, []);
    }

    this.observers.get(modelName)!.push(observer);
  }

  /**
   * Remove an observer from this model
   *
   * @param observer - The observer instance to remove
   */
  public static removeObserver<T extends Model>(observer: Observer<T>): void {
    const modelName = this.getObjectName();
    const observers = this.observers.get(modelName);

    if (observers) {
      const index = observers.indexOf(observer);
      if (index > -1) {
        observers.splice(index, 1);
      }
    }
  }

  /**
   * Get all observers registered for this model
   *
   * @returns Array of observers
   */
  protected static getObservers<T extends Model>(): Observer<T>[] {
    const modelName = this.getObjectName();
    return this.observers.get(modelName) || [];
  }

  /**
   * Clear all observers for this model
   * Useful for testing
   */
  public static clearObservers(): void {
    const modelName = this.getObjectName();
    this.observers.delete(modelName);
  }

  /**
   * Configure observer execution behavior
   *
   * @param options - Observer execution options
   */
  public static setObserverOptions(options: ObserverOptions): void {
    this.observerOptions = { ...this.observerOptions, ...options };
  }

  /**
   * Execute observer hooks
   *
   * @param hookName - The hook method name to execute
   * @param args - Arguments to pass to the hook
   */
  protected static async executeObservers<T extends Model>(
    hookName: keyof Observer<T>,
    ...args: any[]
  ): Promise<void> {
    const observers = this.getObservers<T>();

    if (observers.length === 0) {
      return;
    }

    const { stopOnError, parallel } = this.observerOptions;

    if (parallel) {
      // Execute all observers in parallel
      const promises = observers
        .filter(observer => typeof observer[hookName] === 'function')
        .map(observer => {
          try {
            return (observer[hookName] as any)(...args);
          } catch (error) {
            if (stopOnError) {
              throw error;
            }
            console.error(`Observer hook ${String(hookName)} failed:`, error);
            return Promise.resolve();
          }
        });

      await Promise.all(promises);
    } else {
      // Execute observers sequentially
      for (const observer of observers) {
        if (typeof observer[hookName] === 'function') {
          try {
            await (observer[hookName] as any)(...args);
          } catch (error) {
            if (stopOnError) {
              throw error;
            }
            console.error(`Observer hook ${String(hookName)} failed:`, error);
          }
        }
      }
    }
  }

  /**
   * Get date fields for this model
   */
  protected static getDateFields(): string[] {
    return this.dateFields || [];
  }

  /**
   * Get datetime fields for this model
   */
  protected static getDateTimeFields(): string[] {
    return this.dateTimeFields || [];
  }

  /**
   * Convert Date objects to ISO strings for Salesforce API (static version)
   */
  protected static convertDatesToStringsStatic(data: Partial<ModelData>): Partial<ModelData> {
    const dateFields = this.dateFields || [];
    const dateTimeFields = this.dateTimeFields || [];
    const allDateFields = [...dateFields, ...dateTimeFields];

    const result = { ...data };

    for (const field of allDateFields) {
      const value: any = (result as any)[field];
      if (value instanceof Date) {
        // For date fields, use YYYY-MM-DD format
        // For datetime fields, use full ISO string
        if (dateFields.includes(field)) {
          (result as any)[field] = value.toISOString().split('T')[0];
        } else {
          (result as any)[field] = value.toISOString();
        }
      }
    }

    return result;
  }

  /**
   * Create a new query builder for this model
   */
  public static query<T extends Model>(this: new (data?: any) => T): QueryBuilder<T> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();
    const dateFields = ModelClass.getDateFields ? ModelClass.getDateFields() : [];
    const dateTimeFields = ModelClass.getDateTimeFields ? ModelClass.getDateTimeFields() : [];
    return new QueryBuilder<T>(objectName, this, dateFields, dateTimeFields);
  }

  /**
   * Select specific fields
   */
  public static select<T extends Model>(this: new (data?: any) => T, ...fields: string[]): QueryBuilder<T> {
    return (this as any).query().select(...fields);
  }

  /**
   * Add WHERE clause
   */
  public static where<T extends Model>(
    this: new (data?: any) => T,
    field: string,
    operatorOrValue: any,
    value?: any
  ): QueryBuilder<T> {
    const query = (this as any).query();
    return value === undefined
      ? query.where(field, operatorOrValue)
      : query.where(field, operatorOrValue, value);
  }

  /**
   * Find a record by ID
   */
  public static async find<T extends Model>(this: new (data?: any) => T, id: string): Promise<T | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('find() requires a valid ID');
      }

      const ModelClass = this as any;
      const objectName = ModelClass.getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/${id}`;

      const response = await SalesforceClient.get<any>(url);

      if (!response?.data) {
        return null;
      }

      const instance = new this(response.data);

      // Execute afterFind observers
      await ModelClass.executeObservers('afterFind', instance);

      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to find record: ${errorMessage}`);
    }
  }

  /**
   * Find all records (with optional query builder)
   */
  public static async all<T extends Model>(this: new (data?: any) => T): Promise<T[]> {
    try {
      return await (this as any).query().get();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch records: ${errorMessage}`);
    }
  }

  /**
   * Create a new record
   */
  public static async create<T extends Model>(
    this: new (data?: any) => T,
    payload: Partial<ModelData>
  ): Promise<T> {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('create() requires a valid payload object');
      }

      const ModelClass = this as any;
      const objectName = ModelClass.getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}`;

      // Create temporary instance for hooks
      const tempInstance = new this(payload);

      // Execute beforeSave observers (isNew = true)
      await ModelClass.executeObservers('beforeSave', tempInstance, true);

      // Execute beforeCreate observers
      await ModelClass.executeObservers('beforeCreate', tempInstance);

      // Convert Date objects to strings before sending to Salesforce
      const convertedPayload = ModelClass.convertDatesToStringsStatic
        ? ModelClass.convertDatesToStringsStatic(tempInstance.getData())
        : tempInstance.getData();

      const response = await SalesforceClient.post<{ id: string; success: boolean }>(url, convertedPayload);

      if (!response?.data?.id) {
        throw new Error('Failed to create record: No ID returned');
      }

      // Return a new instance with the created ID and original payload
      // The constructor will convert date strings back to Date objects
      const instance = new this({ ...tempInstance.getData(), Id: response.data.id });

      // Execute afterCreate observers
      await ModelClass.executeObservers('afterCreate', instance);

      // Execute afterSave observers (isNew = true)
      await ModelClass.executeObservers('afterSave', instance, true);

      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create record: ${errorMessage}`);
    }
  }

  /**
   * Check if this instance has been deleted
   */
  public isDeleted(): boolean {
    return this._isDeleted;
  }

  /**
   * Get the ID of this instance
   */
  public getId(): string | undefined {
    return this.data.Id;
  }

  /**
   * Get a field value from this instance
   */
  public get<K extends keyof T>(field: K): T[K] | undefined {
    return this.data[field] as T[K] | undefined;
  }

  /**
   * Set a field value on this instance
   */
  public set<K extends keyof T>(field: K, value: T[K]): this {
    if (this._isDeleted) {
      throw new Error('Cannot modify a deleted record. Create a new instance instead.');
    }
    this.data[field] = value;
    return this;
  }

  /**
   * Get all data from this instance
   */
  public getData(): Partial<T> {
    return { ...this.data };
  }

  /**
   * Update this instance with new data
   */
  public async update(payload: Partial<T>): Promise<this> {
    try {
      if (this._isDeleted) {
        throw new Error('Cannot update a deleted record. Create a new instance instead.');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('update() requires a valid payload object');
      }

      const id = this.getId();
      if (!id) {
        throw new Error('Cannot update record without an Id. Use create() or save() instead.');
      }

      const constructor = this.constructor as typeof Model;
      const objectName = (constructor as any).getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/${id}`;

      // Execute beforeSave observers (isNew = false)
      await (constructor as any).executeObservers('beforeSave', this, false);

      // Execute beforeUpdate observers
      await (constructor as any).executeObservers('beforeUpdate', this, payload);

      // Convert Date objects to strings before sending to Salesforce
      const convertedPayload = this.convertDatesToStrings(payload);

      await SalesforceClient.patch(url, convertedPayload);

      // Update the local data (keep Date objects locally)
      this.data = { ...this.data, ...payload };

      // Execute afterUpdate observers
      await (constructor as any).executeObservers('afterUpdate', this, payload);

      // Execute afterSave observers (isNew = false)
      await (constructor as any).executeObservers('afterSave', this, false);

      return this;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update record: ${errorMessage}`);
    }
  }

  /**
   * Save this instance (create or update)
   *
   * Behavior:
   * - If the instance is new (no Id), creates a new record
   * - If the instance has an Id, updates the existing record
   * - Throws an error if the instance was previously deleted
   */
  public async save(): Promise<this> {
    try {
      if (this._isDeleted) {
        throw new Error('Cannot save a deleted record. Create a new instance instead.');
      }

      const id = this.getId();
      const isNew = !id || this._isNew;
      const constructor = this.constructor as typeof Model;

      // Execute beforeSave observers
      await (constructor as any).executeObservers('beforeSave', this, isNew);

      // If no ID, create a new record
      if (isNew) {
        const objectName = (constructor as any).getObjectName();
        const baseUrl = SalesforceConfig.getApiBaseUrl();
        const url = `${baseUrl}/sobjects/${objectName}`;

        // Execute beforeCreate observers
        await (constructor as any).executeObservers('beforeCreate', this);

        // Remove Id from payload if it exists
        const { Id, ...dataWithoutId } = this.data;

        // Convert Date objects to strings before sending to Salesforce
        const payload = this.convertDatesToStrings(dataWithoutId as Partial<T>);

        const response = await SalesforceClient.post<{ id: string; success: boolean }>(url, payload);

        if (!response?.data?.id) {
          throw new Error('Failed to save record: No ID returned');
        }

        this.data.Id = response.data.id as any;
        this._isNew = false;

        // Execute afterCreate observers
        await (constructor as any).executeObservers('afterCreate', this);
      } else {
        // Otherwise, update the existing record
        const objectName = (constructor as any).getObjectName();
        const baseUrl = SalesforceConfig.getApiBaseUrl();
        const url = `${baseUrl}/sobjects/${objectName}/${id}`;

        // Remove Id from payload for update
        const { Id, ...dataWithoutId } = this.data;

        // Execute beforeUpdate observers
        await (constructor as any).executeObservers('beforeUpdate', this, dataWithoutId);

        // Convert Date objects to strings before sending to Salesforce
        const payload = this.convertDatesToStrings(dataWithoutId as Partial<T>);

        await SalesforceClient.patch(url, payload);

        // Execute afterUpdate observers
        await (constructor as any).executeObservers('afterUpdate', this, dataWithoutId);
      }

      // Execute afterSave observers
      await (constructor as any).executeObservers('afterSave', this, isNew);

      return this;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save record: ${errorMessage}`);
    }
  }

  /**
   * Delete this instance
   *
   * After deletion:
   * - The instance is marked as deleted
   * - The data is preserved but the instance cannot be saved or updated
   * - Calling delete() again will throw an error
   * - To re-create the record, create a new instance with the desired data
   */
  public async delete(): Promise<void> {
    try {
      if (this._isDeleted) {
        throw new Error('This record has already been deleted');
      }

      const id = this.getId();

      if (!id) {
        throw new Error('Cannot delete record without an Id');
      }

      const constructor = this.constructor as typeof Model;
      const objectName = (constructor as any).getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/${id}`;

      // Execute beforeDelete observers
      await (constructor as any).executeObservers('beforeDelete', this);

      await SalesforceClient.delete(url);

      // Mark as deleted but preserve data for reference
      this._isDeleted = true;

      // Execute afterDelete observers
      await (constructor as any).executeObservers('afterDelete', this);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete record: ${errorMessage}`);
    }
  }

  /**
   * Delete records by ID (static method)
   */
  public static async destroy(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('destroy() requires a valid ID');
      }

      const objectName = (this as any).getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/${id}`;

      await SalesforceClient.delete(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete record: ${errorMessage}`);
    }
  }

  /**
   * Convert instance to JSON
   */
  public toJSON(): Partial<T> {
    return this.getData();
  }

  /**
   * Define a belongs-to relationship (lookup/master-detail)
   * Returns a proxy that lazy loads the related record when accessed
   *
   * @param relationshipName - The name of the relationship field (e.g., 'Member', 'Owner')
   * @param foreignKeyField - The ID field that stores the reference (e.g., 'MemberId', 'OwnerId')
   * @param relatedModelClass - The model class to load (e.g., User)
   * @returns A proxy object that loads the related record on first access
   *
   * @example
   * // In your model class:
   * get Member(): User | null {
   *   return this.belongsTo('Member', 'MemberId', User);
   * }
   *
   * // Usage:
   * const journal = await TransactionJournal.find('a001xxx');
   * // Loads Member on first access:
   * console.log(journal.Member.Name); // ← Error: needs to be loaded first
   *
   * // Proper usage - load manually:
   * await journal.loadMember();
   * console.log(journal.Member.Name); // ← Works!
   *
   * // Or eager load in query:
   * const journal2 = await TransactionJournal
   *   .select('Id', 'Name', 'Member.Name', 'Member.Email')
   *   .first();
   * console.log(journal2.Member.Name); // ← Works! Already loaded
   */
  protected belongsTo<R extends ModelData>(
    relationshipName: string,
    foreignKeyField: string,
    relatedModelClass: new (data?: any) => Model<R>
  ): R | null {
    const proxyKey = `__proxy_${relationshipName}`;

    // Check if proxy already exists and return its data
    if ((this as any)[proxyKey]) {
      const existingProxy = (this as any)[proxyKey] as RelationshipProxy<R>;
      return existingProxy.createProxy();
    }

    // Check if the relationship data was already loaded from a query
    const preloadedData = this.get(relationshipName as keyof T) as Partial<R> | undefined;

    // Create a new relationship proxy
    const proxy = new RelationshipProxy<R>(
      this,
      relationshipName,
      foreignKeyField,
      relatedModelClass,
      preloadedData
    );

    // Store the proxy for later access
    (this as any)[proxyKey] = proxy;

    return proxy.createProxy();
  }

  /**
   * Manually load a relationship
   * Use this to explicitly load a relationship before accessing its properties
   *
   * @param relationshipName - The name of the relationship to load
   * @returns Promise that resolves when the relationship is loaded
   *
   * @example
   * const journal = await TransactionJournal.find('a001xxx');
   * await journal.loadRelationship('Member');
   * console.log(journal.Member.Name); // Now safe to access
   */
  protected async loadRelationship(relationshipName: string): Promise<void> {
    const proxyKey = `__proxy_${relationshipName}`;

    // If proxy doesn't exist, create it by accessing the getter first
    if (!(this as any)[proxyKey]) {
      // Access the getter to create the proxy
      // This assumes the relationship getter exists on the model
      const getter = (this as any)[relationshipName];
      if (!getter) {
        throw new Error(
          `Relationship '${relationshipName}' not found. Make sure you've defined a getter for it in your model.`
        );
      }
    }

    const proxy = (this as any)[proxyKey] as RelationshipProxy<any> | undefined;

    if (!proxy) {
      throw new Error(
        `Relationship '${relationshipName}' not found. Make sure you've defined it using belongsTo() in your model.`
      );
    }

    await proxy.load();
  }

  /**
   * Define a has-many relationship (child relationship / related list)
   * Returns a proxy that lazy loads the related records when accessed
   *
   * @param relationshipName - The name of the relationship (e.g., 'TransactionJournals', 'Contacts')
   * @param foreignKeyField - The field on the related object that references this model (e.g., 'MemberId__c', 'AccountId')
   * @param relatedModelClass - The model class to load (e.g., TransactionJournal, Contact)
   * @param salesforceRelationshipName - Optional: The Salesforce API name for subqueries (e.g., 'TransactionJournals__r')
   * @returns A proxy array that loads the related records on first access
   *
   * @example
   * // In your User model:
   * get TransactionJournals(): TransactionJournalData[] {
   *   return this.hasMany<TransactionJournalData>(
   *     'TransactionJournals',
   *     'MemberId__c',
   *     TransactionJournal,
   *     'TransactionJournals__r'
   *   );
   * }
   *
   * // Usage - Lazy Loading:
   * const user = await User.find('005xxx');
   * await user.loadTransactionJournals();
   * console.log(user.TransactionJournals.length); // ← Works!
   * console.log(user.TransactionJournals[0].Name);
   *
   * // Usage - Eager Loading with subquery:
   * const users = await User
   *   .select('Id', 'Name', '(SELECT Id, Name, TransactionAmount__c FROM TransactionJournals__r)')
   *   .get();
   * console.log(users[0].TransactionJournals.length); // ← Already loaded!
   */
  protected hasMany<R extends ModelData>(
    relationshipName: string,
    foreignKeyField: string,
    relatedModelClass: new (data?: any) => Model<R>,
    salesforceRelationshipName?: string
  ): R[] {
    const proxyKey = `__proxy_${relationshipName}`;

    // Check if proxy already exists and return its data
    if ((this as any)[proxyKey]) {
      const existingProxy = (this as any)[proxyKey] as HasManyProxy<R>;
      return existingProxy.createProxy();
    }

    // Check if the relationship data was already loaded from a subquery
    const subqueryKey = salesforceRelationshipName || relationshipName;
    const preloadedData = this.get(subqueryKey as keyof T) as { records: R[] } | undefined;

    // Create a new has-many relationship proxy
    const proxy = new HasManyProxy<R>(
      this,
      relationshipName,
      foreignKeyField,
      relatedModelClass,
      preloadedData
    );

    // Store the proxy for later access
    (this as any)[proxyKey] = proxy;

    return proxy.createProxy();
  }

  /**
   * Manually load a has-many relationship
   * Use this to explicitly load child records before accessing them
   *
   * @param relationshipName - The name of the relationship to load
   * @returns Promise that resolves when the relationship is loaded
   *
   * @example
   * const user = await User.find('005xxx');
   * await user.loadHasManyRelationship('TransactionJournals');
   * console.log(user.TransactionJournals.length); // Now safe to access
   */
  protected async loadHasManyRelationship(relationshipName: string): Promise<void> {
    const proxyKey = `__proxy_${relationshipName}`;

    // If proxy doesn't exist, create it by accessing the getter first
    if (!(this as any)[proxyKey]) {
      // Access the getter to create the proxy
      // This assumes the relationship getter exists on the model
      const getter = (this as any)[relationshipName];
      if (!getter) {
        throw new Error(
          `Relationship '${relationshipName}' not found. Make sure you've defined a getter for it in your model.`
        );
      }
    }

    const proxy = (this as any)[proxyKey] as HasManyProxy<any> | undefined;

    if (!proxy) {
      throw new Error(
        `Relationship '${relationshipName}' not found. Make sure you've defined it using hasMany() in your model.`
      );
    }

    await proxy.load();
  }
}
