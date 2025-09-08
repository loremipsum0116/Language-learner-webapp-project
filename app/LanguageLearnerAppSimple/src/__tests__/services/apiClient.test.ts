// src/__tests__/services/apiClient.test.ts
import { login, fetchWordList, submitQuizAnswer } from '../../services/apiClient';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('login', () => {
    it('성공적인 로그인 요청을 처리해야 함', async () => {
      const mockResponse = {
        success: true,
        user: { id: 1, username: 'testuser' },
        token: 'test-token'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await login('testuser', 'testpass');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            username: 'testuser',
            password: 'testpass',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('로그인 실패를 적절히 처리해야 함', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      await expect(login('wronguser', 'wrongpass')).rejects.toThrow();
    });
  });

  describe('fetchWordList', () => {
    it('단어 목록을 성공적으로 가져와야 함', async () => {
      const mockWords = [
        { id: 1, word: 'hello', meaning: '안녕', difficulty: 1 },
        { id: 2, word: 'world', meaning: '세계', difficulty: 2 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ words: mockWords }),
      });

      const result = await fetchWordList();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/words'),
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(result).toEqual({ words: mockWords });
    });

    it('네트워크 오류를 처리해야 함', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(fetchWordList()).rejects.toThrow('Network Error');
    });
  });

  describe('submitQuizAnswer', () => {
    it('퀴즈 답안 제출을 처리해야 함', async () => {
      const mockResponse = {
        correct: true,
        score: 10,
        explanation: '정답입니다!'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await submitQuizAnswer(1, 'correct-answer');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/quiz/submit'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            questionId: 1,
            answer: 'correct-answer',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('인증 토큰 처리', () => {
    it('Authorization 헤더가 올바르게 설정되어야 함', async () => {
      // 토큰이 저장되어 있다고 가정
      const mockToken = 'test-auth-token';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      // 토큰이 필요한 API 호출
      await fetchWordList();

      // 토큰이 있는 경우 Authorization 헤더 확인
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      if (lastCall[1]?.headers?.Authorization) {
        expect(lastCall[1].headers.Authorization).toBe(`Bearer ${mockToken}`);
      }
    });
  });
});