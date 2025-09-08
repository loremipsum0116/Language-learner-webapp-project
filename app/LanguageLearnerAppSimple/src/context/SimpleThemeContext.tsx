// Simple Theme Context for Expo Go compatibility
import React, { createContext, useContext, ReactNode } from 'react';

interface SimpleTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
}

const defaultTheme: SimpleTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
};

const SimpleThemeContext = createContext<SimpleTheme>(defaultTheme);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <SimpleThemeContext.Provider value={defaultTheme}>
      {children}
    </SimpleThemeContext.Provider>
  );
};

export const useTheme = () => useContext(SimpleThemeContext);
export const useColors = () => useTheme().colors;