# Updating Records

Learn how to update existing Salesforce records.

## Using update()

Update an existing record with new data:

```typescript
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  await account.update({
    Industry: 'Finance',
    AnnualRevenue: 7500000
  });

  console.log('Account updated');
}
```

## Using save()

Modify properties and save:

```typescript
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  account.Industry = 'Healthcare';
  account.AnnualRevenue = 8000000;
  await account.save();
}
```

## Partial Updates

Only update specific fields:

```typescript
const account = await Account.find('001xxx');

if (account) {
  // Only update Industry, leave other fields unchanged
  await account.update({
    Industry: 'Technology'
  });
}
```

## Bulk Update

Update multiple records:

```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .get();

await Promise.all(
  accounts.map(account => {
    account.Industry = 'Tech';
    return account.save();
  })
);

console.log(`Updated ${accounts.length} accounts`);
```

## update() vs save()

Both methods update records, but with different usage patterns:

### update()

Accepts an object of changes:

```typescript
await account.update({
  Name: 'New Name',
  Industry: 'New Industry'
});
```

### save()

Saves current state:

```typescript
account.Name = 'New Name';
account.Industry = 'New Industry';
await account.save();
```

## Upsert Behavior

`save()` performs an upsert:
- If the instance has no `Id`, it **creates** a new record
- If the instance has an `Id`, it **updates** the existing record

```typescript
// Create new record
const newAccount = new Account();
newAccount.Name = 'Brand New Account';
await newAccount.save(); // Creates

console.log(newAccount.Id); // Now has an ID

// Update existing record
newAccount.Industry = 'Finance';
await newAccount.save(); // Updates
```

## With Observers

Observers can intercept update operations:

```typescript
class AccountObserver implements Observer<Account> {
  async beforeUpdate(instance: Account, changes: any): Promise<void> {
    // Validate changes
    console.log('Updating fields:', Object.keys(changes));

    if (changes.AnnualRevenue && changes.AnnualRevenue < 0) {
      throw new Error('Revenue cannot be negative');
    }
  }

  async afterUpdate(instance: Account, changes: any): Promise<void> {
    // React to successful update
    console.log(`Account ${instance.Id} updated`);
  }
}

Account.observe(new AccountObserver());

// Triggers hooks
await account.update({ Industry: 'Tech' });
```

## Handling Errors

```typescript
try {
  await account.update({
    Name: '', // Invalid: empty name
    Industry: 'Technology'
  });
} catch (error) {
  console.error('Update failed:', error.message);
  // Handle Salesforce validation errors
}
```

## Read-Only Fields

System fields cannot be updated:

```typescript
const account = await Account.find('001xxx');

if (account) {
  // ❌ These will be ignored or cause errors
  await account.update({
    Id: 'new-id',              // System field
    CreatedDate: new Date(),   // Read-only
    LastModifiedDate: new Date() // Read-only
  });

  // ✅ Only update user-editable fields
  await account.update({
    Name: 'Updated Name',
    Industry: 'Technology'
  });
}
```

## Conditional Updates

Update based on current state:

```typescript
const account = await Account.find('001xxx');

if (account) {
  // Only update if conditions are met
  if (account.AnnualRevenue && account.AnnualRevenue > 1000000) {
    account.Industry = 'Enterprise';
    await account.save();
  }
}
```

## Best Practices

1. **Fetch before update** - Always retrieve the record first
2. **Update only changed fields** - Don't send unnecessary data
3. **Validate before update** - Use observers for validation
4. **Handle errors** - Wrap in try/catch for error handling
5. **Use transactions when possible** - For related record updates

## Next Steps

- [Creating Records](creating.md) - Insert new records
- [Deleting Records](deleting.md) - Remove records
- [Observers](../advanced/observers.md) - Lifecycle hooks
