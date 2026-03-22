# Quick Start Guide

Get started with Salesforce ORM in 5 minutes!

## Step 1: Install

```bash
npm install javascript-salesforce-connector
```

## Step 2: Configure

```typescript
import { SalesforceConfig } from 'javascript-salesforce-connector';

SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0'
});

SalesforceConfig.setAccessToken('your-access-token');
```

## Step 3: Generate Models (Recommended)

Use the CLI to auto-generate models from Salesforce metadata:

```bash
# Initialize config
npx sfc init

# Generate models
npx sfc scaffold Account Contact Opportunity
```

## Step 4: Query with Type Safety

```typescript
import { Account } from './models/Account';

// Query with lambda syntax
const industry = 'Technology';
const accounts = await Account
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry
  }))
  .where(x => x.Industry === industry)
  .limit(10)
  .get();

// Use the results
for (const account of accounts) {
  console.log(account.Name, account.Industry);
}
```

## Step 5: Create, Update, Delete

```typescript
// Create
const account = await Account.create({
  Name: 'Acme Corporation',
  Industry: 'Technology'
});

// Update
account.Industry = 'Finance';
await account.save();

// Delete
await account.delete();
```

## What's Next?

- [Lambda Queries](../querying/lambda-queries.md) - Master type-safe queries
- [CRUD Operations](../crud/creating.md) - Learn all operations
- [Model Generation](../models/model-generation.md) - Deep dive into CLI
