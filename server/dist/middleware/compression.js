"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brotliCompression = exports.apiCacheOptimization = exports.responseSizeMonitoring = exports.contentTypeOptimization = exports.apiResponseOptimization = exports.advancedCompression = void 0;
const compression_1 = __importDefault(require("compression"));
const zlib_1 = __importDefault(require("zlib"));
const advancedCompression = (0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression'])
            return false;
        const contentType = res.getHeader('Content-Type');
        if (!contentType)
            return true;
        const skipTypes = [
            'image/', 'video/', 'audio/',
            'application/pdf', 'application/zip',
            'application/gzip', 'application/x-rar'
        ];
        if (skipTypes.some(type => contentType.includes(type))) {
            return false;
        }
        const compressTypes = [
            'text/', 'application/json', 'application/javascript',
            'application/xml', 'application/rss+xml',
            'application/atom+xml', 'application/soap+xml'
        ];
        return compressTypes.some(type => contentType.includes(type)) ||
            compression_1.default.filter(req, res);
    },
    strategy: (req, res) => {
        const contentLength = res.getHeader('Content-Length');
        if (contentLength && parseInt(contentLength) > 50000) {
            return zlib_1.default.constants.Z_DEFAULT_STRATEGY;
        }
        else {
            return zlib_1.default.constants.Z_FILTERED;
        }
    }
});
exports.advancedCompression = advancedCompression;
const apiResponseOptimization = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        if (!req.path.startsWith('/api/')) {
            return originalJson(data);
        }
        const networkType = req.headers['x-network-type'];
        const optimizeForSlowNetwork = ['slow-2g', '2g', '3g'].includes(networkType);
        const isMobile = req.path.startsWith('/api/mobile/') ||
            !!req.headers['x-platform'] ||
            req.deviceInfo?.isMobile;
        let optimizedData = data;
        if (optimizeForSlowNetwork || isMobile) {
            optimizedData = optimizeApiResponse(data, {
                removeNulls: true,
                truncateStrings: optimizeForSlowNetwork,
                limitArrays: optimizeForSlowNetwork,
                removeDebugInfo: true
            });
        }
        if (optimizedData !== data) {
            res.set('X-Response-Optimized', 'true');
            res.set('X-Optimization-Level', optimizeForSlowNetwork ? 'aggressive' : 'standard');
        }
        return originalJson(optimizedData);
    };
    next();
};
exports.apiResponseOptimization = apiResponseOptimization;
function optimizeApiResponse(data, options = {}) {
    const { removeNulls = false, truncateStrings = false, limitArrays = false, removeDebugInfo = false } = options;
    if (!data || typeof data !== 'object') {
        return data;
    }
    const optimized = JSON.parse(JSON.stringify(data));
    return optimizeObject(optimized, options);
}
function optimizeObject(obj, options) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        if (options.limitArrays && obj.length > 20) {
            obj = obj.slice(0, 20);
        }
        return obj.map(item => optimizeObject(item, options));
    }
    const optimized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (options.removeNulls && (value === null || value === undefined)) {
            continue;
        }
        if (options.removeDebugInfo &&
            ['__debug', '_meta', 'debugInfo', 'trace', 'stack'].includes(key)) {
            continue;
        }
        if (options.truncateStrings && typeof value === 'string' && value.length > 200) {
            optimized[key] = value.substring(0, 197) + '...';
        }
        else if (typeof value === 'object') {
            optimized[key] = optimizeObject(value, options);
        }
        else {
            optimized[key] = value;
        }
    }
    return optimized;
}
const contentTypeOptimization = (req, res, next) => {
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function (name, value) {
        if (name.toLowerCase() === 'content-type') {
            if (typeof value === 'string' && value.startsWith('text/') && !value.includes('charset')) {
                value = `${value}; charset=utf-8`;
            }
            if (typeof value === 'string' && value.includes('application/json')) {
                res.set('X-Content-Optimized', 'json');
                res.set('Vary', 'Accept-Encoding, X-Network-Type');
            }
        }
        return originalSetHeader(name, value);
    };
    next();
};
exports.contentTypeOptimization = contentTypeOptimization;
const responseSizeMonitoring = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return next();
    }
    const originalEnd = res.end.bind(res);
    const startTime = Date.now();
    res.end = function (chunk, encoding) {
        const responseTime = Date.now() - startTime;
        const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;
        if (responseSize > 100000) {
            console.warn(`[COMPRESSION] Large response detected: ${req.method} ${req.path} - ${(responseSize / 1024).toFixed(2)}KB in ${responseTime}ms`);
        }
        res.set('X-Response-Size', responseSize.toString());
        res.set('X-Response-Time', `${responseTime}ms`);
        return originalEnd(chunk, encoding);
    };
    next();
};
exports.responseSizeMonitoring = responseSizeMonitoring;
const apiCacheOptimization = (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }
    if (req.path.startsWith('/api/')) {
        const isPublicEndpoint = [
            '/api/v1/dict',
            '/api/v1/exam-vocab',
            '/api/v1/reading',
            '/api/mobile/app-info'
        ].some(endpoint => req.path.startsWith(endpoint));
        if (isPublicEndpoint) {
            res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
            res.set('Vary', 'Accept-Encoding, Accept-Language');
        }
        else {
            res.set('Cache-Control', 'private, max-age=300');
        }
        res.set('ETag', `"api-${Date.now().toString(36)}"`);
    }
    next();
};
exports.apiCacheOptimization = apiCacheOptimization;
const brotliCompression = (req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (acceptEncoding.includes('br') &&
        req.headers['user-agent'] &&
        !req.headers['user-agent'].includes('curl')) {
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            res.set('Content-Encoding', 'br');
            return originalJson(data);
        };
    }
    next();
};
exports.brotliCompression = brotliCompression;
