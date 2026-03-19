import * as ts from 'typescript';
import * as fs from 'fs';

/**
 * Result of merging an index file
 */
export interface IndexMergeResult {
  /**
   * The merged code content
   */
  code: string;

  /**
   * Whether any changes were made
   */
  hasChanges: boolean;

  /**
   * List of exports that were added
   */
  addedExports: string[];

  /**
   * List of custom exports that were preserved
   */
  preservedExports: string[];
}

/**
 * Represents an export statement
 */
interface ExportInfo {
  /**
   * The exported name
   */
  name: string;

  /**
   * The module path
   */
  modulePath: string;

  /**
   * The full export statement text
   */
  code: string;
}

/**
 * Handles intelligent merging of index.ts files
 */
export class IndexMerger {
  /**
   * Merge new exports with existing index file
   */
  public static merge(
    indexFilePath: string,
    newExports: string[]
  ): IndexMergeResult {
    // Check if file exists
    if (!fs.existsSync(indexFilePath)) {
      // File doesn't exist, create new index
      const code = this.generateIndexContent(newExports);
      return {
        code,
        hasChanges: true,
        addedExports: newExports,
        preservedExports: [],
      };
    }

    // Read existing file
    const existingContent = fs.readFileSync(indexFilePath, 'utf-8');

    // Parse existing exports
    const existingExports = this.parseExports(existingContent);

    // Determine which exports to add
    const existingExportNames = new Set(existingExports.map(e => e.name));
    const addedExports: string[] = [];
    const preservedExports: string[] = [];

    for (const exportName of newExports) {
      if (!existingExportNames.has(exportName)) {
        addedExports.push(exportName);
      }
    }

    // Preserve custom exports (exports not in the new list)
    for (const existingExport of existingExports) {
      if (!newExports.includes(existingExport.name)) {
        preservedExports.push(existingExport.name);
      }
    }

    // Generate merged content
    let mergedContent = existingContent;

    // Add new exports at the end
    if (addedExports.length > 0) {
      const newExportLines = addedExports
        .map(name => `export { ${name} } from './${name}';`)
        .join('\n');

      // Ensure file ends with newline before adding
      if (!mergedContent.endsWith('\n')) {
        mergedContent += '\n';
      }

      mergedContent += newExportLines + '\n';
    }

    const hasChanges = addedExports.length > 0;

    return {
      code: mergedContent,
      hasChanges,
      addedExports,
      preservedExports,
    };
  }

  /**
   * Parse export statements from existing index file
   */
  private static parseExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // Create source file for parsing
    const sourceFile = ts.createSourceFile(
      'index.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    for (const statement of sourceFile.statements) {
      if (ts.isExportDeclaration(statement)) {
        // Handle: export { Foo } from './Foo';
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            const name = element.name.text;
            const modulePath = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
              ? statement.moduleSpecifier.text
              : '';

            exports.push({
              name,
              modulePath,
              code: statement.getFullText(sourceFile).trim(),
            });
          }
        }
      } else if (ts.isExportAssignment(statement)) {
        // Handle: export default ...
        exports.push({
          name: 'default',
          modulePath: '',
          code: statement.getFullText(sourceFile).trim(),
        });
      }
    }

    return exports;
  }

  /**
   * Generate index.ts content from export list
   */
  private static generateIndexContent(exports: string[]): string {
    if (exports.length === 0) {
      return '';
    }

    return exports
      .map(name => `export { ${name} } from './${name}';`)
      .join('\n') + '\n';
  }

  /**
   * Sort exports alphabetically
   */
  public static sortExports(indexFilePath: string): void {
    if (!fs.existsSync(indexFilePath)) {
      return;
    }

    const content = fs.readFileSync(indexFilePath, 'utf-8');
    const exports = this.parseExports(content);

    // Sort by name
    exports.sort((a, b) => a.name.localeCompare(b.name));

    // Generate sorted content
    const sortedContent = exports
      .map(e => e.code)
      .join('\n') + '\n';

    fs.writeFileSync(indexFilePath, sortedContent, 'utf-8');
  }
}
