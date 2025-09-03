// src/components/Pron.tsx
// 발음 표기 컴포넌트 (React Native 버전)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PronProps } from '../types';

const Pron: React.FC<PronProps> = ({ ipa, ipaKo }) => {
  if (!ipa && !ipaKo) return null;
  
  // ipa와 ipaKo가 같은 값이면 하나만 표시
  if (ipa === ipaKo) {
    return (
      <View style={styles.container}>
        <Text style={styles.pronText}>
          [{ipa?.replace(/^\[?|\]?$/g, '')}]
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {ipa && (
        <Text style={styles.pronText}>
          [{ipa.replace(/^\[?|\]?$/g, '')}]
        </Text>
      )}
      {ipa && ipaKo && (
        <Text style={styles.separator}> · </Text>
      )}
      {ipaKo && (
        <Text style={styles.pronText}>
          {ipaKo}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pronText: {
    fontSize: 12,
    color: '#6b7280', // gray-500
    lineHeight: 16,
  },
  separator: {
    fontSize: 12,
    color: '#6b7280', // gray-500
  },
});

export default Pron;