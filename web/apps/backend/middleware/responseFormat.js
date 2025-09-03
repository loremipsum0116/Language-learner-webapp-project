/**
 * Response Format Middleware
 * Ensures all API responses follow the standard { data, error, meta } format
 */

const ResponseFormatter = require('../utils/responseFormatter');

/**
 * Global response formatting middleware
 * Automatically formats all responses to standard structure
 */
const responseFormatMiddleware = (req, res, next) => {
  // Store original methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = 200;

  // Track status code
  res.status = function(code) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override json method
  res.json = function(data) {
    // Skip formatting for specific endpoints (health checks, metrics, etc.)
    const skipPaths = ['/health', '/metrics', '/api/health', '/api/metrics'];
    if (skipPaths.includes(req.path)) {
      return originalJson(data);
    }

    // If data already has the standard format, pass through
    if (data && typeof data === 'object' && 
        ('data' in data || 'error' in data) && 
        'meta' in data) {
      return originalJson(data);
    }

    // Auto-format based on status code
    let formatted;
    
    if (statusCode >= 400) {
      // Error responses
      if (statusCode === 400) {
        formatted = ResponseFormatter.error(
          data.message || 'Bad request',
          data.code || 'BAD_REQUEST',
          data.details || null
        );
      } else if (statusCode === 401) {
        formatted = ResponseFormatter.authError(
          data.message || 'Unauthorized'
        );
      } else if (statusCode === 403) {
        formatted = ResponseFormatter.error(
          data.message || 'Forbidden',
          'FORBIDDEN',
          data.details || null
        );
      } else if (statusCode === 404) {
        formatted = ResponseFormatter.notFound(
          data.resource || 'Resource'
        );
      } else if (statusCode === 422) {
        formatted = ResponseFormatter.validationError(
          data.errors || data.details || []
        );
      } else if (statusCode === 429) {
        formatted = ResponseFormatter.rateLimitError(
          data.retryAfter || 60
        );
      } else if (statusCode >= 500) {
        formatted = ResponseFormatter.serverError(
          data.message || 'Internal server error'
        );
      } else {
        formatted = ResponseFormatter.error(
          data.message || 'An error occurred',
          data.code || 'ERROR',
          data.details || null
        );
      }
    } else {
      // Success responses
      if (statusCode === 201) {
        formatted = ResponseFormatter.created(
          data.data || data,
          data.message || 'Created successfully'
        );
      } else if (statusCode === 204) {
        formatted = ResponseFormatter.deleted(
          data.message || 'Deleted successfully'
        );
      } else {
        // Check for pagination
        if (data && data.items && data.pagination) {
          formatted = ResponseFormatter.paginated(
            data.items,
            data.pagination.page || 1,
            data.pagination.limit || 10,
            data.pagination.total || data.items.length,
            data.meta || {}
          );
        } else {
          formatted = ResponseFormatter.success(
            data.data !== undefined ? data.data : data,
            data.meta || {},
            data.message || null
          );
        }
      }
    }

    return originalJson(formatted);
  };

  // Override send method for string responses
  res.send = function(data) {
    if (typeof data === 'string') {
      // Convert string responses to JSON format
      return res.json({ message: data });
    }
    return originalSend(data);
  };

  // Add convenience methods
  res.success = function(data, meta = {}, message = null) {
    this.status(200);
    return this.json(ResponseFormatter.success(data, meta, message));
  };

  res.created = function(data, message = 'Created successfully', meta = {}) {
    this.status(201);
    return this.json(ResponseFormatter.created(data, message, meta));
  };

  res.updated = function(data, message = 'Updated successfully', meta = {}) {
    this.status(200);
    return this.json(ResponseFormatter.updated(data, message, meta));
  };

  res.deleted = function(message = 'Deleted successfully', meta = {}) {
    this.status(200);
    return this.json(ResponseFormatter.deleted(message, meta));
  };

  res.paginated = function(items, page, limit, total, meta = {}) {
    this.status(200);
    return this.json(ResponseFormatter.paginated(items, page, limit, total, meta));
  };

  res.empty = function(message = 'No data available', meta = {}) {
    this.status(200);
    return this.json(ResponseFormatter.empty(message, meta));
  };

  res.error = function(message, code = 'ERROR', details = null, meta = {}) {
    this.status(400);
    return this.json(ResponseFormatter.error(message, code, details, meta));
  };

  res.validationError = function(errors, meta = {}) {
    this.status(422);
    return this.json(ResponseFormatter.validationError(errors, meta));
  };

  res.authError = function(message = 'Authentication failed', meta = {}) {
    this.status(401);
    return this.json(ResponseFormatter.authError(message, meta));
  };

  res.notFound = function(resource = 'Resource', meta = {}) {
    this.status(404);
    return this.json(ResponseFormatter.notFound(resource, meta));
  };

  res.serverError = function(message = 'Internal server error', meta = {}) {
    this.status(500);
    return this.json(ResponseFormatter.serverError(message, meta));
  };

  res.rateLimitError = function(retryAfter = 60, meta = {}) {
    this.status(429);
    return this.json(ResponseFormatter.rateLimitError(retryAfter, meta));
  };

  res.batch = function(successful = [], failed = [], meta = {}) {
    const statusCode = failed.length > 0 ? 207 : 200; // 207 Multi-Status
    this.status(statusCode);
    return this.json(ResponseFormatter.batch(successful, failed, meta));
  };

  next();
};

/**
 * Error handling middleware for consistent error responses
 */
const errorResponseMiddleware = (err, req, res, next) => {
  console.error('Error:', err);

  // Default to 500 if status not set
  const statusCode = err.statusCode || err.status || 500;
  
  // Format error response
  let response;
  
  if (err.name === 'ValidationError') {
    // Mongoose/Sequelize validation errors
    const errors = Object.keys(err.errors || {}).map(field => ({
      field: field,
      message: err.errors[field].message
    }));
    response = ResponseFormatter.validationError(errors);
  } else if (err.name === 'UnauthorizedError') {
    // JWT errors
    response = ResponseFormatter.authError(err.message);
  } else if (err.name === 'CastError') {
    // MongoDB cast errors
    response = ResponseFormatter.error(
      'Invalid ID format',
      'INVALID_ID',
      { field: err.path, value: err.value }
    );
  } else if (statusCode === 404) {
    response = ResponseFormatter.notFound(err.resource || 'Resource');
  } else if (statusCode >= 500) {
    // Don't expose internal errors in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message;
    response = ResponseFormatter.serverError(message);
  } else {
    response = ResponseFormatter.error(
      err.message || 'An error occurred',
      err.code || 'ERROR',
      err.details || null
    );
  }

  res.status(statusCode).json(response);
};

/**
 * Async error wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validate response format (for testing)
 */
const validateResponseFormat = (response) => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Check required fields
  if (!('data' in response || 'error' in response)) {
    return false;
  }

  if (!('meta' in response)) {
    return false;
  }

  // Check error structure if present
  if (response.error !== null && response.error !== undefined) {
    if (!response.error.message || !response.error.code || !response.error.timestamp) {
      return false;
    }
  }

  // Check meta structure
  if (!response.meta || typeof response.meta !== 'object') {
    return false;
  }

  // Check timestamp in meta or error
  if (!response.meta.timestamp && (!response.error || !response.error.timestamp)) {
    return false;
  }

  return true;
};

module.exports = {
  responseFormatMiddleware,
  errorResponseMiddleware,
  asyncHandler,
  validateResponseFormat
};