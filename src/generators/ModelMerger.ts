import * as ts from 'typescript';
import * as fs from 'fs';
import { SalesforceObjectMetadata } from './MetadataFetcher';
import { ModelGenerator, ModelGeneratorOptions } from './ModelGenerator';

/**
 * Result of merging a model file
 */
export interface MergeResult {
  /**
   * The merged code content
   */
  code: string;

  /**
   * Whether any changes were made
   */
  hasChanges: boolean;

  /**
   * List of fields that were added
   */
  addedFields: string[];

  /**
   * List of fields that were updated
   */
  updatedFields: string[];

  /**
   * Whether custom code sections were preserved
   */
  customCodePreserved: boolean;
}

/**
 * Represents a custom code section found in the model
 */
interface CustomCodeSection {
  /**
   * Type of custom code
   */
  type: 'method' | 'property' | 'import' | 'interfaceProperty';

  /**
   * The code content
   */
  code: string;

  /**
   * Name of the method/property (if applicable)
   */
  name?: string;
}

/**
 * Handles intelligent merging of model files during scaffolding
 */
export class ModelMerger {
  /**
   * Merge new metadata with existing model file
   */
  public static merge(
    existingFilePath: string,
    newMetadata: SalesforceObjectMetadata,
    options: ModelGeneratorOptions = {}
  ): MergeResult {
    // Check if file exists
    if (!fs.existsSync(existingFilePath)) {
      // File doesn't exist, generate new file
      const code = ModelGenerator.generate(newMetadata, options);
      return {
        code,
        hasChanges: true,
        addedFields: newMetadata.fields.map(f => f.name),
        updatedFields: [],
        customCodePreserved: false,
      };
    }

    // Read existing file
    const existingContent = fs.readFileSync(existingFilePath, 'utf-8');

    // Parse existing file
    const sourceFile = ts.createSourceFile(
      existingFilePath,
      existingContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Extract custom code sections (class methods/properties)
    const customSections = this.extractCustomCode(sourceFile, newMetadata.name);

    // Extract existing fields from interface
    const existingFields = this.extractFieldsFromInterface(sourceFile, `${newMetadata.name}Data`);

    // Extract custom interface properties (relationship fields not in Salesforce metadata)
    const customInterfaceProps = this.extractCustomInterfaceProperties(
      sourceFile,
      `${newMetadata.name}Data`,
      newMetadata
    );
    customSections.push(...customInterfaceProps);

    // Determine field changes
    const newFieldNames = new Set(newMetadata.fields.map(f => f.name));
    const existingFieldNames = new Set(existingFields.map(f => f.name));

    const addedFields: string[] = [];
    const updatedFields: string[] = [];

    // Check for added fields
    for (const fieldName of newFieldNames) {
      if (!existingFieldNames.has(fieldName)) {
        addedFields.push(fieldName);
      }
    }

    // Check for updated fields (type changes)
    for (const field of newMetadata.fields) {
      const existingField = existingFields.find(f => f.name === field.name);
      if (existingField && existingField.type !== this.mapFieldType(field.type)) {
        updatedFields.push(field.name);
      }
    }

    // Generate new model code
    const newCode = ModelGenerator.generate(newMetadata, options);

    // Merge custom code sections
    const mergedCode = this.injectCustomCode(newCode, customSections, newMetadata.name);

    const hasChanges = addedFields.length > 0 || updatedFields.length > 0 || customSections.length > 0;

    return {
      code: mergedCode,
      hasChanges,
      addedFields,
      updatedFields,
      customCodePreserved: customSections.length > 0,
    };
  }

  /**
   * Extract custom code sections from existing model
   */
  private static extractCustomCode(
    sourceFile: ts.SourceFile,
    className: string
  ): CustomCodeSection[] {
    const customSections: CustomCodeSection[] = [];

    // Extract custom imports (anything beyond the base Model import)
    const imports = this.extractCustomImports(sourceFile);
    customSections.push(...imports);

    // Find the class declaration
    const classDeclaration = this.findClassDeclaration(sourceFile, className);
    if (!classDeclaration) {
      return customSections;
    }

    // Extract custom methods and properties
    for (const member of classDeclaration.members) {
      // Skip generated getters/setters and protected static properties
      if (this.isGeneratedMember(member)) {
        continue;
      }

      // This is custom code
      const memberCode = member.getFullText(sourceFile).trim();
      const memberName = this.getMemberName(member);

      if (ts.isMethodDeclaration(member)) {
        customSections.push({
          type: 'method',
          code: memberCode,
          name: memberName,
        });
      } else if (ts.isPropertyDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
        customSections.push({
          type: 'property',
          code: memberCode,
          name: memberName,
        });
      }
    }

    return customSections;
  }

  /**
   * Extract custom imports from source file
   */
  private static extractCustomImports(sourceFile: ts.SourceFile): CustomCodeSection[] {
    const customImports: CustomCodeSection[] = [];

    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) {
        const importText = statement.getFullText(sourceFile).trim();

        // Skip the base Model import (it will be regenerated)
        if (importText.includes("from 'javascript-salesforce-connector'")) {
          continue;
        }

        customImports.push({
          type: 'import',
          code: importText,
        });
      }
    }

    return customImports;
  }

  /**
   * Extract custom interface properties (relationship fields not in Salesforce metadata)
   */
  private static extractCustomInterfaceProperties(
    sourceFile: ts.SourceFile,
    interfaceName: string,
    metadata: SalesforceObjectMetadata
  ): CustomCodeSection[] {
    const customProps: CustomCodeSection[] = [];

    // Get Salesforce field names
    const salesforceFieldNames = new Set(metadata.fields.map(f => f.name));

    for (const statement of sourceFile.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName) {
        for (const member of statement.members) {
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
            const propName = member.name.text;

            // If this property is NOT in Salesforce metadata, it's custom (like relationships)
            if (!salesforceFieldNames.has(propName)) {
              const propCode = member.getFullText(sourceFile).trim();
              customProps.push({
                type: 'interfaceProperty',
                code: propCode,
                name: propName,
              });
            }
          }
        }
      }
    }

    return customProps;
  }

  /**
   * Check if a class member is generated code
   */
  private static isGeneratedMember(member: ts.ClassElement): boolean {
    // Check for protected static properties (objectName, dateFields, dateTimeFields)
    if (ts.isPropertyDeclaration(member)) {
      const modifiers = member.modifiers;
      if (modifiers) {
        const isProtected = modifiers.some(m => m.kind === ts.SyntaxKind.ProtectedKeyword);
        const isStatic = modifiers.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
        if (isProtected && isStatic) {
          return true; // Generated property
        }
      }
    }

    // Check for simple getter/setter pattern
    if (ts.isGetAccessor(member)) {
      const body = member.body;
      if (body && body.statements.length === 1) {
        const statement = body.statements[0];
        // Check if it's a simple return this.get('FieldName') pattern
        if (ts.isReturnStatement(statement) && statement.expression) {
          const expr = statement.expression;
          if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
            if (expr.expression.name.text === 'get') {
              return true; // Generated getter
            }
          }
        }
      }
    }

    if (ts.isSetAccessor(member)) {
      const body = member.body;
      if (body && body.statements.length === 1) {
        const statement = body.statements[0];
        // Check if it's a simple if statement with this.set pattern
        if (ts.isIfStatement(statement)) {
          return true; // Likely a generated setter
        }
      }
    }

    return false;
  }

  /**
   * Get the name of a class member
   */
  private static getMemberName(member: ts.ClassElement): string | undefined {
    if (ts.isPropertyDeclaration(member) || ts.isMethodDeclaration(member) ||
        ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      if (ts.isIdentifier(member.name)) {
        return member.name.text;
      }
    }
    return undefined;
  }

  /**
   * Find class declaration in source file
   */
  private static findClassDeclaration(
    sourceFile: ts.SourceFile,
    className: string
  ): ts.ClassDeclaration | undefined {
    for (const statement of sourceFile.statements) {
      if (ts.isClassDeclaration(statement) && statement.name?.text === className) {
        return statement;
      }
    }
    return undefined;
  }

  /**
   * Extract field information from interface
   */
  private static extractFieldsFromInterface(
    sourceFile: ts.SourceFile,
    interfaceName: string
  ): Array<{ name: string; type: string }> {
    const fields: Array<{ name: string; type: string }> = [];

    for (const statement of sourceFile.statements) {
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName) {
        for (const member of statement.members) {
          if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
            const fieldName = member.name.text;
            const fieldType = member.type ? member.type.getText(sourceFile) : 'any';
            // Remove " | undefined" if present
            const cleanType = fieldType.replace(/\s*\|\s*undefined/, '');
            fields.push({ name: fieldName, type: cleanType });
          }
        }
      }
    }

    return fields;
  }

  /**
   * Inject custom code sections into newly generated code
   */
  private static injectCustomCode(
    generatedCode: string,
    customSections: CustomCodeSection[],
    className: string
  ): string {
    let code = generatedCode;

    // Inject custom imports after the base import
    const customImports = customSections.filter(s => s.type === 'import');
    if (customImports.length > 0) {
      const baseImport = "import { Model } from 'javascript-salesforce-connector';";
      const importCode = customImports.map(s => s.code).join('\n');
      code = code.replace(baseImport, `${baseImport}\n${importCode}`);
    }

    // Inject custom interface properties at the end of the interface (before closing brace)
    const customInterfaceProps = customSections.filter(s => s.type === 'interfaceProperty');
    if (customInterfaceProps.length > 0) {
      const customPropsCode = customInterfaceProps.map(s => `  ${s.code}`).join('\n');

      // Find the interface closing brace and inject custom properties
      const interfacePattern = new RegExp(
        `export interface ${className}Data \\{[\\s\\S]*?\\n\\}`,
        'g'
      );
      code = code.replace(interfacePattern, (match) => {
        // Insert custom properties before the closing brace
        return match.replace(/\n\}$/, `\n${customPropsCode}\n}`);
      });
    }

    // Inject custom methods and properties at the end of the class (before closing brace)
    const customMembers = customSections.filter(s => s.type === 'method' || s.type === 'property');
    if (customMembers.length > 0) {
      const customCode = customMembers.map(s => `  ${s.code}`).join('\n\n');

      // Find the last closing brace of the class
      const classPattern = new RegExp(`export class ${className} extends Model<${className}Data> \\{[\\s\\S]*?\\n\\}`, 'g');
      code = code.replace(classPattern, (match) => {
        // Insert custom code before the closing brace
        return match.replace(/\n\}$/, `\n\n  // Custom code preserved from previous scaffold\n${customCode}\n}`);
      });
    }

    return code;
  }

  /**
   * Map Salesforce field type to TypeScript type string
   */
  private static mapFieldType(salesforceType: string): string {
    switch (salesforceType) {
      case 'id':
      case 'reference':
      case 'string':
      case 'picklist':
      case 'multipicklist':
      case 'textarea':
      case 'email':
      case 'url':
      case 'phone':
      case 'address':
      case 'encryptedstring':
      case 'time':
      case 'base64':
        return 'string';

      case 'int':
      case 'double':
      case 'currency':
      case 'percent':
        return 'number';

      case 'boolean':
        return 'boolean';

      case 'date':
      case 'datetime':
        return 'Date';

      default:
        return 'any';
    }
  }

  /**
   * Create a backup of the existing file
   */
  public static createBackup(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    fs.copyFileSync(filePath, backupPath);

    return backupPath;
  }
}
