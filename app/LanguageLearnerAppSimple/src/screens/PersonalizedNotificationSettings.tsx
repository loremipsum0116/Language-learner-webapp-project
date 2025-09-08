import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useTheme} from '../context/ThemeContext';
import NotificationScheduler from '../services/NotificationScheduler';
import {
  NotificationPreferences,
  NotificationType,
} from '../types/notifications';

export const PersonalizedNotificationSettings: React.FC = () => {
  const {colors} = useTheme();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    optimalLearningTime: '19:00',
    dailyReminderTime: '09:00',
    weeklyProgressDay: 0,
    streakReminder: true,
    srsReminder: true,
    achievementAlerts: true,
    newContentAlerts: true,
    encouragementMessages: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  const [showOptimalTimePicker, setShowOptimalTimePicker] = useState(false);
  const [showDailyTimePicker, setShowDailyTimePicker] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const loadedPrefs = NotificationScheduler.getPreferences();
    setPreferences(loadedPrefs);
  };

  const updatePreference = async (
    key: keyof NotificationPreferences,
    value: any
  ) => {
    const newPreferences = {...preferences, [key]: value};
    setPreferences(newPreferences);
    await NotificationScheduler.updatePreferences(newPreferences);
  };

  const handleTimeChange = (
    event: any,
    selectedDate: Date | undefined,
    type: 'optimal' | 'daily'
  ) => {
    if (type === 'optimal') {
      setShowOptimalTimePicker(false);
    } else {
      setShowDailyTimePicker(false);
    }

    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      if (type === 'optimal') {
        updatePreference('optimalLearningTime', timeString);
      } else {
        updatePreference('dailyReminderTime', timeString);
      }
    }
  };

  const testNotification = async (type: NotificationType) => {
    try {
      await NotificationScheduler.triggerTestNotification(type);
      Alert.alert('Test Sent', 'Check your notifications!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const weekDays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

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
    section: {
      marginVertical: 20,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    settingDescription: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 4,
    },
    timeButton: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    timeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    daySelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    dayButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
      marginBottom: 8,
    },
    dayButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayButtonText: {
      fontSize: 12,
      color: colors.text,
    },
    dayButtonTextSelected: {
      color: colors.onPrimary,
    },
    testSection: {
      backgroundColor: colors.warning + '10',
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: colors.warning + '30',
    },
    testTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    testButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    testButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginRight: 8,
      marginBottom: 8,
    },
    testButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Personalized Notifications</Text>
          <Text style={styles.headerSubtitle}>
            Customize your learning reminders
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Reminders</Text>
          
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{flex: 1}}>
                <Text style={styles.settingLabel}>Optimal Learning Time</Text>
                <Text style={styles.settingDescription}>
                  Get reminded at your most productive time
                </Text>
              </View>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowOptimalTimePicker(true)}>
                <Text style={styles.timeButtonText}>
                  {preferences.optimalLearningTime || '19:00'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={{flex: 1}}>
                <Text style={styles.settingLabel}>Daily Reminder</Text>
                <Text style={styles.settingDescription}>
                  Regular daily study reminder
                </Text>
              </View>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowDailyTimePicker(true)}>
                <Text style={styles.timeButtonText}>
                  {preferences.dailyReminderTime || '09:00'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Streak Reminders</Text>
              <Switch
                value={preferences.streakReminder}
                onValueChange={value => updatePreference('streakReminder', value)}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={preferences.streakReminder ? colors.onPrimary : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Encouragement Messages</Text>
              <Switch
                value={preferences.encouragementMessages}
                onValueChange={value =>
                  updatePreference('encouragementMessages', value)
                }
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={
                  preferences.encouragementMessages ? colors.onPrimary : '#f4f3f4'
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SRS & Progress</Text>
          
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{flex: 1}}>
                <Text style={styles.settingLabel}>SRS Review Reminders</Text>
                <Text style={styles.settingDescription}>
                  Get notified when reviews are due
                </Text>
              </View>
              <Switch
                value={preferences.srsReminder}
                onValueChange={value => updatePreference('srsReminder', value)}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={preferences.srsReminder ? colors.onPrimary : '#f4f3f4'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={{flex: 1}}>
                <Text style={styles.settingLabel}>Achievement Alerts</Text>
                <Text style={styles.settingDescription}>
                  Celebrate your milestones
                </Text>
              </View>
              <Switch
                value={preferences.achievementAlerts}
                onValueChange={value =>
                  updatePreference('achievementAlerts', value)
                }
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={
                  preferences.achievementAlerts ? colors.onPrimary : '#f4f3f4'
                }
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={{flex: 1}}>
                <Text style={styles.settingLabel}>New Content Alerts</Text>
                <Text style={styles.settingDescription}>
                  Discover new lessons and materials
                </Text>
              </View>
              <Switch
                value={preferences.newContentAlerts}
                onValueChange={value =>
                  updatePreference('newContentAlerts', value)
                }
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={
                  preferences.newContentAlerts ? colors.onPrimary : '#f4f3f4'
                }
              />
            </View>

            <View style={styles.divider} />

            <View>
              <Text style={styles.settingLabel}>Weekly Progress Day</Text>
              <Text style={styles.settingDescription}>
                Choose when to receive your weekly summary
              </Text>
              <View style={styles.daySelector}>
                {weekDays.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      preferences.weeklyProgressDay === index &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() => updatePreference('weeklyProgressDay', index)}>
                    <Text
                      style={[
                        styles.dayButtonText,
                        preferences.weeklyProgressDay === index &&
                          styles.dayButtonTextSelected,
                      ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Sound</Text>
              <Switch
                value={preferences.soundEnabled}
                onValueChange={value => updatePreference('soundEnabled', value)}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={preferences.soundEnabled ? colors.onPrimary : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Vibration</Text>
              <Switch
                value={preferences.vibrationEnabled}
                onValueChange={value =>
                  updatePreference('vibrationEnabled', value)
                }
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={
                  preferences.vibrationEnabled ? colors.onPrimary : '#f4f3f4'
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.testTitle}>Test Notifications</Text>
          <View style={styles.testButtons}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => testNotification(NotificationType.LEARNING_REMINDER)}>
              <Text style={styles.testButtonText}>Learning Reminder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => testNotification(NotificationType.STREAK_REMINDER)}>
              <Text style={styles.testButtonText}>Streak Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => testNotification(NotificationType.GOAL_ACHIEVED)}>
              <Text style={styles.testButtonText}>Achievement</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => testNotification(NotificationType.SRS_REVIEW)}>
              <Text style={styles.testButtonText}>SRS Review</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showOptimalTimePicker && (
          <DateTimePicker
            value={parseTime(preferences.optimalLearningTime || '19:00')}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, date) => handleTimeChange(event, date, 'optimal')}
          />
        )}

        {showDailyTimePicker && (
          <DateTimePicker
            value={parseTime(preferences.dailyReminderTime || '09:00')}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, date) => handleTimeChange(event, date, 'daily')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};