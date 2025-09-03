import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import { RootState, AppDispatch } from '@/store';
import {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateTokens,
} from '@/store/slices/authSlice';
import { useLoginMutation, useRefreshTokenMutation } from '@/store/slices/apiSlice';
import { storage } from '@/utils';
import { LoginRequest } from '@/types';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);
  const [loginMutation] = useLoginMutation();
  const [refreshTokenMutation] = useRefreshTokenMutation();

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      dispatch(loginStart());
      const response = await loginMutation(credentials).unwrap();
      
      if (response.data) {
        const { user, accessToken, refreshToken } = response.data;
        
        // Store tokens in AsyncStorage
        await storage.setItem('accessToken', accessToken);
        await storage.setItem('refreshToken', refreshToken);
        await storage.setItem('user', JSON.stringify(user));
        
        dispatch(loginSuccess({ user, accessToken, refreshToken }));
        return { success: true };
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  }, [dispatch, loginMutation]);

  const logoutUser = useCallback(async () => {
    try {
      // Clear stored tokens
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      await storage.removeItem('user');
      
      dispatch(logout());
    } catch (error) {
      console.error('Logout error:', error);
      // Still dispatch logout even if storage clear fails
      dispatch(logout());
    }
  }, [dispatch]);

  const refreshAuthToken = useCallback(async () => {
    try {
      if (!auth.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await refreshTokenMutation({
        refreshToken: auth.refreshToken,
      }).unwrap();

      if (response.data) {
        const { accessToken, refreshToken } = response.data;
        
        // Update stored tokens
        await storage.setItem('accessToken', accessToken);
        await storage.setItem('refreshToken', refreshToken);
        
        dispatch(updateTokens({ accessToken, refreshToken }));
        return { success: true };
      } else {
        throw new Error(response.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      await logoutUser();
      return { success: false };
    }
  }, [auth.refreshToken, refreshTokenMutation, dispatch, logoutUser]);

  const initializeAuth = useCallback(async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        storage.getItem('accessToken'),
        storage.getItem('refreshToken'),
        storage.getItem('user'),
      ]);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson);
        dispatch(loginSuccess({ user, accessToken, refreshToken }));
      }
    } catch (error) {
      console.error('Initialize auth error:', error);
      // Clear potentially corrupted data
      await logoutUser();
    }
  }, [dispatch, logoutUser]);

  return {
    ...auth,
    login,
    logout: logoutUser,
    refreshToken: refreshAuthToken,
    initializeAuth,
  };
};