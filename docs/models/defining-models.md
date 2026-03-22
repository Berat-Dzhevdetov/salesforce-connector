# Defining Models

To create a model, extend the `LambdaModel` class and define your Salesforce object's fields using TypeScript interfaces.

## Basic Model Structure

```typescript
import { LambdaModel, ModelData } from 'javascript-salesforce-connector';

// Define the data interface for type safety
interface AccountData extends ModelData {
  Id?: string;
  Name?: string;
  Industry?: string;
  AnnualRevenue?: number;
  BillingCity?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
}

// Create the model class
class Account extends LambdaModel<AccountData> {
  // Specify the Salesforce object API name
  protected static objectName = 'Account';

  // Define getters for accessing field values
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
}
```

## Custom Object Example

For custom Salesforce objects, append `__c` to the object name:

```typescript
interface ProductReviewData extends ModelData {
  Id?: string;
  Name?: string;
  Rating__c?: number;
  ReviewText__c?: string;
  ProductName__c?: string;
  ReviewerEmail__c?: string;
}

class ProductReview extends LambdaModel<ProductReviewData> {
  protected static objectName = 'ProductReview__c';

  get Id(): string | undefined {
    return this.get('Id');
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
}
```

## Best Practices

1. **Always use interfaces** - Define `ModelData` interface for type safety
2. **Read-only fields** - Don't create setters for system fields like `Id`, `CreatedDate`
3. **Use CLI generation** - The recommended way is to [auto-generate models](model-generation.md)
4. **Extend ModelData** - Your interface should extend `ModelData`

## Next Steps

- [Model Generation (CLI)](model-generation.md) - Auto-generate models from Salesforce
- [Field Types](field-types.md) - TypeScript types for Salesforce fields
