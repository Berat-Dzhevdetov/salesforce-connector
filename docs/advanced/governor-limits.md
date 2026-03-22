# Salesforce Governor Limits

## ⚠️ Critical: Library Does NOT Handle Governor Limits

**This library does NOT automatically handle Salesforce governor limits.** You, as the developer, are responsible for writing queries that respect Salesforce's limits.

## Common Governor Limits

| Limit | Synchronous | Asynchronous |
|-------|-------------|--------------|
| SOQL Queries | 100 | 200 |
| DML Statements | 150 | 150 |
| Heap Size | 6 MB | 12 MB |
| CPU Time | 10 seconds | 60 seconds |
| Query Rows | 50,000 | 50,000 |

[Full list of governor limits](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_apexgov.htm)

## Dangerous Patterns

### Example: Be Careful with `.all()`

```typescript
// ⚠️ DANGEROUS - May retrieve thousands of records and hit limits!
const allAccounts = await Account.all();

// ✅ BETTER - Always use LIMIT to control record retrieval
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .limit(200)  // Stay within safe limits
  .get();

// ✅ BEST - Query only what you need with proper filtering
const techAccounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .where(x => x.IsActive === true)
  .limit(100)
  .get();
```

## Best Practices

### 1. Always Use LIMIT

```typescript
// ❌ Bad - No limit
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .get();

// ✅ Good - With limit
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .limit(200)
  .get();
```

### 2. Filter Aggressively

```typescript
// ❌ Bad - Returns too many results
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .limit(1000)
  .get();

// ✅ Good - Filtered query
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === 'Technology')
  .where(x => x.CreatedDate > '2025-01-01')
  .limit(200)
  .get();
```

### 3. Select Only Needed Fields

```typescript
// ❌ Bad - Selects many fields
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry,
    Description: x.Description,
    // ... 20 more fields
  }))
  .get();

// ✅ Good - Only needed fields
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .limit(200)
  .get();
```

### 4. Use Pagination

```typescript
// ❌ Bad - Fetch all at once
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .limit(10000)  // Too many!
  .get();

// ✅ Good - Paginate results
async function processAllAccounts() {
  let currentPage = 1;
  const pageSize = 200;

  while (true) {
    const result = await Account
      .select(x => ({ Id: x.Id, Name: x.Name }))
      .paginate(currentPage, pageSize);

    // Process this page
    await processAccounts(result.records);

    if (!result.hasNextPage) {
      break;
    }

    currentPage++;
  }
}
```

### 5. Eager Load Relationships

```typescript
// ❌ Bad - N+1 query problem
const contacts = await Contact
  .select(x => ({ Id: x.Id, FirstName: x.FirstName }))
  .limit(100)
  .get();

for (const contact of contacts) {
  await contact.loadOwner();  // 100 additional queries!
}

// ✅ Good - Eager load in one query
const contacts = await Contact
  .select(x => ({
    Id: x.Id,
    FirstName: x.FirstName,
    OwnerName: x.Owner.Name  // Loaded in same query
  }))
  .limit(100)
  .get();
```

### 6. Batch DML Operations

```typescript
// ❌ Bad - Individual DML calls
for (const account of accounts) {
  await account.update({ Industry: 'Tech' });  // 100 DML calls!
}

// ✅ Good - Batch updates
await Promise.all(
  accounts.map(account => {
    account.Industry = 'Tech';
    return account.save();
  })
);
// Still multiple calls, but parallelized
```

### 7. Use count() Instead of get().length

```typescript
// ❌ Bad - Fetches all records just to count
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === 'Technology')
  .get();
const count = accounts.length;  // Wasteful!

// ✅ Good - Use count()
const count = await Account.count(x => x.Industry === 'Technology');
```

## Monitoring Limits

Check current limits in your Salesforce org:
1. Setup → System Overview → Apex → Limits
2. Or use Salesforce API to programmatically check limits

## Handling Limit Errors

```typescript
try {
  const accounts = await Account
    .select(x => ({ Id: x.Id }))
    .limit(50000)  // At the limit
    .get();
} catch (error) {
  if (error.message.includes('QUERY_TIMEOUT') ||
      error.message.includes('QUERY_LOCATOR_MISMATCH')) {
    console.error('Hit governor limits! Reduce query scope.');
  }
}
```

## Production Checklist

Before deploying to production, verify:

- [ ] All queries have `.limit()` clauses
- [ ] Queries are filtered with `.where()`
- [ ] Only necessary fields are selected
- [ ] Relationships are eager-loaded when possible
- [ ] Bulk operations are batched appropriately
- [ ] Pagination is used for large datasets
- [ ] No queries in loops
- [ ] No DML operations in loops

## Real-World Example

```typescript
// ❌ Very Bad - Multiple anti-patterns
async function badExample() {
  const allAccounts = await Account.all();  // No limit!

  for (const account of allAccounts) {  // Loop with queries
    const contacts = await Contact
      .select(x => ({ Id: x.Id }))
      .where(x => x.AccountId === account.Id)
      .get();  // N+1 problem

    for (const contact of contacts) {  // DML in loop
      await contact.update({ Status: 'Active' });
    }
  }
}

// ✅ Good - Follows best practices
async function goodExample() {
  // Paginate with reasonable limit
  let currentPage = 1;
  const pageSize = 200;

  while (true) {
    // Get accounts with eager-loaded contacts
    const result = await Account
      .select(x => ({
        Id: x.Id,
        Name: x.Name,
        Contacts: x.Contacts
          .select(c => ({ Id: c.Id, Status: c.Status }))
      }))
      .where(x => x.Industry === 'Technology')  // Filter
      .paginate(currentPage, pageSize);

    // Batch updates
    const contactsToUpdate = [];
    for (const account of result.records) {
      for (const contact of account.Contacts) {
        contact.Status = 'Active';
        contactsToUpdate.push(contact);
      }
    }

    // Parallel DML
    await Promise.all(contactsToUpdate.map(c => c.save()));

    if (!result.hasNextPage) {
      break;
    }

    currentPage++;
  }
}
```

## Next Steps

- [Pagination](../querying/pagination.md) - Smart pagination
- [Relationships](../querying/relationships.md) - Eager loading
- [Error Handling](error-handling.md) - Handle limit errors
