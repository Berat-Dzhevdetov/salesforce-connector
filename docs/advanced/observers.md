# Lifecycle Hooks (Observers)

**⚠️ Important:** Observers are JavaScript/TypeScript-level hooks that run in **your application code**. They have **nothing to do** with Salesforce Triggers, Process Builder, or Flows. Observers only execute when you use this library's methods (`create()`, `update()`, `save()`, `delete()`) - they do NOT fire when records are modified directly in Salesforce or through other APIs.

Observers allow you to respond to model lifecycle events without modifying your model classes. They follow the Observer pattern and are perfect for cross-cutting concerns like audit logging, validation, and notifications.

## Available Lifecycle Hooks

```typescript
interface Observer<T extends Model> {
  beforeCreate?(instance: T): Promise<void> | void;
  afterCreate?(instance: T): Promise<void> | void;

  beforeUpdate?(instance: T, changes: any): Promise<void> | void;
  afterUpdate?(instance: T, changes: any): Promise<void> | void;

  beforeSave?(instance: T, isNew: boolean): Promise<void> | void;
  afterSave?(instance: T, isNew: boolean): Promise<void> | void;

  beforeDelete?(instance: T): Promise<void> | void;
  afterDelete?(instance: T): Promise<void> | void;

  afterFind?(instance: T): Promise<void> | void;
  afterQuery?(instances: T[]): Promise<void> | void;
}
```

## Hook Execution Order

**For `Model.create()`:**
1. `beforeSave` (isNew=true)
2. `beforeCreate`
3. **→ Salesforce API call**
4. `afterCreate`
5. `afterSave` (isNew=true)

**For `instance.update()`:**
1. `beforeSave` (isNew=false)
2. `beforeUpdate`
3. **→ Salesforce API call**
4. `afterUpdate`
5. `afterSave` (isNew=false)

**For `instance.save()`:**
- If new: Same as `create()`
- If existing: Same as `update()`

**For `instance.delete()`:**
1. `beforeDelete`
2. **→ Salesforce API call**
3. `afterDelete`

## Creating an Observer

```typescript
import { Observer } from 'javascript-salesforce-connector';
import { Account } from './models';

class AccountObserver implements Observer<Account> {
  // All methods are optional - only implement what you need

  async beforeCreate(instance: Account): Promise<void> {
    // Validate or modify before creation
    if (!instance.Name || instance.Name.length < 3) {
      throw new Error('Account name must be at least 3 characters');
    }
  }

  async afterCreate(instance: Account): Promise<void> {
    // Log or trigger actions after creation
    console.log(`Account created: ${instance.Id}`);
  }

  async beforeUpdate(instance: Account, changes: any): Promise<void> {
    // Validate changes
    console.log('Updating fields:', Object.keys(changes));
  }

  async afterUpdate(instance: Account, changes: any): Promise<void> {
    // React to successful update
    console.log(`Account ${instance.Id} updated`);
  }

  async beforeDelete(instance: Account): Promise<void> {
    // Prevent deletion or clean up
    if (instance.get('IsActive')) {
      throw new Error('Cannot delete active accounts');
    }
  }

  async afterDelete(instance: Account): Promise<void> {
    // Audit logging
    console.log(`Account ${instance.getId()} deleted`);
  }
}
```

## Registering Observers

Register observers once at application startup:

```typescript
import { Account, Contact } from './models';
import { AccountObserver } from './observers/AccountObserver';

// Register observer for a specific model
Account.observe(new AccountObserver());

// You can register multiple observers per model
Account.observe(new AuditLogObserver());
Account.observe(new ValidationObserver());

// Or reuse the same observer across multiple models
const auditLogger = new AuditLogObserver();
Account.observe(auditLogger);
Contact.observe(auditLogger);
```

## Example: Audit Log Observer

```typescript
class AuditLogObserver<T extends Model> implements Observer<T> {
  private logAction(action: string, instance: T, details?: any): void {
    const modelName = (instance.constructor as any).getObjectName();
    const id = instance.getId();

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      model: modelName,
      recordId: id,
      details
    }));
  }

  async afterCreate(instance: T): Promise<void> {
    this.logAction('CREATE', instance, { data: instance.getData() });
  }

  async afterUpdate(instance: T, changes: any): Promise<void> {
    this.logAction('UPDATE', instance, { changes });
  }

  async afterDelete(instance: T): Promise<void> {
    this.logAction('DELETE', instance);
  }
}

// Register on multiple models
const logger = new AuditLogObserver();
Account.observe(logger);
Contact.observe(logger);
Opportunity.observe(logger);
```

## Example: Validation Observer

```typescript
class ValidationObserver implements Observer<Account> {
  async beforeCreate(instance: Account): Promise<void> {
    this.validateAccount(instance);
  }

  async beforeUpdate(instance: Account): Promise<void> {
    this.validateAccount(instance);
  }

  private validateAccount(instance: Account): void {
    if (!instance.Name || instance.Name.length < 3) {
      throw new Error('Account name must be at least 3 characters');
    }

    if (instance.AnnualRevenue && instance.AnnualRevenue < 0) {
      throw new Error('Annual revenue cannot be negative');
    }

    if (instance.Email && !this.isValidEmail(instance.Email)) {
      throw new Error('Invalid email format');
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

Account.observe(new ValidationObserver());
```

## Example: Auto-Timestamp Observer

```typescript
class TimestampObserver<T extends Model> implements Observer<T> {
  async beforeCreate(instance: T): Promise<void> {
    const now = new Date();

    // Set custom timestamp fields if they exist
    if (instance.getData().ProcessedAt__c !== undefined) {
      instance.set('ProcessedAt__c' as keyof T, now as any);
    }
  }

  async beforeUpdate(instance: T): Promise<void> {
    const now = new Date();

    if (instance.getData().ProcessedAt__c !== undefined) {
      instance.set('ProcessedAt__c' as keyof T, now as any);
    }
  }
}

CustomObject.observe(new TimestampObserver());
```

## Observer Configuration

Configure how observers execute:

```typescript
// Execute observers in parallel (faster but riskier)
Account.setObserverOptions({ parallel: true });

// Continue executing remaining observers even if one fails
Account.setObserverOptions({ stopOnError: false });

// Clear all observers (useful for testing)
Account.clearObservers();

// Remove a specific observer
const myObserver = new MyObserver();
Account.observe(myObserver);
Account.removeObserver(myObserver);
```

## Best Practices

1. **Keep observers focused** - Each observer should have one responsibility
2. **Register at startup** - Register all observers when your application starts
3. **Throw errors to prevent operations** - Use `beforeX` hooks to validate and throw errors to stop the operation
4. **Keep hooks fast** - Avoid slow operations that block CRUD methods
5. **Use `beforeSave`/`afterSave`** for logic that applies to both create and update

## Common Use Cases

- **Audit Logging** - Track all changes for compliance
- **Data Validation** - Enforce business rules before saving
- **Notifications** - Send emails/webhooks when records change
- **Auto-populate Fields** - Set timestamps, defaults, or calculated values
- **Cache Invalidation** - Clear caches when data changes
- **Security Checks** - Verify permissions before operations
- **Workflow Triggers** - Start background jobs on certain events

## Important Notes

- Observers are **synchronous** and block the operation
- Multiple observers execute in **registration order**
- Errors in `beforeX` hooks **prevent** the operation
- Errors in `afterX` hooks **don't rollback** the Salesforce change
- Observers **only run in your application** - they don't fire for:
  - Direct Salesforce UI changes
  - Salesforce Triggers/Flows
  - Other API integrations
  - Bulk API operations
  - Data Loader imports

## Next Steps

- [Closure Variables](closure-variables.md) - How closures work
- [Error Handling](error-handling.md) - Handle errors gracefully
- [Governor Limits](governor-limits.md) - Best practices
