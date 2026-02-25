import { SalesforceConfig as ISalesforceConfig } from '../types';

/**
 * Singleton class to manage Salesforce configuration
 */
class SalesforceConfigManager {
  private static instance: SalesforceConfigManager;
  private config: ISalesforceConfig | null = null;
  private accessToken: string | null = null;

  private constructor() {}

  public static getInstance(): SalesforceConfigManager {
    if (!SalesforceConfigManager.instance) {
      SalesforceConfigManager.instance = new SalesforceConfigManager();
    }
    return SalesforceConfigManager.instance;
  }

  /**
   * Initialize Salesforce configuration
   */
  public initialize(config: ISalesforceConfig): void {
    if (!config?.instanceUrl || !config?.apiVersion) {
      throw new Error('instanceUrl and apiVersion are required in Salesforce configuration');
    }
    this.config = config;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ISalesforceConfig {
    if (!this.config) {
      throw new Error('Salesforce configuration not initialized. Call SalesforceConfig.initialize() first.');
    }
    return this.config;
  }

  /**
   * Set the access token
   */
  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get the access token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Handle token expiration by invoking the callback
   */
  public async handleTokenExpiration(): Promise<string> {
    const config = this.getConfig();

    if (!config?.onTokenExpired) {
      throw new Error('onTokenExpired callback not configured. Cannot refresh token.');
    }

    try {
      const newToken = await config.onTokenExpired();

      if (!newToken || typeof newToken !== 'string') {
        throw new Error('onTokenExpired callback must return a valid token string');
      }

      this.setAccessToken(newToken);
      return newToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh token: ${errorMessage}`);
    }
  }

  /**
   * Get the full Salesforce API base URL
   */
  public getApiBaseUrl(): string {
    const config = this.getConfig();
    return `${config.instanceUrl}/services/data/${config.apiVersion}`;
  }

  /**
   * Reset configuration (useful for testing)
   */
  public reset(): void {
    this.config = null;
    this.accessToken = null;
  }
}

export const SalesforceConfig = SalesforceConfigManager.getInstance();
