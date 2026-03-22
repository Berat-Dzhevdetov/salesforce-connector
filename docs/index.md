# Salesforce ORM Documentation

> ⚠️ **DEPRECATION NOTICE**: The string-based `Model` class and `QueryBuilder` are **deprecated** and will be removed in **v2.0.0**. Please migrate to `LambdaModel`. [See Migration Guide](migration-guide.md).

Welcome to the Salesforce ORM documentation! This library provides a type-safe, lambda-based query interface for Salesforce with full closure variable support.

## Quick Links

- 🚀 [Quick Start Guide](getting-started/quick-start.md)
- 📘 [Lambda Queries (Recommended)](querying/lambda-queries.md)
- 🔄 [Migration Guide](migration-guide.md)
- 📦 [NPM Package](https://www.npmjs.com/package/javascript-salesforce-connector)

## Getting Started

New to the library? Start here:

- [Installation & Configuration](getting-started/installation.md) - Install and configure the library
- [Quick Start Guide](getting-started/quick-start.md) - Your first query in 5 minutes
- [Configuration Options](getting-started/configuration.md) - Detailed configuration

## Models

Learn how to define and generate models:

- [Defining Models](models/defining-models.md) - Create model classes manually
- [Model Generation (CLI)](models/model-generation.md) - Auto-generate from Salesforce metadata
- [Field Types](models/field-types.md) - TypeScript types and custom fields

## Querying

Master the query API:

- **[Lambda Queries (Recommended)](querying/lambda-queries.md)** - Type-safe queries with closures
- [Basic Queries](querying/basic-queries.md) - SELECT, WHERE, ORDER BY
- [Advanced Queries](querying/advanced-queries.md) - Complex conditions and grouping
- [Pagination](querying/pagination.md) - Limit, offset, and paginate()
- [Relationships & Subqueries](querying/relationships.md) - Eager/lazy loading

## CRUD Operations

Work with Salesforce records:

- [Creating Records](crud/creating.md) - create() and save()
- [Reading Records](crud/reading.md) - find(), first(), get()
- [Updating Records](crud/updating.md) - update() and save()
- [Deleting Records](crud/deleting.md) - delete() and destroy()

## Advanced Topics

Deep dive into advanced features:

- [Lifecycle Hooks (Observers)](advanced/observers.md) - React to model events
- [Closure Variables Deep Dive](advanced/closure-variables.md) - How closures work
- [Error Handling](advanced/error-handling.md) - Try/catch and validation
- [Salesforce Governor Limits](advanced/governor-limits.md) - Best practices

## CLI Tools

Command-line utilities:

- [CLI Commands Reference](cli/commands.md) - All available commands
- [Authentication Setup](cli/authentication.md) - JWT bearer flow
- [Scaffolding Guide](cli/scaffolding.md) - Generate models from metadata

## Reference

- [API Reference](api-reference.md) - Method signatures
- [Migration Guide](migration-guide.md) - Migrate from string-based queries
- [Examples](examples.md) - Common patterns and recipes

## Key Features

### Type-Safe Lambda Queries

```typescript
const accounts = await Account
  .select(x => ({
    Id: x.Id,           // ✓ IntelliSense
    Name: x.Name        // ✓ Type-checked
  }))
  .limit(10)
  .get();
```

### Closure Variables

```typescript
const industry = 'Technology';

const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .where(x => x.Industry === industry)  // ✓ Closures work!
  .get();
```

### Relationship Queries

```typescript
const activeStatus = true;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    Contacts: x.Contacts
      .select(c => ({ Name: c.Name }))
      .where(c => c.Active__c === activeStatus)  // ✓ Closures in subqueries!
  }))
  .get();
```

## Important Notes

⚠️ **Governor Limits:** This library does NOT automatically handle Salesforce governor limits. Always use `.limit()` and proper filtering.

⚠️ **Observers:** Observers are JavaScript/TypeScript hooks that run in your application, NOT Salesforce Triggers, Process Builder, or Flows.

## Need Help?

- 📖 [Full Documentation](https://berat-dzhevdetov.github.io/salesforce-connector/)
- 🐛 [Report Issues](https://github.com/Berat-Dzhevdetov/salesforce-connector/issues)
- 💬 [Discussions](https://github.com/Berat-Dzhevdetov/salesforce-connector/discussions)
- 📦 [NPM Package](https://www.npmjs.com/package/javascript-salesforce-connector)
