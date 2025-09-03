// src/components/gestures/NavigationGestureProvider.tsx
// 네비게이션 제스처 통합 프로바이더

import React, { createContext, useContext, useState, useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useThemedStyles } from '../../context/ThemeContext';
import { Theme } from '../../theme';

import { ScreenTransitionWrapper } from './ScreenTransitionWrapper';
import { PullToRefresh } from './PullToRefresh';
import { LongPressMenu, MenuOption } from './LongPressMenu';

interface NavigationGestureConfig {
  enableSwipeBack: boolean;
  enablePullToRefresh: boolean;
  enableLongPress: boolean;
  swipeBackThreshold: number;
  longPressDuration: number;
  refreshThreshold: number;
  hapticFeedback: boolean;
}

interface NavigationGestureContextType {
  config: NavigationGestureConfig;
  updateConfig: (updates: Partial<NavigationGestureConfig>) => void;
  registerScreen: (screenName: string, options: ScreenGestureOptions) => void;
  unregisterScreen: (screenName: string) => void;
  showQuickActions: (options: MenuOption[]) => void;
  hideQuickActions: () => void;
}

interface ScreenGestureOptions {
  refreshHandler?: () => Promise<void> | void;
  contextMenuOptions?: MenuOption[];
  disableSwipeBack?: boolean;
  customTransition?: boolean;
}

const defaultConfig: NavigationGestureConfig = {
  enableSwipeBack: true,
  enablePullToRefresh: true,
  enableLongPress: true,
  swipeBackThreshold: 100,
  longPressDuration: 500,
  refreshThreshold: 80,
  hapticFeedback: true,
};

const NavigationGestureContext = createContext<NavigationGestureContextType | null>(null);

export const useNavigationGestures = () => {
  const context = useContext(NavigationGestureContext);
  if (!context) {
    throw new Error('useNavigationGestures must be used within NavigationGestureProvider');
  }
  return context;
};

interface NavigationGestureProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<NavigationGestureConfig>;
}

export const NavigationGestureProvider: React.FC<NavigationGestureProviderProps> = ({
  children,
  initialConfig = {},
}) => {
  const [config, setConfig] = useState<NavigationGestureConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  
  const [registeredScreens, setRegisteredScreens] = useState<Map<string, ScreenGestureOptions>>(new Map());
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [quickActionOptions, setQuickActionOptions] = useState<MenuOption[]>([]);

  const updateConfig = useCallback((updates: Partial<NavigationGestureConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const registerScreen = useCallback((screenName: string, options: ScreenGestureOptions) => {
    setRegisteredScreens(prev => new Map(prev).set(screenName, options));
  }, []);

  const unregisterScreen = useCallback((screenName: string) => {
    setRegisteredScreens(prev => {
      const newMap = new Map(prev);
      newMap.delete(screenName);
      return newMap;
    });
  }, []);

  const showQuickActions = useCallback((options: MenuOption[]) => {
    setQuickActionOptions(options);
    setQuickActionsVisible(true);
  }, []);

  const hideQuickActions = useCallback(() => {
    setQuickActionsVisible(false);
    setQuickActionOptions([]);
  }, []);

  const contextValue: NavigationGestureContextType = {
    config,
    updateConfig,
    registerScreen,
    unregisterScreen,
    showQuickActions,
    hideQuickActions,
  };

  return (
    <NavigationGestureContext.Provider value={contextValue}>
      {children}
    </NavigationGestureContext.Provider>
  );
};

// 개별 화면에서 사용할 제스처 래퍼 컴포넌트
interface GestureScreenProps {
  children: React.ReactNode;
  screenName: string;
  refreshHandler?: () => Promise<void> | void;
  contextMenuOptions?: MenuOption[];
  disableSwipeBack?: boolean;
  disablePullToRefresh?: boolean;
  customTransition?: boolean;
  refreshing?: boolean;
}

export const GestureScreen: React.FC<GestureScreenProps> = ({
  children,
  screenName,
  refreshHandler,
  contextMenuOptions = [],
  disableSwipeBack = false,
  disablePullToRefresh = false,
  customTransition = false,
  refreshing = false,
}) => {
  const navigation = useNavigation();
  const styles = useThemedStyles(createStyles);
  const { config, registerScreen, unregisterScreen } = useNavigationGestures();

  // 화면 등록/해제
  React.useEffect(() => {
    const options: ScreenGestureOptions = {
      refreshHandler,
      contextMenuOptions,
      disableSwipeBack,
      customTransition,
    };
    
    registerScreen(screenName, options);
    
    return () => {
      unregisterScreen(screenName);
    };
  }, [screenName, refreshHandler, contextMenuOptions, disableSwipeBack, customTransition]);

  // 스와이프 백 설정
  const enableSwipeBack = config.enableSwipeBack && !disableSwipeBack && navigation.canGoBack();
  
  // 새로고침 설정
  const enableRefresh = config.enablePullToRefresh && !disablePullToRefresh && !!refreshHandler;

  // 화면 내용을 래핑
  let content = children;

  // 컨텍스트 메뉴가 있다면 LongPressMenu로 래핑
  if (contextMenuOptions.length > 0 && config.enableLongPress) {
    content = (
      <LongPressMenu
        options={contextMenuOptions}
        longPressDuration={config.longPressDuration}
        hapticFeedback={config.hapticFeedback}
      >
        {content}
      </LongPressMenu>
    );
  }

  // 새로고침 기능이 있다면 PullToRefresh로 래핑
  if (enableRefresh) {
    content = (
      <PullToRefresh
        onRefresh={refreshHandler!}
        refreshing={refreshing}
        pullThreshold={config.refreshThreshold}
        enabled={enableRefresh}
      >
        {content}
      </PullToRefresh>
    );
  }

  // 스와이프 백이 활성화되어 있다면 ScreenTransitionWrapper로 래핑
  if (enableSwipeBack || customTransition) {
    content = (
      <ScreenTransitionWrapper
        enableSwipeBack={enableSwipeBack}
        swipeBackThreshold={config.swipeBackThreshold}
      >
        {content}
      </ScreenTransitionWrapper>
    );
  }

  return <View style={styles.container}>{content}</View>;
};

// 제스처 설정을 위한 훅
export const useGestureConfig = () => {
  const { config, updateConfig } = useNavigationGestures();
  
  const toggleSwipeBack = useCallback(() => {
    updateConfig({ enableSwipeBack: !config.enableSwipeBack });
  }, [config.enableSwipeBack, updateConfig]);

  const togglePullToRefresh = useCallback(() => {
    updateConfig({ enablePullToRefresh: !config.enablePullToRefresh });
  }, [config.enablePullToRefresh, updateConfig]);

  const toggleLongPress = useCallback(() => {
    updateConfig({ enableLongPress: !config.enableLongPress });
  }, [config.enableLongPress, updateConfig]);

  const toggleHapticFeedback = useCallback(() => {
    updateConfig({ hapticFeedback: !config.hapticFeedback });
  }, [config.hapticFeedback, updateConfig]);

  const setSwipeThreshold = useCallback((threshold: number) => {
    updateConfig({ swipeBackThreshold: threshold });
  }, [updateConfig]);

  const setLongPressDuration = useCallback((duration: number) => {
    updateConfig({ longPressDuration: duration });
  }, [updateConfig]);

  const setRefreshThreshold = useCallback((threshold: number) => {
    updateConfig({ refreshThreshold: threshold });
  }, [updateConfig]);

  return {
    config,
    toggleSwipeBack,
    togglePullToRefresh,
    toggleLongPress,
    toggleHapticFeedback,
    setSwipeThreshold,
    setLongPressDuration,
    setRefreshThreshold,
    updateConfig,
  };
};

// 화면별 제스처 옵션을 관리하는 훅
export const useScreenGestures = (screenName: string) => {
  const navigation = useNavigation();
  const { showQuickActions, hideQuickActions } = useNavigationGestures();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const createRefreshHandler = useCallback((handler: () => Promise<void> | void) => {
    return async () => {
      setIsRefreshing(true);
      try {
        await handler();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
        }, 500);
      }
    };
  }, []);

  const createContextMenu = useCallback((
    baseOptions: Omit<MenuOption, 'id'>[],
    dynamicOptions?: () => Omit<MenuOption, 'id'>[]
  ): MenuOption[] => {
    const options = [...baseOptions];
    
    if (dynamicOptions) {
      options.push(...dynamicOptions());
    }

    // 항상 추가되는 기본 옵션들
    const defaultOptions: Omit<MenuOption, 'id'>[] = [
      {
        title: '설정',
        icon: '⚙️',
        onPress: () => navigation.navigate('Settings' as never),
      },
    ];

    if (navigation.canGoBack()) {
      defaultOptions.unshift({
        title: '뒤로가기',
        icon: '←',
        onPress: () => navigation.goBack(),
      });
    }

    options.push(...defaultOptions);

    return options.map((option, index) => ({
      ...option,
      id: `${screenName}_option_${index}`,
    }));
  }, [screenName, navigation]);

  return {
    isRefreshing,
    createRefreshHandler,
    createContextMenu,
    showQuickActions,
    hideQuickActions,
  };
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default NavigationGestureProvider;