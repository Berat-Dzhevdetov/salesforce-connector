/**
 * Salesforce ORM Module
 * ActiveRecord-style interface for Salesforce REST API
 */

// Core exports
export { Model } from './core/Model';
export { QueryBuilder } from './core/QueryBuilder';
export { SalesforceConfig } from './core/SalesforceConfig';
export { SalesforceClient } from './core/SalesforceClient';

// Observer exports
export type { Observer, ObserverOptions } from './core/Observer';

// Type exports
export type {
  SalesforceConfig as ISalesforceConfig,
  SalesforceAuthResponse,
  SalesforceQueryResponse,
  SalesforceErrorResponse,
  WhereClause,
  ModelData,
  QueryOperator,
} from './types';
  