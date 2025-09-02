"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authService_1 = __importDefault(require("../../../services/authService"));
const jwtService_1 = __importDefault(require("../../../services/jwtService"));
const router = express_1.default.Router();
router.post('/login', async (req, res) => {
    try {
        const { email, password, deviceInfo } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
        const user = await authService_1.default.authenticateUser(email, password);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }
        const mobileDeviceInfo = {
            platform: req.headers['x-platform'] || 'unknown',
            appVersion: req.headers['x-app-version'] || '1.0.0',
            deviceModel: deviceInfo?.deviceModel || 'Unknown',
            osVersion: deviceInfo?.osVersion || 'Unknown',
            userAgent: req.headers['user-agent'] || '',
            lastLoginAt: new Date()
        };
        const accessToken = jwtService_1.default.generateAccessToken({
            id: user.id,
            email: user.email,
            role: user.role
        });
        const refreshToken = await refreshTokenService.createRefreshToken(user.id, mobileDeviceInfo);
        const userInfo = {
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            lastLoginAt: new Date(),
            preferences: user.preferences || {},
            totalWords: user.totalWords,
            studyStreak: user.studyStreak,
            lastStudyDate: user.lastStudyDate,
            level: user.level,
            subscriptionType: user.subscriptionType,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            registrationSource: user.registrationSource
        };
        const response = {
            user: userInfo,
            accessToken,
            refreshToken: refreshToken.token,
            expiresIn: 900,
            refreshExpiresIn: 2592000,
            deviceRegistered: true
        };
        res.json(response);
    }
    catch (error) {
        console.error('[MOBILE AUTH] Login error:', error);
        res.status(500).json({
            error: 'Login failed'
        });
    }
});
router.post('/register', async (req, res) => {
    try {
        const { email, password, deviceInfo, preferences } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }
        const existingUser = await authService_1.default.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                error: 'Email already registered'
            });
        }
        const mobilePreferences = {
            notifications: true,
            offlineSync: true,
            audioAutoDownload: false,
            dailyGoal: 20,
            reminderTime: '20:00',
            ...preferences
        };
        const newUser = await authService_1.default.createUser({
            email,
            password,
            preferences: mobilePreferences,
            registrationSource: 'mobile'
        });
        const mobileDeviceInfo = {
            platform: req.headers['x-platform'] || 'unknown',
            appVersion: req.headers['x-app-version'] || '1.0.0',
            deviceModel: deviceInfo?.deviceModel || 'Unknown',
            osVersion: deviceInfo?.osVersion || 'Unknown',
            userAgent: req.headers['user-agent'] || '',
            registeredAt: new Date()
        };
        const accessToken = jwtService_1.default.generateAccessToken({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role
        });
        const refreshToken = await refreshTokenService.createRefreshToken(newUser.id, mobileDeviceInfo);
        const response = {
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt,
                preferences: mobilePreferences,
                registrationSource: 'mobile'
            },
            accessToken,
            refreshToken: refreshToken.token,
            expiresIn: 900,
            refreshExpiresIn: 2592000
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('[MOBILE AUTH] Register error:', error);
        res.status(500).json({
            error: 'Registration failed'
        });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token is required'
            });
        }
        const tokenData = await refreshTokenService.validateRefreshToken(refreshToken);
        if (!tokenData) {
            return res.status(401).json({
                error: 'Invalid or expired refresh token'
            });
        }
        const user = await authService_1.default.findUserById(tokenData.userId);
        if (!user) {
            return res.status(401).json({
                error: 'User not found'
            });
        }
        const newAccessToken = jwtService_1.default.generateAccessToken({
            id: user.id,
            email: user.email,
            role: user.role
        });
        await refreshTokenService.updateTokenUsage(refreshToken, {
            lastUsedAt: new Date(),
            platform: req.headers['x-platform'],
            appVersion: req.headers['x-app-version']
        });
        res.json({
            accessToken: newAccessToken,
            expiresIn: 900,
            tokenType: 'Bearer'
        });
    }
    catch (error) {
        console.error('[MOBILE AUTH] Refresh error:', error);
        res.status(500).json({
            error: 'Token refresh failed'
        });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            await refreshTokenService.revokeRefreshToken(refreshToken);
        }
        res.json({
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('[MOBILE AUTH] Logout error:', error);
        res.status(500).json({
            error: 'Logout failed'
        });
    }
});
router.post('/logout-all', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        await refreshTokenService.revokeAllUserTokens(userId);
        res.json({
            message: 'Logged out from all devices'
        });
    }
    catch (error) {
        console.error('[MOBILE AUTH] Logout all error:', error);
        res.status(500).json({
            error: 'Logout failed'
        });
    }
});
router.get('/me', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        const user = await authService_1.default.findUserById(userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }
        const mobileUserInfo = {
            id: user.id,
            email: user.email,
            role: user.role,
            preferences: user.preferences || {},
            stats: {
                totalWords: user.totalWords || 0,
                studyStreak: user.studyStreak || 0,
                lastStudyDate: user.lastStudyDate,
                level: user.level || 'Beginner'
            },
            subscription: {
                type: user.subscriptionType || 'free',
                expiresAt: user.subscriptionExpiresAt
            }
        };
        res.json(mobileUserInfo);
    }
    catch (error) {
        console.error('[MOBILE AUTH] Me error:', error);
        res.status(500).json({
            error: 'Failed to get user info'
        });
    }
});
router.get('/devices', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        const devices = await refreshTokenService.getUserDevices(userId);
        const deviceList = devices.map((device) => ({
            id: device.id,
            platform: device.platform,
            deviceModel: device.deviceModel,
            lastUsedAt: device.lastUsedAt,
            createdAt: device.createdAt,
            isCurrentDevice: device.token === req.headers['authorization']?.replace('Bearer ', '')
        }));
        res.json({
            devices: deviceList,
            total: deviceList.length
        });
    }
    catch (error) {
        console.error('[MOBILE AUTH] Devices error:', error);
        res.status(500).json({
            error: 'Failed to get devices'
        });
    }
});
router.delete('/devices/:deviceId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { deviceId } = req.params;
        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        await refreshTokenService.revokeDeviceToken(userId, deviceId);
        res.json({
            message: 'Device logged out successfully'
        });
    }
    catch (error) {
        console.error('[MOBILE AUTH] Device logout error:', error);
        res.status(500).json({
            error: 'Failed to logout device'
        });
    }
});
exports.default = router;
