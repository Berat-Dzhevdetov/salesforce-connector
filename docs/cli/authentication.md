# Authentication Setup

The CLI uses **JWT Bearer Flow** for authentication. Here's how to set it up.

## Overview

JWT Bearer Flow allows server-to-server authentication without user interaction. It's perfect for CLI tools and automated scripts.

## Step 1: Generate RSA Key Pair

Generate a private key and certificate:

```bash
# Create directory for certificates
mkdir -p certs

# Generate private key (2048-bit RSA)
openssl genrsa -out certs/server.key 2048

# Generate certificate (valid for 365 days)
openssl req -new -x509 -key certs/server.key -out certs/server.crt -days 365
```

When prompted, fill in certificate details:
```
Country Name: US
State: California
City: San Francisco
Organization: Your Company
Organizational Unit: IT
Common Name: yourdomain.com
Email: admin@yourdomain.com
```

## Step 2: Create Connected App in Salesforce

1. **Navigate to Setup**
   - Login to Salesforce
   - Click Setup (gear icon)

2. **Create Connected App**
   - Go to: **App Manager**
   - Click **New Connected App**

3. **Basic Information**
   - Connected App Name: `Salesforce ORM CLI`
   - API Name: `Salesforce_ORM_CLI`
   - Contact Email: Your email

4. **Enable OAuth Settings**
   - Check **Enable OAuth Settings**
   - Callback URL: `https://login.salesforce.com/services/oauth2/callback`
   - Check **Use digital signatures**
   - Upload `certs/server.crt` file

5. **Select OAuth Scopes**
   Add these scopes:
   - `api` - Access and manage your data
   - `refresh_token` - Perform requests on your behalf at any time
   - `offline_access` - Provide access to your data via the Web

6. **Save and Continue**
   - Click **Save**
   - Click **Continue**

## Step 3: Get Consumer Key

After creating the Connected App:

1. Go to **App Manager**
2. Find your app: **Salesforce ORM CLI**
3. Click **View**
4. Copy the **Consumer Key** (this is your `clientId`)

## Step 4: Configure CLI

Create `.sfconnect.json` in your project root:

```bash
npx sfc init
```

Edit the generated file with your details:

```json
{
  "instanceUrl": "https://your-instance.salesforce.com",
  "apiVersion": "v59.0",
  "authType": "jwt",
  "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
  "clientId": "YOUR_CONSUMER_KEY_FROM_CONNECTED_APP",
  "username": "your-username@example.com",
  "privateKeyPath": "./certs/server.key",
  "algorithm": "RS256"
}
```

### Configuration Fields

- **instanceUrl**: Your Salesforce instance URL (e.g., `https://na1.my.salesforce.com`)
- **apiVersion**: API version (e.g., `v59.0`)
- **authType**: Always `jwt` for JWT bearer flow
- **tokenUrl**: OAuth token endpoint
  - Production: `https://login.salesforce.com/services/oauth2/token`
  - Sandbox: `https://test.salesforce.com/services/oauth2/token`
- **clientId**: Consumer Key from Connected App
- **username**: Your Salesforce username
- **privateKeyPath**: Path to RSA private key file
- **algorithm**: Signing algorithm (always `RS256`)

## Step 5: Test Authentication

```bash
npx sfc test-auth
```

Success output:
```
✓ Authentication successful!
✓ Instance URL: https://your-instance.salesforce.com
✓ API Version: v59.0
✓ User: user@example.com
```

## Troubleshooting

### Error: "user hasn't approved this consumer"

**Solution:** Pre-approve users for the Connected App

1. Go to Setup → App Manager
2. Find your Connected App → Click dropdown → **Manage**
3. Click **Edit Policies**
4. **Permitted Users**: Select **Admin approved users are pre-authorized**
5. Click **Save**
6. Click **Manage Profiles** or **Manage Permission Sets**
7. Add your user's profile/permission set
8. Click **Save**

### Error: "invalid_grant"

**Causes:**
- Wrong username
- Wrong client ID (Consumer Key)
- Certificate mismatch
- User not pre-approved

**Solutions:**
1. Verify username in `.sfconnect.json`
2. Verify clientId matches Consumer Key
3. Re-upload certificate to Connected App
4. Pre-approve users (see above)

### Error: "invalid signature"

**Cause:** Private key doesn't match certificate

**Solution:**
1. Regenerate key pair (Step 1)
2. Re-upload certificate to Connected App (Step 2)
3. Update `privateKeyPath` in config

### Error: "certificate expired"

**Solution:**
1. Generate new certificate (valid longer):
   ```bash
   openssl req -new -x509 -key certs/server.key -out certs/server.crt -days 3650
   ```
2. Re-upload to Connected App

## Security Best Practices

### 1. Add to .gitignore

Never commit sensitive files:

```bash
# Add to .gitignore
.sfconnect.json
certs/
*.key
*.crt
```

### 2. Use Environment Variables

For CI/CD, use environment variables instead:

```bash
export SF_INSTANCE_URL="https://your-instance.salesforce.com"
export SF_CLIENT_ID="your-consumer-key"
export SF_USERNAME="your-username@example.com"
export SF_PRIVATE_KEY="$(cat certs/server.key)"
```

### 3. Restrict Connected App

In Connected App settings:
- **IP Relaxation**: Enforce IP restrictions
- **Permitted Users**: Admin approved only
- **OAuth Policies**: Restrict refresh token usage

## Sandbox vs Production

### Sandbox Configuration

```json
{
  "instanceUrl": "https://test.salesforce.com",
  "tokenUrl": "https://test.salesforce.com/services/oauth2/token",
  "username": "your-username@example.com.sandbox"
}
```

### Production Configuration

```json
{
  "instanceUrl": "https://login.salesforce.com",
  "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
  "username": "your-username@example.com"
}
```

## Next Steps

- [CLI Commands Reference](commands.md) - All available commands
- [Scaffolding Guide](scaffolding.md) - Generate models
- [Model Generation](../models/model-generation.md) - How models are generated
