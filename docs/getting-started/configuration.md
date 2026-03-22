# Configuration

Before using any models, you must initialize the Salesforce configuration. This configuration is global and used by all models throughout your application.

## Basic Configuration

```typescript
import { SalesforceConfig } from 'javascript-salesforce-connector';

SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    // Your token refresh logic here
    const newToken = await refreshAccessToken();
    return newToken;
  }
});

// Set the initial access token
SalesforceConfig.setAccessToken('your-access-token');
```

## Configuration Options

- **instanceUrl** (required): Your Salesforce instance URL (e.g., `https://na1.salesforce.com`)
- **apiVersion** (required): Salesforce API version to use (e.g., `'59.0'`)
- **onTokenExpired** (optional): Async callback function that returns a fresh access token when authentication fails

## Authentication Strategy

This library intentionally does not handle OAuth authentication flows. The reason is that Salesforce authentication varies widely depending on your use case:

- **OAuth 2.0 Web Server Flow**: For web applications
- **OAuth 2.0 Username-Password Flow**: For server-to-server integrations
- **OAuth 2.0 JWT Bearer Flow**: For service accounts
- **Session-based authentication**: For Visualforce or Lightning components

By providing the `onTokenExpired` callback, you maintain full control over your authentication strategy. The library will:

1. Use the provided access token for all API requests
2. Automatically detect 401/403 authentication errors
3. Call your `onTokenExpired` callback to obtain a fresh token
4. Retry the failed request with the new token
5. Return the result or throw an error if refresh fails

## Example Authentication Implementation

```typescript
import axios from 'axios';

let currentAccessToken = '';

async function authenticateWithSalesforce(): Promise<string> {
  const response = await axios.post(
    'https://login.salesforce.com/services/oauth2/token',
    new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
      username: process.env.SF_USERNAME,
      password: process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
    })
  );

  currentAccessToken = response.data.access_token;
  return currentAccessToken;
}

// Initialize configuration
SalesforceConfig.initialize({
  instanceUrl: process.env.SF_INSTANCE_URL,
  apiVersion: 'v59.0',
  onTokenExpired: authenticateWithSalesforce
});

// Get initial token
const token = await authenticateWithSalesforce();
SalesforceConfig.setAccessToken(token);
```

## Next Steps

- [Quick Start Guide](quick-start.md) - Your first query in 5 minutes
- [Model Generation (CLI)](../models/model-generation.md) - Auto-generate models
