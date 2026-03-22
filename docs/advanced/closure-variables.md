# Closure Variables Deep Dive

Learn how closure variable support works in LambdaModel queries.

## What Are Closures?

Closures allow lambda functions to access variables from outer scopes:

```typescript
const industry = 'Technology';  // Variable in outer scope

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry)  // ✓ Closure variable!
  .get();
```

## How It Works

LambdaModel uses two techniques to extract closure values:

1. **TypeScript AST Parsing** (ts-morph) - Analyzes the lambda function structure
2. **Node.js Inspector Protocol** - Extracts variable values at runtime

### Technical Flow

```typescript
const minRevenue = 1000000;

const query = Account.where(x => x.AnnualRevenue > minRevenue);

// 1. Parse lambda with ts-morph AST
//    → Identifies "minRevenue" as a closure variable
//    → Determines it's a comparison: AnnualRevenue > minRevenue
//
// 2. Extract value with Inspector Protocol
//    → Accesses function's [[Scopes]] internal property
//    → Retrieves minRevenue = 1000000
//
// 3. Build SOQL
//    → WHERE AnnualRevenue > 1000000
```

## Supported Closure Types

### Simple Variables

```typescript
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .get();
```

### Object Properties

```typescript
const config = {
  industry: 'Technology',
  minRevenue: 1000000
};

const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === config.industry && x.AnnualRevenue > config.minRevenue)
  .get();
```

### Nested Object Properties

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
  .select(x => ({ Id: x.Id }))
  .where(x =>
    x.Industry === filters.account.criteria.industry &&
    x.BillingCity === filters.account.criteria.location.city
  )
  .get();
```

## Closures in Subqueries

Closures work in subquery WHERE clauses:

```typescript
const activeStatus = true;
const minAmount = 50000;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name }))
      .where(c => c.Active__c === activeStatus),  // ✓ Closure works!
    BigOpportunities: x.Opportunities
      .select(o => ({ Name: o.Name, Amount: o.Amount }))
      .where(o => o.Amount > minAmount)  // ✓ Closure works!
  }))
  .get();
```

### How Subquery Closures Work

1. **Selector Execution**: When `.select()` is called, the lambda is executed with a proxy object
2. **Capture Phase**: The proxy intercepts `.where()` calls and stores the function **with its closure context**
3. **Parse Phase**: When building SOQL, the captured function is parsed with Inspector Protocol access intact
4. **SOQL Generation**: Closure values are extracted and injected into the subquery

```typescript
// Behind the scenes:
// 1. Proxy captures: x.Contacts.where(c => c.Active === activeStatus)
// 2. Function stored in Map with key "Contacts_where"
// 3. Parser retrieves function from Map (closure preserved)
// 4. Inspector extracts activeStatus = true
// 5. Generates: (SELECT Name FROM Contacts WHERE Active__c = true)
```

## Limitations

### Synchronous Only

The Inspector Protocol API is synchronous:

```typescript
// ✓ Works - synchronous variable access
const industry = 'Technology';
const accounts = await Account
  .where(x => x.Industry === industry)
  .get();

// ❌ Won't work - async function calls not supported
const getIndustry = async () => 'Technology';
const accounts = await Account
  .where(x => x.Industry === await getIndustry())  // Error!
  .get();
```

### No Function Calls

Only direct variable references work:

```typescript
// ✓ Works
const filters = {
  getIndustry: () => 'Technology'
};
// But you must call it OUTSIDE the lambda:
const industry = filters.getIndustry();
const accounts = await Account
  .where(x => x.Industry === industry)
  .get();

// ❌ Won't work - function call inside lambda
const accounts = await Account
  .where(x => x.Industry === filters.getIndustry())  // Error!
  .get();
```

### Inspector Protocol Required

If the Node.js Inspector Protocol is unavailable, closures will fail silently:

```typescript
// ✓ Fallback to literal parsing (if Inspector unavailable)
const accounts = await Account
  .where(x => x.Industry === 'Technology')  // Literal works
  .get();

// ❌ Fails silently if Inspector unavailable
const industry = 'Technology';
const accounts = await Account
  .where(x => x.Industry === industry)  // Returns undefined, generates invalid SOQL
  .get();
```

## Best Practices

1. **Extract values before lambda** - Don't call functions inside lambdas
2. **Use simple variable references** - Avoid complex expressions
3. **Test with real data** - Verify closures work in your environment
4. **Fallback to literals** - If closures don't work, use literal values

### Good Examples

```typescript
// ✓ Simple variables
const industry = 'Technology';
const accounts = await Account.where(x => x.Industry === industry).get();

// ✓ Object properties
const config = { industry: 'Technology' };
const accounts = await Account.where(x => x.Industry === config.industry).get();

// ✓ Pre-computed values
const industries = ['Technology', 'Finance'];
const firstIndustry = industries[0];
const accounts = await Account.where(x => x.Industry === firstIndustry).get();
```

### Bad Examples

```typescript
// ❌ Function call inside lambda
const getIndustry = () => 'Technology';
const accounts = await Account
  .where(x => x.Industry === getIndustry())  // Won't work!
  .get();

// ❌ Async operations
const industry = await fetchIndustryFromDB();
const accounts = await Account
  .where(x => x.Industry === await fetchIndustryFromDB())  // Won't work!
  .get();

// ❌ Complex expressions
const config = { base: 'Tech', suffix: 'nology' };
const accounts = await Account
  .where(x => x.Industry === config.base + config.suffix)  // Won't work!
  .get();
```

## Debugging Closures

Use `toSOQL()` to verify closure values were extracted correctly:

```typescript
const industry = 'Technology';
const query = Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === industry);

console.log(query.toSOQL());
// Expected: SELECT Id FROM Account WHERE Industry = 'Technology'
// If you see: SELECT Id FROM Account WHERE Industry = undefined
// Then closure extraction failed!
```

## Next Steps

- [Lambda Queries](../querying/lambda-queries.md) - Full lambda query guide
- [Advanced Queries](../querying/advanced-queries.md) - Complex patterns
- [Error Handling](error-handling.md) - Handle errors gracefully
