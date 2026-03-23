# LambdaModel - Type-Safe Lambda Queries

> **The Future of Salesforce ORM**: Full type inference, closure variables, and IntelliSense support.

## Overview

LambdaModel provides a lambda-based query interface with:

- ✅ **Full TypeScript type inference** - IntelliSense for all fields
- ✅ **Closure variable support** - Use variables from outer scope
- ✅ **Type-safe field selection** - Compiler catches typos
- ✅ **Subquery support** - Query relationships with closures
- ✅ **Clean syntax** - Fluent, chainable API

[View on GitHub](https://github.com/Berat-Dzhevdetov/salesforce-connector)

## Quick Example

```typescript
// Define your model
interface AccountData extends ModelData {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
}

class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}

// Query with full type safety and closure support
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({
    Id: x.Id,           // ✓ IntelliSense works!
    Name: x.Name,       // ✓ Typos caught at compile time
    Industry: x.Industry
  }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)  // ✓ Closures work!
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .limit(10)
  .get();
```

## Table of Contents

- [Getting Started](#getting-started)
- [Field Selection](#field-selection)
- [WHERE Clauses](#where-clauses)
- [Ordering & Pagination](#ordering--pagination)
- [Relationships & Subqueries](#relationships--subqueries)
- [count() and exists()](#count-and-exists)
- [Migration Guide](#migration-guide)

## Getting Started

### Define Your Model

```typescript
import { LambdaModel, ModelData, RelationshipArray } from 'javascript-salesforce-connector';

interface ContactData extends ModelData {
  Id: string;
  Name: string;
  Email: string;
  Title: string;
}

interface AccountData extends ModelData {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
  Contacts: RelationshipArray<ContactData>;
}

class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  // Define relationship getter for runtime access
  get Contacts(): RelationshipArray<ContactData> {
    return (this.get("Contacts") as any) || [];
  }
}
```

### Basic Query

```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name
  }))
  .get();

// Type: { Id: string, Name: string }[]
```

## Field Selection

### Simple Fields

```typescript
const results = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .get();
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

### Single Field

```typescript
const names = await Account
  .select(x => ({ Name: x.Name }))
  .get();

// Type: { Name: string }[]
```

## WHERE Clauses

### Literal Values

```typescript
// Strings
await Account
  .select(x => ({ Id: x.Id }))
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

**Simple variables:**
```typescript
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .get();
```

**Object properties:**
```typescript
const config = {
  industry: 'Technology',
  minRevenue: 1000000
};

const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === config.industry)
  .get();
```

**Nested properties:**
```typescript
const filters = {
  account: {
    criteria: {
      industry: 'Technology'
    }
  }
};

const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === filters.account.criteria.industry)
  .get();
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

### Array Membership (WHERE IN)

The `.includes()` method automatically detects arrays and generates `WHERE IN` clauses:

```typescript
// String array → WHERE IN
const industries = ['Technology', 'Finance', 'Healthcare'];

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .where(x => x.Industry.includes(industries))
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance', 'Healthcare')
```

**Numeric arrays:**
```typescript
const revenues = [1000000, 5000000, 10000000];

const accounts = await Account
  .select(x => ({ Name: x.Name, AnnualRevenue: x.AnnualRevenue }))
  .where(x => x.AnnualRevenue.includes(revenues))
  .get();
// SOQL: WHERE AnnualRevenue IN (1000000, 5000000, 10000000)
```

**Boolean arrays:**
```typescript
const statuses = [true, false];

const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Active__c.includes(statuses))
  .get();
// SOQL: WHERE Active__c IN (TRUE, FALSE)
```

**With closure variables:**
```typescript
const config = {
  allowedIndustries: ['Technology', 'Finance', 'Healthcare']
};

const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Industry.includes(config.allowedIndustries))
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance', 'Healthcare')
```

**Combined with other conditions:**
```typescript
const industries = ['Technology', 'Finance'];

const accounts = await Account
  .select(x => ({ Name: x.Name }))
  .where(x => x.Industry.includes(industries) && x.AnnualRevenue > 1000000)
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance') AND AnnualRevenue > 1000000
```

### Operators

```typescript
const results = await Account
  .select(x => ({ Id: x.Id }))
  .where(x =>
    x.AnnualRevenue > 1000000 &&      // >
    x.AnnualRevenue <= 5000000 &&     // <=
    x.NumberOfEmployees >= 100 &&     // >=
    x.Rating !== 'Cold'               // !=
  )
  .get();
```

### Complex Conditions

```typescript
// AND and OR
const results = await Account
  .select(x => ({ Id: x.Id }))
  .where(x =>
    (x.Industry === 'Technology' || x.Industry === 'Finance') &&
    x.AnnualRevenue > 1000000
  )
  .get();

// Multiple WHERE (combined with AND)
const results = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === 'Technology')
  .where(x => x.AnnualRevenue > 1000000)
  .get();
```

## Ordering & Pagination

### Order By

```typescript
const sorted = await Account
  .select(x => ({ Name: x.Name, Revenue: x.AnnualRevenue }))
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .get();
```

### Limit & Offset

```typescript
const paginated = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .limit(20)
  .offset(40)
  .get();
```

### Paginate Helper

```typescript
const { records, totalSize, hasNextPage } = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .paginate(3, 20);  // Page 3, 20 per page

console.log(`Total: ${totalSize}, Has next: ${hasNextPage}`);
```

### First Record

```typescript
const account = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .first();

// Type: { Id: string, Name: string } | null
```

## Relationships & Subqueries

### Basic Subquery

```typescript
const accounts = await Account
  .select(x => ({
    Name: x.Name,
    Contacts: x.Contacts.select(c => ({
      Name: c.Name,
      Email: c.Email
    }))
  }))
  .get();
```

### Subquery with WHERE (Closure Support!)

```typescript
const activeStatus = true;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name }))
      .where(c => c.Active__c === activeStatus)  // ✓ Closure works!
  }))
  .get();
```

### Complex Subquery Filters

```typescript
const config = {
  contacts: {
    active: true,
    title: 'VP Sales'
  }
};

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    FilteredContacts: x.Contacts
      .select(c => ({ Name: c.Name, Title: c.Title }))
      .where(c =>
        c.Active__c === config.contacts.active &&
        c.Title === config.contacts.title
      )
  }))
  .get();
```

### Subquery Ordering & Limiting

```typescript
const accounts = await Account
  .select(x => ({
    Name: x.Name,
    TopContacts: x.Contacts
      .select(c => ({ Name: c.Name }))
      .orderBy(c => c.CreatedDate, 'DESC')
      .limit(5)
  }))
  .get();
```

### Multiple Subqueries

```typescript
const activeStatus = true;
const minAmount = 50000;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name }))
      .where(c => c.Active__c === activeStatus),
    BigOpportunities: x.Opportunities
      .select(o => ({ Name: o.Name, Amount: o.Amount }))
      .where(o => o.Amount > minAmount)
  }))
  .get();
```

## count() and exists()

### Count with Closure

```typescript
// Count all
const total = await Account.count();

// Count with condition
const industry = 'Technology';
const techCount = await Account.count(x => x.Industry === industry);

// Complex condition
const count = await Account.count(x =>
  x.Industry === 'Technology' && x.AnnualRevenue > 1000000
);
```

### Exists with Closure

```typescript
const companyName = 'Acme Corp';
const exists = await Account.exists(x => x.Name === companyName);

if (exists) {
  console.log('Found!');
}
```

## Migration Guide

### From QueryBuilder (Old) to LambdaModel (New)

**Before (deprecated):**
```typescript
import { Model } from 'javascript-salesforce-connector';

class Account extends Model<AccountData> {
  protected static objectName = 'Account';
}

// String-based queries
const industry = 'Technology';
const accounts = await Account
  .select('Id', 'Name', 'Industry')
  .where('Industry', industry)
  .where('AnnualRevenue', '>', 1000000)
  .get();
```

**After (recommended):**
```typescript
import { LambdaModel } from 'javascript-salesforce-connector';

class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}

// Lambda-based queries
const industry = 'Technology';
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .where(x => x.Industry === industry && x.AnnualRevenue > 1000000)
  .get();
```

### WHERE IN Migration

**Before (deprecated - verbose OR chains):**
```typescript
const industries = ['Technology', 'Finance', 'Healthcare'];

const accounts = await Account
  .select('Id', 'Name')
  .where(x =>
    x.Industry === industries[0] ||
    x.Industry === industries[1] ||
    x.Industry === industries[2]
  )
  .get();
```

**After (recommended - clean includes()):**
```typescript
const industries = ['Technology', 'Finance', 'Healthcare'];

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry.includes(industries))
  .get();
// SOQL: WHERE Industry IN ('Technology', 'Finance', 'Healthcare')
```

### Benefits of Migration

1. **Type Safety**: Catch typos at compile time
2. **IntelliSense**: Field suggestions in your IDE
3. **Closure Support**: Use variables naturally
4. **Cleaner Code**: More readable lambda syntax
5. **WHERE IN Support**: Array membership with `.includes(array)`
6. **Future Proof**: Will be the default in v2.0

### What's Changing in v2.0

- `LambdaModel` → `Model` (rename)
- Current `Model` → Removed
- `QueryBuilder` → Removed
- Lambda syntax will be the only way

**Start migrating now!**

## Debug Queries

Use `toSOQL()` to see the generated query:

```typescript
const query = Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .limit(10);

console.log(query.toSOQL());
// Output: SELECT Id, Name FROM Account WHERE Industry = 'Technology' ORDER BY AnnualRevenue DESC LIMIT 10
```

## API Reference

### LambdaModel Static Methods

| Method | Description | Example |
|--------|-------------|---------|
| `select(fn)` | Select fields with type inference | `Account.select(x => ({ Id: x.Id }))` |
| `count(fn?)` | Count records | `Account.count(x => x.IsActive)` |
| `exists(fn)` | Check existence | `Account.exists(x => x.Name === 'Acme')` |
| `find(id)` | Find by ID | `Account.find('001...')` |
| `create(data)` | Create record | `Account.create({ Name: 'Acme' })` |

### TypedQueryBuilder Methods

| Method | Description | Example |
|--------|-------------|---------|
| `where(fn)` | Filter with closures | `.where(x => x.Industry === industry)` |
| `orderBy(fn, dir)` | Sort results | `.orderBy(x => x.Name, 'ASC')` |
| `limit(n)` | Limit results | `.limit(10)` |
| `offset(n)` | Skip records | `.offset(20)` |
| `get()` | Execute query | `.get()` |
| `first()` | Get first result | `.first()` |
| `paginate(page, size)` | Paginated results | `.paginate(1, 20)` |
| `toSOQL()` | Get SOQL string | `.toSOQL()` |

## Best Practices

### 1. Always Use Types

```typescript
interface AccountData extends ModelData {
  Id: string;
  Name: string;
  Industry: string;
}

class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}
```

### 2. Select Only What You Need

```typescript
// ✓ Good
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .get();

// ✗ Avoid
const accounts = await Account
  .select(x => ({
    // ... 30 fields you don't need
  }))
  .get();
```

### 3. Use Closures for Dynamic Queries

```typescript
const filters = getUserFilters();

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === filters.industry)
  .get();
```

### 4. Leverage IntelliSense

Let your IDE autocomplete field names - that's the power of lambda syntax!

### 5. Use first() for Single Records

```typescript
const account = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.ExternalId__c === id)
  .first();
```

## Common Patterns

### Search Pattern

```typescript
function searchAccounts(searchTerm: string) {
  return Account
    .select(x => ({ Id: x.Id, Name: x.Name }))
    .where(x => x.Name.includes(searchTerm))
    .limit(50)
    .get();
}
```

### Filtered List Pattern

```typescript
interface AccountFilters {
  industry?: string;
  minRevenue?: number;
  isActive?: boolean;
}

async function getFilteredAccounts(filters: AccountFilters) {
  let query = Account.select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
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

  return query.get();
}
```

### Master-Detail Query Pattern

```typescript
async function getAccountsWithContacts(industry: string) {
  return Account
    .select(x => ({
      Id: x.Id,
      Name: x.Name,
      PrimaryContacts: x.Contacts
        .select(c => ({
          Name: c.Name,
          Email: c.Email,
          Phone: c.Phone
        }))
        .where(c => c.IsPrimary__c === true)
        .limit(1)
    }))
    .where(x => x.Industry === industry)
    .get();
}
```

## Learn More

- [Main Documentation](/)
- [GitHub Repository](https://github.com/Berat-Dzhevdetov/salesforce-connector)
- [NPM Package](https://www.npmjs.com/package/javascript-salesforce-connector)
