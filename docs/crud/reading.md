# Reading Records

Learn how to query and retrieve Salesforce records.

## Find by ID

Retrieve a single record by its Salesforce ID:

```typescript
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  console.log(account.Name);
  console.log(account.Industry);
} else {
  console.log('Account not found');
}

// Type: Account | null
```

## Query with get()

Retrieve multiple records with filtering:

```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .where(x => x.Industry === 'Technology')
  .limit(10)
  .get();

// Type: Account[]
for (const account of accounts) {
  console.log(account.Name);
}
```

## Get First Record

Retrieve only the first matching record:

```typescript
const account = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Name.startsWith('Acme'))
  .first();

// Type: Account | null
if (account) {
  console.log(`Found: ${account.Name}`);
} else {
  console.log('No matching account');
}
```

## Count Records

Get the count without retrieving data:

```typescript
const count = await Account.count(x => x.Industry === 'Technology');
console.log(`Found ${count} technology accounts`);

// Count all
const totalAccounts = await Account.count();
```

## Check Existence

Check if any records match a condition:

```typescript
const exists = await Account.exists(x => x.Name === 'Acme Corp');

if (exists) {
  console.log('Account exists');
} else {
  console.log('Account not found');
}
```

## With Relationships

Eager load related records:

```typescript
const contacts = await Contact
  .select(x => ({
    Id: x.Id,
    FirstName: x.FirstName,
    LastName: x.LastName,
    OwnerName: x.Owner.Name,
    OwnerEmail: x.Owner.Email
  }))
  .get();

for (const contact of contacts) {
  console.log(`${contact.FirstName} ${contact.LastName}`);
  console.log(`Owner: ${contact.OwnerName} (${contact.OwnerEmail})`);
}
```

## With Pagination

Get paginated results with metadata:

```typescript
const result = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .paginate(1, 20);

console.log(`Page 1: ${result.records.length} accounts`);
console.log(`Total: ${result.totalSize} accounts`);
console.log(`Has next page: ${result.hasNextPage}`);
```

## Complex Queries

Combine multiple conditions:

```typescript
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry,
    Revenue: x.AnnualRevenue
  }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .limit(20)
  .get();
```

## Pattern Matching

Search with string methods:

```typescript
const searchTerm = 'Tech';

// Contains
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.includes(searchTerm))
  .get();

// Starts with
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.startsWith('A'))
  .get();

// Ends with
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.endsWith('Corp'))
  .get();
```

## Accessing Field Values

Once you have a record instance:

```typescript
const account = await Account.find('001xxx');

if (account) {
  // Using getters
  const name = account.Name;
  const industry = account.Industry;

  // Using get() method
  const revenue = account.get('AnnualRevenue');

  // Get all data
  const data = account.getData();
  console.log(data);
}
```

## With Observers

Observers can react to query operations:

```typescript
class AccountObserver implements Observer<Account> {
  async afterFind(instance: Account): Promise<void> {
    console.log(`Account ${instance.Id} was retrieved`);
  }

  async afterQuery(instances: Account[]): Promise<void> {
    console.log(`Query returned ${instances.length} accounts`);
  }
}

Account.observe(new AccountObserver());

// Triggers afterFind
const account = await Account.find('001xxx');

// Triggers afterQuery
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .get();
```

## Best Practices

1. **Select only needed fields** - Don't query unnecessary data
2. **Use find() for single records** - More efficient than `.where().first()`
3. **Always use .limit()** - Prevent retrieving too many records
4. **Filter early** - Use `.where()` to reduce result set
5. **Use count() for counting** - More efficient than `.get().length`

## Next Steps

- [Creating Records](creating.md) - Insert new records
- [Updating Records](updating.md) - Modify existing records
- [Lambda Queries](../querying/lambda-queries.md) - Full query guide
