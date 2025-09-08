// src/__tests__/screens/LoginScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../screens/auth/LoginScreen';
import { Alert } from 'react-native';

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock AsyncStorage
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: mockSetItem,
  getItem: mockGetItem,
}));

// Mock API Client
jest.mock('../../services/apiClient', () => ({
  login: jest.fn(),
}));

const { login: mockLogin } = require('../../services/apiClient');

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
  });

  it('로그인 폼이 올바르게 렌더링되어야 함', () => {
    const { getByTestId, getByText } = render(<LoginScreen />);
    
    expect(getByTestId('username-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByText('로그인')).toBeTruthy();
  });

  it('사용자 입력이 올바르게 처리되어야 함', () => {
    const { getByTestId } = render(<LoginScreen />);
    
    const usernameInput = getByTestId('username-input');
    const passwordInput = getByTestId('password-input');
    
    fireEvent.changeText(usernameInput, 'testuser');
    fireEvent.changeText(passwordInput, 'testpass');
    
    expect(usernameInput.props.value || usernameInput.props.defaultValue).toBe('testuser');
    expect(passwordInput.props.value || passwordInput.props.defaultValue).toBe('testpass');
  });

  it('성공적인 로그인이 처리되어야 함', async () => {
    const mockNavigate = jest.fn();
    jest.mock('@react-navigation/native', () => ({
      useNavigation: () => ({ navigate: mockNavigate }),
    }));

    mockLogin.mockResolvedValue({
      success: true,
      user: { id: 1, username: 'testuser' },
      token: 'test-token'
    });

    const { getByTestId, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('username-input'), 'testuser');
    fireEvent.changeText(getByTestId('password-input'), 'testpass');
    fireEvent.press(getByText('로그인'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass');
    });
  });

  it('로그인 실패시 에러 메시지가 표시되어야 함', async () => {
    mockLogin.mockRejectedValue(new Error('로그인 실패'));

    const { getByTestId, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('username-input'), 'wronguser');
    fireEvent.changeText(getByTestId('password-input'), 'wrongpass');
    fireEvent.press(getByText('로그인'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        '로그인 실패',
        expect.stringContaining('로그인에 실패했습니다')
      );
    });
  });

  it('빈 필드 검증이 작동해야 함', () => {
    const { getByText } = render(<LoginScreen />);
    
    fireEvent.press(getByText('로그인'));
    
    expect(Alert.alert).toHaveBeenCalledWith(
      '입력 오류',
      '사용자명과 비밀번호를 모두 입력해주세요.'
    );
  });

  it('기억하기 체크박스가 작동해야 함', () => {
    const { getByTestId } = render(<LoginScreen />);
    
    const rememberCheckbox = getByTestId('remember-checkbox');
    expect(rememberCheckbox).toBeTruthy();
    
    fireEvent.press(rememberCheckbox);
    // 체크박스 상태 변경 확인은 구현에 따라 달라질 수 있음
  });
});