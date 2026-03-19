import { SubqueryBuilder } from './SubqueryBuilder';

/**
 * RelationshipArray combines array behavior with query builder methods.
 * At runtime, results are a plain array: result.Contacts.map(x => x.Name)
 * At query time, provides .select() method: x.Contacts.select(c => ({...}))
 */
export type RelationshipArray<T> = T[] & {
  select<TResult>(selector: (item: T) => TResult): SubqueryResult<T, TResult>;
};

/**
 * Result type for subqueries that allows further chaining
 */
export type SubqueryResult<T, TResult> = TResult[] & SubqueryBuilder<T, TResult>;

/**
 * Helper function to create a RelationshipArray
 * Used primarily for type safety in model definitions
 */
export function relationshipArray<T>(): RelationshipArray<T> {
  return [] as any;
}
