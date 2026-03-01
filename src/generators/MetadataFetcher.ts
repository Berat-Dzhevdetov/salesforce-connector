import { SalesforceClient } from '../core/SalesforceClient';
import { SalesforceConfig } from '../core/SalesforceConfig';

/**
 * Salesforce field metadata
 */
export interface SalesforceField {
  name: string;
  type: string;
  label: string;
  length?: number;
  precision?: number;
  scale?: number;
  referenceTo?: string[];
  relationshipName?: string | null;
  nillable: boolean;
  updateable: boolean;
  createable: boolean;
  custom: boolean;
  calculated: boolean;
  autoNumber: boolean;
  defaultValue?: any;
  picklistValues?: Array<{ label: string; value: string }>;
}

/**
 * Salesforce child relationship metadata
 */
export interface SalesforceChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string | null;
}

/**
 * Salesforce object metadata
 */
export interface SalesforceObjectMetadata {
  name: string;
  label: string;
  labelPlural: string;
  custom: boolean;
  fields: SalesforceField[];
  childRelationships: SalesforceChildRelationship[];
}

/**
 * Fetches Salesforce object metadata using the Describe API
 */
export class MetadataFetcher {
  /**
   * Fetch metadata for a specific Salesforce object
   */
  public static async describe(objectName: string): Promise<SalesforceObjectMetadata> {
    try {
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects/${objectName}/describe`;

      const response = await SalesforceClient.get<any>(url);

      if (!response?.data) {
        throw new Error(`Failed to fetch metadata for ${objectName}`);
      }

      const data = response.data;

      return {
        name: data.name,
        label: data.label,
        labelPlural: data.labelPlural,
        custom: data.custom,
        fields: data.fields.map((field: any) => ({
          name: field.name,
          type: field.type,
          label: field.label,
          length: field.length,
          precision: field.precision,
          scale: field.scale,
          referenceTo: field.referenceTo,
          relationshipName: field.relationshipName,
          nillable: field.nillable,
          updateable: field.updateable,
          createable: field.createable,
          custom: field.custom,
          calculated: field.calculated,
          autoNumber: field.autoNumber,
          defaultValue: field.defaultValue,
          picklistValues: field.picklistValues,
        })),
        childRelationships: data.childRelationships.map((rel: any) => ({
          childSObject: rel.childSObject,
          field: rel.field,
          relationshipName: rel.relationshipName,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to describe ${objectName}: ${errorMessage}`);
    }
  }

  /**
   * Fetch metadata for multiple Salesforce objects
   */
  public static async describeMultiple(objectNames: string[]): Promise<SalesforceObjectMetadata[]> {
    return await Promise.all(objectNames.map((name) => this.describe(name)));
  }

  /**
   * List all available Salesforce objects
   */
  public static async listObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    try {
      const baseUrl = SalesforceConfig.getApiBaseUrl();
      const url = `${baseUrl}/sobjects`;

      const response = await SalesforceClient.get<any>(url);

      if (!response?.data?.sobjects) {
        throw new Error('Failed to fetch object list');
      }

      return response.data.sobjects.map((obj: any) => ({
        name: obj.name,
        label: obj.label,
        custom: obj.custom,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list objects: ${errorMessage}`);
    }
  }

  /**
   * List all custom objects
   */
  public static async listCustomObjects(): Promise<Array<{ name: string; label: string }>> {
    const allObjects = await this.listObjects();
    return allObjects.filter((obj) => obj.custom).map((obj) => ({ name: obj.name, label: obj.label }));
  }

  /**
   * List standard objects
   */
  public static async listStandardObjects(): Promise<Array<{ name: string; label: string }>> {
    const allObjects = await this.listObjects();
    return allObjects.filter((obj) => !obj.custom).map((obj) => ({ name: obj.name, label: obj.label }));
  }
}
