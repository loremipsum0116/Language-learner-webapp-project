// src/context/ThemeContext.tsx
// 테마 컨텍스트 및 프로바이더

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StatusBar, Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeMode, getTheme, toggleTheme as toggleThemeMode } from '../theme';

// Context interface
interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeMode;
  followSystem?: boolean;
}

// Storage keys
const THEME_STORAGE_KEY = '@theme_mode';
const FOLLOW_SYSTEM_KEY = '@follow_system_theme';

// Theme provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = 'light',
  followSystem = true,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const [followSystemTheme, setFollowSystemTheme] = useState(followSystem);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get system theme
  const getSystemTheme = (): ThemeMode => {
    const systemTheme = Appearance.getColorScheme();
    return systemTheme === 'dark' ? 'dark' : 'light';
  };

  // Load theme from storage
  const loadThemeFromStorage = async () => {
    try {
      const [storedTheme, storedFollowSystem] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(FOLLOW_SYSTEM_KEY),
      ]);

      const shouldFollowSystem = storedFollowSystem !== null 
        ? JSON.parse(storedFollowSystem) 
        : followSystem;
      
      setFollowSystemTheme(shouldFollowSystem);

      if (shouldFollowSystem) {
        const systemTheme = getSystemTheme();
        setThemeMode(systemTheme);
      } else if (storedTheme) {
        setThemeMode(storedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Failed to load theme from storage:', error);
    } finally {
      setIsInitialized(true);
    }
  };

  // Save theme to storage
  const saveThemeToStorage = async (mode: ThemeMode, followSystem: boolean) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode),
        AsyncStorage.setItem(FOLLOW_SYSTEM_KEY, JSON.stringify(followSystem)),
      ]);
    } catch (error) {
      console.error('Failed to save theme to storage:', error);
    }
  };

  // Handle system theme change
  const handleSystemThemeChange = (preferences: { colorScheme: ColorSchemeName }) => {
    if (followSystemTheme && preferences.colorScheme) {
      const newMode = preferences.colorScheme === 'dark' ? 'dark' : 'light';
      setThemeMode(newMode);
    }
  };

  // Initialize theme
  useEffect(() => {
    loadThemeFromStorage();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(handleSystemThemeChange);
    return () => subscription.remove();
  }, [followSystemTheme]);

  // Save theme when it changes
  useEffect(() => {
    if (isInitialized) {
      saveThemeToStorage(themeMode, followSystemTheme);
    }
  }, [themeMode, followSystemTheme, isInitialized]);

  // Update status bar based on theme
  useEffect(() => {
    StatusBar.setBarStyle(
      themeMode === 'dark' ? 'light-content' : 'dark-content',
      true
    );
    
    // For Android
    if (StatusBar.setBackgroundColor) {
      const theme = getTheme(themeMode);
      StatusBar.setBackgroundColor(theme.colors.background, true);
    }
  }, [themeMode]);

  // Theme functions
  const toggleTheme = () => {
    const newMode = toggleThemeMode(themeMode);
    setThemeMode(newMode);
    setFollowSystemTheme(false); // Disable system follow when manually toggling
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setFollowSystemTheme(false); // Disable system follow when manually setting
  };

  // Enable/disable system theme following
  const enableSystemTheme = () => {
    setFollowSystemTheme(true);
    const systemTheme = getSystemTheme();
    setThemeMode(systemTheme);
  };

  const disableSystemTheme = () => {
    setFollowSystemTheme(false);
  };

  // Get current theme object
  const theme = getTheme(themeMode);
  const isDark = themeMode === 'dark';

  // Context value
  const contextValue: ThemeContextType = {
    theme,
    themeMode,
    isDark,
    toggleTheme,
    setTheme,
  };

  // Don't render until theme is initialized
  if (!isInitialized) {
    return null; // or a loading spinner
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Hook for just colors (most common use case)
export const useColors = () => {
  const { theme } = useTheme();
  return theme.colors;
};

// Hook for typography
export const useTypography = () => {
  const { theme } = useTheme();
  return theme.typography;
};

// Hook for spacing
export const useSpacing = () => {
  const { theme } = useTheme();
  return theme.spacing;
};

// Hook for variants
export const useVariants = () => {
  const { theme } = useTheme();
  return theme.variants;
};

// Higher-order component for theme-aware components
export const withTheme = <P extends object>(
  Component: React.ComponentType<P & { theme: Theme }>
) => {
  return (props: P) => {
    const { theme } = useTheme();
    return <Component {...props} theme={theme} />;
  };
};

// Styled component helper
export const createThemedStyleSheet = <T extends Record<string, any>>(
  styleCreator: (theme: Theme) => T
) => {
  return (theme: Theme): T => styleCreator(theme);
};

// Theme-aware StyleSheet helper
export const useThemedStyles = <T extends Record<string, any>>(
  styleCreator: (theme: Theme) => T
): T => {
  const { theme } = useTheme();
  return React.useMemo(() => styleCreator(theme), [theme, styleCreator]);
};

// Export context for advanced usage
export { ThemeContext };
export default ThemeProvider;