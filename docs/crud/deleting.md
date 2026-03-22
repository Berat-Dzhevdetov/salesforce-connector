# Deleting Records

Learn how to delete Salesforce records.

## Using delete()

Delete a record instance:

```typescript
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  await account.delete();
  console.log('Account deleted');

  // The instance is now marked as deleted
  console.log(account.isDeleted()); // true
}
```

## Using destroy()

Delete a record by ID without fetching it:

```typescript
// More efficient - no fetch required
await Account.destroy('001xx000003DGbQAAW');
console.log('Account deleted');
```

## Bulk Delete

Delete multiple records:

```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === 'Obsolete')
  .get();

await Promise.all(
  accounts.map(account => account.delete())
);

console.log(`Deleted ${accounts.length} accounts`);
```

## Delete by IDs

Delete records using their IDs:

```typescript
const idsToDelete = ['001xxx', '001yyy', '001zzz'];

await Promise.all(
  idsToDelete.map(id => Account.destroy(id))
);
```

## Deleted Record Behavior

Once deleted, the instance is marked and cannot be modified:

```typescript
const account = await Account.find('001xxx');
await account.delete();

// These will throw errors:
try {
  await account.save();
} catch (error) {
  console.error(error.message); // "Cannot save a deleted record"
}

try {
  await account.update({ Name: 'New' });
} catch (error) {
  console.error(error.message); // "Cannot update a deleted record"
}

try {
  account.Name = 'Test';
} catch (error) {
  console.error(error.message); // "Cannot modify a deleted record"
}

// Data is still accessible for reference
console.log(account.Name); // Still works
console.log(account.isDeleted()); // true
```

## With Observers

Observers can intercept delete operations:

```typescript
class AccountObserver implements Observer<Account> {
  async beforeDelete(instance: Account): Promise<void> {
    // Prevent deletion based on conditions
    if (instance.get('IsActive')) {
      throw new Error('Cannot delete active accounts');
    }

    console.log(`About to delete account: ${instance.Id}`);
  }

  async afterDelete(instance: Account): Promise<void> {
    // Audit logging
    console.log(`Account ${instance.getId()} deleted at ${new Date()}`);

    // Clean up related data
    await cleanupRelatedRecords(instance.getId());
  }
}

Account.observe(new AccountObserver());

// Triggers hooks
await account.delete();
```

## Handling Errors

```typescript
try {
  await account.delete();
} catch (error) {
  console.error('Delete failed:', error.message);
  // Handle Salesforce errors (e.g., record locked, permissions)
}
```

## Soft Delete Pattern

Implement soft deletes using a custom field:

```typescript
// Instead of deleting, mark as inactive
const account = await Account.find('001xxx');

if (account) {
  account.IsDeleted__c = true;
  account.DeletedDate__c = new Date().toISOString();
  await account.save();
}

// Query only active records
const activeAccounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.IsDeleted__c === false)
  .get();
```

## Conditional Delete

Delete based on criteria:

```typescript
const account = await Account.find('001xxx');

if (account) {
  // Only delete if conditions are met
  if (account.AnnualRevenue === 0 && account.NumberOfEmployees === 0) {
    await account.delete();
    console.log('Inactive account deleted');
  } else {
    console.log('Account is still active');
  }
}
```

## Cascade Deletes

Salesforce handles cascade deletes automatically for master-detail relationships. For lookup relationships, you may need to handle related records:

```typescript
class AccountObserver implements Observer<Account> {
  async beforeDelete(instance: Account): Promise<void> {
    // Delete related custom records
    const relatedRecords = await CustomObject
      .select(x => ({ Id: x.Id }))
      .where(x => x.AccountId__c === instance.Id)
      .get();

    await Promise.all(
      relatedRecords.map(record => record.delete())
    );
  }
}
```

## delete() vs destroy()

### delete()

- Requires an instance
- Triggers observers
- Marks instance as deleted
- More overhead

```typescript
const account = await Account.find('001xxx');
await account.delete();
```

### destroy()

- Static method
- Takes an ID parameter
- Triggers observers
- More efficient (no fetch required)

```typescript
await Account.destroy('001xxx');
```

## Best Practices

1. **Validate before delete** - Use observers for validation
2. **Use destroy() for efficiency** - When you only have the ID
3. **Handle errors** - Wrap in try/catch
4. **Clean up related data** - Use observers for cleanup
5. **Consider soft deletes** - For records that need audit trails
6. **Check permissions** - Ensure user has delete access

## Next Steps

- [Creating Records](creating.md) - Insert new records
- [Updating Records](updating.md) - Modify records
- [Observers](../advanced/observers.md) - Lifecycle hooks
