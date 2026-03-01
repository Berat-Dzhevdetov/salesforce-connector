#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager, SFConnectConfig } from './ConfigManager';
import { AuthHelper } from './AuthHelper';
import { SalesforceConfig } from '../core/SalesforceConfig';
import { MetadataFetcher } from '../generators/MetadataFetcher';
import { ModelGenerator, ModelGeneratorOptions } from '../generators/ModelGenerator';
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

      console.log(`Generating ${objects.length} model(s)...\n`);

      const generatorOptions: ModelGeneratorOptions = {
        includeComments: options.comments !== false,
      };

      let successCount = 0;
      let failCount = 0;

      for (const objectName of objects) {
        try {
          process.stdout.write(`  ${objectName}... `);

          // Fetch metadata
          const metadata = await MetadataFetcher.describe(objectName);

          // Generate model code
          const modelCode = ModelGenerator.generate(metadata, generatorOptions);

          // Write to file
          const filePath = path.join(outputDir, `${objectName}.ts`);
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

      // Generate index file
      if (successCount > 0) {
        console.log('\nGenerating index file...');
        const indexPath = path.join(outputDir, 'index.ts');
        const indexContent = objects
          .filter((obj) => {
            // Only include successfully generated models
            return fs.existsSync(path.join(outputDir, `${obj}.ts`));
          })
          .map((obj) => `export { ${obj} } from './${obj}';`)
          .join('\n');

        fs.writeFileSync(indexPath, indexContent + '\n', 'utf-8');
        console.log('✓ index.ts\n');
      }

      // Summary
      console.log('--- Summary ---');
      console.log(`Total: ${objects.length}`);
      console.log(`Success: ${successCount}`);
      console.log(`Failed: ${failCount}`);
      console.log(`\nModels saved to: ${outputDir}`);

      if (successCount > 0) {
        console.log('\nNext steps:');
        console.log('1. Review generated models');
        console.log('2. Import related models for relationships');
        console.log('3. Run: npm run build');
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

program.parse();
