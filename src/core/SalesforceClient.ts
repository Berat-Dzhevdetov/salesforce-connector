import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { SalesforceConfig } from './SalesforceConfig';
import { SalesforceErrorResponse } from '../types';

/**
 * HTTP client for Salesforce REST API with automatic token refresh
 */
class SalesforceHttpClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create();
  }

  /**
   * Check if error is an authentication error (401 or 403)
   */
  private isAuthError(error: AxiosError): boolean {
    return error?.response?.status === 401 || error?.response?.status === 403;
  }

  /**
   * Make HTTP request with automatic token refresh on auth failure
   */
  private async makeRequest<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    config?: AxiosRequestConfig,
    retryCount = 0
  ): Promise<AxiosResponse<T>> {
    try {
      const token = SalesforceConfig.getAccessToken();

      if (!token) {
        throw new Error('Access token not set. Call setAccessToken() or provide onTokenExpired callback.');
      }

      const requestConfig: AxiosRequestConfig = {
        ...config,
        headers: {
          ...config?.headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      // For POST and PATCH, axios expects (url, data, config)
      // For GET and DELETE, axios expects (url, config)
      let response: AxiosResponse<T>;
      if (method === 'post' || method === 'patch') {
        const { data, ...configWithoutData } = requestConfig;
        response = await this.axiosInstance[method]<T>(url, data, configWithoutData);
      } else {
        response = await this.axiosInstance[method]<T>(url, requestConfig);
      }

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Check if this is an authentication error and we haven't retried yet
        if (this.isAuthError(error) && retryCount === 0) {
          try {
            // Attempt to refresh the token
            await SalesforceConfig.handleTokenExpiration();

            // Retry the request with the new token
            return await this.makeRequest<T>(method, url, config, retryCount + 1);
          } catch (refreshError) {
            const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Unknown error';
            throw new Error(`Authentication failed and token refresh failed: ${refreshMessage}`);
          }
        }

        // Format the error message
        const sfError = error?.response?.data as SalesforceErrorResponse[];
        if (sfError && Array.isArray(sfError) && sfError.length > 0) {
          throw new Error(`Salesforce API Error: ${sfError[0].message} (${sfError[0].errorCode})`);
        }

        const errorMessage = error?.response?.data || error?.message || 'Unknown error';
        throw new Error(`Salesforce API request failed: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Perform GET request
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>('get', url, config);
  }

  /**
   * Perform POST request
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>('post', url, { ...config, data });
  }

  /**
   * Perform PATCH request
   */
  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>('patch', url, { ...config, data });
  }

  /**
   * Perform DELETE request
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>('delete', url, config);
  }
}

export const SalesforceClient = new SalesforceHttpClient();
