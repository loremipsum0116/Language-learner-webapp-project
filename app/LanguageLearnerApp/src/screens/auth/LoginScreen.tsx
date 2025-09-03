// src/screens/auth/LoginScreen.tsx
// 로그인 화면 (React Native 버전)

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { Button, AlertBanner } from '../../components/common';
import { FadeInView } from '../../components/animations';
import { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface TouchedFields {
  email: boolean;
  password: boolean;
}

const LoginScreen: React.FC<Props> = ({ navigation, route }) => {
  const { login } = useAuth();
  const redirect = route.params?.redirect || 'Home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<TouchedFields>({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [invalidCredentials, setInvalidCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const errors = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailError = !email 
      ? '이메일을 입력하세요.' 
      : !emailRegex.test(email) 
      ? '올바른 이메일 형식이 아닙니다.' 
      : '';
    const passwordError = !password ? '비밀번호를 입력하세요.' : '';
    
    return { email: emailError, password: passwordError };
  }, [email, password]);

  const isInvalid = {
    email: (touched.email && !!errors.email) || invalidCredentials,
    password: (touched.password && !!errors.password) || invalidCredentials,
  };

  const canSubmit = !errors.email && !errors.password && !loading;

  const parseServerError = (error: any) => {
    let message = error?.message || '로그인 실패';
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error) message = parsed.error;
    } catch {}
    return { status: error?.status, message };
  };

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    setServerError(null);
    setInvalidCredentials(false);
    
    if (!canSubmit) return;

    try {
      setLoading(true);
      await login(email.trim(), password);
      
      // Navigation will be handled by auth state change
      // The RootNavigator will automatically navigate to authenticated screens
    } catch (error: any) {
      const { status, message } = parseServerError(error);
      setServerError(message || '로그인 실패');
      
      if (status === 401 || /invalid credentials/i.test(String(message))) {
        setInvalidCredentials(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setInvalidCredentials(false);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setInvalidCredentials(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView duration={600} style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>로그인</Text>
              <Text style={styles.subtitle}>
                단어 학습을 계속하려면 로그인하세요
              </Text>
            </View>

            {/* Server Error Alert */}
            {serverError && (
              <AlertBanner
                type="error"
                message={serverError}
                onClose={() => setServerError(null)}
                style={styles.errorBanner}
              />
            )}

            {/* Form */}
            <View style={styles.form}>
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={[
                    styles.input,
                    isInvalid.email && styles.inputError,
                    touched.email && !errors.email && !invalidCredentials && styles.inputValid,
                  ]}
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  placeholder="이메일을 입력하세요"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  editable={!loading}
                />
                {isInvalid.email && (
                  <Text style={styles.errorText}>
                    {invalidCredentials 
                      ? '이메일 또는 비밀번호가 올바르지 않습니다.' 
                      : errors.email}
                  </Text>
                )}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      isInvalid.password && styles.inputError,
                      touched.password && !errors.password && !invalidCredentials && styles.inputValid,
                    ]}
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                    placeholder="비밀번호를 입력하세요"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeIcon}>
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {isInvalid.password && (
                  <Text style={styles.errorText}>
                    {invalidCredentials 
                      ? '이메일 또는 비밀번호가 올바르지 않습니다.' 
                      : errors.password}
                  </Text>
                )}
              </View>

              {/* Submit Button */}
              <Button
                title={loading ? '로그인 중...' : '로그인'}
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={loading}
                variant="primary"
                size="large"
                style={styles.submitButton}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>계정이 없으세요? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>회원가입</Text>
              </TouchableOpacity>
            </View>

            {/* Biometric Authentication Placeholder */}
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={() => Alert.alert('생체인증', '생체인증 기능이 곧 추가됩니다!')}
              activeOpacity={0.7}
            >
              <Text style={styles.biometricIcon}>👤</Text>
              <Text style={styles.biometricText}>생체인증으로 로그인</Text>
            </TouchableOpacity>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorBanner: {
    marginBottom: 20,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputValid: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  eyeIcon: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 6,
  },
  submitButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    fontSize: 16,
    color: '#6b7280',
  },
  linkText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  biometricIcon: {
    fontSize: 20,
  },
  biometricText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default LoginScreen;