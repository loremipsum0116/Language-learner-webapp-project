import { storage } from '@/utils';

const BASE_URL = 'http://localhost:3001/api';

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  requiresAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await storage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async buildHeaders(
    customHeaders: Record<string, string> = {},
    requiresAuth = true,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (requiresAuth) {
      const authHeaders = await this.getAuthHeaders();
      Object.assign(headers, authHeaders);
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    config: RequestConfig = {},
  ): Promise<T> {
    const {
      method = 'GET',
      headers: customHeaders = {},
      body,
      requiresAuth = true,
    } = config;

    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.buildHeaders(customHeaders, requiresAuth);

    const requestConfig: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      requestConfig.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestConfig);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0') {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      // Handle blob responses (for audio files)
      if (contentType?.includes('audio/') || contentType?.includes('octet-stream')) {
        return (await response.blob()) as unknown as T;
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      console.error('API Request failed:', { url, method, error });
      throw error;
    }
  }

  // Auth endpoints
  auth = {
    login: (credentials: { email: string; password: string; deviceInfo?: any }) =>
      this.request('/auth/login', {
        method: 'POST',
        body: credentials,
        requiresAuth: false,
      }),

    register: (userData: { email: string; password: string; preferences?: any }) =>
      this.request('/auth/register', {
        method: 'POST',
        body: userData,
        requiresAuth: false,
      }),

    refreshToken: (refreshToken: string) =>
      this.request('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        requiresAuth: false,
      }),

    logout: () =>
      this.request('/auth/logout', { method: 'POST' }),
  };

  // Mobile-specific endpoints
  mobile = {
    vocab: {
      paginated: (params: { page?: number; limit?: number; level?: string }) =>
        this.request(`/mobile/vocab/paginated?${new URLSearchParams({
          page: String(params.page || 1),
          limit: String(params.limit || 20),
          ...(params.level ? { level: params.level } : {}),
        })}`),

      details: (id: number) =>
        this.request(`/mobile/vocab/${id}`),
    },

    audio: {
      compressed: (path: string, bitrate = 64) =>
        this.request(`/mobile/audio/compressed?path=${encodeURIComponent(path)}&bitrate=${bitrate}`),
    },

    sync: (data: { srsCompletions?: any[]; progressUpdates?: any[] }) =>
      this.request('/mobile/sync', { method: 'POST', body: data }),
  };

  // User endpoints
  user = {
    profile: () => this.request('/user/profile'),
    updateProfile: (updates: any) =>
      this.request('/user/profile', { method: 'PATCH', body: updates }),
  };
}

export const apiClient = new ApiClient(BASE_URL);
export default apiClient;