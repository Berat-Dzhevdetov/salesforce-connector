# Relationships & Subqueries

Query related records with full type safety and closure support.

## Basic Subquery

Query child records with the parent:

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

// Access child records
for (const account of accounts) {
  console.log(`${account.Name} has ${account.Contacts.length} contacts`);

  account.Contacts.forEach(contact => {
    console.log(`  - ${contact.Name}: ${contact.Email}`);
  });
}
```

## Subquery with WHERE (Closure Support!)

Filter child records using closure variables:

```typescript
const activeStatus = true;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name, Email: c.Email }))
      .where(c => c.Active__c === activeStatus)  // ✓ Closure works!
  }))
  .get();
```

## Complex Subquery Filters

Use nested object properties in subquery filters:

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

## Subquery Ordering & Limiting

Sort and limit child records:

```typescript
const accounts = await Account
  .select(x => ({
    Name: x.Name,
    TopContacts: x.Contacts
      .select(c => ({ Name: c.Name, CreatedDate: c.CreatedDate }))
      .orderBy(c => c.CreatedDate, 'DESC')
      .limit(5)
  }))
  .get();
```

## Multiple Subqueries

Query multiple relationships in one query:

```typescript
const activeStatus = true;
const minAmount = 50000;

const accounts = await Account
  .select(x => ({
    Name: x.Name,
    ActiveContacts: x.Contacts
      .select(c => ({ Name: c.Name, Email: c.Email }))
      .where(c => c.Active__c === activeStatus),
    BigOpportunities: x.Opportunities
      .select(o => ({ Name: o.Name, Amount: o.Amount }))
      .where(o => o.Amount > minAmount)
  }))
  .get();
```

## Lookup Relationships (Parent Records)

Query parent record fields:

```typescript
interface ContactData extends ModelData {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  OwnerId?: string;
  Owner?: UserData;  // Parent relationship
}

// Define the relationship in the model
class Contact extends LambdaModel<ContactData> {
  protected static objectName = 'Contact';

  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }
}

// Query with parent fields
const contacts = await Contact
  .select(x => ({
    FirstName: x.FirstName,
    LastName: x.LastName,
    OwnerName: x.Owner.Name,
    OwnerEmail: x.Owner.Email
  }))
  .get();
```

## Nested Lookups

Query multiple levels of parent relationships:

```typescript
const contacts = await Contact
  .select(x => ({
    Name: x.Name,
    AccountName: x.Account.Name,
    AccountOwner: x.Account.Owner.Name
  }))
  .get();
```

## Defining Relationships in Models

### Child Relationship (HasMany)

```typescript
import { RelationshipArray } from 'javascript-salesforce-connector';

interface AccountData extends ModelData {
  Id?: string;
  Name?: string;
  Contacts?: RelationshipArray<ContactData>;
}

class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  get Contacts(): RelationshipArray<ContactData> {
    return (this.get("Contacts") as any) || [];
  }
}
```

### Parent Relationship (BelongsTo)

```typescript
interface ContactData extends ModelData {
  Id?: string;
  Name?: string;
  OwnerId?: string;
  Owner?: UserData;
}

class Contact extends LambdaModel<ContactData> {
  protected static objectName = 'Contact';

  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  async loadOwner(): Promise<void> {
    await this.loadRelationship('Owner');
  }
}
```

## Eager Loading vs Lazy Loading

### Eager Loading (Recommended)

Load relationships in the initial query:

```typescript
// Single query - efficient!
const contacts = await Contact
  .select(x => ({
    Id: x.Id,
    Name: x.Name,
    OwnerName: x.Owner.Name,
    OwnerEmail: x.Owner.Email
  }))
  .get();

// Owner data is already loaded
for (const contact of contacts) {
  console.log(contact.OwnerName);  // No additional query
}
```

### Lazy Loading

Load relationships on-demand:

```typescript
// Find a Contact (Owner not loaded yet)
const contact = await Contact.find('003xxx');

// Explicitly load the Owner relationship
await contact.loadOwner();

// Now you can access Owner properties
console.log(contact.Owner?.Name);
console.log(contact.Owner?.Email);
```

## Custom Object Relationships

For custom objects, use `__r` suffix:

```typescript
interface CustomChildData extends ModelData {
  Id?: string;
  Name?: string;
  ParentObject__c?: string;
  ParentObject__r?: ParentObjectData;
}

class CustomChild extends LambdaModel<CustomChildData> {
  protected static objectName = 'CustomChild__c';

  get ParentObject__r(): ParentObjectData | null {
    return this.belongsTo<ParentObjectData>('ParentObject__r', 'ParentObject__c', ParentObject);
  }
}

// Query with custom relationship
const children = await CustomChild
  .select(x => ({
    Name: x.Name,
    ParentName: x.ParentObject__r.Name
  }))
  .get();
```

## Best Practices

1. **Prefer eager loading** - More efficient than lazy loading
2. **Filter subqueries** - Use `.where()` to reduce data transfer
3. **Limit subqueries** - Use `.limit()` to avoid loading too many children
4. **Select specific fields** - Don't query unnecessary relationship fields
5. **Use closures** - Leverage closure variables in subquery filters

## Important Notes

- Subquery closures work with simple variables, object properties, and nested properties
- Relationship names must match Salesforce API names exactly
- Custom object relationships use `__r` suffix
- Eager loading uses a single SOQL query (respects governor limits)
- Lazy loading makes additional queries (less efficient)

## Next Steps

- [Lambda Queries](lambda-queries.md) - Full lambda query guide
- [Advanced Queries](advanced-queries.md) - Complex query patterns
- [Closure Variables Deep Dive](../advanced/closure-variables.md) - How closures work
