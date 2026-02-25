import { Model } from '../../src/core/Model';
import { ContactData } from './Contact';

/**
 * User data interface
 * Represents a Salesforce User record
 */
export interface UserData {
  Id?: string;
  Name?: string;
  Email?: string;
  Title?: string;
  Phone?: string;
  Department?: string;
  IsActive?: boolean;

  // Has-many relationship (populated when eager loaded with subquery)
  Contacts?: {
    records: ContactData[];
  };
}

/**
 * User Model
 * Demonstrates hasMany relationship with Contacts
 */
export class User extends Model<UserData> {
  protected static objectName = 'User';

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

  get Email(): string | undefined {
    return this.get('Email');
  }

  set Email(value: string | undefined) {
    if (value !== undefined) {
      this.set('Email', value);
    }
  }

  get Title(): string | undefined {
    return this.get('Title');
  }

  set Title(value: string | undefined) {
    if (value !== undefined) {
      this.set('Title', value);
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

  get Department(): string | undefined {
    return this.get('Department');
  }

  set Department(value: string | undefined) {
    if (value !== undefined) {
      this.set('Department', value);
    }
  }

  get IsActive(): boolean | undefined {
    return this.get('IsActive');
  }

  set IsActive(value: boolean | undefined) {
    if (value !== undefined) {
      this.set('IsActive', value);
    }
  }

  /**
   * HasMany relationship to Contacts
   * Returns all Contacts owned by this User
   *
   * Usage:
   * - Eager load: .select('Id', 'Name', '(SELECT Id, FirstName, LastName FROM Contacts)')
   * - Lazy load: await user.loadContacts()
   */
  get Contacts(): ContactData[] {
    return this.hasMany<ContactData>(
      'Contacts',
      'OwnerId',
      // We need to import Contact class to avoid circular dependency
      // For now, we'll use a type assertion
      require('./Contact').Contact,
      'Contacts'
    );
  }

  /**
   * Helper method to manually load the Contacts relationship
   */
  async loadContacts(): Promise<void> {
    await this.loadHasManyRelationship('Contacts');
  }
}
