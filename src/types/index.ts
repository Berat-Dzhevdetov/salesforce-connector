/**
 * Salesforce ORM Type Definitions
 */

export interface SalesforceConfig {
  instanceUrl: string;
  apiVersion: string;
  clientId?: string;
  clientSecret?: string;
  onTokenExpired?: () => Promise<string>;
}

export interface SalesforceAuthResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

export interface SalesforceQueryResponse<T = any> {
  totalSize: number;
  done: boolean;
  records: T[];
}

export interface SalesforceErrorResponse {
  message: string;
  errorCode: string;
  fields?: string[];
}

export interface WhereClause {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

export interface ModelData {
  [key: string]: any;
  Id?: string;
}

export type QueryOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
