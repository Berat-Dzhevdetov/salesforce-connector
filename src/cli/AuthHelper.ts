import * as fs from 'fs';
import * as path from 'path';
import { sign } from 'jsonwebtoken';
import axios from 'axios';
import { SFConnectConfig } from './ConfigManager';

/**
 * OAuth2 token response
 */
interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/**
 * Helper for JWT Bearer Flow authentication
 */
export class AuthHelper {
  /**
   * Authenticate using JWT Bearer Flow
   */
  public static async authenticate(config: SFConnectConfig): Promise<string> {
    if (!config.tokenUrl || !config.clientId || !config.username || !config.privateKeyPath) {
      throw new Error('JWT authentication requires tokenUrl, clientId, username, and privateKeyPath');
    }

    try {
      // Read private key
      const privateKeyFullPath = path.isAbsolute(config.privateKeyPath)
        ? config.privateKeyPath
        : path.join(process.cwd(), config.privateKeyPath);

      if (!fs.existsSync(privateKeyFullPath)) {
        throw new Error(`Private key file not found: ${privateKeyFullPath}`);
      }

      const privateKey = fs.readFileSync(privateKeyFullPath, 'utf-8');

      // Create JWT payload
      const payload = {
        iss: config.clientId,
        sub: config.username,
        aud: config.tokenUrl,
        exp: Math.floor(Date.now() / 1000) + 180, // 3 minutes
      };

      // Sign JWT
      const algorithm = (config.algorithm || 'RS256') as any;
      const assertion = sign(payload, privateKey, { algorithm });

      // Exchange JWT for access token
      const response = await axios.post<TokenResponse>(
        config.tokenUrl,
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response?.data?.access_token) {
        throw new Error('Failed to obtain access token');
      }

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data;
        throw new Error(
          `Authentication failed: ${errorData.error_description || errorData.error || error.message}`
        );
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`JWT authentication failed: ${errorMessage}`);
    }
  }
}
