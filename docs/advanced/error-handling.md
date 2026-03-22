# Error Handling

Learn how to handle errors gracefully when working with Salesforce.

## Basic Error Handling

All methods throw descriptive errors that you should handle:

```typescript
try {
  const account = await Account.find('invalid-id');
} catch (error) {
  console.error('Failed to fetch account:', error.message);
}
```

## Common Error Scenarios

### Authentication Errors

Automatically handled via `onTokenExpired` callback:

```typescript
SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    console.log('Token expired, refreshing...');
    const newToken = await refreshAccessToken();
    return newToken;
  }
});

// When a 401/403 error occurs:
// 1. Library calls onTokenExpired()
// 2. Gets new token
// 3. Retries the request automatically
```

### Validation Errors

Salesforce rejects invalid data:

```typescript
try {
  await Account.create({
    Name: '',  // Empty name (invalid)
    Industry: 'Technology'
  });
} catch (error) {
  console.error('Validation error:', error.message);
  // Example: "Required field missing: Name"
}
```

### Not Found Errors

`find()` returns `null` instead of throwing:

```typescript
const account = await Account.find('001xxx');

if (!account) {
  console.log('Account not found');
  return;
}

console.log(account.Name);
```

### Deleted Record Errors

Operations on deleted instances throw errors:

```typescript
const account = await Account.find('001xxx');
await account.delete();

try {
  await account.save();
} catch (error) {
  console.error(error.message);
  // "Cannot save a deleted record"
}

try {
  await account.update({ Name: 'New' });
} catch (error) {
  console.error(error.message);
  // "Cannot update a deleted record"
}

try {
  account.Name = 'Test';
} catch (error) {
  console.error(error.message);
  // "Cannot modify a deleted record"
}

// Data is preserved for reference
console.log(account.Name);  // Still accessible
console.log(account.isDeleted());  // true
```

### Query Errors

Handle query parsing or execution errors:

```typescript
try {
  const accounts = await Account
    .select(x => ({ Id: x.Id, Name: x.Name }))
    .where(x => x.InvalidField === 'value')  // Invalid field
    .get();
} catch (error) {
  console.error('Query error:', error.message);
  // Example: "No such column 'InvalidField' on entity 'Account'"
}
```

## Observer Errors

### Before Hooks (Prevent Operations)

Errors in `beforeX` hooks prevent the operation:

```typescript
class ValidationObserver implements Observer<Account> {
  async beforeCreate(instance: Account): Promise<void> {
    if (!instance.Name || instance.Name.length < 3) {
      throw new Error('Account name must be at least 3 characters');
    }
  }
}

Account.observe(new ValidationObserver());

try {
  await Account.create({ Name: 'AB' });  // Only 2 chars
} catch (error) {
  console.error(error.message);
  // "Account name must be at least 3 characters"
  // Record was NOT created
}
```

### After Hooks (Don't Rollback)

Errors in `afterX` hooks don't rollback Salesforce changes:

```typescript
class NotificationObserver implements Observer<Account> {
  async afterCreate(instance: Account): Promise<void> {
    // Send notification (might fail)
    await sendEmail(instance);  // Throws error if email service down
  }
}

Account.observe(new NotificationObserver());

try {
  const account = await Account.create({ Name: 'Test' });
  // Record WILL be created even if email fails
} catch (error) {
  console.error('Notification failed:', error.message);
  // The account was still created in Salesforce!
}
```

## Error Type Checking

```typescript
import { SalesforceError } from 'javascript-salesforce-connector';

try {
  await Account.create({ Name: 'Test' });
} catch (error) {
  if (error instanceof SalesforceError) {
    console.error('Salesforce API error:', error.statusCode, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Retry Logic

Implement retry for transient errors:

```typescript
async function createAccountWithRetry(data: any, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await Account.create(data);
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        throw error;  // Give up after max retries
      }

      console.warn(`Attempt ${attempt} failed, retrying...`);
      await sleep(1000 * attempt);  // Exponential backoff
    }
  }
}
```

## Bulk Operation Error Handling

Handle errors in bulk operations:

```typescript
const accountsData = [
  { Name: 'Company A', Industry: 'Technology' },
  { Name: '', Industry: 'Finance' },  // Invalid
  { Name: 'Company C', Industry: 'Healthcare' }
];

const results = await Promise.allSettled(
  accountsData.map(data => Account.create(data))
);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Account ${index} created:`, result.value.Id);
  } else {
    console.error(`Account ${index} failed:`, result.reason.message);
  }
});

// Output:
// Account 0 created: 001xxx
// Account 1 failed: Required field missing: Name
// Account 2 created: 001yyy
```

## Validation Before Save

Validate data before attempting to save:

```typescript
function validateAccount(data: any): string[] {
  const errors: string[] = [];

  if (!data.Name || data.Name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (data.Name && data.Name.length < 3) {
    errors.push('Name must be at least 3 characters');
  }

  if (data.AnnualRevenue && data.AnnualRevenue < 0) {
    errors.push('Annual revenue cannot be negative');
  }

  if (data.Email && !isValidEmail(data.Email)) {
    errors.push('Invalid email format');
  }

  return errors;
}

// Use validation
const errors = validateAccount({ Name: 'AB' });
if (errors.length > 0) {
  console.error('Validation errors:', errors.join(', '));
  return;
}

await Account.create({ Name: 'Valid Name' });
```

## Governor Limit Errors

Handle governor limit violations:

```typescript
try {
  // Accidentally query too many records
  const accounts = await Account
    .select(x => ({ Id: x.Id }))
    .get();  // No LIMIT!
} catch (error) {
  if (error.message.includes('QUERY_TIMEOUT') ||
      error.message.includes('QUERY_LOCATOR_MISMATCH')) {
    console.error('Query governor limit exceeded');
    console.log('Solution: Add .limit() to your query');
  } else {
    throw error;
  }
}
```

## Best Practices

1. **Always use try/catch** - Wrap API calls in error handlers
2. **Validate before save** - Client-side validation prevents API errors
3. **Check for null** - Use `find()` returns carefully
4. **Handle specific errors** - Different error types need different handling
5. **Use observers for validation** - Centralize validation logic
6. **Log errors properly** - Include context for debugging
7. **Don't swallow errors** - Re-throw or handle appropriately

## Next Steps

- [Observers](observers.md) - Lifecycle hooks for validation
- [Governor Limits](governor-limits.md) - Avoid Salesforce limits
- [Creating Records](../crud/creating.md) - Insert with validation
