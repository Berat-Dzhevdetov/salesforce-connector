import { Model } from '../src/core/Model';

/**
 * Feedback model data interface
 */
export interface FeedbackData {
  Id?: string;
  LoyaltyProgramMemberId__c?: string;
  Experience__c?: string;
  Description__c?: string;
  TransactionId__c?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;
}

/**
 * Feedback model class
 * Example implementation for a custom Salesforce object
 */
export class Feedback extends Model<FeedbackData> {
  protected static objectName = 'Feedback__c';

  /**
   * Direct property access with type safety
   */
  get Id(): string | undefined {
    return this.get('Id');
  }

  get LoyaltyProgramMemberId__c(): string | undefined {
    return this.get('LoyaltyProgramMemberId__c');
  }

  set LoyaltyProgramMemberId__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('LoyaltyProgramMemberId__c', value);
    }
  }

  get Experience__c(): string | undefined {
    return this.get('Experience__c');
  }

  set Experience__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('Experience__c', value);
    }
  }

  get Description__c(): string | undefined {
    return this.get('Description__c');
  }

  set Description__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('Description__c', value);
    }
  }

  get TransactionId__c(): string | undefined {
    return this.get('TransactionId__c');
  }

  set TransactionId__c(value: string | undefined) {
    if (value !== undefined) {
      this.set('TransactionId__c', value);
    }
  }

  get CreatedDate(): string | undefined {
    return this.get('CreatedDate');
  }

  get LastModifiedDate(): string | undefined {
    return this.get('LastModifiedDate');
  }
}
