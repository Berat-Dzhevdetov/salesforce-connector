import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataFetcher } from '../../src/generators/MetadataFetcher';
import { SalesforceClient } from '../../src/core/SalesforceClient';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

/**
 * Tests for MetadataFetcher (lines 55-149)
 */
describe('MetadataFetcher', () => {
  beforeEach(() => {
    vi.spyOn(SalesforceConfig, 'getApiBaseUrl').mockReturnValue(
      'https://test.salesforce.com/services/data/v58.0'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAccountDescribe = {
    name: 'Account',
    label: 'Account',
    labelPlural: 'Accounts',
    custom: false,
    fields: [
      {
        name: 'Id',
        type: 'id',
        label: 'Account ID',
        length: 18,
        precision: 0,
        scale: 0,
        referenceTo: [],
        relationshipName: null,
        nillable: false,
        updateable: false,
        createable: false,
        custom: false,
        calculated: false,
        autoNumber: false,
        defaultValue: null,
        picklistValues: [],
      },
      {
        name: 'Name',
        type: 'string',
        label: 'Account Name',
        length: 255,
        nillable: false,
        updateable: true,
        createable: true,
        custom: false,
        calculated: false,
        autoNumber: false,
      },
    ],
    childRelationships: [
      {
        childSObject: 'Contact',
        field: 'AccountId',
        relationshipName: 'Contacts',
      },
    ],
  };

  describe('describe() (lines 54-100)', () => {
    it('should return structured metadata for a Salesforce object', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: mockAccountDescribe,
      } as any);

      const result = await MetadataFetcher.describe('Account');

      expect(result.name).toBe('Account');
      expect(result.label).toBe('Account');
      expect(result.labelPlural).toBe('Accounts');
      expect(result.custom).toBe(false);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].name).toBe('Id');
      expect(result.fields[0].type).toBe('id');
      expect(result.childRelationships).toHaveLength(1);
      expect(result.childRelationships[0].childSObject).toBe('Contact');
    });

    it('should map all field properties correctly', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: mockAccountDescribe,
      } as any);

      const result = await MetadataFetcher.describe('Account');

      const idField = result.fields[0];
      expect(idField.length).toBe(18);
      expect(idField.precision).toBe(0);
      expect(idField.scale).toBe(0);
      expect(idField.referenceTo).toEqual([]);
      expect(idField.relationshipName).toBeNull();
      expect(idField.nillable).toBe(false);
      expect(idField.updateable).toBe(false);
      expect(idField.createable).toBe(false);
      expect(idField.custom).toBe(false);
      expect(idField.calculated).toBe(false);
      expect(idField.autoNumber).toBe(false);
    });

    it('should throw when response has no data', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: null,
      } as any);

      await expect(MetadataFetcher.describe('Account')).rejects.toThrow(
        'Failed to describe Account'
      );
    });

    it('should throw with wrapped error message on failure', async () => {
      vi.spyOn(SalesforceClient, 'get').mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(MetadataFetcher.describe('Account')).rejects.toThrow(
        'Failed to describe Account: Network error'
      );
    });

    it('should call the correct URL', async () => {
      const getSpy = vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: mockAccountDescribe,
      } as any);

      await MetadataFetcher.describe('Contact');

      expect(getSpy).toHaveBeenCalledWith(
        'https://test.salesforce.com/services/data/v58.0/sobjects/Contact/describe'
      );
    });

    it('should handle unknown error type in catch block', async () => {
      vi.spyOn(SalesforceClient, 'get').mockRejectedValueOnce('string error');

      await expect(MetadataFetcher.describe('Account')).rejects.toThrow(
        'Failed to describe Account: Unknown error'
      );
    });
  });

  describe('describeMultiple() (lines 105-107)', () => {
    it('should fetch metadata for multiple objects in parallel', async () => {
      const getSpy = vi.spyOn(SalesforceClient, 'get')
        .mockResolvedValueOnce({ data: { ...mockAccountDescribe, name: 'Account' } } as any)
        .mockResolvedValueOnce({ data: { ...mockAccountDescribe, name: 'Contact', label: 'Contact', labelPlural: 'Contacts' } } as any);

      const results = await MetadataFetcher.describeMultiple(['Account', 'Contact']);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Account');
      expect(results[1].name).toBe('Contact');
    });

    it('should return empty array for empty input', async () => {
      const results = await MetadataFetcher.describeMultiple([]);
      expect(results).toEqual([]);
    });
  });

  describe('listObjects() (lines 112-132)', () => {
    const mockSObjectList = {
      sobjects: [
        { name: 'Account', label: 'Account', custom: false },
        { name: 'Contact', label: 'Contact', custom: false },
        { name: 'MyObject__c', label: 'My Object', custom: true },
      ],
    };

    it('should return all objects with name, label, and custom flag', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: mockSObjectList,
      } as any);

      const result = await MetadataFetcher.listObjects();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: 'Account', label: 'Account', custom: false });
      expect(result[2]).toEqual({ name: 'MyObject__c', label: 'My Object', custom: true });
    });

    it('should throw when sobjects list is missing', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {},
      } as any);

      await expect(MetadataFetcher.listObjects()).rejects.toThrow(
        'Failed to list objects'
      );
    });

    it('should call correct URL for listing objects', async () => {
      const getSpy = vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: mockSObjectList,
      } as any);

      await MetadataFetcher.listObjects();

      expect(getSpy).toHaveBeenCalledWith(
        'https://test.salesforce.com/services/data/v58.0/sobjects'
      );
    });
  });

  describe('listCustomObjects() (lines 137-140)', () => {
    it('should return only custom objects', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          sobjects: [
            { name: 'Account', label: 'Account', custom: false },
            { name: 'MyObj__c', label: 'My Obj', custom: true },
            { name: 'OtherObj__c', label: 'Other Obj', custom: true },
          ],
        },
      } as any);

      const result = await MetadataFetcher.listCustomObjects();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'MyObj__c', label: 'My Obj' });
      expect(result.every(o => !('custom' in o))).toBe(true);
    });
  });

  describe('listStandardObjects() (lines 145-148)', () => {
    it('should return only standard objects', async () => {
      vi.spyOn(SalesforceClient, 'get').mockResolvedValueOnce({
        data: {
          sobjects: [
            { name: 'Account', label: 'Account', custom: false },
            { name: 'Contact', label: 'Contact', custom: false },
            { name: 'MyObj__c', label: 'My Obj', custom: true },
          ],
        },
      } as any);

      const result = await MetadataFetcher.listStandardObjects();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'Account', label: 'Account' });
      expect(result.every(o => !('custom' in o))).toBe(true);
    });
  });
});
