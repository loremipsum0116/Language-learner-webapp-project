"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const compression_1 = require("./middleware/compression");
const staticCompression_1 = require("./middleware/staticCompression");
const auth_1 = __importDefault(require("./routes/auth"));
const learn_1 = __importDefault(require("./routes/learn"));
const vocab_1 = __importDefault(require("./routes/vocab"));
const quiz_1 = __importDefault(require("./routes/quiz"));
const srs_1 = __importDefault(require("./routes/srs"));
const user_1 = __importDefault(require("./routes/user"));
const reading_1 = __importDefault(require("./routes/reading"));
const categories_1 = __importDefault(require("./routes/categories"));
const my_wordbook_1 = __importDefault(require("./routes/my-wordbook"));
const my_idioms_1 = __importDefault(require("./routes/my-idioms"));
const odat_note_1 = __importDefault(require("./routes/odat-note"));
const dict_1 = __importDefault(require("./routes/dict"));
const examVocab_1 = __importDefault(require("./routes/examVocab"));
const autoFolder_1 = __importDefault(require("./routes/autoFolder"));
const srs_flat_extensions_1 = __importDefault(require("./routes/srs-flat-extensions"));
const srs_dashboard_override_1 = __importDefault(require("./routes/srs-dashboard-override"));
const timeMachine_1 = require("./routes/timeMachine");
const admin_1 = __importDefault(require("./routes/admin"));
const auth_2 = __importDefault(require("./middleware/auth"));
const apiVersion_1 = require("./middleware/apiVersion");
const v1_1 = __importDefault(require("./routes/api/v1"));
const mobile_1 = __importDefault(require("./routes/api/mobile"));
const app = (0, express_1.default)();
console.log('[STARTUP] Express app created, setting up routes...');
app.get('/static-test', (req, res) => {
    res.json({ message: 'Static routing works', timestamp: new Date().toISOString() });
});
app.use('/starter', (req, res, next) => {
    console.log('[STATIC] starter audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'starter')));
app.use('/elementary', (req, res, next) => {
    console.log('[STATIC] elementary audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'elementary')));
app.use('/intermediate', (req, res, next) => {
    console.log('[STATIC] intermediate audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'intermediate')));
app.use('/upper', (req, res, next) => {
    console.log('[STATIC] upper audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'upper')));
app.use('/advanced', (req, res, next) => {
    console.log('[STATIC] advanced audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'advanced')));
console.log('Setting up A1 audio:', path_1.default.join(__dirname, 'A1', 'audio'));
console.log('Setting up A2 audio:', path_1.default.join(__dirname, 'A2', 'audio'));
console.log('Setting up B1 audio:', path_1.default.join(__dirname, 'B1', 'audio'));
console.log('Setting up B2 audio:', path_1.default.join(__dirname, 'B2', 'audio'));
console.log('Setting up C1 audio:', path_1.default.join(__dirname, 'C1', 'audio'));
console.log('Setting up C2 audio:', path_1.default.join(__dirname, 'C2', 'audio'));
app.use('/A1/audio', (req, res, next) => {
    console.log('[STATIC] A1 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'A1', 'audio')));
app.use('/A2/audio', (req, res, next) => {
    console.log('[STATIC] A2 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'A2', 'audio')));
app.use('/B1/audio', (req, res, next) => {
    console.log('[STATIC] B1 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'B1', 'audio')));
app.use('/B2/audio', (req, res, next) => {
    console.log('[STATIC] B2 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'B2', 'audio')));
app.use('/C1/audio', (req, res, next) => {
    console.log('[STATIC] C1 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'C1', 'audio')));
app.use('/C2/audio', (req, res, next) => {
    console.log('[STATIC] C2 audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'C2', 'audio')));
app.use('/phrasal_verb', (req, res, next) => {
    console.log('[STATIC] phrasal_verb audio request:', req.path);
    next();
}, staticCompression_1.staticFileLogging, staticCompression_1.audioOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'phrasal_verb')));
app.use('/api/video', staticCompression_1.staticFileLogging, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'out')));
app.use(compression_1.advancedCompression);
app.use(compression_1.contentTypeOptimization);
app.use(compression_1.responseSizeMonitoring);
app.use(compression_1.brotliCompression);
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use('/public', staticCompression_1.staticFileLogging, staticCompression_1.imageOptimization, (0, staticCompression_1.preCompressedStatic)(path_1.default.join(__dirname, 'public')));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(compression_1.apiResponseOptimization);
app.use(compression_1.apiCacheOptimization);
app.use(apiVersion_1.detectApiVersion);
app.use((0, apiVersion_1.validateApiVersion)([1]));
app.use(apiVersion_1.deprecationWarning);
app.use(apiVersion_1.formatApiResponse);
app.use('/api/v1', v1_1.default);
app.use('/auth', auth_1.default);
app.use('/time-accelerator', require('./routes/timeAccelerator').router);
app.use('/dict', dict_1.default);
app.use('/exam-vocab', examVocab_1.default);
app.use('/api/reading', reading_1.default);
app.use('/api/listening', require('./routes/listening'));
app.use('/api/idiom', require('./routes/idiom_working'));
app.use('/api/mobile', mobile_1.default);
app.get('/docs/api', (0, apiVersion_1.generateApiDocs)([1]));
app.use((req, res, next) => {
    if (req.path.startsWith('/api/mobile')) {
        return next();
    }
    const publicRoutes = [
        '/auth', '/dict', '/exam-vocab', '/api/reading', '/api/listening',
        '/api/idiom', '/time-accelerator', '/docs', '/static-test',
        '/api/v1', '/api/video'
    ];
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    if (isPublicRoute) {
        return next();
    }
    return (0, auth_2.default)(req, res, next);
});
app.use('/learn', learn_1.default);
app.use('/vocab', vocab_1.default);
app.use('/quiz', quiz_1.default);
app.use('/srs', srs_1.default);
app.use('/categories', categories_1.default);
app.use('/my-wordbook', my_wordbook_1.default);
app.use('/my-idioms', my_idioms_1.default);
app.use('/odat-note', odat_note_1.default);
app.use('/time-machine', timeMachine_1.router);
app.use('/admin', admin_1.default);
app.use('/auto-folder', autoFolder_1.default);
app.use('/', user_1.default);
app.use('/srs-flat-ext', srs_flat_extensions_1.default);
app.use('/srs-dashboard-override', srs_dashboard_override_1.default);
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        data: null,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
        meta: {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        }
    });
});
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
    const isDevelopment = process.env.NODE_ENV !== 'production';
    res.status(500).json({
        data: null,
        error: isDevelopment ? err.message : 'Internal server error',
        meta: {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            ...(isDevelopment && { stack: err.stack })
        }
    });
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS Origins: ${process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001'}`);
});
exports.default = app;
