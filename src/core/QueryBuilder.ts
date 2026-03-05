import { SalesforceClient } from './SalesforceClient';
import { SalesforceConfig } from './SalesforceConfig';
import { SalesforceQueryResponse, QueryOperator } from '../types';

/**
 * Query builder for constructing and executing SOQL queries
 */
type WhereClause = {
  condition: string;
  connector: 'AND' | 'OR';
};

export class QueryBuilder<T = any> {
  private selectedFields: string[] = [];
  private whereClauses: WhereClause[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private orderByField?: string;
  private orderDirection: 'ASC' | 'DESC' = 'ASC';
  private modelConstructor?: new (data?: any) => T;
  private dateFields: string[] = [];
  private dateTimeFields: string[] = [];

  constructor(
    private objectName: string,
    modelConstructor?: new (data?: any) => T,
    dateFields?: string[],
    dateTimeFields?: string[]
  ) {
    this.modelConstructor = modelConstructor;
    this.dateFields = dateFields || [];
    this.dateTimeFields = dateTimeFields || [];
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

    const formattedValue = this.formatValue(actualValue, field);
    this.whereClauses.push({
      condition: `${field} ${operator} ${formattedValue}`,
      connector: 'AND'
    });

    return this;
  }

  /**
   * Add OR WHERE clause
   * Usage: orWhere('Name', 'Ivan') or orWhere('Age', '>', 18)
   */
  public orWhere(field: string, operatorOrValue: QueryOperator | any, value?: any): this {
    if (!field || typeof field !== 'string') {
      throw new Error('orWhere() requires a valid field name');
    }

    let operator: QueryOperator = '=';
    let actualValue: any;

    // Handle two-parameter form: orWhere('Name', 'Ivan')
    if (value === undefined) {
      actualValue = operatorOrValue;
    } else {
      // Handle three-parameter form: orWhere('Age', '>', 18)
      operator = operatorOrValue as QueryOperator;
      actualValue = value;
    }

    const formattedValue = this.formatValue(actualValue, field);
    this.whereClauses.push({
      condition: `${field} ${operator} ${formattedValue}`,
      connector: 'OR'
    });

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

    const formattedValues = values.map(v => this.formatValue(v, field)).join(', ');
    this.whereClauses.push({
      condition: `${field} IN (${formattedValues})`,
      connector: 'AND'
    });

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

    const formattedValues = values.map(v => this.formatValue(v, field)).join(', ');
    this.whereClauses.push({
      condition: `${field} NOT IN (${formattedValues})`,
      connector: 'AND'
    });

    return this;
  }

  /**
   * Add a grouped OR WHERE clause
   * Usage:
   * query.where('IsActive', true)
   *      .orWhereGroup(qb => {
   *        qb.where('Name', 'LIKE', '%John%')
   *          .orWhere('Email', 'LIKE', '%john%')
   *      })
   * Results in: WHERE IsActive = TRUE AND (Name LIKE '%John%' OR Email LIKE '%john%')
   */
  public orWhereGroup(callback: (qb: QueryBuilder<T>) => void): this {
    // Create a new query builder for the group
    const groupBuilder = new QueryBuilder<T>(
      this.objectName,
      this.modelConstructor,
      this.dateFields,
      this.dateTimeFields
    );

    // Execute the callback to build the group conditions
    callback(groupBuilder);

    // Get the conditions from the group builder
    if (groupBuilder.whereClauses.length === 0) {
      throw new Error('orWhereGroup() requires at least one condition inside the group');
    }

    // Build the grouped condition string
    const groupConditions = groupBuilder.whereClauses
      .map((clause, index) => {
        if (index === 0) {
          return clause.condition;
        }
        return `${clause.connector} ${clause.condition}`;
      })
      .join(' ');

    // Add the grouped condition with OR connector
    this.whereClauses.push({
      condition: `(${groupConditions})`,
      connector: 'OR'
    });

    return this;
  }

  /**
   * Add a grouped AND WHERE clause
   * Usage:
   * query.where('IsActive', true)
   *      .whereGroup(qb => {
   *        qb.where('Name', 'LIKE', '%John%')
   *          .orWhere('Email', 'LIKE', '%john%')
   *      })
   * Results in: WHERE IsActive = TRUE AND (Name LIKE '%John%' OR Email LIKE '%john%')
   */
  public whereGroup(callback: (qb: QueryBuilder<T>) => void): this {
    // Create a new query builder for the group
    const groupBuilder = new QueryBuilder<T>(
      this.objectName,
      this.modelConstructor,
      this.dateFields,
      this.dateTimeFields
    );

    // Execute the callback to build the group conditions
    callback(groupBuilder);

    // Get the conditions from the group builder
    if (groupBuilder.whereClauses.length === 0) {
      throw new Error('whereGroup() requires at least one condition inside the group');
    }

    // Build the grouped condition string
    const groupConditions = groupBuilder.whereClauses
      .map((clause, index) => {
        if (index === 0) {
          return clause.condition;
        }
        return `${clause.connector} ${clause.condition}`;
      })
      .join(' ');

    // Add the grouped condition with AND connector
    this.whereClauses.push({
      condition: `(${groupConditions})`,
      connector: 'AND'
    });

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
    let fields: string;

    if (this.selectedFields.length > 0) {
      fields = this.selectedFields.join(', ');
    } else {
      // SOQL doesn't support SELECT *, so we default to Id
      // Models should explicitly select fields they need
      fields = 'FIELDS(ALL)';
      this.limitValue = this.limitValue || 200; // Default to 200 if no limit is set, to avoid large queries
    }

    let query = `SELECT ${fields} FROM ${this.objectName}`;

    if (this.whereClauses.length > 0) {
      const whereString = this.whereClauses
        .map((clause, index) => {
          if (index === 0) {
            // First clause doesn't need a connector
            return clause.condition;
          }
          // Subsequent clauses use their connector
          return `${clause.connector} ${clause.condition}`;
        })
        .join(' ');

      query += ` WHERE ${whereString}`;
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
      const limitedQuery = new QueryBuilder<T>(
        this.objectName,
        this.modelConstructor,
        this.dateFields,
        this.dateTimeFields
      );
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
