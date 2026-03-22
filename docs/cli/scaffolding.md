# Scaffolding Guide

Learn how to auto-generate TypeScript models from Salesforce metadata.

## Quick Start

```bash
# Initialize config
npx sfc init

# Generate models
npx sfc scaffold Account Contact Opportunity
```

## Basic Usage

### Generate Single Object

```bash
npx sfc scaffold Account
```

### Generate Multiple Objects

```bash
npx sfc scaffold Account Contact Opportunity Lead Case
```

### Custom Output Directory

```bash
# Output to ./models
npx sfc scaffold Account -o ./models

# Output to nested directory
npx sfc scaffold Contact -o ./src/salesforce/models
```

## Object API Names

**IMPORTANT:** Always use the exact Salesforce **API name**:

### Standard Objects

```bash
npx sfc scaffold Account Contact Opportunity Lead Case User Task Event
```

### Custom Objects

Custom objects must include `__c` suffix:

```bash
npx sfc scaffold ProductReview__c Transaction__c CustomObject__c
```

❌ **Wrong:**
```bash
npx sfc scaffold Accounts  # Missing __c or wrong name
npx sfc scaffold Product Review  # Spaces not allowed
```

✅ **Correct:**
```bash
npx sfc scaffold Account  # Standard object
npx sfc scaffold ProductReview__c  # Custom object
```

## Generated Files

### File Structure

```
./models/
  ├── Account.ts
  ├── Contact.ts
  ├── Opportunity.ts
  └── index.ts
```

### Account.ts Example

```typescript
import { LambdaModel, ModelData } from 'javascript-salesforce-connector';

/**
 * Data interface for Account (Account)
 */
export interface AccountData extends ModelData {
  /** Account ID */
  Id?: string;
  /** Account Name */
  Name?: string;
  /** Industry */
  Industry?: string;
  /** Annual Revenue */
  AnnualRevenue?: number;
  // ... more fields
}

/**
 * Model for Account (Account)
 */
export class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  /** Get Account ID */
  get Id(): string | undefined {
    return this.get('Id');
  }

  /** Get Account Name */
  get Name(): string | undefined {
    return this.get('Name');
  }

  /** Set Account Name */
  set Name(value: string | undefined) {
    if (value !== undefined) {
      this.set('Name', value);
    }
  }

  // ... more getters/setters
}
```

### index.ts

```typescript
export * from './Account';
export * from './Contact';
export * from './Opportunity';
```

## Smart Incremental Scaffolding

Re-running `sfc scaffold` on existing models preserves custom code!

### What Gets Preserved

✅ **In the Interface:**
- Custom relationship properties
- Manually added fields

✅ **In the Class:**
- Custom methods
- Custom relationship getters
- Custom static properties
- Comments and JSDoc

✅ **In index.ts:**
- Custom exports

### What Gets Updated

🔄 **From Salesforce metadata:**
- Standard field properties
- Standard getters
- Standard setters (for updateable fields)
- `objectName`, `dateFields`, `dateTimeFields`
- JSDoc comments
- Field types

### Example

**Before (Your custom code):**
```typescript
export class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  // Generated getters/setters...

  // YOUR CUSTOM CODE
  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  toClientFormat() {
    return {
      id: this.Id,
      name: this.Name,
      industry: this.Industry
    };
  }
}
```

**After running `sfc scaffold Account`:**
```typescript
export class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  // Updated getters/setters with new fields added...

  // YOUR CUSTOM CODE (PRESERVED!)
  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  toClientFormat() {
    return {
      id: this.Id,
      name: this.Name,
      industry: this.Industry
    };
  }
}
```

## Scaffold Options

### Default (Recommended)

Preserves custom code, creates backups:

```bash
npx sfc scaffold Account Contact
```

### Force Regenerate

⚠️ **WARNING:** Discards all custom code!

```bash
npx sfc scaffold Account --force
```

Use `--force` only when:
- Starting fresh
- Model is corrupted
- You want to reset everything

### Skip Backups

```bash
npx sfc scaffold Account --no-backup
```

Preserves custom code but doesn't create `.backup` files.

### No JSDoc Comments

```bash
npx sfc scaffold Account --no-comments
```

Generates models without JSDoc comments.

## Backup Files

When updating existing models, backups are created automatically:

```
./models/
  ├── Account.ts
  ├── Account.ts.backup.2025-03-19T10-30-15-000Z
  ├── Contact.ts
  └── Contact.ts.backup.2025-03-19T11-45-22-000Z
```

Backup filename format: `{Model}.ts.backup.{ISO-8601-timestamp}`

## Best Practices

1. **Commit before scaffolding** - Use git to track changes
2. **Run incrementally** - Update models when Salesforce schema changes
3. **Review changes** - Check diffs after generation
4. **Use backups** - Restore if something goes wrong
5. **Avoid `--force`** - Only use when necessary

## Field Type Mappings

| Salesforce Type | TypeScript Type |
|----------------|-----------------|
| `string` | `string` |
| `boolean` | `boolean` |
| `int` | `number` |
| `double` | `number` |
| `currency` | `number` |
| `date` | `string` |
| `datetime` | `string` |
| `email` | `string` |
| `phone` | `string` |
| `url` | `string` |
| `picklist` | `string` |
| `id` | `string` |
| `reference` | `string` |

## Read-Only Fields

System fields are generated as getters only (no setters):

- `Id`
- `CreatedDate`
- `CreatedById`
- `LastModifiedDate`
- `LastModifiedById`
- `SystemModstamp`

## Common Issues

### Error: "Object 'Accounts' not found"

Use singular form: `Account` not `Accounts`

### Error: "Object 'Product Review' not found"

Custom objects need API name with `__c`: `ProductReview__c`

### Error: "Authentication failed"

Run `npx sfc test-auth` to verify authentication setup.

### Error: "Permission denied"

Ensure your Salesforce user has:
- Read access to objects
- View All Data permission (or object-specific)

## Next Steps

- [CLI Commands Reference](commands.md) - All commands
- [Authentication Setup](authentication.md) - Configure JWT flow
- [Defining Models](../models/defining-models.md) - Manual model creation
