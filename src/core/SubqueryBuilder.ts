import { LambdaParser } from './LambdaParser';

/**
 * SubqueryBuilder provides chainable methods for building SOQL subqueries
 * Used when querying relationships with lambda syntax
 *
 * Note: Subqueries are parsed during SELECT parsing via LambdaParser.buildSubqueryFromChain(),
 * so WHERE clauses are handled by LambdaParser.parseWhereFromNode() which supports closure variables.
 */
export class SubqueryBuilder<TModel, TResult> {
  private parser: LambdaParser;
  private relationshipName: string;
  private selectedFields: string[];
  private whereClause: string = '';
  private orderByClause: string = '';
  private limitValue: number | null = null;
  private offsetValue: number | null = null;

  constructor(relationshipName: string, selectedFields: string[]) {
    this.parser = new LambdaParser();
    this.relationshipName = relationshipName;
    this.selectedFields = selectedFields;
  }

  /**
   * Adds a WHERE condition to the subquery
   * Multiple where calls are combined with AND
   *
   * Supports closure variables via Inspector Protocol:
   * - Simple variables: .where(c => c.Status === status)
   * - Object properties: .where(c => c.Priority === config.priority)
   * - Nested properties: .where(c => c.Type === settings.filters.type)
   */
  where(condition: (x: TModel) => boolean): this {
    const newCondition = this.parser.parseWhere(condition);

    if (this.whereClause) {
      this.whereClause = `${this.whereClause} AND ${newCondition}`;
    } else {
      this.whereClause = newCondition;
    }

    return this;
  }

  /**
   * Adds ORDER BY clause to the subquery
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
   * Limits the number of records returned by the subquery
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Skips the first N records in the subquery
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Builds the complete SOQL subquery string
   */
  toSOQL(): string {
    const fieldsList = this.selectedFields.join(', ');
    let soql = `SELECT ${fieldsList} FROM ${this.relationshipName}`;

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

    return `(${soql})`;
  }
}
