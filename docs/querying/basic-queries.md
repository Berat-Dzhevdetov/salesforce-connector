# Basic Queries

Learn the fundamentals of querying Salesforce with LambdaModel.

## Select Fields

Specify which fields to retrieve from Salesforce:

```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .get();

// Returns: Array of Account instances
```

### Single Field Selection

```typescript
const names = await Account
  .select(x => ({ Name: x.Name }))
  .get();

// Type: { Name: string }[]
```

### Nested Fields

```typescript
const results = await Account
  .select(x => ({
    Name: x.Name,
    Street: x.BillingAddress.Street,
    City: x.BillingAddress.City
  }))
  .get();
```

## WHERE Clauses

Filter records using type-safe conditions:

### Literal Values

```typescript
// Strings
await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .get();

// Numbers
await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.AnnualRevenue > 1000000)
  .get();

// Booleans
await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.IsActive === true)
  .get();
```

### Closure Variables

Use variables from outer scope:

```typescript
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .get();
```

### Supported Operators

```typescript
// Comparison operators
x.AnnualRevenue > 1000000      // Greater than
x.AnnualRevenue >= 1000000     // Greater than or equal
x.AnnualRevenue < 5000000      // Less than
x.AnnualRevenue <= 5000000     // Less than or equal
x.Industry === 'Technology'    // Equals
x.Industry !== 'Finance'       // Not equals

// Logical operators
x.Industry === 'Tech' && x.AnnualRevenue > 1000000  // AND
x.Industry === 'Tech' || x.Industry === 'Finance'   // OR
```

### String Methods

```typescript
const searchTerm = 'Tech';

// LIKE '%Tech%'
await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.includes(searchTerm))
  .get();

// LIKE 'Tech%'
await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.startsWith(searchTerm))
  .get();

// LIKE '%Tech'
await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.endsWith(searchTerm))
  .get();
```

### Multiple WHERE Conditions

Chain multiple `where()` calls (combined with AND):

```typescript
const results = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .where(x => x.AnnualRevenue > 1000000)
  .get();

// Generates: WHERE Industry = 'Technology' AND AnnualRevenue > 1000000
```

## Order By

Sort results by one or more fields:

```typescript
const sorted = await Account
  .select(x => ({ Name: x.Name, Revenue: x.AnnualRevenue }))
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .get();

// Ascending order
const ascending = await Account
  .select(x => ({ Name: x.Name }))
  .orderBy(x => x.Name, 'ASC')
  .get();
```

## Limit & Offset

Control the number of results and pagination:

```typescript
// Get first 10 records
const first10 = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .limit(10)
  .get();

// Skip first 10, get next 10
const next10 = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .offset(10)
  .limit(10)
  .get();
```

## First Record

Retrieve only the first matching record:

```typescript
const account = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .first();

// Type: { Id: string, Name: string } | null
```

## Count Records

Get the count of matching records without retrieving data:

```typescript
// Count all Technology accounts
const count = await Account.count(x => x.Industry === 'Technology');

console.log(count); // e.g., 150

// Count with complex condition
const highValueCount = await Account.count(x =>
  x.Industry === 'Technology' && x.AnnualRevenue > 1000000
);
```

## Exists Check

Check if any records match a condition:

```typescript
const companyName = 'Acme Corp';
const exists = await Account.exists(x => x.Name === companyName);

if (exists) {
  console.log('Found!');
}
```

## Complex Queries

Chain multiple methods for sophisticated queries:

```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry,
    Revenue: x.AnnualRevenue
  }))
  .where(x => x.Industry === 'Technology')
  .where(x => x.AnnualRevenue >= 500000)
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .limit(20)
  .get();
```

## Debug Queries

Use `toSOQL()` to see the generated SOQL query:

```typescript
const query = Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .limit(10);

console.log(query.toSOQL());
// Output: SELECT Id, Name FROM Account WHERE Industry = 'Technology' ORDER BY AnnualRevenue DESC LIMIT 10
```

## Next Steps

- [Advanced Queries](advanced-queries.md) - Complex conditions and grouping
- [Pagination](pagination.md) - Smart pagination with metadata
- [Relationships](relationships.md) - Query related records
