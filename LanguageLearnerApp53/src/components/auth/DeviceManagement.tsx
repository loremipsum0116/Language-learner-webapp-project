import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { DeviceSession } from '@/types';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

export const DeviceManagement: React.FC = () => {
  const colors = useColors();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.authAdvanced.getDevices();
      setDevices(response.data || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError('Failed to load device sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutDevice = (device: DeviceSession) => {
    Alert.alert(
      'Logout Device',
      `Are you sure you want to logout from ${device.deviceName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.authAdvanced.logoutDevice(device.id);
              loadDevices();
            } catch (err) {
              Alert.alert('Error', 'Failed to logout device');
            }
          }
        }
      ]
    );
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Logout All Devices',
      'This will logout from all devices except this one. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.authAdvanced.logoutAll();
              loadDevices();
            } catch (err) {
              Alert.alert('Error', 'Failed to logout all devices');
            }
          }
        }
      ]
    );
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'ios': return '📱';
      case 'android': return '🤖';
      case 'web': return '🌐';
      case 'windows': return '🪟';
      case 'macos': return '🍎';
      case 'linux': return '🐧';
      default: return '💻';
    }
  };

  const getLastActiveText = (lastActive: string) => {
    const now = new Date();
    const lastActiveDate = new Date(lastActive);
    const diffMs = now.getTime() - lastActiveDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Active now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderDevice = ({ item }: { item: DeviceSession }) => (
    <View style={[styles.deviceItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceInfo}>
          <Text style={styles.platformIcon}>{getPlatformIcon(item.platform)}</Text>
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, { color: colors.text }]}>{item.deviceName}</Text>
            <Text style={[styles.devicePlatform, { color: colors.textSecondary }]}>
              {item.platform} {item.osVersion}
            </Text>
            {item.appVersion && (
              <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
                App version: {item.appVersion}
              </Text>
            )}
          </View>
        </View>
        
        {item.isCurrentDevice && (
          <View style={[styles.currentBadge, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.currentText, { color: colors.success }]}>Current</Text>
          </View>
        )}
      </View>

      <View style={styles.deviceMeta}>
        <Text style={[styles.lastActive, { color: colors.textSecondary }]}>
          {getLastActiveText(item.lastActive)}
        </Text>
        {item.location && (
          <Text style={[styles.location, { color: colors.textSecondary }]}>
            📍 {item.location}
          </Text>
        )}
      </View>

      {!item.isCurrentDevice && (
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.error }]}
          onPress={() => handleLogoutDevice(item)}
        >
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Device Management</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage your active sessions across devices
        </Text>
      </View>

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
          style={styles.errorBanner}
        />
      )}

      {devices.filter(d => !d.isCurrentDevice).length > 0 && (
        <View style={styles.actionsContainer}>
          <Button
            title="Logout All Other Devices"
            onPress={handleLogoutAll}
            variant="danger"
            size="small"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading devices...
          </Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No active sessions found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  errorBanner: {
    margin: 16,
  },
  actionsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  deviceItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  platformIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  devicePlatform: {
    fontSize: 14,
    marginBottom: 2,
  },
  appVersion: {
    fontSize: 12,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deviceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lastActive: {
    fontSize: 12,
    fontWeight: '500',
  },
  location: {
    fontSize: 12,
  },
  logoutButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});