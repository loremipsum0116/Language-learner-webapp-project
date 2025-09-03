/**
 * Standard Response Formatter for API consistency
 * All API responses follow the { data, error, meta } structure
 */

class ResponseFormatter {
  /**
   * Success response format
   * @param {any} data - Response data
   * @param {Object} meta - Metadata (pagination, timestamps, etc.)
   * @param {string} message - Optional success message
   */
  static success(data = null, meta = {}, message = null) {
    const response = {
      data: data,
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };

    if (message) {
      response.meta.message = message;
    }

    return response;
  }

  /**
   * Error response format
   * @param {string} message - Error message
   * @param {number} code - Error code
   * @param {Object} details - Additional error details
   * @param {Object} meta - Metadata
   */
  static error(message, code = 'UNKNOWN_ERROR', details = null, meta = {}) {
    return {
      data: null,
      error: {
        message: message,
        code: code,
        details: details,
        timestamp: new Date().toISOString()
      },
      meta: meta
    };
  }

  /**
   * Paginated response format
   * @param {Array} items - Data items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {number} total - Total items
   * @param {Object} additionalMeta - Additional metadata
   */
  static paginated(items, page, limit, total, additionalMeta = {}) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: items || [],
      error: null,
      meta: {
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: totalPages,
          hasNext: hasNext,
          hasPrev: hasPrev,
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        },
        timestamp: new Date().toISOString(),
        ...additionalMeta
      }
    };
  }

  /**
   * Empty result response
   * @param {string} message - Optional message for empty result
   * @param {Object} meta - Metadata
   */
  static empty(message = 'No data available', meta = {}) {
    return {
      data: [],
      error: null,
      meta: {
        message: message,
        timestamp: new Date().toISOString(),
        count: 0,
        ...meta
      }
    };
  }

  /**
   * Validation error response
   * @param {Array} errors - Validation errors
   * @param {Object} meta - Metadata
   */
  static validationError(errors, meta = {}) {
    return {
      data: null,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
        timestamp: new Date().toISOString()
      },
      meta: meta
    };
  }

  /**
   * Authentication error response
   * @param {string} message - Error message
   * @param {Object} meta - Metadata
   */
  static authError(message = 'Authentication failed', meta = {}) {
    return {
      data: null,
      error: {
        message: message,
        code: 'AUTH_ERROR',
        details: null,
        timestamp: new Date().toISOString()
      },
      meta: meta
    };
  }

  /**
   * Not found error response
   * @param {string} resource - Resource name
   * @param {Object} meta - Metadata
   */
  static notFound(resource = 'Resource', meta = {}) {
    return {
      data: null,
      error: {
        message: `${resource} not found`,
        code: 'NOT_FOUND',
        details: null,
        timestamp: new Date().toISOString()
      },
      meta: meta
    };
  }

  /**
   * Server error response
   * @param {string} message - Error message
   * @param {Object} meta - Metadata
   */
  static serverError(message = 'Internal server error', meta = {}) {
    return {
      data: null,
      error: {
        message: message,
        code: 'SERVER_ERROR',
        details: null,
        timestamp: new Date().toISOString()
      },
      meta: {
        ...meta,
        support: 'Please contact support if this error persists'
      }
    };
  }

  /**
   * Rate limit error response
   * @param {number} retryAfter - Seconds until retry
   * @param {Object} meta - Metadata
   */
  static rateLimitError(retryAfter = 60, meta = {}) {
    return {
      data: null,
      error: {
        message: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: retryAfter
        },
        timestamp: new Date().toISOString()
      },
      meta: meta
    };
  }

  /**
   * Created resource response
   * @param {any} data - Created resource data
   * @param {string} message - Success message
   * @param {Object} meta - Metadata
   */
  static created(data, message = 'Resource created successfully', meta = {}) {
    return {
      data: data,
      error: null,
      meta: {
        message: message,
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Updated resource response
   * @param {any} data - Updated resource data
   * @param {string} message - Success message
   * @param {Object} meta - Metadata
   */
  static updated(data, message = 'Resource updated successfully', meta = {}) {
    return {
      data: data,
      error: null,
      meta: {
        message: message,
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Deleted resource response
   * @param {string} message - Success message
   * @param {Object} meta - Metadata
   */
  static deleted(message = 'Resource deleted successfully', meta = {}) {
    return {
      data: null,
      error: null,
      meta: {
        message: message,
        timestamp: new Date().toISOString(),
        deleted: true,
        ...meta
      }
    };
  }

  /**
   * Batch operation response
   * @param {Array} successful - Successful operations
   * @param {Array} failed - Failed operations
   * @param {Object} meta - Metadata
   */
  static batch(successful = [], failed = [], meta = {}) {
    return {
      data: {
        successful: successful,
        failed: failed
      },
      error: failed.length > 0 ? {
        message: `${failed.length} operations failed`,
        code: 'PARTIAL_ERROR',
        details: failed,
        timestamp: new Date().toISOString()
      } : null,
      meta: {
        totalProcessed: successful.length + failed.length,
        successCount: successful.length,
        failedCount: failed.length,
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }
}

// Helper function for Express.js integration
ResponseFormatter.expressHandler = function(formatter, statusCode = 200) {
  return function(req, res) {
    const response = formatter();
    res.status(statusCode).json(response);
  };
};

// Middleware for automatic response formatting
ResponseFormatter.middleware = function() {
  return function(req, res, next) {
    // Store original json method
    const originalJson = res.json;

    // Override json method
    res.json = function(data) {
      // If data already has the standard format, pass through
      if (data && typeof data === 'object' && 
          ('data' in data || 'error' in data) && 
          'meta' in data) {
        return originalJson.call(this, data);
      }

      // Auto-format non-standard responses
      let formatted;
      
      // Check if it's an error response
      if (this.statusCode >= 400) {
        const message = data.message || data.error || 'An error occurred';
        const code = data.code || 'ERROR';
        formatted = ResponseFormatter.error(message, code, data.details || null);
      } else {
        // Success response
        formatted = ResponseFormatter.success(data);
      }

      return originalJson.call(this, formatted);
    };

    // Add helper methods to response object
    res.success = function(data, meta, message) {
      return this.status(200).json(ResponseFormatter.success(data, meta, message));
    };

    res.created = function(data, message, meta) {
      return this.status(201).json(ResponseFormatter.created(data, message, meta));
    };

    res.updated = function(data, message, meta) {
      return this.status(200).json(ResponseFormatter.updated(data, message, meta));
    };

    res.deleted = function(message, meta) {
      return this.status(200).json(ResponseFormatter.deleted(message, meta));
    };

    res.paginated = function(items, page, limit, total, meta) {
      return this.status(200).json(ResponseFormatter.paginated(items, page, limit, total, meta));
    };

    res.empty = function(message, meta) {
      return this.status(200).json(ResponseFormatter.empty(message, meta));
    };

    res.error = function(message, code, details, meta) {
      return this.status(400).json(ResponseFormatter.error(message, code, details, meta));
    };

    res.validationError = function(errors, meta) {
      return this.status(422).json(ResponseFormatter.validationError(errors, meta));
    };

    res.authError = function(message, meta) {
      return this.status(401).json(ResponseFormatter.authError(message, meta));
    };

    res.notFound = function(resource, meta) {
      return this.status(404).json(ResponseFormatter.notFound(resource, meta));
    };

    res.serverError = function(message, meta) {
      return this.status(500).json(ResponseFormatter.serverError(message, meta));
    };

    res.rateLimitError = function(retryAfter, meta) {
      return this.status(429).json(ResponseFormatter.rateLimitError(retryAfter, meta));
    };

    next();
  };
};

module.exports = ResponseFormatter;