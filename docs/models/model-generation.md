# Model Generation (CLI)

The `sfc` CLI tool automatically generates TypeScript model files from your Salesforce metadata. This is the **recommended way** to create models, as it ensures accuracy and saves time.

## Installation

**Install globally to use `sfc` commands directly:**
```bash
npm install -g javascript-salesforce-connector
```

Now you can use `sfc` anywhere without `npx`:
```bash
sfc init
sfc scaffold Account Contact -o ./models
sfc test-auth
```

**Alternative:** If you prefer not to install globally, use `npx` instead:
```bash
npx sfc init
npx sfc scaffold Account Contact -o ./models
```

## Quick Start

1. **Initialize configuration:**
   ```bash
   sfc init
   ```
   This creates a `.sfconnect.json` configuration file in your project root.

2. **Configure authentication** by editing `.sfconnect.json`:
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

3. **Test your authentication:**
   ```bash
   sfc test-auth
   ```

4. **Generate models:**
   ```bash
   sfc scaffold Account Contact Opportunity
   ```

## Generating Models

**IMPORTANT:** Always use the exact Salesforce **API name** for objects:
- ✅ Standard objects: `Account`, `Contact`, `Opportunity`, `Lead`, `Case`, `User`
- ✅ Custom objects: `CustomObject__c`, `ProductReview__c` (must include `__c` suffix)
- ❌ Don't use labels like "Accounts" or "Custom Object"

### Generate to default location (`./src/models`):
```bash
sfc scaffold Account Contact Opportunity
```

### Generate to custom directory:
```bash
# Output to ./models
sfc scaffold Account -o ./models

# Output to nested directory
sfc scaffold Contact Opportunity -o ./src/salesforce/models

# Generate custom object
sfc scaffold ProductReview__c -o ./models
```

### Generate multiple objects at once:
```bash
sfc scaffold Account Contact Lead Opportunity Case -o ./models
```

## Smart Incremental Scaffolding

As of v1.1.0, the scaffold command intelligently **preserves your custom code** when updating existing models!

### How It Works

When you run `sfc scaffold` on an **existing model file**:

1. ✅ **Preserves custom methods** - Your business logic, helpers, and custom functions stay intact
2. ✅ **Preserves custom interface properties** - Relationship fields like `Owner?: UserData` are kept
3. ✅ **Preserves custom imports** - Related model imports remain in place
4. ✅ **Updates field definitions** - Adds new fields from Salesforce metadata
5. ✅ **Updates field types** - Fixes type mismatches (e.g., `string` → `number`)
6. ✅ **Creates automatic backups** - Original file backed up before modification
7. ✅ **Smart index.ts merging** - Adds new exports while preserving custom ones

### Scaffold Options

**Default behavior (recommended):**
```bash
# Preserves custom code, creates backups
sfc scaffold Account Contact
```

**Force regeneration (discards all custom code):**
```bash
# ⚠️ WARNING: Overwrites everything, losing custom methods!
sfc scaffold Account --force
```

**Skip backups:**
```bash
# Preserves custom code but doesn't create .backup files
sfc scaffold Account --no-backup
```

## What Gets Generated

For each Salesforce object, the CLI generates:
- ✅ TypeScript interface (e.g., `AccountData`)
- ✅ Model class extending `LambdaModel<T>`
- ✅ Getters for all fields
- ✅ Setters for updateable fields only (read-only fields excluded)
- ✅ JSDoc comments with field labels and metadata
- ✅ Proper TypeScript types based on Salesforce field types
- ✅ An `index.ts` file for convenient imports

**Example output structure:**
```
./models/
  ├── Account.ts
  ├── Contact.ts
  ├── Opportunity.ts
  ├── index.ts
  └── (backup files when updating)
```

## CLI Commands Reference

| Command | Description | Options |
|---------|-------------|---------|
| `sfc init` | Create `.sfconnect.json` config file | `-o, --output <path>` - Config file path |
| `sfc scaffold <objects...>` | Generate TypeScript models from Salesforce metadata | `-o, --output <dir>` - Output directory (default: `./src/models`)<br>`-c, --config <path>` - Config file path<br>`--no-comments` - Skip JSDoc comments<br>`--force` - Force regenerate (overwrites custom code)<br>`--no-backup` - Skip creating backup files |
| `sfc test-auth` | Test JWT authentication | `-c, --config <path>` - Config file path |

## Using Generated Models

Once generated, import and use your models:

```typescript
import { SalesforceConfig } from 'javascript-salesforce-connector';
import { Account, Contact } from './models';

// Initialize Salesforce config
SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0'
});

SalesforceConfig.setAccessToken(token);

// Use the generated models
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .where(x => x.Industry === 'Technology')
  .limit(10)
  .get();

for (const account of accounts) {
  console.log(account.Name, account.Industry);
}
```

## Next Steps

- [CLI Authentication Setup](../cli/authentication.md) - Configure JWT bearer flow
- [Defining Models](defining-models.md) - Manual model creation
- [Lambda Queries](../querying/lambda-queries.md) - Query your models
