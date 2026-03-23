/**
 * Type helpers for lambda expressions in WHERE clauses
 * These types enable TypeScript support for SOQL-specific operations
 */

/**
 * Augments primitive types with SOQL query methods
 * - includes() accepts both single values (for LIKE) and arrays (for IN)
 * - startsWith() and endsWith() for LIKE patterns
 */
export type SOQLField<T> = T & {
  /**
   * For string pattern matching: field.includes(searchString) → LIKE '%searchString%'
   * For array membership: field.includes([val1, val2]) → IN (val1, val2)
   */
  includes(searchValue: T | T[] | any[]): boolean;

  /**
   * String pattern matching: field.startsWith(prefix) → LIKE 'prefix%'
   */
  startsWith(searchString: string): boolean;

  /**
   * String pattern matching: field.endsWith(suffix) → LIKE '%suffix'
   */
  endsWith(searchString: string): boolean;
};

/**
 * Recursively converts all primitive fields in a type to SOQLField types
 * This allows lambda parameters to have the includes/startsWith/endsWith methods
 */
export type SOQLProxy<T> = {
  [K in keyof T]: T[K] extends string | number | boolean
    ? SOQLField<T[K]>
    : T[K] extends object
    ? SOQLProxy<T[K]>
    : T[K];
};
