// routes/api/mobile/device.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../../../lib/prismaClient');
const refreshTokenService = require('../../../services/refreshTokenService');

// 디바이스 등록/업데이트
router.post('/register', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      deviceId,
      deviceName,
      platform, // 'ios', 'android'
      osVersion,
      appVersion,
      pushToken,
      deviceModel,
      screenSize,
      timezone
    } = req.body;

    if (!deviceId || !platform) {
      return res.status(400).json({
        error: 'Device ID and platform are required'
      });
    }

    // 기존 디바이스 확인/업데이트
    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId
      }
    });

    const deviceData = {
      userId,
      deviceId,
      deviceName: deviceName || `${platform} Device`,
      platform,
      osVersion: osVersion || 'Unknown',
      appVersion: appVersion || '1.0.0',
      pushToken,
      deviceModel: deviceModel || 'Unknown',
      screenSize: screenSize || 'Unknown',
      timezone: timezone || 'UTC',
      isActive: true,
      lastActiveAt: new Date()
    };

    let device;
    if (existingDevice) {
      device = await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: deviceData
      });
    } else {
      device = await prisma.userDevice.create({
        data: deviceData
      });
    }

    res.json({
      message: 'Device registered successfully',
      device: {
        id: device.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        registeredAt: device.createdAt,
        isActive: device.isActive
      }
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Register error:', error);
    res.status(500).json({
      error: 'Failed to register device'
    });
  }
});

// 사용자의 모든 디바이스 목록 조회
router.get('/list', async (req, res) => {
  try {
    const userId = req.user.id;

    const devices = await prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        osVersion: true,
        appVersion: true,
        deviceModel: true,
        isActive: true,
        createdAt: true,
        lastActiveAt: true,
        pushToken: true // 푸시 알림 상태 확인용
      }
    });

    const deviceList = devices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.deviceName,
      platform: device.platform,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
      model: device.deviceModel,
      isActive: device.isActive,
      registeredAt: device.createdAt,
      lastActiveAt: device.lastActiveAt,
      pushEnabled: !!device.pushToken,
      isCurrentDevice: device.deviceId === req.headers['x-device-id']
    }));

    res.json({
      devices: deviceList,
      total: deviceList.length,
      activeCount: deviceList.filter(d => d.isActive).length
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] List error:', error);
    res.status(500).json({
      error: 'Failed to get device list'
    });
  }
});

// 특정 디바이스 상세 정보 조회
router.get('/:deviceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    const device = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId
      },
      include: {
        _count: {
          select: {
            pushNotifications: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30일
                }
              }
            }
          }
        }
      }
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    res.json({
      id: device.id,
      deviceId: device.deviceId,
      name: device.deviceName,
      platform: device.platform,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
      model: device.deviceModel,
      screenSize: device.screenSize,
      timezone: device.timezone,
      isActive: device.isActive,
      pushEnabled: !!device.pushToken,
      registeredAt: device.createdAt,
      lastActiveAt: device.lastActiveAt,
      stats: {
        notificationsLast30Days: device._count.pushNotifications
      }
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Get device error:', error);
    res.status(500).json({
      error: 'Failed to get device info'
    });
  }
});

// 디바이스 설정 업데이트
router.put('/:deviceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const {
      deviceName,
      pushToken,
      pushEnabled,
      timezone,
      notificationSettings
    } = req.body;

    const device = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId
      }
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    const updateData = {
      lastActiveAt: new Date()
    };

    if (deviceName !== undefined) updateData.deviceName = deviceName;
    if (pushToken !== undefined) updateData.pushToken = pushToken;
    if (timezone !== undefined) updateData.timezone = timezone;
    
    // 푸시 알림 비활성화 시 토큰 제거
    if (pushEnabled === false) {
      updateData.pushToken = null;
    }

    // 알림 설정 저장
    if (notificationSettings) {
      updateData.notificationSettings = JSON.stringify(notificationSettings);
    }

    const updatedDevice = await prisma.userDevice.update({
      where: { id: device.id },
      data: updateData
    });

    res.json({
      message: 'Device updated successfully',
      device: {
        id: updatedDevice.id,
        deviceId: updatedDevice.deviceId,
        name: updatedDevice.deviceName,
        pushEnabled: !!updatedDevice.pushToken,
        timezone: updatedDevice.timezone
      }
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Update error:', error);
    res.status(500).json({
      error: 'Failed to update device'
    });
  }
});

// 디바이스 비활성화 (로그아웃과 유사)
router.post('/:deviceId/deactivate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    const device = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId
      }
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    // 디바이스 비활성화 및 푸시 토큰 제거
    await prisma.userDevice.update({
      where: { id: device.id },
      data: {
        isActive: false,
        pushToken: null,
        deactivatedAt: new Date()
      }
    });

    // 해당 디바이스의 리프레시 토큰들 무효화
    await refreshTokenService.revokeDeviceTokens(userId, deviceId);

    res.json({
      message: 'Device deactivated successfully'
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Deactivate error:', error);
    res.status(500).json({
      error: 'Failed to deactivate device'
    });
  }
});

// 디바이스 완전 삭제
router.delete('/:deviceId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;

    const device = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId
      }
    });

    if (!device) {
      return res.status(404).json({
        error: 'Device not found'
      });
    }

    // 관련 데이터 정리
    await Promise.all([
      // 디바이스 삭제
      prisma.userDevice.delete({
        where: { id: device.id }
      }),
      // 리프레시 토큰 무효화
      refreshTokenService.revokeDeviceTokens(userId, deviceId),
      // 관련 푸시 알림 기록 삭제 (선택사항)
      prisma.pushNotification.deleteMany({
        where: {
          userId,
          deviceId
        }
      })
    ]);

    res.json({
      message: 'Device deleted successfully'
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Delete error:', error);
    res.status(500).json({
      error: 'Failed to delete device'
    });
  }
});

// 푸시 알림 발송 (테스트용)
router.post('/:deviceId/test-push', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const { message = 'Test notification' } = req.body;

    const device = await prisma.userDevice.findFirst({
      where: {
        userId,
        deviceId,
        isActive: true
      }
    });

    if (!device || !device.pushToken) {
      return res.status(404).json({
        error: 'Device not found or push notifications not enabled'
      });
    }

    // 실제 푸시 알림 발송은 별도 서비스에서 구현
    // 여기서는 기록만 남김
    await prisma.pushNotification.create({
      data: {
        userId,
        deviceId,
        title: 'Test Notification',
        message,
        type: 'test',
        status: 'pending'
      }
    });

    res.json({
      message: 'Test notification queued',
      deviceName: device.deviceName
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Test push error:', error);
    res.status(500).json({
      error: 'Failed to send test notification'
    });
  }
});

// 푸시 알림 기록 조회
router.get('/:deviceId/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const notifications = await prisma.pushNotification.findMany({
      where: {
        userId,
        deviceId
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        status: true,
        createdAt: true,
        sentAt: true,
        readAt: true
      }
    });

    res.json({
      notifications: notifications.map(notif => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        status: notif.status,
        sentAt: notif.sentAt,
        readAt: notif.readAt,
        createdAt: notif.createdAt
      })),
      total: notifications.length,
      hasMore: notifications.length === parseInt(limit)
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Get notifications error:', error);
    res.status(500).json({
      error: 'Failed to get notifications'
    });
  }
});

// 푸시 알림 읽음 처리
router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    await prisma.pushNotification.updateMany({
      where: {
        id: parseInt(notificationId),
        userId
      },
      data: {
        readAt: new Date()
      }
    });

    res.json({
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('[MOBILE DEVICE] Mark read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read'
    });
  }
});

module.exports = router;