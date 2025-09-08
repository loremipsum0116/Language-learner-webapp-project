import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

// Re-export from AuthContext for backward compatibility

export { useAuth } from '../context/AuthContext';

// Legacy compatibility wrapper for components still using old auth hook interface
export const useAuthLegacy = () => {
  const auth = useContext(AuthContext);
  
  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  // Map to old interface for backward compatibility
  return {
    user: auth.user,
    isAuthenticated: !!auth.user,
    isLoading: auth.loading,
    error: null,
    accessToken: null, // Now handled internally by apiClient
    refreshToken: null, // Now handled internally by apiClient
    login: async (email: string, password: string) => {
      try {
        await auth.login(email, password);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    logout: auth.logout,
    refreshToken: async () => {
      try {
        await auth.refreshUser();
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    initializeAuth: auth.refreshUser,
  };
};