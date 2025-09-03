import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../context/ThemeContext';
import {useNotifications} from '../hooks/useNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  key: string;
  topic?: string;
}

const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    id: '1',
    title: 'Daily Reminders',
    description: 'Get reminded to practice every day',
    key: '@notification_daily_reminder',
    topic: 'daily_reminders',
  },
  {
    id: '2',
    title: 'Lesson Updates',
    description: 'Notify when new lessons are available',
    key: '@notification_lesson_updates',
    topic: 'lesson_updates',
  },
  {
    id: '3',
    title: 'Achievement Alerts',
    description: 'Celebrate your learning milestones',
    key: '@notification_achievements',
    topic: 'achievements',
  },
  {
    id: '4',
    title: 'Practice Streaks',
    description: 'Keep your streak going with timely reminders',
    key: '@notification_streaks',
    topic: 'practice_streaks',
  },
  {
    id: '5',
    title: 'Weekly Progress',
    description: 'Get weekly summaries of your progress',
    key: '@notification_weekly_progress',
    topic: 'weekly_progress',
  },
];

export const NotificationSettingsScreen: React.FC = () => {
  const {colors} = useTheme();
  const {
    isPermissionGranted,
    requestPermission,
    subscribeToTopic,
    unsubscribeFromTopic,
  } = useNotifications();
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [masterSwitch, setMasterSwitch] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setMasterSwitch(isPermissionGranted);
  }, [isPermissionGranted]);

  const loadSettings = async () => {
    const loadedSettings: Record<string, boolean> = {};
    for (const setting of NOTIFICATION_SETTINGS) {
      const value = await AsyncStorage.getItem(setting.key);
      loadedSettings[setting.id] = value === 'true';
    }
    setSettings(loadedSettings);
  };

  const handleMasterSwitchToggle = async (value: boolean) => {
    if (value && !isPermissionGranted) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive alerts.',
        );
        return;
      }
    }
    setMasterSwitch(value);
    
    if (!value) {
      for (const setting of NOTIFICATION_SETTINGS) {
        await handleSettingToggle(setting.id, false);
      }
    }
  };

  const handleSettingToggle = async (id: string, value: boolean) => {
    if (!masterSwitch && value) {
      Alert.alert(
        'Enable Notifications',
        'Please enable notifications first to customize your preferences.',
      );
      return;
    }

    const setting = NOTIFICATION_SETTINGS.find(s => s.id === id);
    if (!setting) return;

    setSettings(prev => ({...prev, [id]: value}));
    await AsyncStorage.setItem(setting.key, value.toString());

    if (setting.topic) {
      if (value) {
        await subscribeToTopic(setting.topic);
      } else {
        await unsubscribeFromTopic(setting.topic);
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    masterControl: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.surface,
      marginVertical: 16,
      marginHorizontal: 16,
      borderRadius: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    masterControlText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingInfo: {
      flex: 1,
      marginRight: 12,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.secondaryText,
      lineHeight: 18,
    },
    infoSection: {
      backgroundColor: colors.primary + '10',
      padding: 16,
      marginHorizontal: 16,
      marginTop: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    disabledOverlay: {
      opacity: 0.5,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>
          Manage your notification preferences
        </Text>
      </View>

      <View style={styles.masterControl}>
        <Text style={styles.masterControlText}>Enable Notifications</Text>
        <Switch
          value={masterSwitch}
          onValueChange={handleMasterSwitchToggle}
          trackColor={{false: colors.border, true: colors.primary}}
          thumbColor={masterSwitch ? colors.onPrimary : '#f4f3f4'}
        />
      </View>

      <ScrollView style={styles.scrollContent}>
        {NOTIFICATION_SETTINGS.map(setting => (
          <View
            key={setting.id}
            style={[
              styles.settingItem,
              !masterSwitch && styles.disabledOverlay,
            ]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>{setting.title}</Text>
              <Text style={styles.settingDescription}>
                {setting.description}
              </Text>
            </View>
            <Switch
              value={settings[setting.id] || false}
              onValueChange={value => handleSettingToggle(setting.id, value)}
              disabled={!masterSwitch}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={
                settings[setting.id] ? colors.onPrimary : '#f4f3f4'
              }
            />
          </View>
        ))}

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            💡 Tip: Enable notifications to stay motivated and maintain your learning streak. 
            You can customize which types of notifications you receive above.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};