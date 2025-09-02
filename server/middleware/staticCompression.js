// middleware/staticCompression.js - Static File Compression and Optimization
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createReadStream, existsSync } = require('fs');
const zlib = require('zlib');
const { promisify } = require('util');

/**
 * Pre-compressed static file serving
 * Serves .gz and .br files if they exist and client supports them
 */
const preCompressedStatic = (staticPath, options = {}) => {
  const {
    maxAge = 86400000, // 24 hours default
    etag = true,
    dotfiles = 'ignore',
    index = false
  } = options;

  return async (req, res, next) => {
    // Only handle GET requests for static files
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const filePath = path.join(staticPath, req.path);
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    try {
      // Check for pre-compressed versions
      let serveFile = filePath;
      let contentEncoding = null;
      
      // Prefer Brotli over Gzip
      if (acceptEncoding.includes('br')) {
        const brFile = `${filePath}.br`;
        if (existsSync(brFile)) {
          serveFile = brFile;
          contentEncoding = 'br';
        }
      } else if (acceptEncoding.includes('gzip')) {
        const gzFile = `${filePath}.gz`;
        if (existsSync(gzFile)) {
          serveFile = gzFile;
          contentEncoding = 'gzip';
        }
      }
      
      // Check if file exists
      if (!existsSync(serveFile) && !existsSync(filePath)) {
        return next();
      }
      
      // Use original file if compressed version doesn't exist
      if (!existsSync(serveFile)) {
        serveFile = filePath;
        contentEncoding = null;
      }
      
      // Get file stats
      const stats = await fs.stat(serveFile);
      
      // Set appropriate headers
      const ext = path.extname(req.path).toLowerCase();
      const contentType = getContentType(ext);
      
      res.set('Content-Type', contentType);
      
      if (contentEncoding) {
        res.set('Content-Encoding', contentEncoding);
        res.set('Vary', 'Accept-Encoding');
      }
      
      // Cache headers
      if (maxAge > 0) {
        res.set('Cache-Control', `public, max-age=${Math.floor(maxAge/1000)}`);
      }
      
      if (etag) {
        const etag = `"${stats.mtime.getTime().toString(16)}-${stats.size.toString(16)}"`;
        res.set('ETag', etag);
        
        // Check if-none-match
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
      }
      
      // Set content length (for original file, not compressed)
      if (!contentEncoding) {
        res.set('Content-Length', stats.size);
      }
      
      // Stream the file
      const stream = createReadStream(serveFile);
      stream.pipe(res);
      
      stream.on('error', (err) => {
        console.error(`[STATIC] Error serving ${serveFile}:`, err);
        next();
      });
      
    } catch (error) {
      console.error(`[STATIC] Error processing ${filePath}:`, error);
      next();
    }
  };
};

/**
 * Audio file optimization middleware
 */
const audioOptimization = (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
    // Set appropriate headers for audio files
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    
    // Handle range requests for audio streaming
    const range = req.headers.range;
    if (range) {
      // Range request handling would go here
      // For now, just add the header
      res.set('Content-Type', getContentType(ext));
    }
  }
  
  next();
};

/**
 * Image optimization headers
 */
const imageOptimization = (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
    // Aggressive caching for images
    res.set('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    
    // Add optimization hints
    if (ext === '.svg') {
      res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    }
    
    // Add Vary header for WebP support
    if (req.headers.accept && req.headers.accept.includes('image/webp')) {
      res.set('Vary', 'Accept');
    }
  }
  
  next();
};

/**
 * JSON file compression and caching
 */
const jsonFileOptimization = (staticPath) => {
  return async (req, res, next) => {
    if (!req.path.endsWith('.json')) {
      return next();
    }
    
    const filePath = path.join(staticPath, req.path);
    
    try {
      if (!existsSync(filePath)) {
        return next();
      }
      
      const stats = await fs.stat(filePath);
      const data = await fs.readFile(filePath, 'utf8');
      
      // Set headers
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
      
      const etag = `"json-${stats.mtime.getTime().toString(16)}"`;
      res.set('ETag', etag);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      // Minify JSON if not already minified
      let jsonData;
      try {
        const parsed = JSON.parse(data);
        jsonData = JSON.stringify(parsed); // Removes formatting
      } catch (e) {
        jsonData = data; // Use original if parsing fails
      }
      
      res.json(JSON.parse(jsonData));
      
    } catch (error) {
      console.error(`[JSON] Error serving ${filePath}:`, error);
      next();
    }
  };
};

/**
 * Batch static file pre-compression
 * Generates .gz and .br versions of compressible files
 */
const preCompressStaticFiles = async (staticPath, extensions = ['.js', '.css', '.html', '.json', '.xml', '.txt']) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[COMPRESSION] Skipping pre-compression in development`);
    return;
  }
  
  console.log(`[COMPRESSION] Pre-compressing static files in ${staticPath}`);
  
  const gzip = promisify(zlib.gzip);
  const brotliCompress = promisify(zlib.brotliCompress);
  
  try {
    const files = await findCompressibleFiles(staticPath, extensions);
    let compressed = 0;
    
    for (const file of files) {
      try {
        const data = await fs.readFile(file);
        
        // Skip small files (< 1KB)
        if (data.length < 1024) continue;
        
        // Generate gzip version
        const gzipData = await gzip(data, { level: 9 });
        await fs.writeFile(`${file}.gz`, gzipData);
        
        // Generate brotli version
        const brotliData = await brotliCompress(data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
          }
        });
        await fs.writeFile(`${file}.br`, brotliData);
        
        compressed++;
        
        if (compressed % 100 === 0) {
          console.log(`[COMPRESSION] Compressed ${compressed}/${files.length} files`);
        }
        
      } catch (error) {
        console.error(`[COMPRESSION] Error compressing ${file}:`, error.message);
      }
    }
    
    console.log(`[COMPRESSION] Pre-compression complete: ${compressed} files compressed`);
    
  } catch (error) {
    console.error(`[COMPRESSION] Pre-compression failed:`, error);
  }
};

/**
 * Find compressible files recursively
 */
async function findCompressibleFiles(dir, extensions, files = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await findCompressibleFiles(fullPath, extensions, files);
      } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return files;
}

/**
 * Get content type by file extension
 */
function getContentType(ext) {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Static file logging middleware
 */
const staticFileLogging = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const size = res.getHeader('Content-Length') || 0;
      const encoding = res.getHeader('Content-Encoding') || 'none';
      
      console.log(`[STATIC] ${req.method} ${req.path} - ${res.statusCode} - ${size} bytes (${encoding}) - ${duration}ms`);
    });
  }
  
  next();
};

module.exports = {
  preCompressedStatic,
  audioOptimization,
  imageOptimization,
  jsonFileOptimization,
  preCompressStaticFiles,
  staticFileLogging
};