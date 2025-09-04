// src/__tests__/components/AppHeader.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AppHeader from '../../components/common/AppHeader';

// Mock react-navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
}));

describe('AppHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('제목이 올바르게 렌더링되어야 함', () => {
    const { getByText } = render(<AppHeader title="테스트 제목" />);
    expect(getByText('테스트 제목')).toBeTruthy();
  });

  it('뒤로가기 버튼이 표시되고 동작해야 함', () => {
    const { getByTestId } = render(
      <AppHeader title="테스트" showBackButton={true} />
    );
    
    const backButton = getByTestId('back-button');
    expect(backButton).toBeTruthy();
    
    fireEvent.press(backButton);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('오른쪽 액션 버튼이 표시되고 동작해야 함', () => {
    const mockAction = jest.fn();
    const { getByTestId } = render(
      <AppHeader 
        title="테스트" 
        rightAction={{
          icon: 'settings',
          onPress: mockAction,
          testID: 'settings-button'
        }}
      />
    );
    
    const actionButton = getByTestId('settings-button');
    expect(actionButton).toBeTruthy();
    
    fireEvent.press(actionButton);
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('서브타이틀이 표시되어야 함', () => {
    const { getByText } = render(
      <AppHeader title="메인 제목" subtitle="서브 제목" />
    );
    
    expect(getByText('메인 제목')).toBeTruthy();
    expect(getByText('서브 제목')).toBeTruthy();
  });

  it('커스텀 스타일이 적용되어야 함', () => {
    const customStyle = { backgroundColor: '#FF0000' };
    const { getByTestId } = render(
      <AppHeader 
        title="테스트" 
        style={customStyle}
        testID="custom-header"
      />
    );
    
    const header = getByTestId('custom-header');
    expect(header).toHaveStyle(customStyle);
  });
});