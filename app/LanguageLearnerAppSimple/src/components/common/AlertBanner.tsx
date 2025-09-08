// src/components/common/AlertBanner.tsx
// 공통 알림 배너 컴포넌트

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertBannerProps } from '../../types';

const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  title,
  message,
  onClose,
  style
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'info':
        return {
          container: styles.infoContainer,
          icon: '💡',
          titleColor: '#1e40af',
          messageColor: '#1e40af',
        };
      case 'success':
        return {
          container: styles.successContainer,
          icon: '✅',
          titleColor: '#166534',
          messageColor: '#166534',
        };
      case 'warning':
        return {
          container: styles.warningContainer,
          icon: '⚠️',
          titleColor: '#92400e',
          messageColor: '#92400e',
        };
      case 'error':
        return {
          container: styles.errorContainer,
          icon: '❌',
          titleColor: '#991b1b',
          messageColor: '#991b1b',
        };
      default:
        return {
          container: styles.infoContainer,
          icon: '💡',
          titleColor: '#1e40af',
          messageColor: '#1e40af',
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <View style={[styles.container, typeStyles.container, style]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{typeStyles.icon}</Text>
        <View style={styles.textContainer}>
          {title && (
            <Text style={[styles.title, { color: typeStyles.titleColor }]}>
              {title}
            </Text>
          )}
          <Text style={[styles.message, { color: typeStyles.messageColor }]}>
            {message}
          </Text>
        </View>
      </View>
      
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={[styles.closeText, { color: typeStyles.titleColor }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Type-specific container styles
  infoContainer: {
    backgroundColor: '#dbeafe', // blue-100
    borderColor: '#93c5fd', // blue-300
  },
  successContainer: {
    backgroundColor: '#dcfce7', // green-100
    borderColor: '#86efac', // green-300
  },
  warningContainer: {
    backgroundColor: '#fef3c7', // yellow-100
    borderColor: '#fcd34d', // yellow-300
  },
  errorContainer: {
    backgroundColor: '#fecaca', // red-100
    borderColor: '#fca5a5', // red-300
  },
});

export default AlertBanner;