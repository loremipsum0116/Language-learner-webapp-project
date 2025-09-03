import React, { useMemo, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

interface ParsedError {
  status?: number;
  message: string;
}

function parseServerError(e: any): ParsedError {
  let msg = e?.message || '회원가입 실패';
  try {
    const j = JSON.parse(msg);
    if (j?.error) msg = j.error;
  } catch { }
  return { status: e?.status, message: msg };
}

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // 필드 터치 여부(Blur 이후 유효성 표시)
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false });

  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);

  // 클라이언트 유효성 규칙
  const errors = useMemo(() => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailErr = !email ? '이메일을 입력하세요.' : !emailRe.test(email) ? '올바른 이메일 형식이 아닙니다.' : '';

    // 정책: 8–64자, 영문/숫자 최소 1개 포함
    const passLen = password.length < 8 || password.length > 64;
    const passComp = !/[A-Za-z]/.test(password) || !/[0-9]/.test(password);
    const passwordErr = !password
      ? '비밀번호를 입력하세요.'
      : passLen
        ? '비밀번호는 8–64자여야 합니다.'
        : passComp
          ? '영문과 숫자를 최소 1자 이상 포함하세요.'
          : '';

    const confirmErr = confirm !== password ? '비밀번호가 일치하지 않습니다.' : '';

    return { email: emailErr, password: passwordErr, confirm: confirmErr };
  }, [email, password, confirm]);

  const isInvalid = {
    email: (touched.email && !!errors.email) || emailTaken,
    password: touched.password && !!errors.password,
    confirm: touched.confirm && !!errors.confirm,
  };

  const canSubmit = !errors.email && !errors.password && !errors.confirm && !loading;

  const onSubmit = async () => {
    // 모든 필드를 터치 상태로 만들어 에러 노출
    setTouched({ email: true, password: true, confirm: true });
    setServerErr(null);
    setEmailTaken(false);

    if (!canSubmit) return;

    try {
      setLoading(true);
      await register(email.trim(), password);
      // Navigation will be handled by auth context
    } catch (e2: any) {
      const { status, message } = parseServerError(e2);
      setServerErr(message || '회원가입 실패');
      if (status === 409 || /already exists/i.test(String(message))) {
        setEmailTaken(true); // 이메일 중복을 필드 에러로 표시
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>회원가입</Text>

            {serverErr && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorText}>{serverErr}</Text>
              </View>
            )}

            {/* 이메일 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={[
                  styles.input,
                  isInvalid.email && styles.inputInvalid,
                  touched.email && !errors.email && !emailTaken && styles.inputValid
                ]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailTaken(false); // 재입력 시 중복 플래그 해제
                }}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                placeholder="이메일을 입력하세요"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
              {isInvalid.email && (
                <Text style={styles.errorMessage}>
                  {emailTaken ? '이미 등록된 이메일입니다.' : errors.email}
                </Text>
              )}
            </View>

            {/* 비밀번호 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={[
                  styles.input,
                  isInvalid.password && styles.inputInvalid,
                  touched.password && !errors.password && styles.inputValid
                ]}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                placeholder="비밀번호를 입력하세요"
                secureTextEntry
                autoComplete="new-password"
                autoCorrect={false}
              />
              <Text style={[styles.helpText, isInvalid.password && styles.errorMessage]}>
                최소 8–64자, 영문과 숫자 포함(서버는 bcrypt(10–12 rounds)로 저장).
              </Text>
            </View>

            {/* 비밀번호 확인 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호 확인</Text>
              <TextInput
                style={[
                  styles.input,
                  isInvalid.confirm && styles.inputInvalid,
                  touched.confirm && !errors.confirm && styles.inputValid
                ]}
                value={confirm}
                onChangeText={setConfirm}
                onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
                placeholder="비밀번호를 다시 입력하세요"
                secureTextEntry
                autoComplete="new-password"
                autoCorrect={false}
                onSubmitEditing={onSubmit}
              />
              {isInvalid.confirm && (
                <Text style={styles.errorMessage}>{errors.confirm}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.submitButtonText}>가입 중…</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>가입하기</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginPrompt}>
              <Text style={styles.loginText}>이미 계정이 있으세요? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>로그인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  errorAlert: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputValid: {
    borderColor: '#28a745',
  },
  inputInvalid: {
    borderColor: '#dc3545',
  },
  errorMessage: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 4,
  },
  helpText: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});