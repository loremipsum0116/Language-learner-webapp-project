// server/middleware/performance.js - Performance monitoring middleware
const os = require('os');

// Request timing middleware
const requestTimer = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
    }
    
    // Add timing header
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  
  next();
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
  const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
  
  // Warn if memory usage is high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn(`[HIGH MEMORY] ${memUsedMB}MB used, ${memTotalMB}MB total`);
  }
  
  // Add memory headers for monitoring
  res.set('X-Memory-Used', `${memUsedMB}MB`);
  res.set('X-Memory-Total', `${memTotalMB}MB`);
  
  next();
};

// Request rate limiting and tracking
const requestTracker = (() => {
  const requests = new Map();
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.lastRequest > 300000) { // 5 minutes
        requests.delete(key);
      }
    }
  }, 60000); // Cleanup every minute
  
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(clientIP)) {
      requests.set(clientIP, { count: 0, lastRequest: now });
    }
    
    const clientData = requests.get(clientIP);
    clientData.count++;
    clientData.lastRequest = now;
    
    // Add request count header
    res.set('X-Request-Count', clientData.count.toString());
    
    next();
  };
})();

// Database query performance tracking
const queryPerformanceTracker = {
  queries: [],
  maxQueries: 100,
  
  track(query, duration, error = null) {
    this.queries.push({
      query: query.substring(0, 200), // Limit query string length
      duration,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    });
    
    // Keep only recent queries
    if (this.queries.length > this.maxQueries) {
      this.queries.shift();
    }
    
    // Log slow queries
    if (duration > 100) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${query.substring(0, 100)}...`);
    }
  },
  
  getStats() {
    if (this.queries.length === 0) return null;
    
    const totalQueries = this.queries.length;
    const avgDuration = this.queries.reduce((sum, q) => sum + q.duration, 0) / totalQueries;
    const slowQueries = this.queries.filter(q => q.duration > 100).length;
    const errors = this.queries.filter(q => q.error).length;
    
    return {
      totalQueries,
      averageDuration: avgDuration.toFixed(2) + 'ms',
      slowQueries,
      errors,
      errorRate: ((errors / totalQueries) * 100).toFixed(2) + '%'
    };
  }
};

// System health check endpoint
const healthCheck = (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    memory: {
      used: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      total: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
      external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    system: {
      platform: os.platform(),
      architecture: os.arch(),
      loadAverage: os.loadavg(),
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`
    }
  };
  
  // Add database query stats if available
  const queryStats = queryPerformanceTracker.getStats();
  if (queryStats) {
    health.database = queryStats;
  }
  
  res.json(health);
};

// Performance metrics endpoint
const performanceMetrics = (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      loadavg: os.loadavg(),
      freemem: os.freemem(),
      totalmem: os.totalmem()
    }
  };
  
  res.json(metrics);
};

// Compression recommendation
const compressionMiddleware = (req, res, next) => {
  // Add compression headers
  res.set('Vary', 'Accept-Encoding');
  
  // Recommend gzip for large responses
  const originalSend = res.send;
  res.send = function(data) {
    if (data && typeof data === 'string' && data.length > 1000) {
      res.set('X-Should-Compress', 'true');
    }
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  requestTimer,
  memoryMonitor,
  requestTracker,
  queryPerformanceTracker,
  healthCheck,
  performanceMetrics,
  compressionMiddleware
};