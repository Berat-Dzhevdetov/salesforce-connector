# Salesforce ORM

A TypeScript ORM library for Salesforce with an ActiveRecord-style interface. This library provides a fluent API for querying and manipulating Salesforce records using the Salesforce REST API.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication Strategy](#authentication-strategy)
- [Creating Models](#creating-models)
- [Query Operations](#query-operations)
- [CRUD Operations](#crud-operations)
- [Base Model Methods](#base-model-methods)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

## Installation

```bash
npm install javascript-salesforce-connector
```

For local development, you can link the package:

```bash
# In the package directory
npm install
npm run build
npm link

# In your project directory
npm link javascript-salesforce-connector
```

## Configuration

Before using any models, you must initialize the Salesforce configuration. This configuration is global and used by all models throughout your application.

```typescript
import { SalesforceConfig } from 'javascript-salesforce-connector';

SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    // Your token refresh logic here
    const newToken = await refreshAccessToken();
    return newToken;
  }
});

// Set the initial access token
SalesforceConfig.setAccessToken('your-access-token');
```

### Configuration Options

- **instanceUrl** (required): Your Salesforce instance URL (e.g., `https://na1.salesforce.com`)
- **apiVersion** (required): Salesforce API version to use (e.g., `'59.0'`)
- **onTokenExpired** (optional): Async callback function that returns a fresh access token when authentication fails

## Authentication Strategy

This library intentionally does not handle OAuth authentication flows. The reason is that Salesforce authentication varies widely depending on your use case:

- **OAuth 2.0 Web Server Flow**: For web applications
- **OAuth 2.0 Username-Password Flow**: For server-to-server integrations
- **OAuth 2.0 JWT Bearer Flow**: For service accounts
- **Session-based authentication**: For Visualforce or Lightning components

By providing the `onTokenExpired` callback, you maintain full control over your authentication strategy. The library will:

1. Use the provided access token for all API requests
2. Automatically detect 401/403 authentication errors
3. Call your `onTokenExpired` callback to obtain a fresh token
4. Retry the failed request with the new token
5. Return the result or throw an error if refresh fails

### Example Authentication Implementation

```typescript
import axios from 'axios';

let currentAccessToken = '';

async function authenticateWithSalesforce(): Promise<string> {
  const response = await axios.post(
    'https://login.salesforce.com/services/oauth2/token',
    new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.SF_CLIENT_ID,
      client_secret: process.env.SF_CLIENT_SECRET,
      username: process.env.SF_USERNAME,
      password: process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
    })
  );

  currentAccessToken = response.data.access_token;
  return currentAccessToken;
}

// Initialize configuration
SalesforceConfig.initialize({
  instanceUrl: process.env.SF_INSTANCE_URL,
  apiVersion: 'v59.0',
  onTokenExpired: authenticateWithSalesforce
});

// Get initial token
const token = await authenticateWithSalesforce();
SalesforceConfig.setAccessToken(token);
```

## Creating Models

To create a model, extend the `Model` class and define your Salesforce object's fields using TypeScript getters and setters.

### Basic Model Structure

```typescript
import { Model } from 'javascript-salesforce-connector';

// Define the data interface for type safety
interface AccountData {
  Id?: string;
  Name?: string;
  Industry?: string;
  AnnualRevenue?: number;
  BillingCity?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
}

// Create the model class
class Account extends Model<AccountData> {
  // Specify the Salesforce object API name
  protected static objectName = 'Account';

  // Define getters and setters for type-safe property access
  get Id(): string | undefined {
    return this.get('Id');
  }

  get Name(): string | undefined {
    return this.get('Name');
  }

  set Name(value: string | undefined) {
    if (value !== undefined) {
      this.set('Name', value);
    }
  }

  get Industry(): string | undefined {
    return this.get('Industry');
  }

  set Industry(value: string | undefined) {
    if (value !== undefined) {
      this.set('Industry', value);
    }
  }

  get AnnualRevenue(): number | undefined {
    return this.get('AnnualRevenue');
  }

  set AnnualRevenue(value: number | undefined) {
    if (value !== undefined) {
      this.set('AnnualRevenue', value);
    }
  }

  get BillingCity(): string | undefined {
    return this.get('BillingCity');
  }

  set BillingCity(value: string | undefined) {
    if (value !== undefined) {
      this.set('BillingCity', value);
    }
  }

  get CreatedDate(): string | undefined {
    return this.get('CreatedDate');
  }

  get LastModifiedDate(): string | undefined {
    return this.get('LastModifiedDate');
  }
}
```

### Custom Object Example

For custom Salesforce objects, append `__c` to the object name:

```typescript
interface FeedbackData {
  Id?: string;
  Name?: string;
  Rating__c?: number;
  Comments__c?: string;
  Status__c?: string;
}

class Feedback extends Model<FeedbackData> {
  protected static objectName = 'Feedback__c';

  get Id(): string | undefined {
    return this.get('Id');
  }

  get Name(): string | undefined {
    return this.get('Name');
  }

  set Name(value: string | undefined) {
    if (value !== undefined) {
      this.set('Name', value);
    }
  }

  get Rating__c(): number | undefined {
    return this.get('Rating__c');
  }

  set Rating__c(value: number | undefined) {
    if (value !== undefined) {
      this.set('Rating__c', value);
    }
  }

  get Comments__c(): string | undefined {
    return this.get('Comments__c');
  }

  set Comments__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('Comments__c', value);
    }
  }

  get Status__c(): string | undefined {
    return this.get('Status__c');
  }

  set Status__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('Status__c', value);
    }
  }
}
```

## Query Operations

The library provides a fluent query builder interface similar to ActiveRecord or Eloquent.

### Select Fields

Specify which fields to retrieve from Salesforce:

```typescript
const accounts = await Account
  .select('Id', 'Name', 'Industry')
  .get();

// Returns: Account[]
```

### Where Clauses

Filter records using where clauses:

```typescript
// Simple equality
const accounts = await Account
  .where('Industry', 'Technology')
  .get();

// With operators
const accounts = await Account
  .where('AnnualRevenue', '>', 1000000)
  .get();

// Multiple conditions (AND)
const accounts = await Account
  .select('Id', 'Name', 'Industry')
  .where('Industry', 'Technology')
  .where('AnnualRevenue', '>', 1000000)
  .get();
```

### Supported Operators

- `=` - Equals (default)
- `!=` - Not equals
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `LIKE` - Pattern matching
- `IN` - In list
- `NOT IN` - Not in list

```typescript
// LIKE operator
const accounts = await Account
  .where('Name', 'LIKE', 'Acme%')
  .get();

// IN operator
const accounts = await Account
  .whereIn('Industry', ['Technology', 'Finance', 'Healthcare'])
  .get();

// NOT IN operator
const accounts = await Account
  .whereNotIn('BillingCity', ['New York', 'Los Angeles'])
  .get();
```

### Order By

Sort results by one or more fields:

```typescript
const accounts = await Account
  .select('Id', 'Name', 'CreatedDate')
  .orderBy('CreatedDate', 'DESC')
  .get();
```

### Limit and Offset

Paginate results:

```typescript
// Get first 10 records
const accounts = await Account
  .select('Id', 'Name')
  .limit(10)
  .get();

// Skip first 10, get next 10
const accounts = await Account
  .select('Id', 'Name')
  .offset(10)
  .limit(10)
  .get();
```

### Get First Record

Retrieve only the first matching record:

```typescript
const account = await Account
  .where('Name', 'Acme Corporation')
  .first();

// Returns: Account | null
```

### Get All Records

Retrieve all records without filtering:

```typescript
const allAccounts = await Account.all();
```

### Complex Queries

Chain multiple query methods:

```typescript
const accounts = await Account
  .select('Id', 'Name', 'Industry', 'AnnualRevenue')
  .where('Industry', 'Technology')
  .where('AnnualRevenue', '>=', 500000)
  .whereIn('BillingCity', ['San Francisco', 'Seattle', 'Austin'])
  .orderBy('AnnualRevenue', 'DESC')
  .limit(20)
  .get();
```

## CRUD Operations

### Create

Create a new record in Salesforce:

```typescript
// Using static create method
const account = await Account.create({
  Name: 'New Account',
  Industry: 'Technology',
  AnnualRevenue: 5000000
});

console.log(account.Id); // Salesforce record ID
console.log(account.Name); // 'New Account'
```

### Read

Find a record by ID:

```typescript
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  console.log(account.Name);
  console.log(account.Industry);
}
```

Query for records:

```typescript
const accounts = await Account
  .where('Industry', 'Technology')
  .get();

for (const account of accounts) {
  console.log(account.Name);
}
```

### Update

Update an existing record:

```typescript
// Method 1: Using update() on an instance
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  await account.update({
    Industry: 'Finance',
    AnnualRevenue: 7500000
  });
}

// Method 2: Modify properties and save()
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  account.Industry = 'Healthcare';
  account.AnnualRevenue = 8000000;
  await account.save();
}
```

### Delete

Delete a record:

```typescript
// Method 1: Using delete() on an instance
const account = await Account.find('001xx000003DGbQAAW');

if (account) {
  await account.delete();
  // account is now marked as deleted
  // Further operations will throw an error
}

// Method 2: Using static destroy() method
await Account.destroy('001xx000003DGbQAAW');
```

### Upsert (Save)

The `save()` method performs an upsert operation:
- If the instance has no `Id`, it creates a new record
- If the instance has an `Id`, it updates the existing record

```typescript
// Create new record
const newAccount = new Account();
newAccount.Name = 'Brand New Account';
newAccount.Industry = 'Technology';
await newAccount.save(); // Creates new record

console.log(newAccount.Id); // Now has an ID

// Update existing record
newAccount.Industry = 'Finance';
await newAccount.save(); // Updates the record
```

## Base Model Methods

All models inherit these methods from the `Model` base class:

### Static Methods (Class-Level)

- **`query()`**: Create a new query builder instance
  ```typescript
  const query = Account.query();
  ```

- **`select(...fields)`**: Start a query with field selection
  ```typescript
  const accounts = await Account.select('Id', 'Name').get();
  ```

- **`where(field, operatorOrValue, value?)`**: Start a query with filtering
  ```typescript
  const accounts = await Account.where('Industry', 'Technology').get();
  ```

- **`find(id)`**: Find a record by ID
  ```typescript
  const account = await Account.find('001xx000003DGbQAAW');
  ```

- **`all()`**: Get all records
  ```typescript
  const accounts = await Account.all();
  ```

- **`create(data)`**: Create a new record
  ```typescript
  const account = await Account.create({ Name: 'New Account' });
  ```

- **`destroy(id)`**: Delete a record by ID
  ```typescript
  await Account.destroy('001xx000003DGbQAAW');
  ```

### Instance Methods

- **`getId()`**: Get the record ID
  ```typescript
  const id = account.getId();
  ```

- **`get(field)`**: Get a field value
  ```typescript
  const name = account.get('Name');
  ```

- **`set(field, value)`**: Set a field value
  ```typescript
  account.set('Name', 'Updated Name');
  ```

- **`getData()`**: Get all data as an object
  ```typescript
  const data = account.getData();
  ```

- **`update(payload)`**: Update the record with new data
  ```typescript
  await account.update({ Name: 'New Name', Industry: 'Tech' });
  ```

- **`save()`**: Save the record (create or update)
  ```typescript
  await account.save();
  ```

- **`delete()`**: Delete the record
  ```typescript
  await account.delete();
  ```

- **`isDeleted()`**: Check if the record has been deleted
  ```typescript
  if (account.isDeleted()) {
    console.log('This record was deleted');
  }
  ```

- **`toJSON()`**: Convert to plain JSON object
  ```typescript
  const json = account.toJSON();
  ```

## Error Handling

All methods throw descriptive errors that you should handle appropriately:

```typescript
try {
  const account = await Account.find('invalid-id');
} catch (error) {
  console.error('Failed to fetch account:', error.message);
}

try {
  await Account.create({ Name: '' }); // Invalid data
} catch (error) {
  console.error('Failed to create account:', error.message);
}
```

### Common Error Scenarios

- **Authentication errors**: Automatically handled via `onTokenExpired` callback
- **Validation errors**: Thrown when Salesforce rejects invalid data
- **Not found errors**: `find()` returns `null` instead of throwing
- **Deleted record errors**: Operations on deleted instances throw errors

### Deleted Record Behavior

Once a record is deleted, the instance is marked as deleted and further operations are blocked:

```typescript
const account = await Account.find('001xx000003DGbQAAW');
await account.delete();

// These will throw errors:
await account.save(); // Error: Cannot save a deleted record
await account.update({ Name: 'New' }); // Error: Cannot update a deleted record
account.Name = 'Test'; // Error: Cannot modify a deleted record

// Data is preserved for reference
console.log(account.Name); // Still accessible
console.log(account.isDeleted()); // true
```

## TypeScript Support

This library is written in TypeScript and provides full type safety:

```typescript
// Type inference works automatically
const account = await Account.find('001xx000003DGbQAAW');
account.Name = 'Valid'; // OK
account.Name = 123; // Error: Type 'number' is not assignable to type 'string'

// Query results are properly typed
const accounts: Account[] = await Account.all();

// Type-safe field access
const name: string | undefined = account.Name;
const revenue: number | undefined = account.AnnualRevenue;
```

## Examples

### Complete CRUD Application

```typescript
import { SalesforceConfig, Model } from 'javascript-salesforce-connector';

// Configure Salesforce
SalesforceConfig.initialize({
  instanceUrl: process.env.SF_INSTANCE_URL!,
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    // Implement your token refresh logic
    return await refreshToken();
  }
});

SalesforceConfig.setAccessToken(process.env.SF_ACCESS_TOKEN!);

// Define model
interface AccountData {
  Id?: string;
  Name?: string;
  Industry?: string;
}

class Account extends Model<AccountData> {
  protected static objectName = 'Account';

  get Id(): string | undefined {
    return this.get('Id');
  }

  get Name(): string | undefined {
    return this.get('Name');
  }

  set Name(value: string | undefined) {
    if (value !== undefined) {
      this.set('Name', value);
    }
  }

  get Industry(): string | undefined {
    return this.get('Industry');
  }

  set Industry(value: string | undefined) {
    if (value !== undefined) {
      this.set('Industry', value);
    }
  }
}

// Create
async function createAccount() {
  const account = await Account.create({
    Name: 'Acme Corporation',
    Industry: 'Technology'
  });
  console.log('Created account:', account.Id);
  return account;
}

// Read
async function readAccounts() {
  const accounts = await Account
    .select('Id', 'Name', 'Industry')
    .where('Industry', 'Technology')
    .limit(10)
    .get();

  for (const account of accounts) {
    console.log(`${account.Name} - ${account.Industry}`);
  }
}

// Update
async function updateAccount(id: string) {
  const account = await Account.find(id);

  if (account) {
    account.Industry = 'Healthcare';
    await account.save();
    console.log('Updated account:', account.Id);
  }
}

// Delete
async function deleteAccount(id: string) {
  const account = await Account.find(id);

  if (account) {
    await account.delete();
    console.log('Deleted account:', id);
  }
}

// Run examples
async function main() {
  const account = await createAccount();
  await readAccounts();
  await updateAccount(account.Id!);
  await deleteAccount(account.Id!);
}

main().catch(console.error);
```

### Bulk Operations

```typescript
// Bulk create
async function createMultipleAccounts() {
  const accountsData = [
    { Name: 'Company A', Industry: 'Technology' },
    { Name: 'Company B', Industry: 'Finance' },
    { Name: 'Company C', Industry: 'Healthcare' }
  ];

  const accounts = await Promise.all(
    accountsData.map(data => Account.create(data))
  );

  console.log(`Created ${accounts.length} accounts`);
}

// Bulk update
async function updateMultipleAccounts() {
  const accounts = await Account
    .where('Industry', 'Technology')
    .get();

  await Promise.all(
    accounts.map(account => {
      account.Industry = 'Tech';
      return account.save();
    })
  );

  console.log(`Updated ${accounts.length} accounts`);
}
```

### Advanced Queries

```typescript
// Complex filtering
const enterprises = await Account
  .select('Id', 'Name', 'AnnualRevenue', 'NumberOfEmployees')
  .where('AnnualRevenue', '>', 10000000)
  .where('NumberOfEmployees', '>', 500)
  .whereIn('Industry', ['Technology', 'Finance', 'Healthcare'])
  .whereNotIn('BillingCountry', ['Competitor Countries'])
  .orderBy('AnnualRevenue', 'DESC')
  .limit(50)
  .get();

// Pattern matching
const acmeAccounts = await Account
  .where('Name', 'LIKE', 'Acme%')
  .get();

// Pagination
async function paginateAccounts(pageSize: number = 20) {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const accounts = await Account
      .select('Id', 'Name')
      .orderBy('CreatedDate', 'DESC')
      .limit(pageSize)
      .offset(offset)
      .get();

    if (accounts.length === 0) {
      hasMore = false;
      break;
    }

    // Process accounts
    for (const account of accounts) {
      console.log(account.Name);
    }

    offset += pageSize;
  }
}
```

## License

MIT
