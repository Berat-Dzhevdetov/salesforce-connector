import { QueryBuilder } from './QueryBuilder';
import { SalesforceClient } from './SalesforceClient';
import { SalesforceConfig } from './SalesforceConfig';
import { ModelData } from '../types';

/**
 * Base Model class for Salesforce objects
 * Provides ActiveRecord-style ORM interface
 */
export class Model<T extends ModelData = ModelData> {
  protected static objectName: string;
  protected data: Partial<T> = {};
  protected _isNew: boolean = true;
  protected _isDeleted: boolean = false;

  constructor(data?: Partial<T>) {
    if (data) {
      this.data = { ...data };
      // If data has an Id, this is an existing record
      if (data.Id) {
        this._isNew = false;
      }
    }
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
   * Create a new query builder for this model
   */
  public static query<T extends Model>(this: new (data?: any) => T): QueryBuilder<T> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();
    return new QueryBuilder<T>(objectName, this);
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

      return new this(response.data);
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

      const response = await SalesforceClient.post<{ id: string; success: boolean }>(url, payload);

      if (!response?.data?.id) {
        throw new Error('Failed to create record: No ID returned');
      }

      // Return a new instance with the created ID and original payload
      return new this({ ...payload, Id: response.data.id });
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

      await SalesforceClient.patch(url, payload);

      // Update the local data
      this.data = { ...this.data, ...payload };

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

      // If no ID, create a new record
      if (!id || this._isNew) {
        const constructor = this.constructor as typeof Model;
        const objectName = (constructor as any).getObjectName();
        const baseUrl = SalesforceConfig.getApiBaseUrl();
        const url = `${baseUrl}/sobjects/${objectName}`;

        // Remove Id from payload if it exists
        const { Id, ...payload } = this.data;

        const response = await SalesforceClient.post<{ id: string; success: boolean }>(url, payload);

        if (!response?.data?.id) {
          throw new Error('Failed to save record: No ID returned');
        }

        this.data.Id = response.data.id as any;
        this._isNew = false;

        return this;
      }

      // Otherwise, update the existing record
      const constructor = this.constructor as typeof Model;
      const objectName = (constructor as any).getObjectName();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/${id}`;

      // Remove Id from payload for update
      const { Id, ...payload } = this.data;

      await SalesforceClient.patch(url, payload);

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

      await SalesforceClient.delete(url);

      // Mark as deleted but preserve data for reference
      this._isDeleted = true;
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
}
