# API Response Format Specification

## Overview
All API responses in the Language Learner application follow a standardized format to ensure consistency across endpoints and improve client-side error handling.

## Standard Response Structure

Every API response MUST contain the following three top-level fields:

```json
{
  "data": <any>,
  "error": <object | null>,
  "meta": <object>
}
```

### Field Descriptions

#### `data` (required)
- Contains the main payload of the response
- Type: `any` (can be object, array, string, number, boolean, or null)
- For successful responses: Contains the requested data
- For error responses: MUST be `null`
- For empty results: Should be an empty array `[]` or `null`

#### `error` (required)
- Contains error information when the request fails
- Type: `object | null`
- For successful responses: MUST be `null`
- For error responses: MUST contain:
  ```json
  {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": <any>, // Optional: additional error context
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```

#### `meta` (required)
- Contains metadata about the response
- Type: `object` (never null)
- MUST include at minimum:
  ```json
  {
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```
- MAY include additional fields based on response type

## Response Types

### 1. Success Response
```json
{
  "data": {
    "id": 1,
    "name": "Example"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "message": "Operation successful" // optional
  }
}
```

### 2. Error Response
```json
{
  "data": null,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND",
    "details": null,
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "meta": {}
}
```

### 3. Paginated Response
```json
{
  "data": [
    { "id": 1 },
    { "id": 2 }
  ],
  "error": null,
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false,
      "nextPage": 2,
      "prevPage": null
    },
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

### 4. Empty Response
```json
{
  "data": [],
  "error": null,
  "meta": {
    "message": "No data available",
    "count": 0,
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

### 5. Batch Operation Response
```json
{
  "data": {
    "successful": [
      { "id": 1, "status": "created" },
      { "id": 2, "status": "updated" }
    ],
    "failed": [
      { "id": 3, "error": "Validation failed" }
    ]
  },
  "error": {
    "message": "1 operations failed",
    "code": "PARTIAL_ERROR",
    "details": [...],
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "meta": {
    "totalProcessed": 3,
    "successCount": 2,
    "failedCount": 1,
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

## Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `AUTH_ERROR` | 401 | Authentication failed |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `PARTIAL_ERROR` | 207 | Some operations in batch failed |

## Implementation

### Server-side Usage

```javascript
// Import the formatter
const ResponseFormatter = require('./utils/responseFormatter');

// Success response
res.json(ResponseFormatter.success(data, meta, message));

// Error response
res.status(400).json(ResponseFormatter.error(message, code, details));

// Paginated response
res.json(ResponseFormatter.paginated(items, page, limit, total));

// Using convenience methods (with middleware)
res.success(data);
res.error('Invalid input', 'VALIDATION_ERROR');
res.paginated(items, 1, 10, 100);
res.notFound('User');
```

### Client-side Handling

```javascript
// TypeScript interface
interface ApiResponse<T = any> {
  data: T | null;
  error: {
    message: string;
    code: string;
    details?: any;
    timestamp: string;
  } | null;
  meta: {
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      nextPage: number | null;
      prevPage: number | null;
    };
    [key: string]: any;
  };
}

// Example client handling
async function fetchData() {
  const response = await fetch('/api/v1/vocab');
  const result: ApiResponse = await response.json();
  
  if (result.error) {
    // Handle error
    console.error(`Error ${result.error.code}: ${result.error.message}`);
    return;
  }
  
  // Use data
  console.log('Data:', result.data);
  
  // Check pagination
  if (result.meta.pagination?.hasNext) {
    // Load more available
  }
}
```

## Mobile API Specific Considerations

Mobile endpoints (`/api/mobile/*`) receive the same standardized format with additional optimizations:

1. **Compressed responses**: Large data sets are automatically compressed
2. **Minimal meta**: Only essential metadata is included to reduce payload size
3. **Efficient pagination**: Uses cursor-based pagination for better performance
4. **Offline support**: Includes sync timestamps for offline capability

Example mobile response:
```json
{
  "data": [...],
  "error": null,
  "meta": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "syncToken": "abc123", // For offline sync
    "compressed": true,    // Indicates gzip compression
    "cursor": "next_page_token" // For cursor pagination
  }
}
```

## Migration Guide

For legacy endpoints not yet using the standard format:

1. **Automatic formatting**: The `responseFormatMiddleware` automatically wraps non-standard responses
2. **Gradual migration**: Update endpoints one by one using `ResponseFormatter` utility
3. **Testing**: Use `validateResponseFormat()` to verify compliance
4. **Backwards compatibility**: Legacy endpoints continue to work with automatic wrapping

## Testing

Run response format tests:
```bash
npm test -- responseFormat.test.js
```

Validate response in unit tests:
```javascript
const { validateResponseFormat } = require('./middleware/responseFormat');

test('API returns standard format', async () => {
  const response = await api.get('/endpoint');
  expect(validateResponseFormat(response.data)).toBe(true);
});
```

## Benefits

1. **Consistency**: All APIs follow the same structure
2. **Error handling**: Standardized error format simplifies client-side error handling
3. **Metadata**: Consistent place for pagination, timestamps, and other metadata
4. **Type safety**: Predictable structure enables strong typing in TypeScript/Flow
5. **Debugging**: Timestamps and error codes improve debugging
6. **Mobile optimization**: Efficient format for mobile clients
7. **Future-proof**: Extensible meta field for future additions

## Compliance

- ✅ All `/api/v1/*` endpoints use standard format
- ✅ All `/api/mobile/*` endpoints use standard format
- ✅ Error responses automatically formatted
- ✅ Middleware ensures compliance for new endpoints
- ✅ Validation tests ensure format integrity