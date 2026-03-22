# Pagination

Learn how to paginate query results with metadata.

## Using paginate()

The `paginate()` method returns results along with pagination metadata:

```typescript
// Basic pagination - page 1, 20 items per page
const result = await Account
  .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
  .where(x => x.Industry === 'Technology')
  .paginate(1, 20);

console.log(result.records);        // Array of Account instances
console.log(result.totalSize);      // Total matching records (e.g., 250)
console.log(result.hasNextPage);    // true if more pages exist

// Returns:
// {
//   records: Account[],
//   totalSize: number,
//   hasNextPage: boolean
// }
```

## Parameters

- `page` (optional): Page number, 1-based (defaults to 1)
- `itemsPerPage` (optional): Number of items per page (defaults to 20)

## Building Paginated APIs

### REST API Example

```typescript
// Fastify/Express route example
app.get('/api/accounts', async (request, reply) => {
  const { page = 1, limit = 20 } = request.query;

  const result = await Account
    .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry, Website: x.Website }))
    .where(x => x.Industry === 'Technology')
    .orderBy(x => x.Name, 'ASC')
    .paginate(page, limit);

  return {
    data: result.records,
    pagination: {
      page: page,
      limit: limit,
      total: result.totalSize,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: page > 1,
      totalPages: Math.ceil(result.totalSize / limit)
    }
  };
});
```

## Infinite Scroll Implementation

```typescript
async function loadMoreAccounts(currentOffset: number, pageSize: number = 20) {
  const page = Math.floor(currentOffset / pageSize) + 1;

  const result = await Account
    .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
    .orderBy(x => x.CreatedDate, 'DESC')
    .paginate(page, pageSize);

  return {
    items: result.records,
    hasMore: result.hasNextPage,
    total: result.totalSize,
    nextOffset: currentOffset + result.records.length
  };
}

// Usage in frontend
let offset = 0;
const { items, hasMore, nextOffset } = await loadMoreAccounts(offset);
// User scrolls...
if (hasMore) {
  const moreItems = await loadMoreAccounts(nextOffset);
}
```

## Fetching All Pages

```typescript
async function fetchAllPages() {
  const pageSize = 50;
  let currentPage = 1;
  let allRecords: Account[] = [];

  while (true) {
    const result = await Account
      .select(x => ({ Id: x.Id, Name: x.Name, Industry: x.Industry }))
      .where(x => x.Industry === 'Technology')
      .paginate(currentPage, pageSize);

    allRecords = [...allRecords, ...result.records];

    console.log(`Fetched page ${currentPage}, total so far: ${allRecords.length}/${result.totalSize}`);

    if (!result.hasNextPage) {
      break;
    }

    currentPage++;
  }

  return allRecords;
}
```

## Comparison: .get() vs .paginate()

```typescript
// Using .get() - Returns only records
const accounts = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .limit(10)
  .get();
// Returns: Account[]

// Using .paginate() - Returns records + metadata
const result = await Account
  .select(x => ({ Id: x.Id, Name: x.Name }))
  .paginate(1, 10);
// Returns: { records: Account[], totalSize: number, hasNextPage: boolean }
```

## Important Notes

- `.paginate()` does NOT mutate the query builder - you can reuse the same query
- Page numbers are 1-based (first page is 1, not 0)
- `totalSize` represents the total count of matching records across all pages
- `hasNextPage` is based on Salesforce's `done` flag for accurate pagination
- You can still use `.where()`, `.orderBy()`, and other query methods before calling `.paginate()`

## Performance Considerations

1. **Use appropriate page sizes** - 20-50 items is typical
2. **Always filter** - Use `.where()` to reduce total results
3. **Order consistently** - Use `.orderBy()` for predictable pagination
4. **Mind governor limits** - Don't fetch too many records at once

## Example: Table Pagination

```typescript
interface PaginationRequest {
  page: number;
  size: number;
  industry?: string;
  search?: string;
}

async function getAccountsForTable(req: PaginationRequest) {
  let query = Account.select(x => ({
    Id: x.Id,
    Name: x.Name,
    Industry: x.Industry,
    Revenue: x.AnnualRevenue
  }));

  // Apply filters
  if (req.industry) {
    query = query.where(x => x.Industry === req.industry);
  }

  if (req.search) {
    query = query.where(x => x.Name.includes(req.search));
  }

  // Paginate
  const result = await query
    .orderBy(x => x.Name, 'ASC')
    .paginate(req.page, req.size);

  return {
    rows: result.records,
    total: result.totalSize,
    page: req.page,
    pageSize: req.size,
    totalPages: Math.ceil(result.totalSize / req.size),
    hasNext: result.hasNextPage,
    hasPrev: req.page > 1
  };
}
```

## Next Steps

- [Relationships](relationships.md) - Query related records
- [Basic Queries](basic-queries.md) - Query fundamentals
- [Governor Limits](../advanced/governor-limits.md) - Best practices
