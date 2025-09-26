// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs'); // Using bcryptjs instead of bcrypt
const { prisma } = require('../lib/prismaClient');
const { ok, fail } = require('../lib/resp'); // 응답 헬퍼 사용
const jwtService = require('../services/jwtService');
const refreshTokenService = require('../services/refreshTokenService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, 'Email and password are required');

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return fail(res, 409, 'User with this email already exists');

        const passwordHash = await bcrypt.hash(password, 10);
        const userRole = email === 'super@root.com' ? 'admin' : 'USER';
        const isApproved = email === 'super@root.com'; // super@root.com은 자동 승인
        const approvedAt = isApproved ? new Date() : null;
        const approvedBy = isApproved ? 'system' : null;

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                role: userRole,
                isApproved,
                approvedAt,
                approvedBy
            }
        });

        const { passwordHash: _, ...userSafe } = user;

        // 승인된 사용자만 토큰 발급
        if (isApproved) {
            // Generate token pair with device info
            const deviceInfo = jwtService.getDeviceInfo(req);
            const tokens = await jwtService.generateTokenPair(user, deviceInfo);

            // Set cookies
            jwtService.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

            return ok(res, {
                user: userSafe,
                accessToken: tokens.accessToken,
                refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
                message: 'Registration successful and approved'
            });
        } else {
            return ok(res, {
                user: userSafe,
                message: '가입신청 해주셔서 감사드립니다! 운영자가 확인 후 빠른 시일내에 승인 해드리겠습니다. 단무새와 함께 단어를 정복하세요!',
                requiresApproval: true
            });
        }
    } catch (e) {
        console.error('POST /auth/register failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

router.post('/login', async (req, res) => {
    console.log('[LOGIN DEBUG] Received login request');
    console.log('[LOGIN DEBUG] Request body:', req.body);
    console.log('[LOGIN DEBUG] Request headers:', req.headers);

    const { email, password } = req.body;
    if (!email || !password) {
        console.log('[LOGIN DEBUG] Missing email or password');
        return fail(res, 400, 'email and password required');
    }

    console.log('[LOGIN DEBUG] Email:', email);
    console.log('[LOGIN DEBUG] Password length:', password?.length);

    try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        console.log('[LOGIN DEBUG] User found:', !!user);
        console.log('[LOGIN DEBUG] User details:', user ? { id: user.id, email: user.email, role: user.role } : null);

        if (!user) {
            console.log('[LOGIN DEBUG] User not found');
            return fail(res, 401, 'invalid credentials');
        }

        const okPw = await bcrypt.compare(password, user.passwordHash);
        console.log('[LOGIN DEBUG] Password comparison result:', okPw);
        console.log('[LOGIN DEBUG] Stored hash (first 20 chars):', user.passwordHash?.substring(0, 20));

        if (!okPw) {
            console.log('[LOGIN DEBUG] Password comparison failed');
            return fail(res, 401, 'invalid credentials');
        }

        // 승인된 사용자만 로그인 허용
        if (!user.isApproved) {
            console.log('[LOGIN DEBUG] User not approved');
            return res.status(200).json({
                success: false,
                pending: true,
                message: '가입신청 해주셔서 감사드립니다! 운영자가 확인 후 빠른 시일내에 승인 해드리겠습니다. 단무새와 함께 단어를 정복하세요!',
                type: 'ACCOUNT_PENDING'
            });
        }

        // Generate token pair with device info
        const deviceInfo = jwtService.getDeviceInfo(req);
        const tokens = await jwtService.generateTokenPair(user, deviceInfo);
        
        // Set cookies
        jwtService.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

        const { passwordHash: _, ...userSafe } = user;
        return ok(res, { 
            user: userSafe,
            accessToken: tokens.accessToken,
            refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
        });
    } catch (e) {
        console.error('POST /auth/login failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// Logout (revoke refresh token)
router.post('/logout', async (req, res) => {
    try {
        const refreshToken = jwtService.extractToken(req, 'refresh');
        if (refreshToken) {
            await refreshTokenService.revokeRefreshToken(refreshToken);
        }
        
        // Clear cookies
        jwtService.clearAuthCookies(res);
        return ok(res, { message: 'Logged out successfully' });
    } catch (e) {
        console.error('POST /auth/logout failed:', e);
        // Still clear cookies even if token revocation fails
        jwtService.clearAuthCookies(res);
        return ok(res, { message: 'Logged out successfully' });
    }
});

// Logout from all devices
router.post('/logout-all', authMiddleware, async (req, res) => {
    try {
        await refreshTokenService.revokeAllUserTokens(req.user.id);
        jwtService.clearAuthCookies(res);
        return ok(res, { message: 'Logged out from all devices successfully' });
    } catch (e) {
        console.error('POST /auth/logout-all failed:', e);
        return fail(res, 500, 'Failed to logout from all devices');
    }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = jwtService.extractToken(req, 'refresh');
        if (!refreshToken) {
            return fail(res, 401, 'Refresh token not provided');
        }

        // Validate refresh token
        const tokenData = await refreshTokenService.validateRefreshToken(refreshToken);
        
        // Generate new access token
        const newAccessToken = jwtService.generateAccessToken({
            id: tokenData.user.id,
            email: tokenData.user.email,
            role: tokenData.user.role
        });

        // Set new access token cookie
        jwtService.setAuthCookies(res, newAccessToken, refreshToken);

        return ok(res, {
            user: tokenData.user,
            accessToken: newAccessToken
        });
    } catch (e) {
        console.error('POST /auth/refresh failed:', e);
        jwtService.clearAuthCookies(res);
        return fail(res, 401, e.message || 'Invalid refresh token');
    }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                role: true,
                profile: true,
                createdAt: true,
                lastStudiedAt: true,
                streak: true,
                isApproved: true,
                approvedAt: true,
                approvedBy: true
            }
        });

        if (!user) {
            return fail(res, 404, 'User not found');
        }

        return ok(res, { user });
    } catch (e) {
        console.error('GET /auth/me failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// Get active devices/sessions
router.get('/devices', authMiddleware, async (req, res) => {
    try {
        const devices = await refreshTokenService.getUserActiveTokens(req.user.id);
        return ok(res, { devices });
    } catch (e) {
        console.error('GET /auth/devices failed:', e);
        return fail(res, 500, 'Failed to get device list');
    }
});

// Revoke a specific device/session
router.delete('/devices/:deviceId', authMiddleware, async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Find and revoke the refresh token for this device
        const refreshToken = await prisma.refreshToken.findFirst({
            where: {
                userId: req.user.id,
                deviceId: deviceId,
                isRevoked: false
            }
        });

        if (!refreshToken) {
            return fail(res, 404, 'Device session not found');
        }

        await refreshTokenService.revokeRefreshToken(refreshToken.token);
        return ok(res, { message: 'Device session revoked successfully' });
    } catch (e) {
        console.error('DELETE /auth/devices/:deviceId failed:', e);
        return fail(res, 500, 'Failed to revoke device session');
    }
});

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return fail(res, 403, 'Admin access required');
    }
    next();
};

// Get pending user approvals (admin only)
router.get('/admin/pending-users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const pendingUsers = await prisma.user.findMany({
            where: {
                isApproved: false
            },
            select: {
                id: true,
                email: true,
                createdAt: true,
                role: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return ok(res, { users: pendingUsers });
    } catch (e) {
        console.error('GET /auth/admin/pending-users failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// Approve user (admin only)
router.post('/admin/approve-user/:userId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const adminEmail = req.user.email;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return fail(res, 404, 'User not found');
        }

        if (user.isApproved) {
            return fail(res, 400, 'User is already approved');
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: {
                isApproved: true,
                approvedAt: new Date(),
                approvedBy: adminEmail
            },
            select: {
                id: true,
                email: true,
                isApproved: true,
                approvedAt: true,
                approvedBy: true
            }
        });

        return ok(res, {
            user: updatedUser,
            message: `User ${user.email} has been approved`
        });
    } catch (e) {
        console.error('POST /auth/admin/approve-user failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// Reject user (admin only)
router.post('/admin/reject-user/:userId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return fail(res, 404, 'User not found');
        }

        if (user.isApproved) {
            return fail(res, 400, 'Cannot reject an approved user');
        }

        // Delete the user instead of keeping rejected users
        await prisma.user.delete({
            where: { id: parseInt(userId) }
        });

        return ok(res, {
            message: `User ${user.email} has been rejected and removed`
        });
    } catch (e) {
        console.error('POST /auth/admin/reject-user failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

// Get all users (admin only)
router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
                isApproved: true,
                approvedAt: true,
                approvedBy: true,
                lastStudiedAt: true,
                streak: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return ok(res, { users });
    } catch (e) {
        console.error('GET /auth/admin/users failed:', e);
        return fail(res, 500, 'Internal Server Error');
    }
});

module.exports = router;