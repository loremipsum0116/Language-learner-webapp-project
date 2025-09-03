// src/screens/auth/RegisterScreen.tsx
// 회원가입 화면 (React Native 버전)

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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { Button, AlertBanner } from '../../components/common';
import { FadeInView } from '../../components/animations';
import { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface TouchedFields {
  email: boolean;
  password: boolean;
  confirm: boolean;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<TouchedFields>({ 
    email: false, 
    password: false, 
    confirm: false 
  });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const errors = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailError = !email 
      ? '이메일을 입력하세요.' 
      : !emailRegex.test(email) 
      ? '올바른 이메일 형식이 아닙니다.' 
      : '';

    // Password policy: 8-64 chars, at least 1 letter and 1 number
    const passLen = password.length < 8 || password.length > 64;
    const passComp = !/[A-Za-z]/.test(password) || !/[0-9]/.test(password);
    const passwordError = !password
      ? '비밀번호를 입력하세요.'
      : passLen
      ? '비밀번호는 8-64자여야 합니다.'
      : passComp
      ? '영문과 숫자를 최소 1자 이상 포함하세요.'
      : '';

    const confirmError = confirm !== password ? '비밀번호가 일치하지 않습니다.' : '';

    return { email: emailError, password: passwordError, confirm: confirmError };
  }, [email, password, confirm]);

  const isInvalid = {
    email: (touched.email && !!errors.email) || emailTaken,
    password: touched.password && !!errors.password,
    confirm: touched.confirm && !!errors.confirm,
  };

  const canSubmit = !errors.email && !errors.password && !errors.confirm && !loading;

  const parseServerError = (error: any) => {
    let message = error?.message || '회원가입 실패';
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error) message = parsed.error;
    } catch {}
    return { status: error?.status, message };
  };

  const handleSubmit = async () => {
    setTouched({ email: true, password: true, confirm: true });
    setServerError(null);
    setEmailTaken(false);

    if (!canSubmit) return;

    try {
      setLoading(true);
      await register(email.trim(), password);
      
      Alert.alert(
        '회원가입 완료',
        '계정이 성공적으로 생성되었습니다!',
        [{ text: '확인', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      const { status, message } = parseServerError(error);
      setServerError(message || '회원가입 실패');
      
      if (status === 409 || /already exists/i.test(String(message))) {
        setEmailTaken(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailTaken(false);
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '#e5e7eb' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const strengthMap = {
      1: { label: '매우 약함', color: '#ef4444' },
      2: { label: '약함', color: '#f97316' },
      3: { label: '보통', color: '#eab308' },
      4: { label: '강함', color: '#22c55e' },
      5: { label: '매우 강함', color: '#16a34a' },
    };

    return {
      strength,
      ...strengthMap[strength as keyof typeof strengthMap] || { label: '', color: '#e5e7eb' }
    };
  };

  const passwordStrength = getPasswordStrength(password);

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
              <Text style={styles.title}>회원가입</Text>
              <Text style={styles.subtitle}>
                새 계정을 만들어 단어 학습을 시작하세요
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
                    touched.email && !errors.email && !emailTaken && styles.inputValid,
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
                    {emailTaken ? '이미 등록된 이메일입니다.' : errors.email}
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
                      touched.password && !errors.password && styles.inputValid,
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                    placeholder="비밀번호를 입력하세요"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    returnKeyType="next"
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
                
                {/* Password Strength Indicator */}
                {password && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <View
                          key={level}
                          style={[
                            styles.strengthSegment,
                            {
                              backgroundColor: level <= passwordStrength.strength 
                                ? passwordStrength.color 
                                : '#e5e7eb'
                            }
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}

                <Text style={[styles.helpText, isInvalid.password && styles.errorText]}>
                  {isInvalid.password 
                    ? errors.password
                    : '최소 8-64자, 영문과 숫자 포함'}
                </Text>
              </View>

              {/* Confirm Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      isInvalid.confirm && styles.inputError,
                      touched.confirm && !errors.confirm && styles.inputValid,
                    ]}
                    value={confirm}
                    onChangeText={setConfirm}
                    onBlur={() => setTouched(prev => ({ ...prev, confirm: true }))}
                    placeholder="비밀번호를 다시 입력하세요"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showConfirm}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirm(!showConfirm)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeIcon}>
                      {showConfirm ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {isInvalid.confirm && (
                  <Text style={styles.errorText}>{errors.confirm}</Text>
                )}
              </View>

              {/* Submit Button */}
              <Button
                title={loading ? '가입 중...' : '가입하기'}
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
              <Text style={styles.footerText}>이미 계정이 있으세요? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>로그인</Text>
              </TouchableOpacity>
            </View>
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
  strengthContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
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
});

export default RegisterScreen;