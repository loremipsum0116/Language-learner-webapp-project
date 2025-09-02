"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkOptimization = exports.offlineSupportHeaders = exports.batchRequestHandler = exports.setCacheHeaders = exports.compressionOptimization = exports.validateMobileHeaders = exports.detectDevice = void 0;
const compression_1 = __importDefault(require("compression"));
const detectDevice = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const mobileAppHeader = req.headers['x-mobile-app'];
    const appVersion = req.headers['x-app-version'];
    const platform = req.headers['x-platform'];
    req.deviceInfo = {
        platform: platform || 'unknown',
        appVersion: appVersion || '1.0.0',
        userAgent: userAgent,
        lastLoginAt: new Date()
    };
    if (process.env.MOBILE_API_STRICT && !mobileAppHeader) {
        return res.status(403).json({
            success: false,
            error: 'Mobile app access required'
        });
    }
    next();
};
exports.detectDevice = detectDevice;
const validateMobileHeaders = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        return next();
    }
    const requiredHeaders = ['x-platform'];
    for (const header of requiredHeaders) {
        if (!req.headers[header]) {
            return res.status(400).json({
                success: false,
                error: `Missing required header: ${header}`
            });
        }
    }
    const supportedPlatforms = ['ios', 'android', 'unknown'];
    const platform = req.headers['x-platform'];
    if (platform && !supportedPlatforms.includes(platform)) {
        return res.status(400).json({
            success: false,
            error: `Unsupported platform: ${platform}`
        });
    }
    next();
};
exports.validateMobileHeaders = validateMobileHeaders;
exports.compressionOptimization = (0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression'])
            return false;
        if (res.getHeader('Content-Type')?.toString().includes('image/'))
            return false;
        if (res.getHeader('Content-Type')?.toString().includes('audio/'))
            return false;
        return compression_1.default.filter(req, res);
    }
});
const setCacheHeaders = (req, res, next) => {
    if (req.path.includes('/audio/') || req.path.includes('/image/')) {
        res.set('Cache-Control', 'public, max-age=86400');
    }
    else if (req.path.includes('/sync/') || req.path.includes('/learning/')) {
        res.set('Cache-Control', 'private, max-age=300');
    }
    res.set('ETag', `"mobile-${Date.now()}"`);
    next();
};
exports.setCacheHeaders = setCacheHeaders;
const batchRequestHandler = (req, res, next) => {
    if (req.path === '/batch' && req.method === 'POST') {
        const { requests } = req.body;
        if (!Array.isArray(requests)) {
            return res.status(400).json({
                success: false,
                error: 'Requests must be an array'
            });
        }
        if (requests.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 requests per batch'
            });
        }
        req.isBatchRequest = true;
        req.batchRequests = requests;
    }
    next();
};
exports.batchRequestHandler = batchRequestHandler;
const offlineSupportHeaders = (req, res, next) => {
    const offlineCacheableEndpoints = [
        '/learning/vocab',
        '/srs/cards',
        '/learning/categories',
        '/learning/levels'
    ];
    const isOfflineCacheable = offlineCacheableEndpoints.some(endpoint => req.path.includes(endpoint));
    if (isOfflineCacheable) {
        res.set('X-Offline-Cacheable', 'true');
        res.set('X-Cache-Strategy', 'cache-first');
    }
    next();
};
exports.offlineSupportHeaders = offlineSupportHeaders;
const networkOptimization = (req, res, next) => {
    const networkHint = req.headers['x-network-type'];
    if (networkHint) {
        req.networkType = networkHint;
        if (['slow-2g', '2g'].includes(networkHint)) {
            req.optimizeForSlowNetwork = true;
            res.set('X-Optimized-Response', 'true');
        }
    }
    next();
};
exports.networkOptimization = networkOptimization;
exports.default = {
    detectDevice: exports.detectDevice,
    validateMobileHeaders: exports.validateMobileHeaders,
    compressionOptimization: exports.compressionOptimization,
    setCacheHeaders: exports.setCacheHeaders,
    batchRequestHandler: exports.batchRequestHandler,
    offlineSupportHeaders: exports.offlineSupportHeaders,
    networkOptimization: exports.networkOptimization
};
