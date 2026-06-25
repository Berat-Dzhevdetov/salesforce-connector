import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IndexMerger } from '../../src/generators/IndexMerger';

/**
 * Tests for IndexMerger (lines 61-199)
 */
describe('IndexMerger', () => {
  let tmpDir: string;
  let indexPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-merger-test-'));
    indexPath = path.join(tmpDir, 'index.ts');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('merge() - file does not exist (lines 61-69)', () => {
    it('should create new index content when file does not exist', () => {
      const result = IndexMerger.merge(indexPath, ['Account', 'Contact', 'Opportunity']);

      expect(result.hasChanges).toBe(true);
      expect(result.addedExports).toEqual(['Account', 'Contact', 'Opportunity']);
      expect(result.preservedExports).toEqual([]);
      expect(result.code).toContain("export { Account } from './Account';");
      expect(result.code).toContain("export { Contact } from './Contact';");
      expect(result.code).toContain("export { Opportunity } from './Opportunity';");
    });

    it('should return empty string when no exports provided to non-existent file', () => {
      const result = IndexMerger.merge(indexPath, []);

      expect(result.hasChanges).toBe(true);
      expect(result.code).toBe('');
    });
  });

  describe('merge() - file exists (lines 71-120)', () => {
    beforeEach(() => {
      fs.writeFileSync(
        indexPath,
        `export { Account } from './Account';\nexport { Contact } from './Contact';\n`
      );
    });

    it('should add new exports to existing index', () => {
      const result = IndexMerger.merge(indexPath, ['Account', 'Contact', 'Lead']);

      expect(result.hasChanges).toBe(true);
      expect(result.addedExports).toEqual(['Lead']);
      expect(result.code).toContain("export { Lead } from './Lead';");
    });

    it('should not add already existing exports', () => {
      const result = IndexMerger.merge(indexPath, ['Account', 'Contact']);

      expect(result.hasChanges).toBe(false);
      expect(result.addedExports).toEqual([]);
    });

    it('should preserve custom exports not in new list', () => {
      const result = IndexMerger.merge(indexPath, ['Lead']);

      expect(result.preservedExports).toContain('Account');
      expect(result.preservedExports).toContain('Contact');
    });

    it('should append newline before new exports if file does not end with newline', () => {
      // Write file without trailing newline
      fs.writeFileSync(indexPath, `export { Account } from './Account';`);

      const result = IndexMerger.merge(indexPath, ['Account', 'Contact']);

      expect(result.code).toContain('\n');
      expect(result.code).toContain("export { Contact } from './Contact';");
    });

    it('should return hasChanges=false when no new exports added', () => {
      const result = IndexMerger.merge(indexPath, ['Account', 'Contact']);

      expect(result.hasChanges).toBe(false);
    });
  });

  describe('parseExports() - via merge() (lines 126-165)', () => {
    it('should parse named exports with module path', () => {
      fs.writeFileSync(
        indexPath,
        `export { Foo } from './Foo';\nexport { Bar } from './Bar';\n`
      );

      const result = IndexMerger.merge(indexPath, ['Foo', 'Bar', 'Baz']);

      expect(result.addedExports).toEqual(['Baz']);
      expect(result.preservedExports).toEqual([]);
    });

    it('should handle export default in existing file', () => {
      fs.writeFileSync(indexPath, `export default {};\nexport { Foo } from './Foo';\n`);

      const result = IndexMerger.merge(indexPath, ['Foo', 'Bar']);

      expect(result.addedExports).toEqual(['Bar']);
    });
  });

  describe('generateIndexContent() - via merge() non-existent file (lines 170-178)', () => {
    it('should generate one export per line with trailing newline', () => {
      const result = IndexMerger.merge(indexPath, ['Alpha', 'Beta']);

      expect(result.code).toBe(
        "export { Alpha } from './Alpha';\nexport { Beta } from './Beta';\n"
      );
    });
  });

  describe('sortExports() (lines 183-200)', () => {
    it('should sort exports alphabetically', () => {
      fs.writeFileSync(
        indexPath,
        `export { Zebra } from './Zebra';\nexport { Apple } from './Apple';\nexport { Mango } from './Mango';\n`
      );

      IndexMerger.sortExports(indexPath);

      const content = fs.readFileSync(indexPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines[0]).toContain('Apple');
      expect(lines[1]).toContain('Mango');
      expect(lines[2]).toContain('Zebra');
    });

    it('should not throw when file does not exist', () => {
      const nonExistentPath = path.join(tmpDir, 'nonexistent.ts');

      expect(() => IndexMerger.sortExports(nonExistentPath)).not.toThrow();
    });

    it('should write sorted content back to file', () => {
      fs.writeFileSync(
        indexPath,
        `export { C } from './C';\nexport { A } from './A';\nexport { B } from './B';\n`
      );

      IndexMerger.sortExports(indexPath);

      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content.indexOf('A')).toBeLessThan(content.indexOf('B'));
      expect(content.indexOf('B')).toBeLessThan(content.indexOf('C'));
    });
  });
});
