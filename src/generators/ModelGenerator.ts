import { SalesforceObjectMetadata, SalesforceField } from './MetadataFetcher';

/**
 * Options for model generation
 */
export interface ModelGeneratorOptions {
  /**
   * Include field comments with metadata
   */
  includeComments?: boolean;

  /**
   * Include only specific fields (if not specified, all fields are included)
   */
  includeFields?: string[];

  /**
   * Exclude specific fields
   */
  excludeFields?: string[];
}

/**
 * Generates TypeScript model code from Salesforce metadata
 */
export class ModelGenerator {
  /**
   * Map Salesforce field types to TypeScript types
   */
  private static mapFieldType(field: SalesforceField): string {
    switch (field.type) {
      case 'id':
      case 'reference': // Foreign keys are always strings (IDs)
      case 'string':
      case 'picklist':
      case 'multipicklist':
      case 'textarea':
      case 'email':
      case 'url':
      case 'phone':
      case 'address':
      case 'encryptedstring':
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

      case 'time':
        return 'string'; // Time fields remain as strings (HH:mm:ss format)

      case 'base64':
        return 'string'; // Base64 encoded string

      default:
        return 'any';
    }
  }

  /**
   * Generate the data interface for a Salesforce object
   */
  private static generateInterface(
    metadata: SalesforceObjectMetadata,
    options: ModelGeneratorOptions = {}
  ): string {
    const { includeComments = true, includeFields, excludeFields = [] } = options;

    let fields = metadata.fields;

    // Filter fields if specified
    if (includeFields && includeFields.length > 0) {
      fields = fields.filter((f) => includeFields.includes(f.name));
    }

    // Exclude fields
    fields = fields.filter((f) => !excludeFields.includes(f.name));

    const interfaceName = `${metadata.name}Data`;
    let code = '';

    if (includeComments) {
      code += `/**\n * Data interface for ${metadata.label} (${metadata.name})\n */\n`;
    }

    code += `export interface ${interfaceName} {\n`;

    // Add fields
    for (const field of fields) {
      if (includeComments) {
        code += `  /** ${field.label}`;
        if (field.custom) code += ' (Custom)';
        if (field.calculated) code += ' (Formula)';
        if (field.autoNumber) code += ' (Auto Number)';
        code += ` */\n`;
      }

      const fieldType = this.mapFieldType(field);
      code += `  ${field.name}?: ${fieldType} | undefined;\n`;
    }

    code += '}\n';

    return code;
  }

  /**
   * Generate getter and setter methods for fields
   */
  private static generateAccessors(
    metadata: SalesforceObjectMetadata,
    options: ModelGeneratorOptions = {}
  ): string {
    const { includeComments = true, includeFields, excludeFields = [] } = options;

    let fields = metadata.fields;

    // Filter fields
    if (includeFields && includeFields.length > 0) {
      fields = fields.filter((f) => includeFields.includes(f.name));
    }

    fields = fields.filter((f) => !excludeFields.includes(f.name));

    let code = '';

    for (const field of fields) {
      const fieldType = this.mapFieldType(field);
      const returnType = `${fieldType} | undefined`;

      // Getter
      if (includeComments && field.label) {
        code += `  /** Get ${field.label} */\n`;
      }
      code += `  get ${field.name}(): ${returnType} {\n`;
      code += `    return this.get('${field.name}');\n`;
      code += `  }\n\n`;

      // Setter (only for updateable fields)
      if (field.updateable && !field.calculated && !field.autoNumber) {
        if (includeComments) {
          code += `  /** Set ${field.label} */\n`;
        }
        code += `  set ${field.name}(value: ${returnType}) {\n`;
        code += `    if (value !== undefined) {\n`;
        code += `      this.set('${field.name}', value);\n`;
        code += `    }\n`;
        code += `  }\n\n`;
      }
    }

    return code;
  }


  /**
   * Generate complete model class code
   */
  public static generate(metadata: SalesforceObjectMetadata, options: ModelGeneratorOptions = {}): string {
    const { includeComments = true, includeFields, excludeFields = [] } = options;

    let code = '';

    // Imports
    code += `import { Model } from 'javascript-salesforce-connector';\n\n`;

    // Interface
    code += this.generateInterface(metadata, options);
    code += '\n';

    // Class
    if (includeComments) {
      code += `/**\n * Model for ${metadata.label} (${metadata.name})\n`;
      if (metadata.custom) {
        code += ` * Custom Object\n`;
      }
      code += ` */\n`;
    }

    code += `export class ${metadata.name} extends Model<${metadata.name}Data> {\n`;
    code += `  protected static objectName = '${metadata.name}';\n`;

    // Generate date and datetime field arrays
    let fields = metadata.fields;
    if (includeFields && includeFields.length > 0) {
      fields = fields.filter((f) => includeFields.includes(f.name));
    }
    fields = fields.filter((f) => !excludeFields.includes(f.name));

    const dateFields = fields.filter(f => f.type === 'date').map(f => f.name);
    const dateTimeFields = fields.filter(f => f.type === 'datetime').map(f => f.name);

    if (dateFields.length > 0) {
      code += `  protected static dateFields = ${JSON.stringify(dateFields)};\n`;
    }
    if (dateTimeFields.length > 0) {
      code += `  protected static dateTimeFields = ${JSON.stringify(dateTimeFields)};\n`;
    }
    code += '\n';

    // Accessors
    code += this.generateAccessors(metadata, options);

    code += '}\n';

    return code;
  }

  /**
   * Generate models for multiple objects
   */
  public static generateMultiple(
    metadataList: SalesforceObjectMetadata[],
    options: ModelGeneratorOptions = {}
  ): Map<string, string> {
    const models = new Map<string, string>();

    for (const metadata of metadataList) {
      const code = this.generate(metadata, options);
      models.set(metadata.name, code);
    }

    return models;
  }
}
