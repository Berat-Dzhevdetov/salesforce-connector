# Migration Guide: QueryBuilder → LambdaModel

> Upgrade to type-safe queries with closure variable support

## Why Migrate?

The old `QueryBuilder` and string-based `Model` class are **deprecated** and will be removed in **v2.0.0**.

### What You Get

| Feature | QueryBuilder (Old) | LambdaModel (New) |
|---------|-------------------|-------------------|
| Type Safety | ❌ No | ✅ Full IntelliSense |
| Closure Variables | ❌ No | ✅ Yes |
| Typo Detection | ❌ Runtime errors | ✅ Compile-time |
| Field Suggestions | ❌ No | ✅ IDE autocomplete |
| Subquery Closures | ❌ No | ✅ Yes |
| Future Support | ⚠️ Deprecated | ✅ Actively developed |

## Step-by-Step Migration

### Step 1: Update Your Imports

**Before:**
```typescript
import { Model, ModelData } from 'javascript-salesforce-connector';
```

**After:**
```typescript
import { LambdaModel, ModelData } from 'javascript-salesforce-connector';
```

### Step 2: Change Base Class

**Before:**
```typescript
class Account extends Model<AccountData> {
  protected static objectName = 'Account';
}
```

**After:**
```typescript
class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}
```

### Step 3: Update Queries

#### Simple SELECT

**Before:**
```typescript
const accounts = await Account
  .select('Id', 'Name', 'Industry')
  .get();
```

**After:**
```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .get();
```

#### WHERE Clauses

**Before:**
```typescript
const accounts = await Account
  .select('Id', 'Name')
  .where('Industry', 'Technology')
  .where('AnnualRevenue', '>', 1000000)
  .get();
```

**After:**
```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology' && x.AnnualRevenue > 1000000)
  .get();
```

#### ORDER BY

**Before:**
```typescript
const accounts = await Account
  .select('Id', 'Name')
  .orderBy('AnnualRevenue', 'DESC')
  .get();
```

**After:**
```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .orderBy(x => x.AnnualRevenue, 'DESC')
  .get();
```

#### Pagination

**Before:**
```typescript
const accounts = await Account
  .select('Id', 'Name')
  .limit(20)
  .offset(40)
  .get();
```

**After:**
```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .limit(20)
  .offset(40)
  .get();
```

### Step 4: Leverage Closure Variables

This is the **biggest benefit** - you can now use variables from outer scopes:

**Before (workaround):**
```typescript
const industry = 'Technology';
const minRevenue = 1000000;

// Had to pass as values
const accounts = await Account
  .select('Id', 'Name')
  .where('Industry', industry)
  .where('AnnualRevenue', '>', minRevenue)
  .get();
```

**After (natural):**
```typescript
const industry = 'Technology';
const minRevenue = 1000000;

// Variables just work!
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .get();
```

### Step 5: Update Relationships

**Before:**
```typescript
// Not well supported
```

**After:**
```typescript
const activeStatus = true;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name, Email: c.Email }))
      .where(c => c.Active__c === activeStatus)  // Closure works!
  }))
  .get();
```

## Common Migration Patterns

### Pattern 1: whereIn() → OR conditions

**Before:**
```typescript
const industries = ['Technology', 'Finance', 'Healthcare'];

const accounts = await Account
  .select('Id', 'Name')
  .whereIn('Industry', industries)
  .get();
```

**After:**
```typescript
const industries = ['Technology', 'Finance', 'Healthcare'];

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    x.Industry === industries[0] ||
    x.Industry === industries[1] ||
    x.Industry === industries[2]
  )
  .get();

// Or build dynamically:
let query = Account.select(x => ({ Id: x.Id, Name: x.Name }));
industries.forEach((industry, index) => {
  query = index === 0
    ? query.where(x => x.Industry === industry)
    : query; // Chain OR logic as needed
});
```

### Pattern 2: whereGroup() → Parentheses

**Before:**
```typescript
const accounts = await Account
  .select('Id', 'Name')
  .where('IsActive', true)
  .orWhereGroup(qb => {
    qb.where('Name', 'LIKE', '%John%')
      .orWhere('Email', 'LIKE', '%john%');
  })
  .get();
```

**After:**
```typescript
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x =>
    x.IsActive === true &&
    (x.Name.includes('John') || x.Email.includes('john'))
  )
  .get();
```

### Pattern 3: Dynamic Filters

**Before:**
```typescript
function getAccounts(filters: any) {
  let query = Account.select('Id', 'Name');

  if (filters.industry) {
    query = query.where('Industry', filters.industry);
  }

  if (filters.minRevenue) {
    query = query.where('AnnualRevenue', '>', filters.minRevenue);
  }

  return query.get();
}
```

**After:**
```typescript
function getAccounts(filters: any) {
  let query = Account.select(x => ({ Id: x.Id, Name: x.Name }));

  if (filters.industry) {
    query = query.where(x => x.Industry === filters.industry);
  }

  if (filters.minRevenue) {
    query = query.where(x => x.AnnualRevenue > filters.minRevenue);
  }

  return query.get();
}
```

### Pattern 4: count()

**Before:**
```typescript
const count = await Account
  .where('Industry', 'Technology')
  .count();
```

**After:**
```typescript
const industry = 'Technology';
const count = await Account.count(x => x.Industry === industry);
```

## Troubleshooting

### Issue: "Property does not exist on type"

**Problem:**
```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    NonExistentField: x.NonExistentField  // ❌ Error!
  }))
  .get();
```

**Solution:** This is actually **good**! TypeScript is catching a typo. Update your interface if the field exists:

```typescript
interface AccountData extends ModelData {
  Id: string;
  Name: string;
  NonExistentField: string;  // Add the field
}
```

### Issue: Closure variable not working

**Problem:**
```typescript
// Still using old Model class
class Account extends Model<AccountData> { }

const industry = 'Tech';
const accounts = await Account
  .select(x => ({ Id: x.Id }))
  .where(x => x.Industry === industry);  // ❌ Doesn't work with old Model
```

**Solution:** Make sure you're using `LambdaModel`:

```typescript
class Account extends LambdaModel<AccountData> { }  // ✓ Use LambdaModel
```

### Issue: Lost QueryBuilder methods

**Problem:**
```typescript
// Looking for whereIn, whereNotIn, orWhereGroup, etc.
```

**Solution:** Use the lambda WHERE syntax instead - it's more flexible:

```typescript
// Instead of whereIn:
.where(x => x.Industry === 'Tech' || x.Industry === 'Finance')

// Instead of whereNotIn:
.where(x => x.Industry !== 'Tech' && x.Industry !== 'Finance')

// Instead of whereGroup:
.where(x => x.IsActive && (x.Type === 'A' || x.Type === 'B'))
```

## Deprecation Timeline

| Version | Status | Notes |
|---------|--------|-------|
| v1.x | ⚠️ **Current** | Both Model and LambdaModel available |
| v1.x (soon) | 🔔 Deprecation warnings | Console warnings when using old Model |
| v2.0 | 🚫 **Breaking** | Old Model & QueryBuilder removed |
|  | ✅ | LambdaModel renamed to Model |

## Checklist

- [ ] Update imports: `Model` → `LambdaModel`
- [ ] Update base class: `extends Model` → `extends LambdaModel`
- [ ] Convert `.select('fields')` → `.select(x => ({ fields }))`
- [ ] Convert `.where('field', value)` → `.where(x => x.field === value)`
- [ ] Convert `.orderBy('field')` → `.orderBy(x => x.field)`
- [ ] Test with closure variables
- [ ] Update subqueries to use closures
- [ ] Remove any QueryBuilder workarounds

## Need Help?

- [LambdaModel Guide](lambda-model.md)
- [GitHub Issues](https://github.com/Berat-Dzhevdetov/salesforce-connector/issues)
- [Examples](examples.md)

Start migrating today! 🚀
