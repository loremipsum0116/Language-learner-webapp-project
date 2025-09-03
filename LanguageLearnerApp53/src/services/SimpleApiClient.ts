// Simple API Client for Expo Go compatibility
export const apiClient = {
  dictionary: {
    search: async (query: string) => {
      // Mock data for demo
      return {
        data: {
          entries: [
            {
              id: 1,
              lemma: query || 'hello',
              pos: 'noun',
              levelCEFR: 'A1',
              ipa: '/həˈloʊ/',
              examples: [
                {
                  kind: 'gloss',
                  ko: '안녕, 여보세요',
                },
                {
                  kind: 'example',
                  en: 'Hello, how are you?',
                  ko: '안녕하세요, 어떻게 지내세요?',
                },
              ],
              ko_gloss: '안녕, 여보세요',
            },
          ],
        },
      };
    },
  },
  
  request: async (url: string, options?: any) => {
    // Mock API requests for demo
    console.log('API Request:', url, options);
    
    if (url.includes('/my-wordbook')) {
      return {
        data: {
          words: [
            {
              id: 1,
              lemma: 'hello',
              category: { id: 1, name: '기본 단어' },
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              lemma: 'world',
              category: { id: 1, name: '기본 단어' },
              createdAt: new Date().toISOString(),
            },
          ],
          categories: [
            { id: 1, name: '기본 단어', count: 2 },
          ],
        },
      };
    }
    
    if (url.includes('/reading/practice')) {
      return {
        data: [
          {
            id: 1,
            level: 'A1',
            passage: 'This is a simple reading passage for beginners.',
            question: 'What is this passage about?',
            options: {
              A: 'Reading practice',
              B: 'Writing skills',
              C: 'Speaking practice',
              D: 'Listening skills',
            },
            correctAnswer: 'A',
            explanation: 'This passage is specifically about reading practice for beginners.',
          },
        ],
      };
    }
    
    return { data: null };
  },
};