# Field Types

TypeScript type mappings for Salesforce field types.

## Standard Field Type Mappings

| Salesforce Type | TypeScript Type | Example |
|----------------|-----------------|---------|
| `string` | `string` | Account Name |
| `boolean` | `boolean` | IsActive |
| `int` | `number` | NumberOfEmployees |
| `double` | `number` | AnnualRevenue |
| `currency` | `number` | Amount |
| `percent` | `number` | Probability |
| `date` | `string` | BirthDate |
| `datetime` | `string` | CreatedDate |
| `email` | `string` | Email |
| `phone` | `string` | Phone |
| `url` | `string` | Website |
| `textarea` | `string` | Description |
| `picklist` | `string` | Industry |
| `multipicklist` | `string` | Interests__c |
| `id` | `string` | Id |
| `reference` | `string` | OwnerId |

## Custom Fields

Custom fields in Salesforce end with `__c`:

```typescript
interface CustomObjectData extends ModelData {
  Id?: string;
  Name?: string;

  // Custom fields
  Rating__c?: number;
  Category__c?: string;
  IsActive__c?: boolean;
  CustomDate__c?: string;
  CustomLookup__c?: string;  // Foreign key
}
```

## Relationship Fields

### Lookup Relationships (BelongsTo)

```typescript
interface ContactData extends ModelData {
  Id?: string;
  FirstName?: string;
  LastName?: string;

  // Foreign key
  OwnerId?: string;

  // Relationship (populated when eager loaded)
  Owner?: UserData;
}
```

### Child Relationships (HasMany)

```typescript
interface AccountData extends ModelData {
  Id?: string;
  Name?: string;

  // Child relationship (populated when eager loaded)
  Contacts?: RelationshipArray<ContactData>;
}
```

## Optional vs Required Fields

All fields should be optional (`?`) since:
- Not all fields are required in Salesforce
- Fields may not be selected in queries
- New instances don't have data yet

```typescript
interface AccountData extends ModelData {
  Id?: string;              // Optional - not set until created
  Name?: string;            // Optional - may not be selected
  Industry?: string;        // Optional - nullable field
  CreatedDate?: string;     // Optional - system field
}
```

## Date and DateTime Fields

Salesforce returns dates as ISO 8601 strings:

```typescript
interface EventData extends ModelData {
  Id?: string;

  // Date field (YYYY-MM-DD)
  ActivityDate?: string;

  // DateTime field (ISO 8601)
  CreatedDate?: string;     // "2025-01-15T10:30:00.000+0000"
  LastModifiedDate?: string;
}
```

## Next Steps

- [Defining Models](defining-models.md) - Create model classes
- [Model Generation](model-generation.md) - Auto-generate with correct types
