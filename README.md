# Salesforce ORM

A TypeScript ORM library for Salesforce with an ActiveRecord-style interface. This library provides a fluent API for querying and manipulating Salesforce records using the Salesforce REST API.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication Strategy](#authentication-strategy)
- [Model Generation (CLI)](#model-generation-cli)
- [Creating Models](#creating-models)
- [Query Operations](#query-operations)
- [CRUD Operations](#crud-operations)
- [Relationships and Lazy Loading](#relationships-and-lazy-loading)
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

## Model Generation (CLI)

The `sfc` CLI tool automatically generates TypeScript model files from your Salesforce metadata. This is the **recommended way** to create models, as it ensures accuracy and saves time.

### Installation

**Install globally to use `sfc` commands directly:**
```bash
npm install -g javascript-salesforce-connector
```

Now you can use `sfc` anywhere without `npx`:
```bash
sfc init
sfc scaffold Account Contact -o ./models
sfc test-auth
```

**Alternative:** If you prefer not to install globally, use `npx` instead:
```bash
npx sfc init
npx sfc scaffold Account Contact -o ./models
```

### Quick Start

1. **Initialize configuration:**
   ```bash
   sfc init
   ```
   This creates a `.sfconnect.json` configuration file in your project root.

2. **Configure authentication** by editing `.sfconnect.json`:
   ```json
   {
     "instanceUrl": "https://your-instance.salesforce.com",
     "apiVersion": "v59.0",
     "authType": "jwt",
     "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
     "clientId": "YOUR_CONNECTED_APP_CLIENT_ID",
     "username": "your-username@example.com",
     "privateKeyPath": "./certs/server.key",
     "algorithm": "RS256"
   }
   ```

3. **Test your authentication:**
   ```bash
   sfc test-auth
   ```

4. **Generate models:**
   ```bash
   sfc scaffold Account Contact Opportunity
   ```

### Generating Models

**IMPORTANT:** Always use the exact Salesforce **API name** for objects:
- ✅ Standard objects: `Account`, `Contact`, `Opportunity`, `Lead`, `Case`, `User`
- ✅ Custom objects: `CustomObject__c`, `ProductReview__c` (must include `__c` suffix)
- ❌ Don't use labels like "Accounts" or "Custom Object"

#### Generate to default location (`./src/models`):
```bash
sfc scaffold Account Contact Opportunity
```

#### Generate to custom directory:
```bash
# Output to ./models
sfc scaffold Account -o ./models

# Output to nested directory
sfc scaffold Contact Opportunity -o ./src/salesforce/models

# Generate custom object
sfc scaffold ProductReview__c -o ./models
```

#### Generate multiple objects at once:
```bash
sfc scaffold Account Contact Lead Opportunity Case -o ./models
```

### What Gets Generated

For each Salesforce object, the CLI generates:
- ✅ TypeScript interface (e.g., `AccountData`)
- ✅ Model class extending `Model<T>`
- ✅ Getters for all fields
- ✅ Setters for updateable fields only (read-only fields excluded)
- ✅ JSDoc comments with field labels and metadata
- ✅ Proper TypeScript types based on Salesforce field types
- ✅ An `index.ts` file for convenient imports

**Example output structure:**
```
./models/
  ├── Account.ts
  ├── Contact.ts
  ├── Opportunity.ts
  └── index.ts
```

**Generated model example** (`Account.ts`):
```typescript
import { Model } from 'javascript-salesforce-connector';

/**
 * Data interface for Account (Account)
 */
export interface AccountData {
  /** Account ID */
  Id?: string | undefined;
  /** Account Name */
  Name?: string | undefined;
  /** Industry */
  Industry?: string | undefined;
  /** Annual Revenue */
  AnnualRevenue?: number | undefined;
  // ... more fields
}

/**
 * Model for Account (Account)
 */
export class Account extends Model<AccountData> {
  protected static objectName = 'Account';

  /** Get Account ID */
  get Id(): string | undefined {
    return this.get('Id');
  }

  /** Get Account Name */
  get Name(): string | undefined {
    return this.get('Name');
  }

  /** Set Account Name */
  set Name(value: string | undefined) {
    if (value !== undefined) {
      this.set('Name', value);
    }
  }

  // ... more getters/setters
}
```

### CLI Commands Reference

| Command | Description | Options |
|---------|-------------|---------|
| `sfc init` | Create `.sfconnect.json` config file | `-o, --output <path>` - Config file path |
| `sfc scaffold <objects...>` | Generate TypeScript models from Salesforce metadata | `-o, --output <dir>` - Output directory (default: `./src/models`)<br>`-c, --config <path>` - Config file path<br>`--no-comments` - Skip JSDoc comments |
| `sfc test-auth` | Test JWT authentication | `-c, --config <path>` - Config file path |

### Using Generated Models

Once generated, import and use your models:

```typescript
import { SalesforceConfig } from 'javascript-salesforce-connector';
import { Account, Contact } from './models';

// Initialize Salesforce config
SalesforceConfig.initialize({
  instanceUrl: 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    return await refreshToken();
  }
});

SalesforceConfig.setAccessToken(token);

// Use the generated models
const accounts = await Account
  .select('Id', 'Name', 'Industry', 'AnnualRevenue')
  .where('Industry', 'Technology')
  .limit(10)
  .get();

for (const account of accounts) {
  console.log(account.Name, account.Industry);
}
```

### Authentication Setup (JWT Bearer Flow)

The CLI uses **JWT Bearer Flow** for authentication. Here's how to set it up:

1. **Create a Connected App in Salesforce:**
   - Go to Setup → App Manager → New Connected App
   - Enable OAuth Settings
   - Enable "Use digital signatures"
   - Upload your certificate (`.crt` file)
   - Select OAuth scopes: `api`, `refresh_token`, `offline_access`
   - Enable "Admin approved users are pre-authorized"

2. **Generate RSA key pair:**
   ```bash
   # Generate private key
   openssl genrsa -out server.key 2048

   # Generate certificate
   openssl req -new -x509 -key server.key -out server.crt -days 365
   ```

3. **Configure `.sfconnect.json`:**
   ```json
   {
     "instanceUrl": "https://your-instance.salesforce.com",
     "apiVersion": "v59.0",
     "authType": "jwt",
     "tokenUrl": "https://login.salesforce.com/services/oauth2/token",
     "clientId": "YOUR_CONNECTED_APP_CLIENT_ID",
     "username": "your-username@example.com",
     "privateKeyPath": "./server.key",
     "algorithm": "RS256"
   }
   ```

4. **Add to `.gitignore`:**
   ```
   .sfconnect.json
   *.key
   *.crt
   certs/
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
interface ProductReviewData {
  Id?: string;
  Name?: string;
  Rating__c?: number;
  ReviewText__c?: string;
  ProductName__c?: string;
  ReviewerEmail__c?: string;
}

class ProductReview extends Model<ProductReviewData> {
  protected static objectName = 'ProductReview__c';

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

  get ReviewText__c(): string | undefined {
    return this.get('ReviewText__c');
  }

  set ReviewText__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('ReviewText__c', value);
    }
  }

  get ProductName__c(): string | undefined {
    return this.get('ProductName__c');
  }

  set ProductName__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('ProductName__c', value);
    }
  }

  get ReviewerEmail__c(): string | undefined {
    return this.get('ReviewerEmail__c');
  }

  set ReviewerEmail__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('ReviewerEmail__c', value);
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

## Relationships and Lazy Loading

The ORM supports Salesforce relationships (lookups and master-detail) with both **eager loading** and **lazy loading** patterns.

### ⚠️ Important Naming Guidelines

**Mandatory:** Your model's getter name MUST match the Salesforce relationship name exactly, or the proxy won't find the relationship!

#### For BelongsTo Relationships:

| Object Type | Foreign Key Field | Salesforce Relationship Name | Your Getter Name |
|-------------|-------------------|------------------------------|------------------|
| **Standard** | `OwnerId` | `Owner` | `get Owner()` ✅ |
| **Standard** | `AccountId` | `Account` | `get Account()` ✅ |
| **Custom** | `CustomObject__c` | `CustomObject__r` | `get CustomObject__r()` ✅ |

```typescript
// ✅ CORRECT - Getter name matches Salesforce relationship name
get Owner(): UserData | null {
  return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  //                                ^^^^^^^ Must match getter name!
}

// ❌ WRONG - Getter name doesn't match first parameter
get MyOwner(): UserData | null {
  return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  //     ^^^^^^^^                  ^^^^^^^
  //     These must match!
}
```

#### For HasMany Relationships:

| Parent Object | Child Object | Salesforce Relationship Name | Your Getter Name |
|---------------|--------------|------------------------------|------------------|
| **Standard** | Contact | `Contacts` | `get Contacts()` ✅ |
| **Custom Parent** | Custom Child | `CustomChildren__r` | `get CustomChildren__r()` ✅ |

```typescript
// ✅ CORRECT - Getter name matches relationship name
get Contacts(): ContactData[] {
  return this.hasMany<ContactData>('Contacts', 'OwnerId', Contact, 'Contacts');
  //                                ^^^^^^^^^ Must match getter name!
}
```

**Rule of Thumb:**
- The **first parameter** of `belongsTo()` or `hasMany()` MUST match your **getter name**
- The **first parameter** MUST match the **Salesforce relationship name** you use in queries
- For custom lookups, use `__r` suffix (e.g., `User__r`)

### Defining Relationships

To define a relationship in your model, use the `belongsTo()` method:

```typescript
import { Model } from 'javascript-salesforce-connector';
import { User, UserData } from './User';

interface ContactData {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  OwnerId?: string;
  Email?: string;

  // Relationship field (populated when eager loaded)
  Owner?: UserData;
}

class Contact extends Model<ContactData> {
  protected static objectName = 'Contact';

  // ... other field getters/setters ...

  /**
   * Define the Owner relationship
   */
  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  /**
   * Helper method to manually load the Owner
   */
  async loadOwner(): Promise<void> {
    await this.loadRelationship('Owner');
  }
}
```

### Eager Loading (Recommended for Performance)

Load relationship data in the initial query - **most efficient**, uses a single SOQL query:

```typescript
// Query with relationship fields included
const contacts = await Contact
  .select('Id', 'FirstName', 'LastName', 'Owner.Name', 'Owner.Email')
  .where('Email', '!=', null)
  .get();

// Owner data is already loaded - no additional queries!
for (const contact of contacts) {
  console.log(`Contact: ${contact.FirstName} ${contact.LastName}`);
  console.log(`Owner: ${contact.Owner?.Name} (${contact.Owner?.Email})`);
}
```

**Benefits:**
- Single SOQL query (respects Salesforce governor limits)
- Best performance
- Can select specific fields from the related object

### Lazy Loading

Load relationship data on-demand when needed:

```typescript
// Find a Contact (Owner not loaded yet)
const contact = await Contact.find('003xxx');

// Explicitly load the Owner relationship
await contact.loadOwner();

// Now you can access Owner properties (all fields loaded)
console.log(`Owner: ${contact.Owner?.Name}`);
console.log(`Email: ${contact.Owner?.Email}`);
console.log(`Department: ${contact.Owner?.Department}`);
```

**Important:** The load methods automatically initialize the relationship proxy, so you can call `loadOwner()` directly without accessing the getter first.

**When to use:**
- You don't always need the relationship data
- Loading conditionally based on business logic
- Working with a single record

### Accessing Unloaded Relationships

Attempting to access a relationship that hasn't been loaded will throw a clear error:

```typescript
const contact = await Contact.find('003xxx');

// This will throw an error with helpful message
try {
  console.log(contact.Owner?.Name);
} catch (error) {
  // Error: Relationship 'Owner' is not loaded.
  // Access it asynchronously using: await contact.loadOwner()
  // or eager load it in your query: .select('Id', 'FirstName', 'Owner.Name')
}
```

### Partial Field Loading

You can load only specific fields from the relationship to optimize performance:

```typescript
// Only load Name and Email from Owner
const contacts = await Contact
  .select('Id', 'FirstName', 'LastName', 'Owner.Name', 'Owner.Email')
  .get();

for (const contact of contacts) {
  console.log(contact.Owner?.Name);     // Available
  console.log(contact.Owner?.Email);    // Available
  console.log(contact.Owner?.Phone);    // undefined - not selected
}
```

### Handling Null Relationships

Use optional chaining to safely handle relationships that might be null:

```typescript
const contact = await Contact
  .select('Id', 'FirstName', 'LastName', 'Owner.Name', 'Owner.Email')
  .first();

// Safe navigation
if (contact?.Owner) {
  console.log(`Owner: ${contact.Owner.Name}`);
} else {
  console.log('No owner assigned');
}

// Using optional chaining with fallback
console.log(`Email: ${contact.Owner?.Email || 'N/A'}`);
```

### Multiple Relationships

If your object has multiple lookup fields, define each relationship:

```typescript
interface OpportunityData {
  Id?: string;
  Name?: string;
  AccountId?: string;
  OwnerId?: string;

  Account?: AccountData;
  Owner?: UserData;
}

class Opportunity extends Model<OpportunityData> {
  protected static objectName = 'Opportunity';

  get Account(): AccountData | null {
    return this.belongsTo<AccountData>('Account', 'AccountId', Account);
  }

  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  async loadAccount(): Promise<void> {
    await this.loadRelationship('Account');
  }

  async loadOwner(): Promise<void> {
    await this.loadRelationship('Owner');
  }
}

// Query multiple relationships
const opportunities = await Opportunity
  .select('Id', 'Name', 'Account.Name', 'Owner.Name', 'Owner.Email')
  .get();
```

### Best Practices

1. **Prefer eager loading** when you know you'll need the relationship data
2. **Select specific fields** instead of loading entire related objects
3. **Use lazy loading** for conditional or single-record scenarios
4. **Respect governor limits** - eager loading uses fewer queries
5. **Handle null relationships** with optional chaining

### Has-Many Relationships (Child Relationships)

Define relationships where the parent has multiple child records:

```typescript
import { Model } from 'javascript-salesforce-connector';
import { Contact, ContactData } from './Contact';

interface UserData {
  Id?: string;
  Name?: string;
  Email?: string;

  // Child relationship (populated when eager loaded with subquery)
  Contacts?: {
    records: ContactData[];
  };
}

class User extends Model<UserData> {
  protected static objectName = 'User';

  // ... other field getters/setters ...

  /**
   * Define the Contacts relationship (User has many Contacts)
   */
  get Contacts(): ContactData[] {
    return this.hasMany<ContactData>(
      'Contacts',           // Relationship name
      'OwnerId',           // Foreign key on Contact
      Contact,             // Related model class
      'Contacts'           // Salesforce subquery name
    );
  }

  /**
   * Helper method to manually load Contacts
   */
  async loadContacts(): Promise<void> {
    await this.loadHasManyRelationship('Contacts');
  }
}
```

**Eager Loading with Subquery:**

```typescript
// Query with child records included
const users = await User
  .select('Id', 'Name', '(SELECT Id, FirstName, LastName, Email FROM Contacts)')
  .where('IsActive', true)
  .get();

// Contacts are already loaded!
for (const user of users) {
  console.log(`${user.Name} has ${user.Contacts.length} contacts`);

  user.Contacts.forEach(contact => {
    console.log(`  - ${contact.FirstName} ${contact.LastName}`);
  });
}
```

**Lazy Loading Child Records:**

```typescript
// Find a User (Contacts not loaded yet)
const user = await User.find('005xxx');

// Explicitly load the Contacts
await user.loadContacts();

// Now you can access Contacts
console.log(`Found ${user.Contacts.length} contacts`);
user.Contacts.forEach(contact => {
  console.log(contact.FirstName);
});
```

**Note:** Like `belongsTo`, the `loadContacts()` method automatically initializes the relationship, so you don't need to access `user.Contacts` before loading.

### Salesforce Relationship Syntax

When eager loading, use Salesforce's relationship syntax:

```typescript
// BelongsTo - Standard objects use singular relationship names
.select('Id', 'Name', 'Owner.Name', 'Account.Name')

// BelongsTo - Custom objects use __r suffix
.select('Id', 'Name', 'CustomLookup__r.Name')

// HasMany - Subqueries for child relationships
.select('Id', 'Name', '(SELECT Id, Name FROM Contacts)')

// HasMany - Custom object child relationships
.select('Id', 'Name', '(SELECT Id, Name FROM CustomChildren__r)')
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
