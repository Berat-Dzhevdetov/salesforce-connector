import { Model } from '../../src/core/Model';
import { User, UserData } from './User';

/**
 * Contact data interface
 * Represents a Salesforce Contact record
 */
export interface ContactData {
  Id?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  OwnerId?: string;
  AccountId?: string;
  CreatedDate?: string;
  LastModifiedDate?: string;

  // Relationship field (populated when eager loaded)
  Owner?: UserData;
}

/**
 * Contact Model
 * Demonstrates belongsTo relationship with User (Owner)
 */
export class Contact extends Model<ContactData> {
  protected static objectName = 'Contact';

  get Id(): string | undefined {
    return this.get('Id');
  }

  get FirstName(): string | undefined {
    return this.get('FirstName');
  }

  set FirstName(value: string | undefined) {
    if (value !== undefined) {
      this.set('FirstName', value);
    }
  }

  get LastName(): string | undefined {
    return this.get('LastName');
  }

  set LastName(value: string | undefined) {
    if (value !== undefined) {
      this.set('LastName', value);
    }
  }

  get Email(): string | undefined {
    return this.get('Email');
  }

  set Email(value: string | undefined) {
    if (value !== undefined) {
      this.set('Email', value);
    }
  }

  get Phone(): string | undefined {
    return this.get('Phone');
  }

  set Phone(value: string | undefined) {
    if (value !== undefined) {
      this.set('Phone', value);
    }
  }

  get OwnerId(): string | undefined {
    return this.get('OwnerId');
  }

  set OwnerId(value: string | undefined) {
    if (value !== undefined) {
      this.set('OwnerId', value);
    }
  }

  get AccountId(): string | undefined {
    return this.get('AccountId');
  }

  set AccountId(value: string | undefined) {
    if (value !== undefined) {
      this.set('AccountId', value);
    }
  }

  get CreatedDate(): string | undefined {
    return this.get('CreatedDate');
  }

  get LastModifiedDate(): string | undefined {
    return this.get('LastModifiedDate');
  }

  /**
   * BelongsTo relationship to User (Owner)
   *
   * Usage:
   * - Eager load: .select('Id', 'FirstName', 'Owner.Name', 'Owner.Email')
   * - Lazy load: await contact.loadOwner()
   */
  get Owner(): UserData | null {
    return this.belongsTo<UserData>('Owner', 'OwnerId', User);
  }

  /**
   * Helper method to manually load the Owner relationship
   */
  async loadOwner(): Promise<void> {
    await this.loadRelationship('Owner');
  }
}
