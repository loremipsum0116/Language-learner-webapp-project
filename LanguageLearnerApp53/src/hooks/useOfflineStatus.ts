// src/hooks/useOfflineStatus.ts
// 오프라인 상태 관리 훅

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineService } from '../services/OfflineService';

interface OfflineStatus {
  isOffline: boolean;
  isOnline: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  lastOnlineTime: string;
  pendingSyncItems: number;
}

export const useOfflineStatus = () => {
  const [status, setStatus] = useState<OfflineStatus>({
    isOffline: false,
    isOnline: true,
    connectionType: null,
    isInternetReachable: null,
    lastOnlineTime: new Date().toISOString(),
    pendingSyncItems: 0,
  });

  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Initial network state check
    NetInfo.fetch().then(state => {
      updateStatus(state);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      updateStatus(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateStatus = async (networkState: any) => {
    const isConnected = networkState.isConnected ?? false;
    const wasOffline = status.isOffline;
    
    // Get offline service state
    const offlineState = offlineService.getOfflineState();

    setStatus(prevStatus => ({
      ...prevStatus,
      isOffline: !isConnected,
      isOnline: isConnected,
      connectionType: networkState.type,
      isInternetReachable: networkState.isInternetReachable,
      lastOnlineTime: isConnected ? new Date().toISOString() : offlineState.lastOnlineTime,
      pendingSyncItems: offlineState.pendingSyncItems,
    }));

    // Handle connection state changes
    if (wasOffline && isConnected) {
      setIsConnecting(true);
      // Give some time for the connection to stabilize
      setTimeout(() => {
        setIsConnecting(false);
      }, 2000);
    }
  };

  const getConnectionQuality = (): 'excellent' | 'good' | 'poor' | 'offline' => {
    if (!status.isOnline) return 'offline';
    
    switch (status.connectionType) {
      case 'wifi':
        return 'excellent';
      case '4g':
      case '5g':
        return 'good';
      case '3g':
      case '2g':
        return 'poor';
      default:
        return 'good';
    }
  };

  const getStatusMessage = (): string => {
    if (isConnecting) return '연결 중...';
    if (!status.isOnline) return '오프라인 모드';
    if (status.isInternetReachable === false) return '인터넷 연결 불안정';
    return '온라인';
  };

  const getStatusColor = (): string => {
    if (isConnecting) return '#f59e0b'; // amber
    if (!status.isOnline) return '#ef4444'; // red
    if (status.isInternetReachable === false) return '#f59e0b'; // amber
    return '#10b981'; // green
  };

  return {
    ...status,
    isConnecting,
    connectionQuality: getConnectionQuality(),
    statusMessage: getStatusMessage(),
    statusColor: getStatusColor(),
    hasStableConnection: status.isOnline && status.isInternetReachable !== false,
  };
};

// Hook for offline-specific functionality
export const useOfflineCapabilities = () => {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeCapabilities = async () => {
      try {
        const offlineState = offlineService.getOfflineState();
        setCapabilities(offlineState.offlineCapabilities);
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing offline capabilities:', error);
      }
    };

    initializeCapabilities();
  }, []);

  const isFeatureAvailable = (feature: string): boolean => {
    return offlineService.isFeatureAvailable(feature);
  };

  const getAvailableFeatures = (): string[] => {
    return capabilities;
  };

  const getUnavailableMessage = (feature: string): string => {
    const messages: { [key: string]: string } = {
      'sync': '동기화는 온라인 상태에서만 가능합니다',
      'download': '콘텐츠 다운로드는 인터넷 연결이 필요합니다',
      'upload': '데이터 업로드는 온라인 상태에서만 가능합니다',
      'real_time': '실시간 기능은 인터넷 연결이 필요합니다',
      'social': '소셜 기능은 온라인 상태에서만 사용할 수 있습니다',
    };

    return messages[feature] || '이 기능은 현재 사용할 수 없습니다';
  };

  return {
    capabilities,
    isInitialized,
    isFeatureAvailable,
    getAvailableFeatures,
    getUnavailableMessage,
  };
};

// Hook for sync status
export const useSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: null as string | null,
    pendingChanges: 0,
    syncErrors: [] as string[],
  });

  const { isOnline } = useOfflineStatus();

  useEffect(() => {
    // Monitor sync status
    const updateSyncStatus = () => {
      // Get sync status from sync service
      // This would be implemented based on your sync service
      setSyncStatus(prevStatus => ({
        ...prevStatus,
        // Update based on actual sync service state
      }));
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const canSync = isOnline && !syncStatus.isSyncing;

  return {
    ...syncStatus,
    canSync,
    needsSync: syncStatus.pendingChanges > 0,
  };
};

export default useOfflineStatus;