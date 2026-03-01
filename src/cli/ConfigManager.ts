import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for .sfconnect.json
 */
export interface SFConnectConfig {
  instanceUrl: string;
  apiVersion: string;
  authType: 'jwt';

  // JWT Bearer Flow
  tokenUrl: string;
  clientId: string;
  username: string;
  privateKeyPath: string;
  algorithm?: string;
}

/**
 * Manages .sfconnect.json configuration file
 */
export class ConfigManager {
  private static CONFIG_FILENAME = '.sfconnect.json';

  /**
   * Find .sfconnect.json in current directory or parent directories
   */
  public static findConfigFile(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;

    // Search up to 10 levels
    for (let i = 0; i < 10; i++) {
      const configPath = path.join(currentDir, this.CONFIG_FILENAME);

      if (fs.existsSync(configPath)) {
        return configPath;
      }

      const parentDir = path.dirname(currentDir);

      // Reached root
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Load configuration from .sfconnect.json
   */
  public static loadConfig(configPath?: string): SFConnectConfig {
    const filePath = configPath || this.findConfigFile();

    if (!filePath) {
      throw new Error(
        `.sfconnect.json not found. Run 'sfc init' to create one, or specify path with --config.`
      );
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content) as SFConnectConfig;

      // Validate required fields
      this.validateConfig(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save configuration to .sfconnect.json
   */
  public static saveConfig(config: SFConnectConfig, outputPath?: string): string {
    const filePath = outputPath || path.join(process.cwd(), this.CONFIG_FILENAME);

    try {
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save config: ${errorMessage}`);
    }
  }

  /**
   * Check if config file exists
   */
  public static configExists(dir: string = process.cwd()): boolean {
    return fs.existsSync(path.join(dir, this.CONFIG_FILENAME));
  }

  /**
   * Validate configuration
   */
  private static validateConfig(config: SFConnectConfig): void {
    if (!config.instanceUrl) {
      throw new Error('Config missing required field: instanceUrl');
    }

    if (!config.apiVersion) {
      throw new Error('Config missing required field: apiVersion');
    }

    if (!config.tokenUrl) {
      throw new Error('Config missing required field: tokenUrl');
    }

    if (!config.clientId) {
      throw new Error('Config missing required field: clientId');
    }

    if (!config.username) {
      throw new Error('Config missing required field: username');
    }

    if (!config.privateKeyPath) {
      throw new Error('Config missing required field: privateKeyPath');
    }
  }

  /**
   * Get default config template
   */
  public static getDefaultConfig(): SFConnectConfig {
    return {
      instanceUrl: 'https://your-instance.salesforce.com',
      apiVersion: 'v59.0',
      authType: 'jwt',
      tokenUrl: 'https://your-auth-server.com/protocol/openid-connect/token',
      clientId: 'YOUR_CLIENT_ID',
      username: 'your-username',
      privateKeyPath: './certs/server.key',
      algorithm: 'RS256',
    };
  }
}
