// routes/api/mobile/auth.ts
import express, { Request, Response } from 'express';
import authService from '../../../services/authService';
// import refreshTokenService from '../../../services/refreshTokenService';
import jwtService from '../../../services/jwtService';
import { DeviceInfo, LoginRequest, LoginResponse, RegisterRequest, UserWithoutPassword } from '@language-learner/core';

const router = express.Router();

interface MobileLoginRequest extends Request {
  body: LoginRequest;
}

interface MobileRegisterRequest extends Request {
  body: RegisterRequest;
}

interface RefreshTokenRequest extends Request {
  body: {
    refreshToken: string;
  };
}

// 모바일 앱 로그인
router.post('/login', async (req: MobileLoginRequest, res: Response): Promise<Response> => {
  try {
    const { email, password, deviceInfo } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // 사용자 인증
    const user = await authService.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // 모바일 디바이스 정보 수집
    const mobileDeviceInfo: DeviceInfo = {
      platform: (req.headers['x-platform'] as string) || 'unknown',
      appVersion: (req.headers['x-app-version'] as string) || '1.0.0',
      deviceModel: deviceInfo?.deviceModel || 'Unknown',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      userAgent: req.headers['user-agent'] || '',
      lastLoginAt: new Date()
    };

    // JWT 토큰 생성 (모바일용)
    const accessToken = jwtService.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // 리프레시 토큰 생성 (모바일용 - 더 긴 만료 시간)
    const refreshToken = await refreshTokenService.createRefreshToken(
      user.id,
      mobileDeviceInfo
    );

    // 사용자 정보 (민감 정보 제외)
    const userInfo: UserWithoutPassword = {
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

    const response: LoginResponse = {
      user: userInfo,
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: 900, // 15분
      refreshExpiresIn: 2592000, // 30일
      deviceRegistered: true
    };

    res.json(response);

  } catch (error) {
    console.error('[MOBILE AUTH] Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
});

// 모바일 앱 회원가입
router.post('/register', async (req: MobileRegisterRequest, res: Response) => {
  try {
    const { email, password, deviceInfo, preferences } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // 이메일 중복 검사
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    // 모바일 전용 기본 설정
    const mobilePreferences = {
      notifications: true,
      offlineSync: true,
      audioAutoDownload: false,
      dailyGoal: 20,
      reminderTime: '20:00',
      ...preferences
    };

    // 사용자 생성
    const newUser = await authService.createUser({
      email,
      password,
      preferences: mobilePreferences,
      registrationSource: 'mobile'
    });

    // 디바이스 정보
    const mobileDeviceInfo: DeviceInfo = {
      platform: (req.headers['x-platform'] as string) || 'unknown',
      appVersion: (req.headers['x-app-version'] as string) || '1.0.0',
      deviceModel: deviceInfo?.deviceModel || 'Unknown',
      osVersion: deviceInfo?.osVersion || 'Unknown',
      userAgent: req.headers['user-agent'] || '',
      registeredAt: new Date()
    };

    // 토큰 생성
    const accessToken = jwtService.generateAccessToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });
    const refreshToken = await refreshTokenService.createRefreshToken(
      newUser.id,
      mobileDeviceInfo
    );

    const response: LoginResponse = {
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

  } catch (error) {
    console.error('[MOBILE AUTH] Register error:', error);
    res.status(500).json({
      error: 'Registration failed'
    });
  }
});

// 모바일 토큰 갱신
router.post('/refresh', async (req: RefreshTokenRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required'
      });
    }

    // 리프레시 토큰 검증
    const tokenData = await refreshTokenService.validateRefreshToken(refreshToken);
    if (!tokenData) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }

    // 사용자 정보 조회
    const user = await authService.findUserById(tokenData.userId);
    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    // 새로운 액세스 토큰 생성
    const newAccessToken = jwtService.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // 디바이스 정보 업데이트
    await refreshTokenService.updateTokenUsage(refreshToken, {
      lastUsedAt: new Date(),
      platform: req.headers['x-platform'] as string,
      appVersion: req.headers['x-app-version'] as string
    });

    res.json({
      accessToken: newAccessToken,
      expiresIn: 900,
      tokenType: 'Bearer'
    });

  } catch (error) {
    console.error('[MOBILE AUTH] Refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

// 모바일 로그아웃
router.post('/logout', async (req: RefreshTokenRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await refreshTokenService.revokeRefreshToken(refreshToken);
    }

    res.json({
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[MOBILE AUTH] Logout error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

// 모든 디바이스에서 로그아웃
router.post('/logout-all', async (req: Request, res: Response) => {
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

  } catch (error) {
    console.error('[MOBILE AUTH] Logout all error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

// 현재 사용자 정보 조회 (모바일 최적화)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const user = await authService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // 모바일용 사용자 정보 (간소화)
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

  } catch (error) {
    console.error('[MOBILE AUTH] Me error:', error);
    res.status(500).json({
      error: 'Failed to get user info'
    });
  }
});

// 활성 디바이스 목록 조회
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const devices = await refreshTokenService.getUserDevices(userId);
    
    const deviceList = devices.map((device: any) => ({
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

  } catch (error) {
    console.error('[MOBILE AUTH] Devices error:', error);
    res.status(500).json({
      error: 'Failed to get devices'
    });
  }
});

// 특정 디바이스 로그아웃
router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
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

  } catch (error) {
    console.error('[MOBILE AUTH] Device logout error:', error);
    res.status(500).json({
      error: 'Failed to logout device'
    });
  }
});

export default router;