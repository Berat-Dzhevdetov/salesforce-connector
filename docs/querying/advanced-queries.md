# Advanced Queries

Master complex query patterns and advanced techniques.

## Object Property Closures

Use nested object properties in WHERE clauses:

```typescript
const config = {
  industry: 'Technology',
  minRevenue: 1000000
};

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === config.industry && x.AnnualRevenue > config.minRevenue)
  .get();
```

### Deeply Nested Properties

```typescript
const filters = {
  account: {
    criteria: {
      industry: 'Technology',
      location: {
        city: 'San Francisco'
      }
    }
  }
};

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    x.Industry === filters.account.criteria.industry &&
    x.BillingCity === filters.account.criteria.location.city
  )
  .get();
```

## Complex Conditions

Combine AND and OR logic:

```typescript
// Parentheses for grouping
const results = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    (x.Industry === 'Technology' || x.Industry === 'Finance') &&
    x.AnnualRevenue > 1000000
  )
  .get();

// Complex business logic
const opportunities = await Opportunity
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    (x.Amount > 100000 && x.Stage === 'Negotiation') ||
    (x.Probability > 80 && x.Stage === 'Proposal')
  )
  .get();
```

## Pattern Matching

Advanced string matching patterns:

```typescript
// Case-insensitive contains (Salesforce LIKE is case-insensitive)
const searchTerm = 'acme';
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.includes(searchTerm))
  .get();
// Generates: WHERE Name LIKE '%acme%'

// Prefix matching
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.startsWith('A'))
  .get();
// Generates: WHERE Name LIKE 'A%'

// Suffix matching
const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Name.endsWith('Corp'))
  .get();
// Generates: WHERE Name LIKE '%Corp'
```

## WHERE IN Queries (Array Membership)

The `.includes()` method automatically detects arrays and generates efficient `WHERE IN` clauses:

### Basic Array Queries

```typescript
// String array
const industries = ['Technology', 'Finance', 'Healthcare'];
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry.includes(industries))
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance', 'Healthcare')

// Numeric array
const revenues = [1000000, 5000000, 10000000];
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.AnnualRevenue.includes(revenues))
  .get();
// SOQL: WHERE AnnualRevenue IN (1000000, 5000000, 10000000)

// Boolean array
const statuses = [true];
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.IsActive.includes(statuses))
  .get();
// SOQL: WHERE IsActive IN (TRUE)
```

### Multiple WHERE IN Clauses

```typescript
const industries = ['Technology', 'Finance'];
const ratings = ['Hot', 'Warm'];

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry.includes(industries) && x.Rating.includes(ratings))
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance') AND Rating IN ('Hot', 'Warm')
```

### Complex Conditions with WHERE IN

```typescript
const industries = ['Technology', 'Finance', 'Healthcare'];
const minRevenue = 5000000;

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    (x.Industry.includes(industries) && x.AnnualRevenue > minRevenue) ||
    (x.Rating === 'Hot' && x.IsActive === true)
  )
  .get();
// SOQL: WHERE (Industry IN ('Technology', 'Finance', 'Healthcare') AND AnnualRevenue > 5000000)
//    OR (Rating = 'Hot' AND IsActive = TRUE)
```

### Dynamic IN Queries

```typescript
function getAccountsByIndustries(allowedIndustries: string[]) {
  return Account
    .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
    .where(x => x.Industry.includes(allowedIndustries))
    .get();
}

// Usage
const techAndFinance = await getAccountsByIndustries(['Technology', 'Finance']);
const allIndustries = await getAccountsByIndustries(['Tech', 'Finance', 'Healthcare', 'Retail']);
```

### Nested Properties with WHERE IN

```typescript
const states = ['CA', 'NY', 'TX'];

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, State: x.BillingAddress.State }))
  .where(x => x.BillingAddress.State.includes(states))
  .get();
// SOQL: WHERE BillingAddress.State IN ('CA', 'NY', 'TX')
```

## Dynamic Query Building

Build queries conditionally:

```typescript
interface AccountFilters {
  industry?: string;
  minRevenue?: number;
  isActive?: boolean;
  city?: string;
}

async function getFilteredAccounts(filters: AccountFilters) {
  let query = Account.select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry,
    Revenue: x.AnnualRevenue
  }));

  if (filters.industry) {
    query = query.where(x => x.Industry === filters.industry);
  }

  if (filters.minRevenue) {
    query = query.where(x => x.AnnualRevenue > filters.minRevenue);
  }

  if (filters.isActive !== undefined) {
    query = query.where(x => x.IsActive === filters.isActive);
  }

  if (filters.city) {
    query = query.where(x => x.BillingCity === filters.city);
  }

  return query.get();
}

// Usage
const results = await getFilteredAccounts({
  industry: 'Technology',
  minRevenue: 1000000,
  isActive: true
});
```

## Search Pattern

Implement search across multiple fields:

```typescript
function searchAccounts(searchTerm: string) {
  return Account
    .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
    .where(x =>
      x.Name.includes(searchTerm) ||
      x.Industry.includes(searchTerm) ||
      x.BillingCity.includes(searchTerm)
    )
    .limit(50)
    .get();
}

// Usage
const results = await searchAccounts('Tech');
```

## Combining Multiple Filters

Build complex filter logic:

```typescript
const activeStatus = true;
const industries = ['Technology', 'Finance', 'Healthcare'];
const minRevenue = 500000;

// Use WHERE IN with array includes()
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    x.IsActive === activeStatus &&
    x.Industry.includes(industries) &&
    x.AnnualRevenue > minRevenue
  )
  .get();
// SOQL: WHERE IsActive = TRUE AND Industry IN ('Technology', 'Finance', 'Healthcare') AND AnnualRevenue > 500000
```

## Field Comparison

Compare fields against each other:

```typescript
// Find accounts where AnnualRevenue > ExpectedRevenue
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.AnnualRevenue > x.ExpectedRevenue__c)
  .get();
```

## Null Checks

```typescript
// Check for null values
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === null)
  .get();

// Check for non-null values
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry !== null)
  .get();
```

## Query Reusability

Create reusable query builders:

```typescript
class AccountQueries {
  static activeAccounts() {
    return Account
      .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
      .where(x => x.IsActive === true);
  }

  static techCompanies() {
    return this.activeAccounts()
      .where(x => x.Industry === 'Technology');
  }

  static largeTechCompanies(minRevenue: number) {
    return this.techCompanies()
      .where(x => x.AnnualRevenue > minRevenue)
      .orderBy(x => x.AnnualRevenue, 'DESC');
  }
}

// Usage
const largetech = await AccountQueries.largeTechCompanies(10000000).get();
```

## Best Practices

1. **Use closures for dynamic values** - Don't concatenate strings
2. **Group complex logic** - Use parentheses for clarity
3. **Limit results** - Always use `.limit()` to avoid governor limits
4. **Filter early** - Put the most selective conditions first
5. **Select only needed fields** - Don't query unnecessary data

## Next Steps

- [Pagination](pagination.md) - Smart pagination with metadata
- [Relationships](relationships.md) - Query related records with closures
- [Governor Limits](../advanced/governor-limits.md) - Best practices
