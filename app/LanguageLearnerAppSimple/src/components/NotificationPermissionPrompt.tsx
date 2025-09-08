import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import {useNotificationPermission} from '../hooks/useNotificationPermission';

interface NotificationPermissionPromptProps {
  isVisible: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
}

export const NotificationPermissionPrompt: React.FC<
  NotificationPermissionPromptProps
> = ({isVisible, onClose, onPermissionGranted}) => {
  const {colors} = useTheme();
  const {requestPermission, hasPermission} = useNotificationPermission();

  const handleRequestPermission = async () => {
    await requestPermission();
    if (hasPermission && onPermissionGranted) {
      onPermissionGranted();
    }
    onClose();
  };

  const styles = StyleSheet.create({
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
      alignItems: 'center',
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    bellIcon: {
      fontSize: 40,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      color: colors.secondaryText,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    benefitsList: {
      width: '100%',
      marginBottom: 24,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    checkIcon: {
      fontSize: 20,
      color: colors.success,
      marginRight: 12,
    },
    benefitText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    buttonContainer: {
      width: '100%',
      gap: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.secondaryText,
      fontSize: 16,
      fontWeight: '500',
    },
  });

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.bellIcon}>🔔</Text>
          </View>
          
          <Text style={styles.title}>Stay Updated!</Text>
          
          <Text style={styles.description}>
            Enable notifications to get the most out of your language learning journey
          </Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Daily learning reminders
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Achievement celebrations
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.benefitText}>
                Practice streak notifications
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.benefitText}>
                New content alerts
              </Text>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRequestPermission}>
              <Text style={styles.primaryButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};