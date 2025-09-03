import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useTheme} from '../context/ThemeContext';
import QuietHoursService, {
  QuietHoursSchedule,
  QuietHoursSettings,
} from '../services/QuietHoursService';
import NotificationCategoryManager, {
  NotificationCategory,
} from '../services/NotificationCategoryManager';
import {NotificationPriority} from '../types/notifications';

export const NotificationManagementScreen: React.FC = () => {
  const {colors} = useTheme();
  const [quietHours, setQuietHours] = useState<QuietHoursSettings>({
    enabled: false,
    schedules: [],
    emergencyBypass: false,
    allowCriticalNotifications: true,
  });
  
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [showQuickActionsModal, setShowQuickActionsModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<QuietHoursSchedule | null>(null);
  
  const [tempSchedule, setTempSchedule] = useState<Partial<QuietHoursSchedule>>({
    name: '',
    startTime: '22:00',
    endTime: '07:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    allowedCategories: [],
  });

  const [showTimePicker, setShowTimePicker] = useState<{
    show: boolean;
    field: 'startTime' | 'endTime';
  }>({show: false, field: 'startTime'});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await QuietHoursService.initialize();
    await NotificationCategoryManager.initialize();
    
    const quietSettings = QuietHoursService.getSettings();
    setQuietHours(quietSettings);
    
    const categorySettings = NotificationCategoryManager.getSettings();
    setCategories(NotificationCategoryManager.getAllCategories());
    setGlobalEnabled(categorySettings.globalEnabled);
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    await QuietHoursService.updateSettings({enabled});
    setQuietHours(prev => ({...prev, enabled}));
  };

  const handleGlobalNotificationsToggle = async (enabled: boolean) => {
    await NotificationCategoryManager.updateGlobalSettings({globalEnabled: enabled});
    setGlobalEnabled(enabled);
  };

  const handleCategoryToggle = async (categoryId: string) => {
    await NotificationCategoryManager.toggleCategory(categoryId);
    const updatedCategories = NotificationCategoryManager.getAllCategories();
    setCategories(updatedCategories);
  };

  const handleAddSchedule = async () => {
    if (!tempSchedule.name) {
      Alert.alert('Error', 'Please enter a schedule name');
      return;
    }

    try {
      if (editingSchedule) {
        await QuietHoursService.updateSchedule(editingSchedule.id, tempSchedule);
      } else {
        await QuietHoursService.addSchedule(tempSchedule as Omit<QuietHoursSchedule, 'id'>);
      }
      
      const updatedSettings = QuietHoursService.getSettings();
      setQuietHours(updatedSettings);
      setShowAddScheduleModal(false);
      setEditingSchedule(null);
      resetTempSchedule();
    } catch (error) {
      Alert.alert('Error', 'Failed to save schedule');
    }
  };

  const handleEditSchedule = (schedule: QuietHoursSchedule) => {
    setEditingSchedule(schedule);
    setTempSchedule(schedule);
    setShowAddScheduleModal(true);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this schedule?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await QuietHoursService.deleteSchedule(scheduleId);
            const updatedSettings = QuietHoursService.getSettings();
            setQuietHours(updatedSettings);
          },
        },
      ]
    );
  };

  const resetTempSchedule = () => {
    setTempSchedule({
      name: '',
      startTime: '22:00',
      endTime: '07:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
      allowedCategories: [],
    });
  };

  const handleTimeChange = (event: any, selectedDate: Date | undefined) => {
    setShowTimePicker({show: false, field: 'startTime'});
    
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      setTempSchedule(prev => ({
        ...prev,
        [showTimePicker.field]: timeString,
      }));
    }
  };

  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDaysFull = [
    'Sunday',
    'Monday', 
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const getPriorityColor = (priority: NotificationPriority): string => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return colors.error;
      case NotificationPriority.HIGH:
        return colors.warning;
      case NotificationPriority.MEDIUM:
        return colors.primary;
      case NotificationPriority.LOW:
        return colors.secondaryText;
      default:
        return colors.text;
    }
  };

  const quietStatus = QuietHoursService.getQuietHoursStatus();
  const categorySummary = NotificationCategoryManager.getCategorySummary();

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
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionIcon: {
      fontSize: 24,
      marginRight: 8,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    lastRow: {
      marginBottom: 0,
    },
    label: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    description: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 4,
    },
    statusCard: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary + '30',
      borderWidth: 1,
    },
    statusText: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
    },
    statusBadge: {
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    statusBadgeInactive: {
      backgroundColor: colors.border,
    },
    statusBadgeText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '500',
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      marginBottom: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    categoryInfo: {
      flex: 1,
    },
    categoryName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    categoryDescription: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      marginRight: 8,
    },
    priorityText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    scheduleItem: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    scheduleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    scheduleName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    scheduleTime: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    scheduleDays: {
      flexDirection: 'row',
      marginTop: 4,
    },
    dayChip: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: 4,
    },
    dayChipText: {
      fontSize: 10,
      color: colors.primary,
    },
    actionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
    },
    actionButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '500',
    },
    actionButtonTextSecondary: {
      color: colors.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    timeButton: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 16,
    },
    timeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '500',
      textAlign: 'center',
    },
    daySelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 20,
    },
    dayButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background,
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
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.secondaryText,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    quickActionIcon: {
      fontSize: 24,
      marginRight: 16,
    },
    quickActionText: {
      flex: 1,
    },
    quickActionTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    quickActionDescription: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notification Management</Text>
          <Text style={styles.headerSubtitle}>
            Control when and how you receive notifications
          </Text>
        </View>

        {/* Global Control */}
        <View style={styles.section}>
          <View style={[styles.card, quietStatus.isActive && styles.statusCard]}>
            <View style={styles.row}>
              <Text style={styles.label}>All Notifications</Text>
              <Switch
                value={globalEnabled}
                onValueChange={handleGlobalNotificationsToggle}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={globalEnabled ? colors.onPrimary : '#f4f3f4'}
              />
            </View>
            
            {quietStatus.isActive && (
              <>
                <View style={styles.divider} />
                <Text style={styles.statusText}>
                  🔕 Quiet Hours Active
                </Text>
                <View style={[styles.statusBadge]}>
                  <Text style={styles.statusBadgeText}>
                    {quietStatus.activeSchedules[0]?.name || 'Quiet Mode'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.sectionIcon}>📊</Text>
            Summary
          </Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Enabled Categories</Text>
              <Text style={styles.summaryValue}>
                {categorySummary.enabledCategories}/{categorySummary.totalCategories}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>High Priority</Text>
              <Text style={styles.summaryValue}>
                {categorySummary.highPriorityEnabled}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quiet Schedules</Text>
              <Text style={styles.summaryValue}>
                {quietHours.schedules.filter(s => s.enabled).length}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>⚡</Text>
              Quick Actions
            </Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowQuickActionsModal(true)}>
              <Text style={styles.actionButtonText}>View All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notification Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.sectionIcon}>📂</Text>
            Categories
          </Text>
          {categories.map(category => (
            <View key={category.id} style={styles.categoryItem}>
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <View style={styles.categoryInfo}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      {backgroundColor: getPriorityColor(category.priority)},
                    ]}>
                    <Text style={styles.priorityText}>
                      {category.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.categoryDescription}>
                  {category.description}
                </Text>
              </View>
              <Switch
                value={category.enabled}
                onValueChange={() => handleCategoryToggle(category.id)}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={category.enabled ? colors.onPrimary : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.sectionIcon}>🔕</Text>
              Quiet Hours
            </Text>
            <Switch
              value={quietHours.enabled}
              onValueChange={handleQuietHoursToggle}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={quietHours.enabled ? colors.onPrimary : '#f4f3f4'}
            />
          </View>
          
          {quietHours.enabled && (
            <>
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    resetTempSchedule();
                    setShowAddScheduleModal(true);
                  }}>
                  <Text style={styles.actionButtonText}>Add Schedule</Text>
                </TouchableOpacity>
              </View>
              
              {quietHours.schedules.map(schedule => (
                <View key={schedule.id} style={styles.scheduleItem}>
                  <View style={styles.scheduleHeader}>
                    <View style={{flex: 1}}>
                      <Text style={styles.scheduleName}>{schedule.name}</Text>
                      <Text style={styles.scheduleTime}>
                        {schedule.startTime} - {schedule.endTime}
                      </Text>
                      <View style={styles.scheduleDays}>
                        {schedule.daysOfWeek.map(day => (
                          <View key={day} style={styles.dayChip}>
                            <Text style={styles.dayChipText}>
                              {weekDays[day]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={{flexDirection: 'row'}}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={() => handleEditSchedule(schedule)}>
                        <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Add/Edit Schedule Modal */}
        <Modal
          visible={showAddScheduleModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddScheduleModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingSchedule ? 'Edit Schedule' : 'Add Quiet Hours'}
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Schedule name"
                placeholderTextColor={colors.secondaryText}
                value={tempSchedule.name}
                onChangeText={text => setTempSchedule(prev => ({...prev, name: text}))}
              />
              
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker({show: true, field: 'startTime'})}>
                <Text style={styles.timeButtonText}>
                  Start Time: {tempSchedule.startTime}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker({show: true, field: 'endTime'})}>
                <Text style={styles.timeButtonText}>
                  End Time: {tempSchedule.endTime}
                </Text>
              </TouchableOpacity>
              
              <Text style={{fontSize: 16, color: colors.text, marginBottom: 8}}>
                Days of Week:
              </Text>
              <View style={styles.daySelector}>
                {weekDaysFull.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      tempSchedule.daysOfWeek?.includes(index) &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() => {
                      const days = tempSchedule.daysOfWeek || [];
                      const newDays = days.includes(index)
                        ? days.filter(d => d !== index)
                        : [...days, index];
                      setTempSchedule(prev => ({...prev, daysOfWeek: newDays}));
                    }}>
                    <Text
                      style={[
                        styles.dayButtonText,
                        tempSchedule.daysOfWeek?.includes(index) &&
                          styles.dayButtonTextSelected,
                      ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => {
                    setShowAddScheduleModal(false);
                    setEditingSchedule(null);
                    resetTempSchedule();
                  }}>
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleAddSchedule}>
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Actions Modal */}
        <Modal
          visible={showQuickActionsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowQuickActionsModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Quick Actions</Text>
              <FlatList
                data={NotificationCategoryManager.getQuickActions()}
                keyExtractor={item => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.quickAction}
                    onPress={async () => {
                      await item.action();
                      await loadData();
                      setShowQuickActionsModal(false);
                    }}>
                    <Text style={styles.quickActionIcon}>{item.icon}</Text>
                    <View style={styles.quickActionText}>
                      <Text style={styles.quickActionTitle}>{item.title}</Text>
                      <Text style={styles.quickActionDescription}>
                        {item.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => setShowQuickActionsModal(false)}>
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {showTimePicker.show && (
          <DateTimePicker
            value={parseTime(tempSchedule[showTimePicker.field] || '12:00')}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};