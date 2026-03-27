import { SalesforceClient } from './SalesforceClient';
import { SalesforceConfig } from './SalesforceConfig';
import { SalesforceQueryResponse, PaginatedResponse, SOQLProxy } from '../types';
import { LambdaParser } from './LambdaParser';

/**
 * TypedQueryBuilder provides a type-safe, lambda-based query interface
 * for Salesforce ORM queries with full TypeScript inference
 */
export class TypedQueryBuilder<TModel, TResult> {
  private parser: LambdaParser;
  private objectName: string;
  private fieldMap: Record<keyof TResult, string>;
  private whereClause: string = '';
  private orderByClause: string = '';
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private modelConstructor?: new (data?: any) => TModel;
  private dateFields: string[] = [];
  private dateTimeFields: string[] = [];

  constructor(
    objectName: string,
    fieldMap: Record<keyof TResult, string>,
    modelConstructor?: new (data?: any) => TModel,
    dateFields?: string[],
    dateTimeFields?: string[]
  ) {
    this.parser = new LambdaParser();
    this.objectName = objectName;
    this.fieldMap = fieldMap;
    this.modelConstructor = modelConstructor;
    this.dateFields = dateFields || [];
    this.dateTimeFields = dateTimeFields || [];
  }

  /**
   * Adds a WHERE condition to the query
   * Multiple where calls are combined with AND
   *
   * Supports:
   * - Literal values: .where(x => x.Industry === 'Technology')
   * - Closure variables: .where(x => x.Industry === industry)
   * - String methods: .where(x => x.Name.includes(searchTerm))
   * - Array membership: .where(x => x.Industry.includes(['Technology', 'Finance']))
   * - Multiple conditions: .where(x => x.A === 'a' && x.B > 10)
   * - OR conditions: .where(x => x.A === 'a' || x.B === 'b')
   */
  where(condition: (x: SOQLProxy<TModel>) => boolean): this {
    const newCondition = this.parser.parseWhere(condition);

    if (this.whereClause) {
      this.whereClause = `${this.whereClause} AND ${newCondition}`;
    } else {
      this.whereClause = newCondition;
    }

    return this;
  }

  /**
   * Adds ORDER BY clause to the query
   */
  orderBy<K extends keyof TModel>(
    fieldSelector: (x: TModel) => TModel[K],
    direction: 'ASC' | 'DESC' = 'ASC'
  ): this {
    const parsedMap = this.parser.parseSelector(fieldSelector as any);
    const fieldName = Object.values(parsedMap)[0];
    this.orderByClause = `ORDER BY ${fieldName} ${direction}`;
    return this;
  }

  /**
   * Limits the number of records returned
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Skips the first N records
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Builds the complete SOQL query string
   */
  toSOQL(): string {
    // Convert field map to field list
    const fields = Object.values(this.fieldMap).join(', ');
    let soql = `SELECT ${fields} FROM ${this.objectName}`;

    if (this.whereClause) {
      soql += ` WHERE ${this.whereClause}`;
    }
    if (this.orderByClause) {
      soql += ` ${this.orderByClause}`;
    }
    if (this.limitValue !== null) {
      soql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== null) {
      soql += ` OFFSET ${this.offsetValue}`;
    }

    return soql;
  }

  /**
   * Executes the query and returns all results
   */
  async get(): Promise<TResult[]> {
    try {
      const soql = this.toSOQL();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const encodedQuery = encodeURIComponent(soql);
      const url = `${baseUrl}/query?q=${encodedQuery}`;

      const response = await SalesforceClient.get<SalesforceQueryResponse<any>>(url);

      if (!response?.data?.records) {
        return [];
      }

      const records = response.data.records;

      // Execute afterQuery observers if model constructor is available
      if (this.modelConstructor) {
        const instances = records.map((record: any) => new this.modelConstructor!(record));
        await (this.modelConstructor as any).executeObservers('afterQuery', instances);
      }

      // Map Salesforce records to the result type
      return records.map((record: any) => this.mapRecord(record));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Executes the query and returns the first result
   */
  async first(): Promise<TResult | null> {
    try {
      // Create a copy with limit 1 to avoid mutating this instance
      const limitedQuery = this.copy();
      limitedQuery.limitValue = 1;

      const results = await limitedQuery.get();
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute the query and return the count of matching records
   */
  async count(): Promise<number> {
    try {
      let query = `SELECT COUNT() FROM ${this.objectName}`;

      if (this.whereClause) {
        query += ` WHERE ${this.whereClause}`;
      }

      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const encodedQuery = encodeURIComponent(query);
      const url = `${baseUrl}/query?q=${encodedQuery}`;

      const response = await SalesforceClient.get<SalesforceQueryResponse<any>>(url);

      return response?.data?.totalSize || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Count query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Executes the query and returns a paginated result
   */
  async paginate(page: number = 1, itemsPerPage: number = 20): Promise<PaginatedResponse<TResult>> {
    try {
      // Validate inputs
      if (page < 1) {
        throw new Error('Page number must be 1 or greater');
      }
      if (itemsPerPage < 1) {
        throw new Error('Items per page must be 1 or greater');
      }

      // Calculate offset from page number (page is 1-based)
      const offset = (page - 1) * itemsPerPage;

      // Get the actual total count with a separate COUNT() query
      // This is necessary because Salesforce's totalSize with OFFSET only reflects the page size
      const totalSize = await this.count();

      // Create a copy and set pagination
      const paginatedQuery = this.copy();
      paginatedQuery.limitValue = itemsPerPage;
      paginatedQuery.offsetValue = offset;

      const soql = paginatedQuery.toSOQL();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const encodedQuery = encodeURIComponent(soql);
      const url = `${baseUrl}/query?q=${encodedQuery}`;

      const response = await SalesforceClient.get<SalesforceQueryResponse<any>>(url);

      if (!response?.data) {
        return {
          records: [],
          totalSize: 0,
          hasNextPage: false
        };
      }

      const records = response.data.records || [];

      // Map records to result type
      const mappedRecords = records.map((record: any) => this.mapRecord(record));

      // Calculate hasNextPage based on offset pagination
      // There's a next page if: (current offset + items fetched) < total records
      const hasNextPage = (offset + records.length) < totalSize;

      return {
        records: mappedRecords,
        totalSize,
        hasNextPage
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Paginated query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Create a copy of this query builder
   * Useful for creating variations without mutating the original
   */
  private copy(): TypedQueryBuilder<TModel, TResult> {
    const copied = new TypedQueryBuilder<TModel, TResult>(
      this.objectName,
      this.fieldMap,
      this.modelConstructor,
      this.dateFields,
      this.dateTimeFields
    );
    copied.whereClause = this.whereClause;
    copied.orderByClause = this.orderByClause;
    copied.limitValue = this.limitValue;
    copied.offsetValue = this.offsetValue;
    return copied;
  }

  /**
   * Maps a Salesforce record to the result type
   * Handles nested properties and subquery results
   */
  private mapRecord(record: any): TResult {
    const result: any = {};

    for (const [alias, fieldPath] of Object.entries(this.fieldMap)) {
      result[alias] = this.getNestedProperty(record, fieldPath as string);
    }

    return result as TResult;
  }

  /**
   * Gets a nested property value from a record
   * Handles both dot-notation paths and subquery results
   */
  private getNestedProperty(obj: any, path: string): any {
    if (!obj) return undefined;

    // Check if this is a subquery (path starts with parenthesis)
    if (path.startsWith('(') && path.endsWith(')')) {
      // Extract relationship name from SOQL
      // "(SELECT Id, Name FROM Contacts)" → "Contacts"
      const match = path.match(/FROM\s+(\w+)/i);
      if (match) {
        const relationshipName = match[1];
        const subqueryData = obj[relationshipName];

        // Salesforce returns { records: [...], done: true }
        if (subqueryData && subqueryData.records) {
          return subqueryData.records;
        }

        return []; // Empty array if no records
      }
    }

    // Regular field access with dot notation
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current?.[part] === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Convert Date objects to ISO strings for Salesforce API
   */
  private convertDatesToStrings(data: any): any {
    const allDateFields = [...this.dateFields, ...this.dateTimeFields];
    const result = { ...data };

    for (const field of allDateFields) {
      const value: any = result[field];
      if (value instanceof Date) {
        if (this.dateFields.includes(field)) {
          result[field] = value.toISOString().split('T')[0];
        } else {
          result[field] = value.toISOString();
        }
      }
    }

    return result;
  }

  /**
   * Format a value for SOQL
   */
  private formatValue(value: any, fieldName?: string): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (value instanceof Date) {
      // Check if this is a date field (not datetime)
      const isDateField = fieldName && this.dateFields.includes(fieldName);

      if (isDateField) {
        // For date fields, use YYYY-MM-DD format without quotes
        return value.toISOString().split('T')[0];
      } else {
        // For datetime fields, use full ISO string without quotes
        return value.toISOString();
      }
    }

    if (typeof value === 'string') {
      // Check if this field is a known date or datetime field
      const isDateField = fieldName && this.dateFields.includes(fieldName);
      const isDateTimeField = fieldName && this.dateTimeFields.includes(fieldName);

      if (isDateField || isDateTimeField) {
        // For date/datetime fields, return the value without quotes
        // Date format: YYYY-MM-DD
        // DateTime format: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sssZ

        // Check if the value looks like a datetime (has T in it)
        const hasTimeComponent = value.includes('T');

        if (hasTimeComponent) {
          // Ensure datetime values end with Z if they don't already and don't have a timezone
          if (!value.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(value)) {
            return `${value}Z`;
          }
        }

        // Return as-is without quotes (works for both date and datetime)
        return value;
      }

      // Regular string - escape single quotes and wrap in quotes
      return `'${value.replace(/'/g, "\\'")}'`;
    }

    // For objects and arrays, convert to JSON string
    return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
  }
}
