import { LambdaModel, RelationshipArray } from '../../src';

// Define data interfaces
export interface ContactData {
  Id: string;
  Name: string;
  Email: string;
  Phone: string;
  Title: string;
  Active__c: boolean;
  AccountId: string;
  CreatedDate: Date;
}

export interface OpportunityData {
  Id: string;
  Name: string;
  Amount: number;
  CloseDate: Date;
  StageName: string;
  AccountId: string;
}

export interface AccountData {
  Id: string;
  Name: string;
  Industry: string;
  Type: string;
  AnnualRevenue: number;
  NumberOfEmployees: number;
  Rating: string;
  Active__c: boolean;
  BillingAddress: {
    Street: string;
    City: string;
    State: string;
    PostalCode: string;
    Country: string;
  };
  ShippingAddress: {
    Street: string;
    City: string;
  };
  Contacts: RelationshipArray<ContactData>;
  Opportunities: RelationshipArray<OpportunityData>;
  CreatedDate: Date;
  LastModifiedDate: Date;
}

// Define model classes
export class Contact extends LambdaModel<ContactData> {
  protected static objectName = 'Contact';

  get Id(): string { return this.get('Id') || ''; }
  get Name(): string { return this.get('Name') || ''; }
  get Email(): string { return this.get('Email') || ''; }
  get Phone(): string { return this.get('Phone') || ''; }
  get Title(): string { return this.get('Title') || ''; }
  get Active__c(): boolean { return this.get('Active__c') || false; }
  get AccountId(): string { return this.get('AccountId') || ''; }
  get CreatedDate(): Date { return this.get('CreatedDate') || new Date(); }
}

export class Opportunity extends LambdaModel<OpportunityData> {
  protected static objectName = 'Opportunity';

  get Id(): string { return this.get('Id') || ''; }
  get Name(): string { return this.get('Name') || ''; }
  get Amount(): number { return this.get('Amount') || 0; }
  get CloseDate(): Date { return this.get('CloseDate') || new Date(); }
  get StageName(): string { return this.get('StageName') || ''; }
  get AccountId(): string { return this.get('AccountId') || ''; }
}

export class Account extends LambdaModel<AccountData> {
  protected static objectName = 'Account';

  get Id(): string { return this.get('Id') || ''; }
  get Name(): string { return this.get('Name') || ''; }
  get Industry(): string { return this.get('Industry') || ''; }
  get Type(): string { return this.get('Type') || ''; }
  get AnnualRevenue(): number { return this.get('AnnualRevenue') || 0; }
  get NumberOfEmployees(): number { return this.get('NumberOfEmployees') || 0; }
  get Rating(): string { return this.get('Rating') || ''; }
  get Active__c(): boolean { return this.get('Active__c') || false; }
  get CreatedDate(): Date { return this.get('CreatedDate') || new Date(); }
  get LastModifiedDate(): Date { return this.get('LastModifiedDate') || new Date(); }

  get BillingAddress(): AccountData['BillingAddress'] {
    return this.get('BillingAddress') || {
      Street: '',
      City: '',
      State: '',
      PostalCode: '',
      Country: ''
    };
  }

  get ShippingAddress(): AccountData['ShippingAddress'] {
    return this.get('ShippingAddress') || { Street: '', City: '' };
  }

  get Contacts(): RelationshipArray<ContactData> {
    return (this.get("Contacts") as any) || [];
  }

  get Opportunities(): RelationshipArray<OpportunityData> {
    return (this.get("Opportunities") as any) || [];
  }
}
