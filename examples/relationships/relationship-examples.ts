import { SalesforceConfig } from '../../src/core/SalesforceConfig';
import { Contact } from './Contact';
import { User } from './User';

/**
 * Relationship Loading Examples
 * Demonstrates different ways to work with related records
 */

// Initialize Salesforce configuration
SalesforceConfig.initialize({
  instanceUrl: process.env.SF_INSTANCE_URL || 'https://your-instance.salesforce.com',
  apiVersion: 'v59.0',
  onTokenExpired: async () => {
    // Your token refresh logic
    return 'new-access-token';
  },
});

SalesforceConfig.setAccessToken(process.env.SF_ACCESS_TOKEN || 'your-token');

/**
 * Example 1: BelongsTo - Eager Loading
 * Load relationship data in the initial query (most efficient)
 */
async function belongsToEagerLoadingExample() {
  console.log('=== BelongsTo Eager Loading Example ===\n');

  // Query Contacts with Owner fields included
  const contacts = await Contact
    .select('Id', 'FirstName', 'LastName', 'Email', 'Owner.Name', 'Owner.Email', 'Owner.Title')
    .where('Email', '!=', null)
    .limit(10)
    .get();

  // Owner data is already loaded - no additional queries!
  for (const contact of contacts) {
    console.log(`Contact: ${contact.FirstName} ${contact.LastName}`);
    console.log(`Email: ${contact.Email}`);
    console.log(`Owner: ${contact.Owner?.Name} (${contact.Owner?.Email})`);
    console.log(`Title: ${contact.Owner?.Title}`);
    console.log('---');
  }
}

/**
 * Example 2: BelongsTo - Lazy Loading
 * Load relationship data on-demand when needed
 */
async function belongsToLazyLoadingExample() {
  console.log('=== BelongsTo Lazy Loading Example ===\n');

  // Find a single Contact (Owner not loaded yet)
  const contact = await Contact.find('003xxxxxxxxxxxxx');

  if (!contact) {
    console.log('Contact not found');
    return;
  }

  console.log(`Contact: ${contact.FirstName} ${contact.LastName}`);
  console.log(`Email: ${contact.Email}`);

  // Explicitly load the Owner relationship
  await contact.loadOwner();

  // Now we can access Owner properties
  console.log(`Owner: ${contact.Owner?.Name}`);
  console.log(`Email: ${contact.Owner?.Email}`);
  console.log(`Department: ${contact.Owner?.Department}`);

  // Second access doesn't trigger another query - it's cached
  console.log(`Owner again: ${contact.Owner?.Name}`);
}

/**
 * Example 3: HasMany - Eager Loading with Subquery
 * Load child records in the initial query
 */
async function hasManyEagerLoadingExample() {
  console.log('=== HasMany Eager Loading Example ===\n');

  // Query Users with their Contacts included (subquery)
  const users = await User
    .select('Id', 'Name', 'Email', '(SELECT Id, FirstName, LastName, Email FROM Contacts)')
    .where('IsActive', true)
    .limit(5)
    .get();

  // Contacts are already loaded - no additional queries!
  for (const user of users) {
    console.log(`User: ${user.Name} (${user.Email})`);
    console.log(`Number of Contacts: ${user.Contacts?.length || 0}`);

    user.Contacts?.forEach((contact, index) => {
      console.log(`  ${index + 1}. ${contact.FirstName} ${contact.LastName} (${contact.Email})`);
    });
    console.log('---');
  }
}

/**
 * Example 4: HasMany - Lazy Loading
 * Load child records on-demand
 */
async function hasManyLazyLoadingExample() {
  console.log('=== HasMany Lazy Loading Example ===\n');

  // Find a User (Contacts not loaded yet)
  const user = await User.find('005xxxxxxxxxxxxx');

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`User: ${user.Name}`);
  console.log(`Email: ${user.Email}`);

  // Explicitly load the Contacts relationship
  await user.loadContacts();

  // Now we can access Contacts array
  console.log(`\nNumber of Contacts: ${user.Contacts?.length || 0}`);

  user.Contacts?.forEach((contact, index) => {
    console.log(`${index + 1}. ${contact.FirstName} ${contact.LastName}`);
  });
}

/**
 * Example 5: Bulk Loading (Respects Governor Limits)
 * Load multiple records and their relationships efficiently
 */
async function bulkLoadingExample() {
  console.log('=== Bulk Loading Example ===\n');

  // Query multiple Contacts with their Owners
  // This is ONE query, not multiple - respects governor limits!
  const contacts = await Contact
    .select(
      'Id',
      'FirstName',
      'LastName',
      'Email',
      'Owner.Name',
      'Owner.Email',
      'Owner.Department'
    )
    .where('Email', '!=', null)
    .orderBy('CreatedDate', 'DESC')
    .limit(50)
    .get();

  console.log(`Found ${contacts.length} contacts\n`);

  // Group by department
  const byDepartment = new Map<string, number>();

  for (const contact of contacts) {
    const dept = contact.Owner?.Department || 'Unknown';
    const current = byDepartment.get(dept) || 0;
    byDepartment.set(dept, current + 1);
  }

  console.log('Contacts by Owner Department:');
  for (const [dept, count] of byDepartment.entries()) {
    console.log(`  ${dept}: ${count} contacts`);
  }
}

/**
 * Example 6: Working with null relationships
 */
async function nullRelationshipExample() {
  console.log('=== Null Relationship Example ===\n');

  // Find a Contact that might not have an Owner assigned
  const contact = await Contact
    .select('Id', 'FirstName', 'LastName', 'Owner.Name')
    .first();

  if (!contact) {
    console.log('No contacts found');
    return;
  }

  // Safe navigation - Owner might be null
  if (contact.Owner) {
    console.log(`Owner: ${contact.Owner.Name}`);
  } else {
    console.log('No owner assigned to this contact');
  }

  // Using optional chaining
  console.log(`Owner Email: ${contact.Owner?.Email || 'N/A'}`);
}

/**
 * Example 7: Accessing unloaded relationships (will throw error)
 */
async function unloadedRelationshipExample() {
  console.log('=== Unloaded Relationship Example ===\n');

  const contact = await Contact.find('003xxxxxxxxxxxxx');

  if (!contact) {
    console.log('Contact not found');
    return;
  }

  try {
    // This will throw an error because Owner is not loaded
    console.log(contact.Owner?.Name);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.log('\nTo fix this, either:');
      console.log('1. Eager load: .select("Id", "FirstName", "Owner.Name")');
      console.log('2. Lazy load: await contact.loadOwner()');
    }
  }
}

// Run examples
async function main() {
  try {
    await belongsToEagerLoadingExample();
    console.log('\n\n');

    await belongsToLazyLoadingExample();
    console.log('\n\n');

    await hasManyEagerLoadingExample();
    console.log('\n\n');

    await hasManyLazyLoadingExample();
    console.log('\n\n');

    await bulkLoadingExample();
    console.log('\n\n');

    await nullRelationshipExample();
    console.log('\n\n');

    await unloadedRelationshipExample();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
  }
}

// Uncomment to run
// main().catch(console.error);

export {
  belongsToEagerLoadingExample,
  belongsToLazyLoadingExample,
  hasManyEagerLoadingExample,
  hasManyLazyLoadingExample,
  bulkLoadingExample,
  nullRelationshipExample,
  unloadedRelationshipExample,
};
