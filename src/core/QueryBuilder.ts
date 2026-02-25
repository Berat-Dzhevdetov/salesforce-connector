import { SalesforceClient } from './SalesforceClient';
import { SalesforceConfig } from './SalesforceConfig';
import { SalesforceQueryResponse, QueryOperator } from '../types';

/**
 * Query builder for constructing and executing SOQL queries
 */
export class QueryBuilder<T = any> {
  private selectedFields: string[] = [];
  private whereClauses: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private orderByField?: string;
  private orderDirection: 'ASC' | 'DESC' = 'ASC';
  private modelConstructor?: new (data?: any) => T;

  constructor(private objectName: string, modelConstructor?: new (data?: any) => T) {
    this.modelConstructor = modelConstructor;
  }

  /**
   * Select specific fields to return
   */
  public select(...fields: string[]): this {
    if (!fields || fields.length === 0) {
      throw new Error('select() requires at least one field');
    }

    // Validate fields
    fields.forEach(field => {
      if (!field || typeof field !== 'string' || field.trim() === '') {
        throw new Error('Invalid field name in select()');
      }
    });

    this.selectedFields = fields;
    return this;
  }

  /**
   * Add WHERE clause
   * Usage: where('Name', 'Ivan') or where('Age', '>', 18)
   */
  public where(field: string, operatorOrValue: QueryOperator | any, value?: any): this {
    if (!field || typeof field !== 'string') {
      throw new Error('where() requires a valid field name');
    }

    let operator: QueryOperator = '=';
    let actualValue: any;

    // Handle two-parameter form: where('Name', 'Ivan')
    if (value === undefined) {
      actualValue = operatorOrValue;
    } else {
      // Handle three-parameter form: where('Age', '>', 18)
      operator = operatorOrValue as QueryOperator;
      actualValue = value;
    }

    const formattedValue = this.formatValue(actualValue);
    this.whereClauses.push(`${field} ${operator} ${formattedValue}`);

    return this;
  }

  /**
   * Add WHERE IN clause
   */
  public whereIn(field: string, values: any[]): this {
    if (!field || typeof field !== 'string') {
      throw new Error('whereIn() requires a valid field name');
    }

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereIn() requires a non-empty array of values');
    }

    const formattedValues = values.map(v => this.formatValue(v)).join(', ');
    this.whereClauses.push(`${field} IN (${formattedValues})`);

    return this;
  }

  /**
   * Add WHERE NOT IN clause
   */
  public whereNotIn(field: string, values: any[]): this {
    if (!field || typeof field !== 'string') {
      throw new Error('whereNotIn() requires a valid field name');
    }

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereNotIn() requires a non-empty array of values');
    }

    const formattedValues = values.map(v => this.formatValue(v)).join(', ');
    this.whereClauses.push(`${field} NOT IN (${formattedValues})`);

    return this;
  }

  /**
   * Add ORDER BY clause
   */
  public orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (!field || typeof field !== 'string') {
      throw new Error('orderBy() requires a valid field name');
    }

    this.orderByField = field;
    this.orderDirection = direction;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  public limit(value: number): this {
    if (!value || typeof value !== 'number' || value <= 0) {
      throw new Error('limit() requires a positive number');
    }

    this.limitValue = value;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  public offset(value: number): this {
    if (typeof value !== 'number' || value < 0) {
      throw new Error('offset() requires a non-negative number');
    }

    this.offsetValue = value;
    return this;
  }

  /**
   * Build the SOQL query string
   */
  public toSOQL(): string {
    const fields = this.selectedFields.length > 0 ? this.selectedFields.join(', ') : '*';

    let query = `SELECT ${fields} FROM ${this.objectName}`;

    if (this.whereClauses.length > 0) {
      query += ` WHERE ${this.whereClauses.join(' AND ')}`;
    }

    if (this.orderByField) {
      query += ` ORDER BY ${this.orderByField} ${this.orderDirection}`;
    }

    if (this.limitValue !== undefined) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return query;
  }

  /**
   * Execute the query and return results
   */
  public async get(): Promise<T[]> {
    try {
      const soql = this.toSOQL();
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const encodedQuery = encodeURIComponent(soql);
      const url = `${baseUrl}/query?q=${encodedQuery}`;

      const response = await SalesforceClient.get<SalesforceQueryResponse<any>>(url);

      if (!response?.data?.records) {
        return [];
      }

      // If a model constructor is provided, instantiate models
      if (this.modelConstructor) {
        return response.data.records.map((record: any) => new this.modelConstructor!(record));
      }

      // Otherwise return raw data
      return response.data.records;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute the query and return the first result
   */
  public async first(): Promise<T | null> {
    try {
      // Create a new query builder with limit 1 to avoid mutating this instance
      const limitedQuery = new QueryBuilder<T>(this.objectName, this.modelConstructor);
      limitedQuery.selectedFields = [...this.selectedFields];
      limitedQuery.whereClauses = [...this.whereClauses];
      limitedQuery.orderByField = this.orderByField;
      limitedQuery.orderDirection = this.orderDirection;
      limitedQuery.offsetValue = this.offsetValue;
      limitedQuery.limitValue = 1;

      const results = await limitedQuery.get();
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Format a value for SOQL query
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      // Escape single quotes in strings
      return `'${value.replace(/'/g, "\\'")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    // For objects and arrays, convert to JSON string
    return `'${JSON.stringify(value).replace(/'/g, "\\'")}'`;
  }
}
