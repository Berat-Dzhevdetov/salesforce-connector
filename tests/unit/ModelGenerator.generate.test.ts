import { describe, it, expect } from 'vitest';
import { ModelGenerator } from '../../src/generators/ModelGenerator';
import { SalesforceObjectMetadata, SalesforceField } from '../../src/generators/MetadataFetcher';

/**
 * Tests for ModelGenerator (lines 37-310)
 */

function makeField(overrides: Partial<SalesforceField> & { name: string; type: string; label: string }): SalesforceField {
  return {
    nillable: true,
    updateable: true,
    createable: true,
    custom: false,
    calculated: false,
    autoNumber: false,
    ...overrides,
  };
}

function makeMetadata(fields: SalesforceField[], overrides: Partial<SalesforceObjectMetadata> = {}): SalesforceObjectMetadata {
  return {
    name: 'Account',
    label: 'Account',
    labelPlural: 'Accounts',
    custom: false,
    fields,
    childRelationships: [],
    ...overrides,
  };
}

describe('ModelGenerator', () => {
  describe('mapFieldType() - all Salesforce types (lines 37-73)', () => {
    const typeMap: Array<[string, string]> = [
      ['id', 'string'],
      ['reference', 'string'],
      ['string', 'string'],
      ['picklist', 'string'],
      ['multipicklist', 'string'],
      ['textarea', 'string'],
      ['email', 'string'],
      ['url', 'string'],
      ['phone', 'string'],
      ['address', 'string'],
      ['encryptedstring', 'string'],
      ['int', 'number'],
      ['double', 'number'],
      ['currency', 'number'],
      ['percent', 'number'],
      ['boolean', 'boolean'],
      ['date', 'Date'],
      ['datetime', 'Date'],
      ['time', 'string'],
      ['base64', 'string'],
      ['unknowntype', 'any'],
    ];

    for (const [sfType, tsType] of typeMap) {
      it(`should map ${sfType} to ${tsType}`, () => {
        const metadata = makeMetadata([makeField({ name: 'Field', type: sfType, label: 'Field' })]);
        const code = ModelGenerator.generate(metadata, { includeComments: false });
        expect(code).toContain(`Field?: ${tsType} | undefined`);
      });
    }
  });

  describe('generateInterface() (lines 78-120)', () => {
    it('should generate interface with comments by default', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Name', type: 'string', label: 'Account Name' }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('export interface AccountData {');
      expect(code).toContain('/** Account Name */');
      expect(code).toContain('Name?: string | undefined;');
    });

    it('should generate interface without comments', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Name', type: 'string', label: 'Account Name' }),
      ]);
      const code = ModelGenerator.generate(metadata, { includeComments: false });

      expect(code).not.toContain('/** Account Name */');
      expect(code).toContain('Name?: string | undefined;');
    });

    it('should add (Custom) annotation for custom fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Active__c', type: 'boolean', label: 'Active', custom: true }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('(Custom)');
    });

    it('should add (Formula) annotation for calculated fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Formula__c', type: 'string', label: 'Formula', calculated: true }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('(Formula)');
    });

    it('should add (Auto Number) annotation for autonumber fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'AutoNum', type: 'string', label: 'Auto Num', autoNumber: true }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('(Auto Number)');
    });

    it('should filter fields by includeFields option', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
        makeField({ name: 'Industry', type: 'string', label: 'Industry' }),
      ]);
      const code = ModelGenerator.generate(metadata, { includeFields: ['Id', 'Name'] });

      expect(code).toContain('Id?:');
      expect(code).toContain('Name?:');
      expect(code).not.toContain('Industry?:');
    });

    it('should exclude fields by excludeFields option', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
        makeField({ name: 'Industry', type: 'string', label: 'Industry' }),
      ]);
      const code = ModelGenerator.generate(metadata, { excludeFields: ['Industry'] });

      expect(code).toContain('Id?:');
      expect(code).toContain('Name?:');
      expect(code).not.toContain('Industry?:');
    });
  });

  describe('generateLambdaGetters() - LambdaModel (lines 125-175)', () => {
    it('should generate LambdaModel getters with default values', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
        makeField({ name: 'Amount', type: 'currency', label: 'Amount' }),
        makeField({ name: 'Active', type: 'boolean', label: 'Active' }),
        makeField({ name: 'CloseDate', type: 'date', label: 'Close Date' }),
      ]);

      const code = ModelGenerator.generate(metadata, { includeComments: false });

      expect(code).toContain("return this.get('Name');");
      expect(code).toContain("return this.get('Amount');");
      expect(code).toContain("return this.get('Active');");
      expect(code).toContain("return this.get('CloseDate');");
    });

    it('should use undefined as any for unknown type defaults', () => {
      const metadata = makeMetadata([
        makeField({ name: 'ComplexField', type: 'unknowntype', label: 'Complex' }),
      ]);

      const code = ModelGenerator.generate(metadata, { includeComments: false });

      expect(code).toContain("return this.get('ComplexField');");
    });
  });

  describe('generateLegacyAccessors() - legacy Model (lines 180-223)', () => {
    it('should generate getter and setter for updateable fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Name', type: 'string', label: 'Name', updateable: true, calculated: false, autoNumber: false }),
      ]);

      const code = ModelGenerator.generate(metadata, { useLegacyModel: true, includeComments: false });

      expect(code).toContain("get Name(): string | undefined");
      expect(code).toContain("return this.get('Name')");
      expect(code).toContain("set Name(value: string | undefined)");
      expect(code).toContain("this.set('Name', value)");
    });

    it('should not generate setter for non-updateable fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Id', type: 'id', label: 'ID', updateable: false }),
      ]);

      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).toContain("get Id()");
      expect(code).not.toContain("set Id(");
    });

    it('should not generate setter for calculated fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Formula', type: 'string', label: 'Formula', updateable: true, calculated: true }),
      ]);

      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).not.toContain("set Formula(");
    });

    it('should not generate setter for autoNumber fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'AutoNum', type: 'string', label: 'Auto', updateable: true, autoNumber: true }),
      ]);

      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).not.toContain("set AutoNum(");
    });
  });

  describe('generate() - class code (lines 229-292)', () => {
    it('should import LambdaModel by default', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain("import { LambdaModel } from 'javascript-salesforce-connector'");
      expect(code).not.toContain("import { Model }");
    });

    it('should import Model when useLegacyModel=true', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).toContain("import { Model } from 'javascript-salesforce-connector'");
    });

    it('should include class comment with model name', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('* Model for Account (Account)');
    });

    it('should include Custom Object annotation for custom objects', () => {
      const metadata = makeMetadata([], { custom: true });
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('* Custom Object');
    });

    it('should include legacy deprecation warning when useLegacyModel=true', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).toContain('deprecated');
    });

    it('should extend LambdaModel by default', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('extends LambdaModel<AccountData>');
    });

    it('should extend Model when useLegacyModel=true', () => {
      const metadata = makeMetadata([]);
      const code = ModelGenerator.generate(metadata, { useLegacyModel: true });

      expect(code).toContain('extends Model<AccountData>');
    });

    it('should include dateFields array when date fields present', () => {
      const metadata = makeMetadata([
        makeField({ name: 'CloseDate', type: 'date', label: 'Close Date' }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('protected static dateFields = ["CloseDate"]');
    });

    it('should include dateTimeFields array when datetime fields present', () => {
      const metadata = makeMetadata([
        makeField({ name: 'CreatedDate', type: 'datetime', label: 'Created Date' }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).toContain('protected static dateTimeFields = ["CreatedDate"]');
    });

    it('should not include dateFields when no date fields', () => {
      const metadata = makeMetadata([
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);
      const code = ModelGenerator.generate(metadata);

      expect(code).not.toContain('protected static dateFields');
    });
  });

  describe('generateMultiple() (lines 297-309)', () => {
    it('should generate models for multiple objects', () => {
      const accountMeta = makeMetadata([], { name: 'Account', label: 'Account' });
      const contactMeta = makeMetadata([], { name: 'Contact', label: 'Contact', labelPlural: 'Contacts' });

      const result = ModelGenerator.generateMultiple([accountMeta, contactMeta]);

      expect(result.size).toBe(2);
      expect(result.has('Account')).toBe(true);
      expect(result.has('Contact')).toBe(true);
      expect(result.get('Account')).toContain('class Account');
      expect(result.get('Contact')).toContain('class Contact');
    });

    it('should return empty map for empty input', () => {
      const result = ModelGenerator.generateMultiple([]);
      expect(result.size).toBe(0);
    });
  });
});
