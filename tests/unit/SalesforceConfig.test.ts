import { describe, it, expect, vi, afterEach } from 'vitest';
import { SalesforceConfig } from '../../src/core/SalesforceConfig';

describe('SalesforceConfigManager', () => {
  afterEach(() => {
    SalesforceConfig.reset();
  });

  describe('initialize()', () => {
    it('should initialize with valid config', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });

      const config = SalesforceConfig.getConfig();
      expect(config.instanceUrl).toBe('https://test.salesforce.com');
      expect(config.apiVersion).toBe('v58.0');
    });

    it('should throw when instanceUrl is missing', () => {
      expect(() =>
        SalesforceConfig.initialize({ instanceUrl: '', apiVersion: 'v58.0' })
      ).toThrow('instanceUrl and apiVersion are required in Salesforce configuration');
    });

    it('should throw when apiVersion is missing', () => {
      expect(() =>
        SalesforceConfig.initialize({ instanceUrl: 'https://test.salesforce.com', apiVersion: '' })
      ).toThrow('instanceUrl and apiVersion are required in Salesforce configuration');
    });

    it('should throw when config is missing both required fields', () => {
      expect(() =>
        SalesforceConfig.initialize({} as any)
      ).toThrow('instanceUrl and apiVersion are required in Salesforce configuration');
    });
  });

  describe('getConfig()', () => {
    it('should throw when not initialized', () => {
      expect(() => SalesforceConfig.getConfig()).toThrow(
        'Salesforce configuration not initialized. Call SalesforceConfig.initialize() first.'
      );
    });

    it('should return config after initialization', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });
      expect(SalesforceConfig.getConfig()).toEqual({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });
    });
  });

  describe('singleton behavior', () => {
    it('should preserve state across accesses', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://a.salesforce.com',
        apiVersion: 'v58.0',
      });

      expect(SalesforceConfig.getConfig().instanceUrl).toBe('https://a.salesforce.com');
    });

    it('should return the same instance instead of creating a new one', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://first.salesforce.com',
        apiVersion: 'v57.0',
      });

      SalesforceConfig.initialize({
        instanceUrl: 'https://second.salesforce.com',
        apiVersion: 'v58.0',
      });

      expect(SalesforceConfig.getConfig().instanceUrl).toBe('https://second.salesforce.com');
      expect(SalesforceConfig.getConfig().apiVersion).toBe('v58.0');
    });
  });

  describe('setAccessToken() / getAccessToken()', () => {
    it('should return null when no token is set', () => {
      expect(SalesforceConfig.getAccessToken()).toBeNull();
    });

    it('should store and return the access token', () => {
      SalesforceConfig.setAccessToken('my-token');
      expect(SalesforceConfig.getAccessToken()).toBe('my-token');
    });
  });

  describe('handleTokenExpiration()', () => {
    it('should throw when config is not initialized', async () => {
      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Salesforce configuration not initialized'
      );
    });

    it('should throw when onTokenExpired callback is not configured', async () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'onTokenExpired callback not configured. Cannot refresh token.'
      );
    });

    it('should refresh token successfully when callback returns a valid string', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue('new-token');

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      const result = await SalesforceConfig.handleTokenExpiration();
      expect(result).toBe('new-token');
      expect(SalesforceConfig.getAccessToken()).toBe('new-token');
      expect(onTokenExpired).toHaveBeenCalledOnce();
    });

    it('should throw when callback returns an empty string', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue('');

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Failed to refresh token: onTokenExpired callback must return a valid token string'
      );
    });

    it('should throw when callback returns null', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue(null);

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Failed to refresh token: onTokenExpired callback must return a valid token string'
      );
    });

    it('should throw when callback returns a non-string value', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue(12345);

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Failed to refresh token: onTokenExpired callback must return a valid token string'
      );
    });

    it('should wrap callback errors with "Failed to refresh token" prefix', async () => {
      const onTokenExpired = vi.fn().mockRejectedValue(new Error('Network failure'));

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Failed to refresh token: Network failure'
      );
    });

    it('should handle non-Error thrown values from callback', async () => {
      const onTokenExpired = vi.fn().mockRejectedValue('some string error');

      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
        onTokenExpired,
      });

      await expect(SalesforceConfig.handleTokenExpiration()).rejects.toThrow(
        'Failed to refresh token: Unknown error'
      );
    });
  });

  describe('getApiBaseUrl()', () => {
    it('should return the correct base URL', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });

      expect(SalesforceConfig.getApiBaseUrl()).toBe(
        'https://test.salesforce.com/services/data/v58.0'
      );
    });

    it('should throw when not initialized', () => {
      expect(() => SalesforceConfig.getApiBaseUrl()).toThrow(
        'Salesforce configuration not initialized'
      );
    });
  });

  describe('reset()', () => {
    it('should clear config and token', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: 'v58.0',
      });
      SalesforceConfig.setAccessToken('my-token');

      SalesforceConfig.reset();

      expect(SalesforceConfig.getAccessToken()).toBeNull();
      expect(() => SalesforceConfig.getConfig()).toThrow(
        'Salesforce configuration not initialized'
      );
    });

    it('should allow re-initialization after reset', () => {
      SalesforceConfig.initialize({
        instanceUrl: 'https://first.salesforce.com',
        apiVersion: 'v57.0',
      });

      SalesforceConfig.reset();

      SalesforceConfig.initialize({
        instanceUrl: 'https://second.salesforce.com',
        apiVersion: 'v58.0',
      });

      expect(SalesforceConfig.getConfig().instanceUrl).toBe('https://second.salesforce.com');
      expect(SalesforceConfig.getConfig().apiVersion).toBe('v58.0');
    });
  });
});
