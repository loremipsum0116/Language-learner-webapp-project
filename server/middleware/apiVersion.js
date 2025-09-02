// middleware/apiVersion.js - API Version Management Middleware
const { ok, fail } = require('../lib/resp');

/**
 * API Version Detection Middleware
 * Supports versioning through:
 * 1. URL path: /api/v1/*, /api/v2/*
 * 2. Accept header: application/vnd.api+json;version=1
 * 3. Custom header: X-API-Version: 1
 */
function detectApiVersion(req, res, next) {
  let version = null;
  
  // Skip version detection for mobile API
  if (req.path.startsWith('/api/mobile')) {
    return next();
  }
  
  // 1. Check URL path for version
  const urlMatch = req.path.match(/^\/api\/v(\d+)/);
  if (urlMatch) {
    version = parseInt(urlMatch[1]);
    req.apiVersion = version;
    req.apiVersionSource = 'url';
    return next();
  }
  
  // 2. Check Accept header for version
  const acceptHeader = req.get('Accept');
  if (acceptHeader && acceptHeader.includes('application/vnd.api+json')) {
    const versionMatch = acceptHeader.match(/version=(\d+)/);
    if (versionMatch) {
      version = parseInt(versionMatch[1]);
      req.apiVersion = version;
      req.apiVersionSource = 'accept';
      return next();
    }
  }
  
  // 3. Check custom X-API-Version header
  const customVersionHeader = req.get('X-API-Version');
  if (customVersionHeader) {
    const parsedVersion = parseInt(customVersionHeader);
    if (!isNaN(parsedVersion)) {
      version = parsedVersion;
      req.apiVersion = version;
      req.apiVersionSource = 'header';
      return next();
    }
  }
  
  // 4. Default to v1 for legacy routes
  if (!req.path.startsWith('/api/v')) {
    req.apiVersion = 1;
    req.apiVersionSource = 'default';
    req.isLegacyRoute = true;
    return next();
  }
  
  // No version detected and not a legacy route
  req.apiVersion = 1; // Default fallback
  req.apiVersionSource = 'fallback';
  next();
}

/**
 * API Version Validation Middleware
 * Ensures requested version is supported
 */
function validateApiVersion(supportedVersions = [1]) {
  return (req, res, next) => {
    // Skip validation for mobile API
    if (req.path.startsWith('/api/mobile')) {
      return next();
    }
    
    const requestedVersion = req.apiVersion;
    
    if (!supportedVersions.includes(requestedVersion)) {
      return res.status(400).json({
        data: null,
        error: `API version ${requestedVersion} is not supported`,
        meta: {
          supportedVersions,
          requestedVersion,
          versionSource: req.apiVersionSource
        }
      });
    }
    
    // Add version info to response headers
    res.set('X-API-Version', requestedVersion.toString());
    res.set('X-Supported-Versions', supportedVersions.join(', '));
    
    next();
  };
}

/**
 * Legacy Route Deprecation Warning Middleware
 * Adds deprecation warnings for routes without version prefix
 */
function deprecationWarning(req, res, next) {
  if (req.isLegacyRoute) {
    // Add deprecation headers
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date('2024-12-31').toISOString());
    res.set('Link', '</docs/api/migration/v1-to-v2>; rel="successor-version"');
    
    console.warn(`[DEPRECATED] Legacy API route accessed: ${req.method} ${req.path} - Client should migrate to /api/v1${req.path}`);
  }
  next();
}

/**
 * Response Formatter Middleware
 * Ensures consistent response format across versions
 */
function formatApiResponse(req, res, next) {
  // Override res.json to add API version metadata
  const originalJson = res.json;
  
  res.json = function(data) {
    // If data is already in API format ({ data, error, meta }), use as is
    if (data && (data.hasOwnProperty('data') || data.hasOwnProperty('error'))) {
      // Ensure meta object exists and add version info
      data.meta = {
        ...data.meta,
        version: req.apiVersion ? `${req.apiVersion}.0.0` : '1.0.0',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      };
      
      if (req.isLegacyRoute) {
        data.meta.deprecated = true;
        data.meta.migration_url = '/docs/api/migration/v1-to-v2';
      }
      
      return originalJson.call(this, data);
    }
    
    // For legacy responses, wrap in API format
    const apiResponse = {
      data: data,
      error: null,
      meta: {
        version: req.apiVersion ? `${req.apiVersion}.0.0` : '1.0.0',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    };
    
    if (req.isLegacyRoute) {
      apiResponse.meta.deprecated = true;
      apiResponse.meta.migration_url = '/docs/api/migration/v1-to-v2';
    }
    
    return originalJson.call(this, apiResponse);
  };
  
  next();
}

/**
 * API Documentation Route Generator
 */
function generateApiDocs(versions = [1]) {
  return (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const documentation = {
      api: {
        name: 'Language Learner API',
        description: 'Comprehensive language learning platform API',
        versions: versions.map(v => ({
          version: `${v}.0.0`,
          status: v === Math.max(...versions) ? 'current' : 'supported',
          baseUrl: `${baseUrl}/api/v${v}`,
          documentation: `${baseUrl}/docs/api/v${v}`,
          endpoints: `${baseUrl}/api/v${v}/`
        })),
        support: {
          deprecation_policy: 'Versions are supported for 12 months after replacement',
          migration_guides: `${baseUrl}/docs/api/migration/`,
          changelog: `${baseUrl}/docs/api/changelog`
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        generator: 'Language Learner API Documentation Generator v1.0.0'
      }
    };
    
    res.json(documentation);
  };
}

module.exports = {
  detectApiVersion,
  validateApiVersion,
  deprecationWarning,
  formatApiResponse,
  generateApiDocs
};