#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './ConfigManager';
import { AuthHelper } from './AuthHelper';
import { SalesforceConfig } from '../core/SalesforceConfig';
import { MetadataFetcher } from '../generators/MetadataFetcher';
import { ModelGenerator, ModelGeneratorOptions } from '../generators/ModelGenerator';
import { ModelMerger, MergeResult } from '../generators/ModelMerger';
import { IndexMerger } from '../generators/IndexMerger';
import { ObserverGenerator } from '../generators/ObserverGenerator';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const program = new Command();

program
  .name('sfc')
  .description('Salesforce Connector CLI - Generate TypeScript models from Salesforce metadata')
  .version('1.0.3');

/**
 * sfc init - Initialize .sfconnect.json config file
 */
program
  .command('init')
  .description('Create .sfconnect.json configuration file')
  .option('-o, --output <path>', 'Output path for config file', './.sfconnect.json')
  .action(async (options) => {
    try {
      // Check if config already exists
      if (ConfigManager.configExists()) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question('.sfconnect.json already exists. Overwrite? (y/N): ', resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Cancelled.');
          process.exit(0);
        }
      }

      // Create default config
      const config = ConfigManager.getDefaultConfig();
      const filePath = ConfigManager.saveConfig(config, options.output);

      console.log(`\n✓ Created config file: ${filePath}\n`);
      console.log('Please edit the file and add your authentication credentials:\n');
      console.log(`  ${filePath}\n`);
      console.log('Required fields for JWT Bearer Flow:');
      console.log('  - instanceUrl: Your Salesforce instance URL');
      console.log('  - tokenUrl: OAuth2 token endpoint');
      console.log('  - clientId: Your connected app client ID');
      console.log('  - username: Your Salesforce username');
      console.log('  - privateKeyPath: Path to your private key file');
      console.log('  - algorithm: JWT signing algorithm (default: RS256)');
      console.log('\nAfter configuring, run: sfc scaffold');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * sfc scaffold - Generate model files
 */
program
  .command('scaffold <objects...>')
  .description('Generate TypeScript models from Salesforce metadata')
  .option('-o, --output <dir>', 'Output directory for generated models', './src/models')
  .option('-c, --config <path>', 'Path to .sfconnect.json file')
  .option('--no-comments', 'Skip field comments')
  .option('--force', 'Force regenerate models (ignore existing files and custom code)')
  .option('--no-backup', 'Skip creating backup files when updating existing models')
  .option('--legacy', 'Generate legacy Model classes instead of LambdaModel (deprecated)')
  .action(async (objects: string[], options) => {
    try {
      console.log('Salesforce Model Generator\n');

      // Load config
      console.log('Loading configuration...');
      const config = ConfigManager.loadConfig(options.config);

      // Authenticate
      console.log('Authenticating with Salesforce...');
      const accessToken = await AuthHelper.authenticate(config);

      // Initialize Salesforce config
      SalesforceConfig.initialize({
        instanceUrl: config.instanceUrl,
        apiVersion: config.apiVersion,
      });
      SalesforceConfig.setAccessToken(accessToken);

      console.log('✓ Authenticated successfully\n');

      // Ensure output directory exists
      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}\n`);
      }

      console.log(`Generating ${objects.length} model(s)...`);
      if (options.legacy) {
        console.log('⚠️  Using legacy Model class (deprecated). Consider using LambdaModel for better type safety.\n');
      } else {
        console.log('✓ Using LambdaModel with type-safe lambda queries\n');
      }

      const generatorOptions: ModelGeneratorOptions = {
        includeComments: options.comments !== false,
        useLegacyModel: options.legacy === true,
      };

      let successCount = 0;
      let failCount = 0;
      let updatedCount = 0;
      let preservedCount = 0;
      const mergeResults: Map<string, MergeResult> = new Map();

      for (const objectName of objects) {
        try {
          process.stdout.write(`  ${objectName}... `);

          // Fetch metadata
          const metadata = await MetadataFetcher.describe(objectName);

          const filePath = path.join(outputDir, `${objectName}.ts`);
          const fileExists = fs.existsSync(filePath);

          let modelCode: string;
          let mergeResult: MergeResult | undefined;

          // Create backup for existing files (unless --no-backup is specified)
          if (fileExists && options.backup !== false) {
            try {
              const backupPath = ModelMerger.createBackup(filePath);
              console.log(`\n    Backup: ${path.basename(backupPath)}`);
            } catch (backupError) {
              console.warn(`\n    Warning: Could not create backup: ${backupError}`);
            }
          }

          if (fileExists && !options.force) {
            // File exists, use smart merge
            mergeResult = ModelMerger.merge(filePath, metadata, generatorOptions);
            modelCode = mergeResult.code;
            mergeResults.set(objectName, mergeResult);

            if (mergeResult.hasChanges) {
              updatedCount++;
            }
            if (mergeResult.customCodePreserved) {
              preservedCount++;
            }
          } else {
            // Generate new file (or force regenerate)
            modelCode = ModelGenerator.generate(metadata, generatorOptions);
          }

          // Write to file
          fs.writeFileSync(filePath, modelCode, 'utf-8');

          console.log('✓');
          successCount++;
        } catch (error) {
          console.log('✗');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`    Error: ${errorMessage}`);
          failCount++;
        }
      }

      // Generate/update index file
      if (successCount > 0) {
        console.log('\nUpdating index file...');
        const indexPath = path.join(outputDir, 'index.ts');

        const successfulObjects = objects.filter((obj) => {
          // Only include successfully generated models
          return fs.existsSync(path.join(outputDir, `${obj}.ts`));
        });

        const indexResult = IndexMerger.merge(indexPath, successfulObjects);
        fs.writeFileSync(indexPath, indexResult.code, 'utf-8');

        if (indexResult.addedExports.length > 0) {
          console.log(`✓ Added ${indexResult.addedExports.length} export(s) to index.ts`);
        }
        if (indexResult.preservedExports.length > 0) {
          console.log(`✓ Preserved ${indexResult.preservedExports.length} custom export(s)`);
        }
        console.log();
      }

      // Summary
      console.log('--- Summary ---');
      console.log(`Total: ${objects.length}`);
      console.log(`Success: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      if (updatedCount > 0) {
        console.log(`Updated: ${updatedCount}`);
      }
      if (preservedCount > 0) {
        console.log(`Custom code preserved: ${preservedCount}`);
      }
      console.log(`\nModels saved to: ${outputDir}`);

      // Show field changes if any
      if (mergeResults.size > 0) {
        let hasFieldChanges = false;
        for (const [objectName, result] of mergeResults) {
          if (result.addedFields.length > 0 || result.updatedFields.length > 0) {
            if (!hasFieldChanges) {
              console.log('\n--- Field Changes ---');
              hasFieldChanges = true;
            }
            console.log(`\n${objectName}:`);
            if (result.addedFields.length > 0) {
              console.log(`  Added fields: ${result.addedFields.join(', ')}`);
            }
            if (result.updatedFields.length > 0) {
              console.log(`  Updated fields: ${result.updatedFields.join(', ')}`);
            }
          }
        }
      }

      if (successCount > 0) {
        console.log('\nNext steps:');
        console.log('1. Review generated/updated models');
        console.log('2. Import related models for relationships');
        console.log('3. Run: npm run build');

        if (options.backup !== false) {
          console.log('\nNote: Backup files created with .backup.* extension');
        }
      }
    } catch (error) {
      console.error('\nError:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * sfc test-auth - Test authentication
 */
program
  .command('test-auth')
  .description('Test OAuth2 authentication')
  .option('-c, --config <path>', 'Path to .sfconnect.json file')
  .action(async (options) => {
    try {
      console.log('Testing JWT Bearer Flow authentication...\n');

      const config = ConfigManager.loadConfig(options.config);
      console.log(`Instance URL: ${config.instanceUrl}`);
      console.log(`Token URL: ${config.tokenUrl}`);

      console.log('Authenticating...');
      const accessToken = await AuthHelper.authenticate(config);

      console.log('✓ Authentication successful!\n');
      console.log(`Access Token: ${accessToken.substring(0, 20)}...`);
      console.log('\nYou can now run: sfc scaffold');
    } catch (error) {
      console.error('\nAuthentication failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * sfc generate-observer - Generate observer for a model
 */
program
  .command('generate-observer <model> <observerName>')
  .description('Generate an observer file for a Salesforce model')
  .option('-o, --output <dir>', 'Output directory for observer', './src/observers')
  .action((model: string, observerName: string, options) => {
    try {
      console.log(`\nGenerating observer for ${model}...\n`);

      // Generate the observer
      ObserverGenerator.generate(model, observerName, options.output);

      console.log('\nNext steps:');
      console.log(`1. Review and customize: ${path.join(options.output, observerName)}.ts`);
      console.log(`2. Register in your app: ${model}.observe(new ${observerName}());`);
      console.log(`3. Or use setup file: import { registerObservers } from '${options.output}/setup';`);
    } catch (error) {
      console.error('\nError:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
