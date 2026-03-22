# Creating Records

Learn how to create new Salesforce records.

## Using create()

The `create()` static method creates a new record in Salesforce:

```typescript
const account = await Account.create({
  Name: 'Acme Corporation',
  Industry: 'Technology',
  AnnualRevenue: 5000000
});

console.log(account.Id);  // Salesforce record ID
console.log(account.Name); // 'Acme Corporation'
```

## Using save()

Create a new instance and save it:

```typescript
const account = new Account();
account.Name = 'New Company';
account.Industry = 'Healthcare';
await account.save(); // Creates new record

console.log(account.Id); // Now has an ID
```

## Validation

Salesforce validates required fields:

```typescript
try {
  // Missing required field
  const account = await Account.create({
    Industry: 'Technology'
    // Name is required but missing
  });
} catch (error) {
  console.error('Validation error:', error.message);
  // Error from Salesforce API
}
```

## Bulk Create

Create multiple records:

```typescript
const accountsData = [
  { Name: 'Company A', Industry: 'Technology' },
  { Name: 'Company B', Industry: 'Finance' },
  { Name: 'Company C', Industry: 'Healthcare' }
];

const accounts = await Promise.all(
  accountsData.map(data => Account.create(data))
);

console.log(`Created ${accounts.length} accounts`);
```

## With Observers

Use observers to react to creation events:

```typescript
class AccountObserver implements Observer<Account> {
  async beforeCreate(instance: Account): Promise<void> {
    // Validate before creation
    if (!instance.Name || instance.Name.length < 3) {
      throw new Error('Account name must be at least 3 characters');
    }
  }

  async afterCreate(instance: Account): Promise<void> {
    // React after creation
    console.log(`Account created: ${instance.Id}`);
  }
}

// Register observer
Account.observe(new AccountObserver());

// Create will trigger hooks
const account = await Account.create({
  Name: 'Acme Corp',
  Industry: 'Tech'
});
```

## Return Value

`create()` returns a fully populated model instance:

```typescript
const account = await Account.create({
  Name: 'Test Account'
});

// All system fields are populated
console.log(account.Id);              // Record ID
console.log(account.CreatedDate);     // Creation timestamp
console.log(account.LastModifiedDate); // Last modified timestamp
```

## Next Steps

- [Reading Records](reading.md) - Query and find records
- [Updating Records](updating.md) - Modify existing records
- [Observers](../advanced/observers.md) - Lifecycle hooks
