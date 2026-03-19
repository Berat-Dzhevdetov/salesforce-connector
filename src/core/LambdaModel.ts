import { Model } from './Model';
import { ModelData } from '../types';
import { TypedQueryBuilder } from './TypedQueryBuilder';
import { LambdaParser } from './LambdaParser';
import { SalesforceConfig } from './SalesforceConfig';
import { SalesforceClient } from './SalesforceClient';

/**
 * LambdaModel provides a type-safe, lambda-based query interface
 * for Salesforce objects. Use this instead of the string-based Model class
 * when you want full TypeScript type inference and IntelliSense support.
 *
 * @example
 * ```typescript
 * interface AccountData {
 *   Id: string;
 *   Name: string;
 *   Industry: string;
 *   Contacts: RelationshipArray<ContactData>;
 * }
 *
 * class Account extends LambdaModel<AccountData> {
 *   protected static objectName = 'Account';
 *
 *   get Contacts(): RelationshipArray<ContactData> {
 *     return (this.get("Contacts") as any) || [];
 *   }
 * }
 *
 * // Query with type safety
 * const results = await Account
 *   .select(x => ({
 *     Name: x.Name,
 *     Industry: x.Industry,
 *     Contacts: x.Contacts.select(c => ({ Id: c.Id, Name: c.Name }))
 *   }))
 *   .where(x => x.Industry === 'Technology')
 *   .first();
 * ```
 */
export class LambdaModel<T extends ModelData = ModelData> extends Model<T> {
  private static parser = new LambdaParser();

  /**
   * Creates a type-safe query using lambda expressions
   *
   * @param selector - Lambda function that defines which fields to select
   * @returns TypedQueryBuilder with full type inference
   *
   * @example
   * ```typescript
   * Account.select(x => ({
   *   Name: x.Name,
   *   Industry: x.Industry,
   *   Street: x.BillingAddress.Street
   * }))
   * ```
   */
  static select<T extends LambdaModel, TResult>(
    this: new (data?: any) => T,
    selector: ((x: T) => TResult) | string,
    ...fields: string[]
  ): TypedQueryBuilder<T, TResult> | any {
    // If first parameter is a function, use lambda mode
    if (typeof selector === 'function') {
      const ModelClass = this as any;
      const objectName = ModelClass.getObjectName();
      const dateFields = ModelClass.getDateFields ? ModelClass.getDateFields() : [];
      const dateTimeFields = ModelClass.getDateTimeFields ? ModelClass.getDateTimeFields() : [];

      // Parse the selector to get field mappings
      const fieldMap = LambdaModel.parser.parseSelector(selector);

      return new TypedQueryBuilder<T, TResult>(
        objectName,
        fieldMap,
        this,
        dateFields,
        dateTimeFields
      );
    } else {
      // Otherwise, fall back to parent string-based select
      return super.select.call(this, selector, ...fields);
    }
  }

  /**
   * Finds a record by ID (same as base Model class)
   */
  static async find<T extends LambdaModel>(
    this: new (data?: any) => T,
    id: string
  ): Promise<T | null> {
    return super.find.call(this, id) as Promise<T | null>;
  }

  /**
   * Creates a new record (same as base Model class)
   */
  static async create<T extends LambdaModel>(
    this: new (data?: any) => T,
    payload: Partial<ModelData>
  ): Promise<T> {
    return super.create.call(this, payload) as Promise<T>;
  }

  /**
   * Finds all records (returns standard Model query builder)
   * For type-safe queries, use .select() instead
   */
  static async all<T extends LambdaModel>(
    this: new (data?: any) => T
  ): Promise<T[]> {
    return super.all.call(this) as Promise<T[]>;
  }

  /**
   * Updates multiple records matching a condition
   *
   * @param selector - Lambda that identifies which field to match
   * @param value - The value to match
   * @param updates - The fields to update
   *
   * @example
   * ```typescript
   * await Account.updateWhere(
   *   x => x.Industry,
   *   'Technology',
   *   { Rating: 'Hot' }
   * );
   * ```
   */
  static async updateWhere<T extends LambdaModel, K extends keyof T>(
    this: new (data?: any) => T,
    selector: (x: T) => T[K],
    value: T[K],
    updates: Partial<ModelData>
  ): Promise<number> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();

    // Parse the field selector
    const parsedMap = LambdaModel.parser.parseSelector(selector as any);
    const fieldName = Object.values(parsedMap)[0];

    // Format the value for SOQL
    let soqlValue: string;
    if (typeof value === 'string') {
      soqlValue = `'${value}'`;
    } else if (typeof value === 'number') {
      soqlValue = String(value);
    } else if (typeof value === 'boolean') {
      soqlValue = value ? 'TRUE' : 'FALSE';
    } else {
      soqlValue = String(value);
    }

    // Find all matching records
    const soql = `SELECT Id FROM ${objectName} WHERE ${fieldName} = ${soqlValue}`;
    const baseUrl = SalesforceConfig.getApiBaseUrl();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${baseUrl}/query?q=${encodedQuery}`;

    const response = await SalesforceClient.get<any>(url);
    const records = response?.data?.records || [];

    if (records.length === 0) {
      return 0;
    }

    // Update each record
    let updateCount = 0;
    for (const record of records) {
      try {
        const instance = new this({ Id: record.Id });
        await instance.update(updates);
        updateCount++;
      } catch (error) {
        console.error(`Failed to update record ${record.Id}:`, error);
      }
    }

    return updateCount;
  }

  /**
   * Deletes multiple records matching a condition
   *
   * @param selector - Lambda that identifies which field to match
   * @param value - The value to match
   *
   * @example
   * ```typescript
   * await Account.deleteWhere(
   *   x => x.Industry,
   *   'Obsolete'
   * );
   * ```
   */
  static async deleteWhere<T extends LambdaModel, K extends keyof T>(
    this: new (data?: any) => T,
    selector: (x: T) => T[K],
    value: T[K]
  ): Promise<number> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();

    // Parse the field selector
    const parsedMap = LambdaModel.parser.parseSelector(selector as any);
    const fieldName = Object.values(parsedMap)[0];

    // Format the value for SOQL
    let soqlValue: string;
    if (typeof value === 'string') {
      soqlValue = `'${value}'`;
    } else if (typeof value === 'number') {
      soqlValue = String(value);
    } else if (typeof value === 'boolean') {
      soqlValue = value ? 'TRUE' : 'FALSE';
    } else {
      soqlValue = String(value);
    }

    // Find all matching records
    const soql = `SELECT Id FROM ${objectName} WHERE ${fieldName} = ${soqlValue}`;
    const baseUrl = SalesforceConfig.getApiBaseUrl();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${baseUrl}/query?q=${encodedQuery}`;

    const response = await SalesforceClient.get<any>(url);
    const records = response?.data?.records || [];

    if (records.length === 0) {
      return 0;
    }

    // Delete each record
    let deleteCount = 0;
    for (const record of records) {
      try {
        const instance = new this({ Id: record.Id });
        await instance.delete();
        deleteCount++;
      } catch (error) {
        console.error(`Failed to delete record ${record.Id}:`, error);
      }
    }

    return deleteCount;
  }

  /**
   * Counts records matching a lambda condition
   *
   * @param condition - Lambda expression for filtering
   *
   * @example
   * ```typescript
   * const count = await Account.count(x => x.Industry === 'Technology');
   * ```
   */
  static async count<T extends LambdaModel>(
    this: new (data?: any) => T,
    condition?: (x: T) => boolean
  ): Promise<number> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();

    let soql = `SELECT COUNT() FROM ${objectName}`;

    if (condition) {
      const whereClause = LambdaModel.parser.parseWhere(condition);
      soql += ` WHERE ${whereClause}`;
    }

    const baseUrl = SalesforceConfig.getApiBaseUrl();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${baseUrl}/query?q=${encodedQuery}`;

    const response = await SalesforceClient.get<any>(url);

    return response?.data?.totalSize || 0;
  }

  /**
   * Checks if any records match a lambda condition
   *
   * @param condition - Lambda expression for filtering
   *
   * @example
   * ```typescript
   * const exists = await Account.exists(x => x.Name === 'Acme Corp');
   * ```
   */
  static async exists<T extends LambdaModel>(
    this: new (data?: any) => T,
    condition: (x: T) => boolean
  ): Promise<boolean> {
    const ModelClass = this as any;
    const objectName = ModelClass.getObjectName();

    const whereClause = LambdaModel.parser.parseWhere(condition);
    const soql = `SELECT COUNT() FROM ${objectName} WHERE ${whereClause}`;

    const baseUrl = SalesforceConfig.getApiBaseUrl();
    const encodedQuery = encodeURIComponent(soql);
    const url = `${baseUrl}/query?q=${encodedQuery}`;

    const response = await SalesforceClient.get<any>(url);
    const count = response?.data?.totalSize || 0;

    return count > 0;
  }
}
