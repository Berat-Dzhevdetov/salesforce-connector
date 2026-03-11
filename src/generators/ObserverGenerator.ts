import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate an observer file for a specific model
 */
export class ObserverGenerator {
  /**
   * Generate observer file
   *
   * @param modelName - The model name (e.g., 'Account', 'Contact', 'CustomObject__c')
   * @param observerName - The observer class name (e.g., 'AccountObserver', 'ValidationObserver')
   * @param outputDir - Output directory path
   */
  static generate(modelName: string, observerName: string, outputDir: string = './src/observers'): void {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`✅ Created directory: ${outputDir}`);
    }

    // Check if observer file already exists
    const observerPath = path.join(outputDir, `${observerName}.ts`);
    if (fs.existsSync(observerPath)) {
      console.error(`❌ Error: Observer file already exists: ${observerPath}`);
      console.error(`   Please use a different name or delete the existing file.`);
      process.exit(1);
    }

    // Generate observer file
    const content = this.generateObserverContent(modelName, observerName);
    fs.writeFileSync(observerPath, content);
    console.log(`✅ Generated observer: ${observerPath}`);

    // Handle setup.ts file
    this.updateSetupFile(observerName, modelName, outputDir);
  }

  /**
   * Update or create setup.ts file with new observer registration
   */
  private static updateSetupFile(observerName: string, modelName: string, outputDir: string): void {
    const setupPath = path.join(outputDir, 'setup.ts');

    if (fs.existsSync(setupPath)) {
      // File exists - append the new observer
      this.appendToSetupFile(setupPath, observerName, modelName);
    } else {
      // File doesn't exist - create it
      this.createSetupFile(setupPath, observerName, modelName);
    }
  }

  /**
   * Create a new setup.ts file
   */
  private static createSetupFile(setupPath: string, observerName: string, modelName: string): void {
    const content = `import { ${observerName} } from './${observerName}';
import { ${modelName} } from '../models/${modelName}';

/**
 * Register all observers
 * Call this function once when your application starts
 */
export function registerObservers(): void {
  // Register ${observerName}
  ${modelName}.observe(new ${observerName}());

  console.log('✅ Observers registered successfully');
}
`;

    fs.writeFileSync(setupPath, content);
    console.log(`✅ Created setup file: ${setupPath}`);
  }

  /**
   * Append new observer registration to existing setup.ts file
   */
  private static appendToSetupFile(setupPath: string, observerName: string, modelName: string): void {
    const existingContent = fs.readFileSync(setupPath, 'utf-8');

    // Check if this observer is already imported
    if (existingContent.includes(`from './${observerName}'`)) {
      console.log(`⚠️  Observer already imported in setup.ts, skipping import addition`);
      return;
    }

    // Find the last import statement
    const lines = existingContent.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    // Add new imports after the last import
    if (lastImportIndex !== -1) {
      const observerImport = `import { ${observerName} } from './${observerName}';`;

      // Check if model is already imported
      const modelImportExists = existingContent.includes(`import { ${modelName} }`);
      const modelImport = modelImportExists ? '' : `import { ${modelName} } from '../models/${modelName}';`;

      const importsToAdd = modelImport ? [observerImport, modelImport] : [observerImport];
      lines.splice(lastImportIndex + 1, 0, ...importsToAdd);
    }

    // Find the registerObservers function and add registration
    const funcStartIndex = lines.findIndex(line => line.includes('export function registerObservers'));
    if (funcStartIndex !== -1) {
      // Find the line with console.log (or closing brace if no console.log)
      let insertIndex = -1;
      for (let i = funcStartIndex; i < lines.length; i++) {
        if (lines[i].includes('console.log') || lines[i].trim() === '}') {
          insertIndex = i;
          break;
        }
      }

      if (insertIndex !== -1) {
        const registration = [
          '',
          `  // Register ${observerName}`,
          `  ${modelName}.observe(new ${observerName}());`
        ];

        // Insert before console.log or closing brace
        lines.splice(insertIndex, 0, ...registration);
      }
    }

    // Write back the updated content
    fs.writeFileSync(setupPath, lines.join('\n'));
    console.log(`✅ Updated setup file: ${setupPath}`);
  }

  /**
   * Generate observer TypeScript content
   */
  private static generateObserverContent(modelName: string, observerName: string): string {
    return `import { Observer } from 'javascript-salesforce-connector';
import { ${modelName} } from '../models/${modelName}';

/**
 * Observer for ${modelName} model
 *
 * Implement lifecycle hooks to respond to ${modelName} events.
 * All methods are optional - only implement the hooks you need.
 */
export class ${observerName} implements Observer<${modelName}> {
  /**
   * Called before a new ${modelName} is created
   * Use this to validate data or set default values
   *
   * @param instance - The ${modelName} instance being created
   * @throws Error to prevent creation
   */
  async beforeCreate(instance: ${modelName}): Promise<void> {
    // TODO: Add validation or modification logic
    console.log('beforeCreate:', instance.getId());
  }

  /**
   * Called after a ${modelName} is successfully created
   * Use this for logging, notifications, or triggering side effects
   *
   * @param instance - The created ${modelName} instance
   */
  async afterCreate(instance: ${modelName}): Promise<void> {
    // TODO: Add post-creation logic
    console.log('afterCreate:', instance.getId());
  }

  /**
   * Called before a ${modelName} is updated
   * Use this to validate changes or modify update data
   *
   * @param instance - The ${modelName} instance being updated
   * @param changes - The fields being changed
   * @throws Error to prevent update
   */
  async beforeUpdate(instance: ${modelName}, changes: any): Promise<void> {
    // TODO: Add validation or modification logic
    console.log('beforeUpdate:', instance.getId(), changes);
  }

  /**
   * Called after a ${modelName} is successfully updated
   * Use this for audit logging or triggering workflows
   *
   * @param instance - The updated ${modelName} instance
   * @param changes - The fields that were changed
   */
  async afterUpdate(instance: ${modelName}, changes: any): Promise<void> {
    // TODO: Add post-update logic
    console.log('afterUpdate:', instance.getId(), changes);
  }

  /**
   * Called before save() - applies to both create and update
   * Use this for common validation logic
   *
   * @param instance - The ${modelName} instance being saved
   * @param isNew - True if creating, false if updating
   * @throws Error to prevent save
   */
  async beforeSave(instance: ${modelName}, isNew: boolean): Promise<void> {
    // TODO: Add common validation logic
    console.log('beforeSave:', instance.getId(), 'isNew:', isNew);
  }

  /**
   * Called after save() - applies to both create and update
   * Use this for common post-save actions
   *
   * @param instance - The saved ${modelName} instance
   * @param isNew - True if it was created, false if updated
   */
  async afterSave(instance: ${modelName}, isNew: boolean): Promise<void> {
    // TODO: Add common post-save logic
    console.log('afterSave:', instance.getId(), 'isNew:', isNew);
  }

  /**
   * Called before a ${modelName} is deleted
   * Use this to prevent deletion or clean up related data
   *
   * @param instance - The ${modelName} instance being deleted
   * @throws Error to prevent deletion
   */
  async beforeDelete(instance: ${modelName}): Promise<void> {
    // TODO: Add deletion validation or cleanup logic
    console.log('beforeDelete:', instance.getId());
  }

  /**
   * Called after a ${modelName} is successfully deleted
   * Use this for cleanup or audit logging
   *
   * @param instance - The deleted ${modelName} instance
   */
  async afterDelete(instance: ${modelName}): Promise<void> {
    // TODO: Add post-deletion logic
    console.log('afterDelete:', instance.getId());
  }
}
`;
  }
}
