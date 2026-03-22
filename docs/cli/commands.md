# CLI Commands Reference

Complete reference for all `sfc` CLI commands.

## sfc init

Create a `.sfconnect.json` configuration file.

```bash
sfc init
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Config file path | `./.sfconnect.json` |

### Example

```bash
# Create config in current directory
sfc init

# Create config in specific location
sfc init -o ./config/salesforce.json
```

### Generated Config

```json
{
  "instanceUrl": "https://your-instance.salesforce.com",
  "apiVersion": "v59.0",
  "authType": "jwt",
  "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
  "clientId": "YOUR_CONNECTED_APP_CLIENT_ID",
  "username": "your-username@example.com",
  "privateKeyPath": "./certs/server.key",
  "algorithm": "RS256"
}
```

## sfc scaffold

Generate TypeScript models from Salesforce metadata.

```bash
sfc scaffold <objects...>
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `objects...` | Salesforce object API names | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./src/models` |
| `-c, --config <path>` | Config file path | `./.sfconnect.json` |
| `--no-comments` | Skip JSDoc comments | false |
| `--force` | Force regenerate (overwrites custom code) | false |
| `--no-backup` | Skip creating backup files | false |

### Examples

```bash
# Generate models to default location
sfc scaffold Account Contact Opportunity

# Generate to custom directory
sfc scaffold Account -o ./models

# Generate without JSDoc comments
sfc scaffold Account --no-comments

# Force regenerate (loses custom code)
sfc scaffold Account --force

# Skip backups
sfc scaffold Account --no-backup

# Custom config file
sfc scaffold Account -c ./config/salesforce.json
```

### Object API Names

**Standard objects:**
- `Account`
- `Contact`
- `Opportunity`
- `Lead`
- `Case`
- `User`
- `Task`
- `Event`

**Custom objects:**
- `CustomObject__c` (must include `__c` suffix)
- `ProductReview__c`
- `Transaction__c`

### What Gets Generated

For each object:
- ✅ TypeScript interface (e.g., `AccountData`)
- ✅ Model class extending `LambdaModel<T>`
- ✅ Getters for all fields
- ✅ Setters for updateable fields
- ✅ JSDoc comments
- ✅ Type-safe field types
- ✅ `index.ts` with exports

### Smart Incremental Scaffolding

Running `sfc scaffold` on existing models:
- ✅ Preserves custom methods
- ✅ Preserves custom interface properties
- ✅ Preserves custom imports
- ✅ Updates field definitions
- ✅ Creates backups automatically

## sfc test-auth

Test JWT authentication with Salesforce.

```bash
sfc test-auth
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <path>` | Config file path | `./.sfconnect.json` |

### Example

```bash
# Test with default config
sfc test-auth

# Test with custom config
sfc test-auth -c ./config/salesforce.json
```

### Output

Success:
```
✓ Authentication successful!
✓ Instance URL: https://your-instance.salesforce.com
✓ API Version: v59.0
✓ User: user@example.com
```

Error:
```
✗ Authentication failed
Error: invalid_grant - user hasn't approved this consumer
```

## Global Options

Available for all commands:

| Option | Description |
|--------|-------------|
| `-h, --help` | Display help for command |
| `-V, --version` | Output version number |

### Examples

```bash
# Get help for specific command
sfc scaffold --help

# Check CLI version
sfc --version
```

## Configuration File

The `.sfconnect.json` file configures CLI authentication:

```json
{
  "instanceUrl": "https://your-instance.salesforce.com",
  "apiVersion": "v59.0",
  "authType": "jwt",
  "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
  "clientId": "YOUR_CONNECTED_APP_CLIENT_ID",
  "username": "your-username@example.com",
  "privateKeyPath": "./certs/server.key",
  "algorithm": "RS256"
}
```

### Configuration Fields

| Field | Description | Required |
|-------|-------------|----------|
| `instanceUrl` | Salesforce instance URL | Yes |
| `apiVersion` | API version (e.g., `v59.0`) | Yes |
| `authType` | Authentication type (`jwt`) | Yes |
| `tokenUrl` | OAuth token endpoint | Yes |
| `clientId` | Connected App client ID | Yes |
| `username` | Salesforce username | Yes |
| `privateKeyPath` | Path to RSA private key | Yes |
| `algorithm` | Signing algorithm (`RS256`) | Yes |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Error (authentication, generation, etc.) |

## Next Steps

- [Authentication Setup](authentication.md) - Configure JWT bearer flow
- [Scaffolding Guide](scaffolding.md) - Detailed generation guide
- [Model Generation](../models/model-generation.md) - How models are generated
