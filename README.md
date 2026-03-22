[![Publish to NPM](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/publish.yml/badge.svg)](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/publish.yml)
[![Test](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/test.yml/badge.svg)](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/test.yml)

# Salesforce ORM

A TypeScript ORM library for Salesforce with **lambda-based queries**, full type inference, and closure variable support. Build type-safe Salesforce integrations with automatic model generation and lifecycle hooks.

📚 **[Full Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)** | 🆕 **[LambdaModel Guide](https://berat-dzhevdetov.github.io/salesforce-connector/lambda-model)** | 🔄 **[Migration Guide](https://berat-dzhevdetov.github.io/salesforce-connector/migration-guide)**

## ✨ What's New: LambdaModel

**Type-safe queries with closure variable support!**

```typescript
// Define your model with full type safety
class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}

// Query with IntelliSense and closure variables
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

**[👉 See LambdaModel Guide](https://berat-dzhevdetov.github.io/salesforce-connector/lambda-model)**

## Features

- 🎯 **Lambda-Based Queries** - Full IntelliSense with closure variable support (NEW!)
- 📊 **100% Type-Safe** - Catch errors at compile time, not runtime
- 🔧 **Automatic Model Generation** - CLI scaffolds TypeScript models from Salesforce metadata
- 🔍 **Fluent Query Builder** - Chainable API with WHERE, JOIN, ORDER BY, LIMIT
- 📄 **Smart Pagination** - Built-in pagination with metadata (totalSize, hasNextPage)
- 🔗 **Relationship Support** - Query subqueries with full closure support
- 🪝 **Lifecycle Hooks** - beforeCreate, afterUpdate, beforeDelete, and more
- ⚡ **Zero Dependencies** - Lightweight with minimal external dependencies

## Quick Start

### Installation

```bash
npm install javascript-salesforce-connector
```

### Initialize Configuration

```bash
# Initialize config file
npx sfc init

# Test authentication
npx sfc test-auth

# Generate models from Salesforce
npx sfc scaffold Account Contact Opportunity
```

### Basic Usage (LambdaModel - Recommended)

```typescript
import { SalesforceConfig, LambdaModel } from 'javascript-salesforce-connector';
import { Account } from './models/Account';

// Configure connection
SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0'
});
SalesforceConfig.setAccessToken('your-access-token');

// Query with closure variables and type safety
const industry = 'Technology';
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .where(x => x.Industry === industry)  // Closure variable works!
  .limit(10)
  .get();

// Paginated query
const { records, totalSize, hasNextPage } = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry)
  .paginate(1, 20); // page 1, 20 items per page

// Create a record
const account = await Account.create({
  Name: 'Acme Corporation',
  Industry: 'Technology'
});

// Update a record
account.Industry = 'Finance';
await account.save();

// Delete a record
await account.delete();
```

### Legacy Usage (Deprecated)

> ⚠️ **Deprecation Notice**: String-based queries are deprecated. Please migrate to LambdaModel. [See Migration Guide](https://berat-dzhevdetov.github.io/salesforce-connector/migration-guide).

<details>
<summary>Click to see legacy syntax</summary>

```typescript
// Old way (will be removed in v2.0)
const accounts = await Account
  .select('Id', 'Name', 'Industry')
  .where('Industry', 'Technology')
  .limit(10)
  .get();
```

</details>

## Core Features

### 🔧 CLI Model Generator

Automatically generate TypeScript models with full type safety:

```bash
npx sfc scaffold Account Contact Opportunity -o ./models
```

**[📖 Learn more about Model Generation](https://berat-dzhevdetov.github.io/salesforce-connector/#model-generation-cli)**

### 🔍 Query Builder

Build complex SOQL queries with a fluent, type-safe API:

```typescript
const accounts = await Account
  .select('Id', 'Name', 'Owner.Name')
  .where('AnnualRevenue', '>', 1000000)
  .whereIn('Industry', ['Technology', 'Finance'])
  .orderBy('CreatedDate', 'DESC')
  .limit(20)
  .get();
```

**[📖 View all query methods](https://berat-dzhevdetov.github.io/salesforce-connector/#query-operations)**

### 🪝 Lifecycle Hooks (Observers)

Respond to model events without modifying model classes:

```typescript
class AuditLogObserver implements Observer<Account> {
  async afterCreate(account: Account) {
    console.log(`Account created: ${account.Id}`);
  }
}

Account.observe(new AuditLogObserver());
```

Generate observers with CLI:
```bash
npx sfc generate-observer Account AccountObserver
```

**[📖 Full Observer documentation](https://berat-dzhevdetov.github.io/salesforce-connector/#observers-lifecycle-hooks)**

### 🔗 Relationships

Eager and lazy loading for Salesforce relationships:

```typescript
// Eager loading with relationship fields
const contacts = await Contact
  .select('Id', 'Name', 'Owner.Name', 'Owner.Email')
  .get();

// Lazy loading on demand
const contact = await Contact.find('003xxx');
await contact.loadOwner();
console.log(contact.Owner?.Name);
```

**[📖 Relationship documentation](https://berat-dzhevdetov.github.io/salesforce-connector/#relationships-and-lazy-loading)**

### 📝 CRUD Operations

Simple, consistent interface for all operations:

```typescript
// Create
const account = await Account.create({ Name: 'Acme' });

// Read
const found = await Account.find('001xxx');
const all = await Account.where('Industry', 'Tech').get();

// Update
await account.update({ Industry: 'Finance' });

// Delete
await account.delete();
```

**[📖 CRUD documentation](https://berat-dzhevdetov.github.io/salesforce-connector/#crud-operations)**

## Documentation

📚 **[View Full Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)**

- [Installation & Setup](https://berat-dzhevdetov.github.io/salesforce-connector/#installation)
- [Configuration](https://berat-dzhevdetov.github.io/salesforce-connector/#configuration)
- [Authentication](https://berat-dzhevdetov.github.io/salesforce-connector/#authentication-strategy)
- [Model Generation (CLI)](https://berat-dzhevdetov.github.io/salesforce-connector/#model-generation-cli)
- [Query Operations](https://berat-dzhevdetov.github.io/salesforce-connector/#query-operations)
- [CRUD Operations](https://berat-dzhevdetov.github.io/salesforce-connector/#crud-operations)
- [Observers (Lifecycle Hooks)](https://berat-dzhevdetov.github.io/salesforce-connector/#observers-lifecycle-hooks)
- [Relationships](https://berat-dzhevdetov.github.io/salesforce-connector/#relationships-and-lazy-loading)
- [TypeScript Support](https://berat-dzhevdetov.github.io/salesforce-connector/#typescript-support)
- [Examples](https://berat-dzhevdetov.github.io/salesforce-connector/#examples)

## CLI Commands

```bash
# Initialize configuration
npx sfc init

# Test authentication
npx sfc test-auth

# Generate models
npx sfc scaffold Account Contact Opportunity

# Generate observer
npx sfc generate-observer Account AccountObserver
```

## Important Notes

⚠️ **Governor Limits:** This library does NOT automatically handle Salesforce governor limits. Always use `.limit()` and proper filtering.

⚠️ **Observers vs Salesforce Triggers:** Observers are JavaScript/TypeScript hooks that run in your application. They are NOT Salesforce Triggers, Process Builder, or Flows.

## Examples

Quick example showing multiple features:

```typescript
import { Account } from './models';

// Query with relationships and filtering
const accounts = await Account
  .select('Id', 'Name', 'Industry', 'Owner.Name')
  .where('AnnualRevenue', '>', 1000000)
  .whereIn('Industry', ['Technology', 'Finance'])
  .orderBy('CreatedDate', 'DESC')
  .limit(10)
  .get();

for (const account of accounts) {
  console.log(`${account.Name} - ${account.Owner?.Name}`);
}
```

**[📖 See more examples](https://berat-dzhevdetov.github.io/salesforce-connector/#examples)**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- 📦 [NPM Package](https://www.npmjs.com/package/javascript-salesforce-connector)
- 📚 [Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)
- 🐛 [Issue Tracker](https://github.com/Berat-Dzhevdetov/salesforce-connector/issues)
- 💬 [Discussions](https://github.com/Berat-Dzhevdetov/salesforce-connector/discussions)
