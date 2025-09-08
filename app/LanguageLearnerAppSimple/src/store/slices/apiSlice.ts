import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../index';
import { ApiResponse, User, Vocab, LoginRequest } from '@/types';

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:3001/api/mobile/',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['User', 'Vocab', 'Progress'],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation<
      ApiResponse<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>,
      LoginRequest
    >({
      query: (credentials) => ({
        url: '../auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User'],
    }),

    refreshToken: builder.mutation<
      ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>,
      { refreshToken: string }
    >({
      query: ({ refreshToken }) => ({
        url: '../auth/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
    }),

    // Vocabulary endpoints
    getVocabularies: builder.query<
      ApiResponse<{
        vocabularies: Vocab[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          hasNext: boolean;
        };
      }>,
      { page?: number; limit?: number; level?: string }
    >({
      query: ({ page = 1, limit = 20, level }) => ({
        url: 'vocab/paginated',
        params: { page, limit, level },
      }),
      providesTags: ['Vocab'],
    }),

    getVocabDetails: builder.query<ApiResponse<Vocab>, number>({
      query: (id) => `vocab/${id}`,
      providesTags: ['Vocab'],
    }),

    // Audio endpoints
    getCompressedAudio: builder.query<Blob, { path: string; bitrate?: number }>({
      query: ({ path, bitrate = 64 }) => ({
        url: 'audio/compressed',
        params: { path, bitrate },
        responseHandler: 'blob',
      }),
    }),

    // Sync endpoints
    syncProgress: builder.mutation<
      ApiResponse<{ synced: number; failed: number }>,
      {
        srsCompletions?: any[];
        progressUpdates?: any[];
      }
    >({
      query: (syncData) => ({
        url: 'sync',
        method: 'POST',
        body: syncData,
      }),
      invalidatesTags: ['Progress'],
    }),

    // User profile endpoints
    getUserProfile: builder.query<ApiResponse<User>, void>({
      query: () => '../user/profile',
      providesTags: ['User'],
    }),

    updateUserProfile: builder.mutation<
      ApiResponse<User>,
      Partial<User>
    >({
      query: (updates) => ({
        url: '../user/profile',
        method: 'PATCH',
        body: updates,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshTokenMutation,
  useGetVocabulariesQuery,
  useGetVocabDetailsQuery,
  useGetCompressedAudioQuery,
  useSyncProgressMutation,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
} = apiSlice;