import { storage } from '@/utils';
import { API_URL } from '@/config';

const BASE_URL = API_URL;

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  requiresAuth?: boolean;
  credentials?: 'include' | 'omit' | 'same-origin';
  signal?: AbortSignal;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    // React Native uses token-based auth, web uses cookies
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
      credentials = 'include',
      signal,
      timeout = 8000,
    } = config;

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.buildHeaders(customHeaders, requiresAuth);

    // Create timeout controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

    // Combine signals if external signal provided
    const finalSignal = signal || timeoutController.signal;

    const requestConfig: RequestInit = {
      method,
      headers,
      credentials,
      signal: finalSignal,
    };

    if (body && method !== 'GET') {
      requestConfig.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestConfig);

      // Clear timeout
      clearTimeout(timeoutId);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        // Clear stored tokens
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        const error = new Error('Unauthorized');
        (error as any).status = 401;
        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }

        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      // Handle empty responses (204, 205)
      if (response.status === 204 || response.status === 205) {
        return { ok: true } as unknown as T;
      }

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
    } catch (error: any) {
      // Handle abort errors
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        (timeoutError as any).status = 408;
        throw timeoutError;
      }
      console.error('API Request failed:', { url, method, error });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Auth endpoints - matching web frontend structure
  auth = {
    login: (credentials: { email: string; password: string; deviceInfo?: any }) =>
      this.request('/auth/login', {
        method: 'POST',
        body: credentials,
        requiresAuth: false,
        credentials: 'include',
      }),

    register: (userData: { email: string; password: string; preferences?: any }) =>
      this.request('/auth/register', {
        method: 'POST',
        body: userData,
        requiresAuth: false,
        credentials: 'include',
      }),

    refreshToken: (refreshToken: string) =>
      this.request('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        requiresAuth: false,
      }),

    logout: () =>
      this.request('/auth/logout', { 
        method: 'POST',
        credentials: 'include',
      }),

    // Get current user info
    me: () => this.request('/me', {
      credentials: 'include',
    }),
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

  // Advanced Auth endpoints
  authAdvanced = {
    getDevices: () => this.request('/auth/devices'),
    logoutDevice: (deviceId: string) => 
      this.request(`/auth/devices/${deviceId}`, { method: 'DELETE' }),
    logoutAll: () => 
      this.request('/auth/logout-all', { method: 'POST' }),
    getCurrentUser: () => this.request('/auth/me'),
  };

  // Quiz endpoints
  quiz = {
    getAll: (filters?: { category?: string; difficulty?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/quiz${params.toString() ? '?' + params.toString() : ''}`);
    },
    getById: (id: number) => this.request(`/quiz/${id}`),
    submit: (quizId: number, answers: any[]) => 
      this.request(`/quiz/${quizId}/submit`, { method: 'POST', body: { answers } }),
    getResults: (quizId: number) => this.request(`/quiz/${quizId}/results`),
  };

  // Reading endpoints
  reading = {
    getAll: (filters?: { level?: string; category?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/reading${params.toString() ? '?' + params.toString() : ''}`);
    },
    getById: (id: number) => this.request(`/reading/${id}`),
    submit: (passageId: number, answers: any[]) => 
      this.request(`/reading/${passageId}/submit`, { method: 'POST', body: { answers } }),
    getProgress: (passageId: number) => this.request(`/reading/${passageId}/progress`),
  };

  // Listening endpoints
  listening = {
    getAll: (filters?: { level?: string; category?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/listening${params.toString() ? '?' + params.toString() : ''}`);
    },
    getById: (id: number) => this.request(`/listening/${id}`),
    submit: (exerciseId: number, answers: any[]) => 
      this.request(`/listening/${exerciseId}/submit`, { method: 'POST', body: { answers } }),
    getProgress: (exerciseId: number) => this.request(`/listening/${exerciseId}/progress`),
  };

  // Dictionary endpoints
  dictionary = {
    search: (query: string, filters?: { limit?: number; level?: string }) => {
      const params = new URLSearchParams({ q: query });
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/dict/search?${params.toString()}`);
    },
    getByWord: (word: string) => this.request(`/dict/word/${encodeURIComponent(word)}`),
    suggestions: (partial: string) => 
      this.request(`/dict/suggestions?q=${encodeURIComponent(partial)}`),
  };

  // Exam Vocabulary endpoints
  examVocab = {
    getCategories: () => this.request('/exam-vocab/categories'),
    getByCategory: (categoryId: number, filters?: { limit?: number; difficulty?: string }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/exam-vocab/category/${categoryId}${params.toString() ? '?' + params.toString() : ''}`);
    },
    search: (query: string, examType?: string) => {
      const params = new URLSearchParams({ q: query });
      if (examType) params.append('examType', examType);
      return this.request(`/exam-vocab/search?${params.toString()}`);
    },
  };

  // Idioms and Phrasal Verbs endpoints
  idioms = {
    getAll: (filters?: { category?: string; difficulty?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/idiom${params.toString() ? '?' + params.toString() : ''}`);
    },
    search: (query: string) => 
      this.request(`/idiom/search?q=${encodeURIComponent(query)}`),
    getById: (id: number) => this.request(`/idiom/${id}`),
  };

  // Personal Wordbook endpoints
  wordbook = {
    getAll: () => this.request('/my-wordbook'),
    create: (name: string, description?: string) => 
      this.request('/my-wordbook', { method: 'POST', body: { name, description } }),
    getById: (id: number) => this.request(`/my-wordbook/${id}`),
    addWord: (wordbookId: number, vocabId: number, notes?: string) => 
      this.request(`/my-wordbook/${wordbookId}/words`, { 
        method: 'POST', 
        body: { vocabId, notes } 
      }),
    removeWord: (wordbookId: number, wordId: number) => 
      this.request(`/my-wordbook/${wordbookId}/words/${wordId}`, { method: 'DELETE' }),
    update: (id: number, updates: { name?: string; description?: string }) => 
      this.request(`/my-wordbook/${id}`, { method: 'PATCH', body: updates }),
    delete: (id: number) => this.request(`/my-wordbook/${id}`, { method: 'DELETE' }),
  };

  // Personal Idioms Collection endpoints
  idiomCollections = {
    getAll: () => this.request('/my-idioms'),
    create: (name: string, description?: string) => 
      this.request('/my-idioms', { method: 'POST', body: { name, description } }),
    getById: (id: number) => this.request(`/my-idioms/${id}`),
    addIdiom: (collectionId: number, idiomId: number, notes?: string) => 
      this.request(`/my-idioms/${collectionId}/idioms`, { 
        method: 'POST', 
        body: { idiomId, notes } 
      }),
    removeIdiom: (collectionId: number, idiomId: number) => 
      this.request(`/my-idioms/${collectionId}/idioms/${idiomId}`, { method: 'DELETE' }),
    update: (id: number, updates: { name?: string; description?: string }) => 
      this.request(`/my-idioms/${id}`, { method: 'PATCH', body: updates }),
    delete: (id: number) => this.request(`/my-idioms/${id}`, { method: 'DELETE' }),
  };

  // Enhanced SRS endpoints
  srs = {
    getStatus: () => this.request('/srs/status'),
    getAvailable: () => this.request('/srs/available'),
    getWaitingCount: () => this.request('/srs/waiting-count'),
    getDashboard: () => this.request('/srs/dashboard'),
    
    folders: {
      getAll: () => this.request('/srs/folders'),
      create: (name: string, description?: string, color?: string) => 
        this.request('/srs/folders/create', { 
          method: 'POST', 
          body: { name, description, color } 
        }),
      getById: (id: number) => this.request(`/srs/folders/${id}`),
      update: (id: number, updates: any) => 
        this.request(`/srs/folders/${id}`, { method: 'PATCH', body: updates }),
      delete: (id: number) => this.request(`/srs/folders/${id}`, { method: 'DELETE' }),
      getCards: (folderId: number) => this.request(`/srs/folders/${folderId}/cards`),
    },

    cards: {
      create: (vocabId: number, folderId?: number) => 
        this.request('/srs/cards', { method: 'POST', body: { vocabId, folderId } }),
      review: (cardId: number, review: any) => 
        this.request(`/srs/cards/${cardId}/review`, { method: 'POST', body: review }),
      getById: (id: number) => this.request(`/srs/cards/${id}`),
      update: (id: number, updates: any) => 
        this.request(`/srs/cards/${id}`, { method: 'PATCH', body: updates }),
      delete: (id: number) => this.request(`/srs/cards/${id}`, { method: 'DELETE' }),
    },
  };

  // Enhanced Vocabulary endpoints
  vocab = {
    getAll: (filters?: { 
      level?: string; 
      pos?: string; 
      limit?: number; 
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value));
        });
      }
      return this.request(`/vocab/list${params.toString() ? '?' + params.toString() : ''}`);
    },
    test: () => this.request('/vocab/test'),
    getByPos: (pos: string) => this.request(`/vocab/vocab-by-pos?pos=${encodeURIComponent(pos)}`),
    getById: (id: number) => this.request(`/vocab/${id}`),
  };

  // Enhanced Audio endpoints
  audio = {
    getByLevel: (level: string, filename: string) => 
      this.request(`/${level}/audio/${filename}`, { requiresAuth: false }),
    getCompressed: (path: string, bitrate = 64) => 
      this.request(`/api/mobile/audio/compressed?path=${encodeURIComponent(path)}&bitrate=${bitrate}`),
    upload: (file: FormData) => 
      this.request('/audio/upload', { 
        method: 'POST', 
        body: file,
        headers: {} // Let browser set content-type for FormData
      }),
  };

  // Learning Module endpoints
  learn = {
    getModules: (level?: string) => {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      return this.request(`/learn${params.toString() ? '?' + params.toString() : ''}`);
    },
    getModule: (moduleId: number) => this.request(`/learn/${moduleId}`),
    startLesson: (moduleId: number, lessonId: number) => 
      this.request(`/learn/${moduleId}/lesson/${lessonId}/start`, { method: 'POST' }),
    completeLesson: (moduleId: number, lessonId: number, progress: any) => 
      this.request(`/learn/${moduleId}/lesson/${lessonId}/complete`, { 
        method: 'POST', 
        body: progress 
      }),
  };

  // Generic methods for backward compatibility
  get<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  put<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  patch<T = any>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  delete<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // For axios-like compatibility
  defaults = {
    timeout: 8000,
    baseURL: this.baseUrl,
  };
}

export const apiClient = new ApiClient(BASE_URL);
export default apiClient;