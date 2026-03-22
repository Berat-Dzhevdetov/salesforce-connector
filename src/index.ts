/**
 * Salesforce ORM Module
 * ActiveRecord-style interface for Salesforce REST API
 */

// Core exports
export { Model } from './core/Model';
export { QueryBuilder } from './core/QueryBuilder';
export { SalesforceConfig } from './core/SalesforceConfig';
export { SalesforceClient } from './core/SalesforceClient';

// Lambda-based query exports
export { LambdaModel } from './core/LambdaModel';
export { TypedQueryBuilder } from './core/TypedQueryBuilder';
export { LambdaParser } from './core/LambdaParser';
export type { RelationshipArray, SubqueryResult } from './core/RelationshipArray';
export { relationshipArray } from './core/RelationshipArray';

// Observer exports
export type { Observer, ObserverOptions } from './core/Observer';

// Type exports
export type {
  SalesforceConfig as ISalesforceConfig,
  SalesforceAuthResponse,
  SalesforceQueryResponse,
  SalesforceErrorResponse,
  PaginatedResponse,
  WhereClause,
  ModelData,
  QueryOperator,
} from './types';
  