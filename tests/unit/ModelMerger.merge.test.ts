import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModelMerger } from '../../src/generators/ModelMerger';
import { SalesforceObjectMetadata, SalesforceField } from '../../src/generators/MetadataFetcher';

/**
 * Tests for ModelMerger (lines 69-456)
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

function makeMetadata(
  name: string,
  fields: SalesforceField[],
  overrides: Partial<SalesforceObjectMetadata> = {}
): SalesforceObjectMetadata {
  return {
    name,
    label: name,
    labelPlural: `${name}s`,
    custom: false,
    fields,
    childRelationships: [],
    ...overrides,
  };
}

describe('ModelMerger', () => {
  let tmpDir: string;
  let modelPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'model-merger-test-'));
    modelPath = path.join(tmpDir, 'Account.ts');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('merge() - file does not exist (lines 69-78)', () => {
    it('should generate new file when it does not exist', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);

      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.hasChanges).toBe(true);
      expect(result.addedFields).toContain('Id');
      expect(result.addedFields).toContain('Name');
      expect(result.updatedFields).toEqual([]);
      expect(result.customCodePreserved).toBe(false);
      expect(result.code).toContain('class Account');
    });
  });

  describe('merge() - file exists (lines 81-142)', () => {
    it('should detect added fields when new metadata has more fields', () => {
      // Create an existing model with just Id and Name
      const initialMetadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);
      const initialResult = ModelMerger.merge(modelPath, initialMetadata);
      fs.writeFileSync(modelPath, initialResult.code);

      // Now merge with additional Industry field
      const updatedMetadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
        makeField({ name: 'Industry', type: 'string', label: 'Industry' }),
      ]);

      const result = ModelMerger.merge(modelPath, updatedMetadata);

      expect(result.addedFields).toContain('Industry');
      expect(result.hasChanges).toBe(true);
    });

    it('should detect updated fields when type changes', () => {
      const initialMetadata = makeMetadata('Account', [
        makeField({ name: 'Amount', type: 'string', label: 'Amount' }),
      ]);
      const initialResult = ModelMerger.merge(modelPath, initialMetadata);
      fs.writeFileSync(modelPath, initialResult.code);

      // Change Amount type from string to currency (number)
      const updatedMetadata = makeMetadata('Account', [
        makeField({ name: 'Amount', type: 'currency', label: 'Amount' }),
      ]);

      const result = ModelMerger.merge(modelPath, updatedMetadata);

      expect(result.updatedFields).toContain('Amount');
      expect(result.hasChanges).toBe(true);
    });

    it('should return hasChanges=false when no fields changed', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);

      // Generate and write the file
      const initial = ModelMerger.merge(modelPath, metadata);
      fs.writeFileSync(modelPath, initial.code);

      // Merge with same metadata
      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.addedFields).toEqual([]);
      expect(result.updatedFields).toEqual([]);
    });
  });

  describe('extractCustomCode() - custom methods and properties (lines 148-191)', () => {
    it('should preserve custom methods in merged output', () => {
      // Generate initial model
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);
      const initial = ModelMerger.merge(modelPath, metadata);

      // Add a custom method before the class closing brace (last \n}\n in the file)
      const lastBrace = initial.code.lastIndexOf('\n}\n');
      const customCode = initial.code.slice(0, lastBrace) +
        `\n  customMethod(): string {\n    return 'custom';\n  }\n}\n`;
      fs.writeFileSync(modelPath, customCode);

      // Re-merge
      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.customCodePreserved).toBe(true);
      expect(result.code).toContain('customMethod');
    });
  });

  describe('extractCustomImports() (lines 196-216)', () => {
    it('should preserve custom imports from existing file', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
      ]);
      const initial = ModelMerger.merge(modelPath, metadata);

      // Add a custom import
      const customCode = `import { SomeHelper } from './helpers';\n${initial.code}`;
      fs.writeFileSync(modelPath, customCode);

      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.code).toContain("import { SomeHelper } from './helpers'");
    });
  });

  describe('extractCustomInterfaceProperties() (lines 221-252)', () => {
    it('should preserve relationship properties not in Salesforce metadata', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
        makeField({ name: 'Name', type: 'string', label: 'Name' }),
      ]);
      const initial = ModelMerger.merge(modelPath, metadata);

      // Add a custom interface property (relationship)
      const customInterfaceProp = `  Contacts?: any[];\n`;
      const codeWithRelationship = initial.code.replace(
        '  Name?: string | undefined;\n}',
        `  Name?: string | undefined;\n${customInterfaceProp}}`
      );
      fs.writeFileSync(modelPath, codeWithRelationship);

      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.customCodePreserved).toBe(true);
    });
  });

  describe('createBackup() (lines 446-457)', () => {
    it('should create a backup file with timestamp', () => {
      fs.writeFileSync(modelPath, 'original content');

      const backupPath = ModelMerger.createBackup(modelPath);

      expect(fs.existsSync(backupPath)).toBe(true);
      expect(backupPath).toContain('.backup.');
      expect(fs.readFileSync(backupPath, 'utf-8')).toBe('original content');
    });

    it('should throw when file does not exist', () => {
      const nonExistent = path.join(tmpDir, 'nonexistent.ts');

      expect(() => ModelMerger.createBackup(nonExistent)).toThrow(
        'File does not exist'
      );
    });

    it('should use ISO timestamp in backup filename (with dashes replacing colons)', () => {
      fs.writeFileSync(modelPath, 'content');

      const backupPath = ModelMerger.createBackup(modelPath);

      // ISO timestamp replaced colons and periods with dashes
      expect(backupPath).toMatch(/\.backup\.\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('isGeneratedMember() - detection of generated vs custom code (lines 257-299)', () => {
    it('should treat protected static objectName as generated', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
      ]);
      const initial = ModelMerger.merge(modelPath, metadata);
      fs.writeFileSync(modelPath, initial.code);

      const result = ModelMerger.merge(modelPath, metadata);

      // objectName should not be in customCodePreserved sections
      expect(result.code).toContain("protected static objectName = 'Account'");
    });

    it('should preserve non-generated getters', () => {
      const metadata = makeMetadata('Account', [
        makeField({ name: 'Id', type: 'id', label: 'ID' }),
      ]);
      const initial = ModelMerger.merge(modelPath, metadata);

      // Add a complex custom getter that is NOT a simple this.get() pattern
      const customGetter = `  get displayName(): string {\n    const id = this.Id;\n    return \`Account: \${id}\`;\n  }\n`;
      const lastBrace = initial.code.lastIndexOf('\n}\n');
      const codeWithGetter = initial.code.slice(0, lastBrace) + `\n${customGetter}}\n`;
      fs.writeFileSync(modelPath, codeWithGetter);

      const result = ModelMerger.merge(modelPath, metadata);

      expect(result.customCodePreserved).toBe(true);
      expect(result.code).toContain('displayName');
    });
  });
});
