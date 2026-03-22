[![Publish to NPM](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/publish.yml/badge.svg)](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/publish.yml)
[![Test](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/test.yml/badge.svg)](https://github.com/Berat-Dzhevdetov/salesforce-connector/actions/workflows/test.yml)

> ⚠️ **DEPRECATION NOTICE**: The string-based `Model` class and `QueryBuilder` are **deprecated** and will be removed in **v2.0.0**. Please migrate to `LambdaModel` for type-safe queries with closure variable support. [See Migration Guide](https://berat-dzhevdetov.github.io/salesforce-connector/migration-guide).

# Salesforce ORM

A TypeScript ORM library for Salesforce with **lambda-based queries**, full type inference, and closure variable support.

📚 **[Full Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)** | 🆕 **[LambdaModel Guide](https://berat-dzhevdetov.github.io/salesforce-connector/querying/lambda-queries)** | 🔄 **[Migration Guide](https://berat-dzhevdetov.github.io/salesforce-connector/migration-guide)**

## ✨ Core Features

### 🎯 Type-Safe Lambda Queries

Write queries with full IntelliSense and compile-time type checking:

```typescript
// Define your model
class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';
}

// Query with type safety
const accounts = await Account
  .select(x => ({
    Id: x.Id,           // ✓ IntelliSense works!
    Name: x.Name,       // ✓ Typos caught at compile time
    Industry: x.Industry
  }))
  .limit(10)
  .get();
```

### 🔗 Closure Variable Support

Use variables from outer scope naturally:

```typescript
const industry = 'Technology';
const minRevenue = 1000000;

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry && x.AnnualRevenue > minRevenue)
  .get();
```

### 🌳 Relationship Queries with Closures

Query subqueries with full closure support:

```typescript
const activeStatus = true;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name, Email: c.Email }))
      .where(c => c.Active__c === activeStatus)  // ✓ Closures work in subqueries!
  }))
  .get();
```

### 🔧 Automatic Model Generation

Generate TypeScript models from Salesforce metadata:

```bash
# Initialize configuration
npx sfc init

# Generate models with full type safety
npx sfc scaffold Account Contact Opportunity
```

### 🪝 Lifecycle Hooks (Observers)

React to model events without modifying model classes:

```typescript
class AuditLogObserver implements Observer<Account> {
  async afterCreate(account: Account) {
    console.log(`Account created: ${account.Id}`);
  }
}

Account.observe(new AuditLogObserver());
```

### 📄 Smart Pagination

Built-in pagination with metadata:

```typescript
const { records, totalSize, hasNextPage } = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === 'Technology')
  .paginate(1, 20);  // Page 1, 20 per page
```

## Quick Start

### Installation

```bash
npm install javascript-salesforce-connector
```

### Basic Usage

```typescript
import { SalesforceConfig, LambdaModel } from 'javascript-salesforce-connector';
import { Account } from './models/Account';

// Configure connection
SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0'
});
SalesforceConfig.setAccessToken('your-access-token');

// Query with type safety
const industry = 'Technology';
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .where(x => x.Industry === industry)
  .limit(10)
  .get();

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

## Documentation

📚 **[View Full Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)**

### Getting Started
- [Installation & Configuration](https://berat-dzhevdetov.github.io/salesforce-connector/getting-started/installation)
- [Quick Start Guide](https://berat-dzhevdetov.github.io/salesforce-connector/getting-started/quick-start)

### Models
- [Defining Models](https://berat-dzhevdetov.github.io/salesforce-connector/models/defining-models)
- [Model Generation (CLI)](https://berat-dzhevdetov.github.io/salesforce-connector/models/model-generation)

### Querying
- [Lambda Queries (Recommended)](https://berat-dzhevdetov.github.io/salesforce-connector/querying/lambda-queries)
- [Basic Queries](https://berat-dzhevdetov.github.io/salesforce-connector/querying/basic-queries)
- [Advanced Queries](https://berat-dzhevdetov.github.io/salesforce-connector/querying/advanced-queries)
- [Relationships & Subqueries](https://berat-dzhevdetov.github.io/salesforce-connector/querying/relationships)

### CRUD Operations
- [Creating Records](https://berat-dzhevdetov.github.io/salesforce-connector/crud/creating)
- [Reading Records](https://berat-dzhevdetov.github.io/salesforce-connector/crud/reading)
- [Updating Records](https://berat-dzhevdetov.github.io/salesforce-connector/crud/updating)
- [Deleting Records](https://berat-dzhevdetov.github.io/salesforce-connector/crud/deleting)

### Advanced
- [Lifecycle Hooks (Observers)](https://berat-dzhevdetov.github.io/salesforce-connector/advanced/observers)
- [Closure Variables Deep Dive](https://berat-dzhevdetov.github.io/salesforce-connector/advanced/closure-variables)
- [Error Handling](https://berat-dzhevdetov.github.io/salesforce-connector/advanced/error-handling)

### CLI
- [CLI Commands Reference](https://berat-dzhevdetov.github.io/salesforce-connector/cli/commands)
- [Authentication Setup](https://berat-dzhevdetov.github.io/salesforce-connector/cli/authentication)

## Important Notes

⚠️ **Governor Limits:** This library does NOT automatically handle Salesforce governor limits. Always use `.limit()` and proper filtering.

⚠️ **Observers vs Salesforce Triggers:** Observers are JavaScript/TypeScript hooks that run in your application. They are NOT Salesforce Triggers, Process Builder, or Flows.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- 📦 [NPM Package](https://www.npmjs.com/package/javascript-salesforce-connector)
- 📚 [Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)
- 🐛 [Issue Tracker](https://github.com/Berat-Dzhevdetov/salesforce-connector/issues)
- 💬 [Discussions](https://github.com/Berat-Dzhevdetov/salesforce-connector/discussions)
