import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VocabCard from './VocabCard';

// Mock the global fetch function
global.fetch = jest.fn();

// Mock auth context
const mockAuthContext = {
  user: { id: 1, email: 'test@example.com' }
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Mock react-toastify
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn()
};

jest.mock('react-toastify', () => ({
  toast: mockToast
}));

describe('VocabCard Component', () => {
  const mockVocab = {
    id: 1,
    lemma: 'apple',
    pos: 'noun',
    levelCEFR: 'A1',
    dictentry: {
      gloss: '사과',
      examples: [
        {
          kind: 'example',
          en: 'I eat an apple.',
          ko: '나는 사과를 먹는다.'
        }
      ]
    }
  };

  const mockOnAddToWordbook = jest.fn();
  const mockOnDetailClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should render vocabulary card with basic information', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('noun')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('사과')).toBeInTheDocument();
  });

  it('should display example sentence when available', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    expect(screen.getByText('I eat an apple.')).toBeInTheDocument();
    expect(screen.getByText('나는 사과를 먹는다.')).toBeInTheDocument();
  });

  it('should call onDetailClick when detail button is clicked', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const detailButton = screen.getByRole('button', { name: /detail|상세/i });
    fireEvent.click(detailButton);

    expect(mockOnDetailClick).toHaveBeenCalledWith(mockVocab);
  });

  it('should add to wordbook when add button is clicked', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Added to wordbook' })
    });

    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const addButton = screen.getByRole('button', { name: /add|추가/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/vocab/add-to-wordbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ vocabId: 1 })
      });
    });

    expect(mockOnAddToWordbook).toHaveBeenCalledWith(mockVocab);
  });

  it('should handle error when adding to wordbook fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Already in wordbook' })
    });

    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const addButton = screen.getByRole('button', { name: /add|추가/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Already in wordbook');
    });

    expect(mockOnAddToWordbook).not.toHaveBeenCalled();
  });

  it('should display different styling for different CEFR levels', () => {
    const { rerender } = render(
      <VocabCard
        vocab={{ ...mockVocab, levelCEFR: 'A1' }}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const a1Badge = screen.getByText('A1');
    expect(a1Badge).toHaveClass('badge-primary');

    rerender(
      <VocabCard
        vocab={{ ...mockVocab, levelCEFR: 'C2' }}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const c2Badge = screen.getByText('C2');
    expect(c2Badge).toHaveClass('badge-danger');
  });

  it('should handle vocabulary without examples gracefully', () => {
    const vocabWithoutExamples = {
      ...mockVocab,
      dictentry: {
        gloss: '사과',
        examples: []
      }
    };

    render(
      <VocabCard
        vocab={vocabWithoutExamples}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('사과')).toBeInTheDocument();
    expect(screen.queryByText('I eat an apple.')).not.toBeInTheDocument();
  });

  it('should handle vocabulary without dictentry gracefully', () => {
    const vocabWithoutDictentry = {
      id: 1,
      lemma: 'test',
      pos: 'noun',
      levelCEFR: 'A1'
    };

    render(
      <VocabCard
        vocab={vocabWithoutDictentry}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('should show loading state when adding to wordbook', async () => {
    fetch.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: async () => ({ message: 'Added' })
      }), 100);
    }));

    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const addButton = screen.getByRole('button', { name: /add|추가/i });
    fireEvent.click(addButton);

    expect(addButton).toBeDisabled();
    expect(screen.getByText(/loading|로딩/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(addButton).not.toBeDisabled();
    });
  });

  it('should display pronunciation when available', () => {
    const vocabWithPronunciation = {
      ...mockVocab,
      dictentry: {
        ...mockVocab.dictentry,
        pronunciation: '/ˈæpəl/'
      }
    };

    render(
      <VocabCard
        vocab={vocabWithPronunciation}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    expect(screen.getByText('/ˈæpəl/')).toBeInTheDocument();
  });

  it('should handle audio playback when audio button is clicked', async () => {
    const mockAudio = {
      play: jest.fn().mockResolvedValue(),
      pause: jest.fn()
    };

    // Mock Audio constructor
    global.Audio = jest.fn().mockImplementation(() => mockAudio);

    const vocabWithAudio = {
      ...mockVocab,
      dictentry: {
        ...mockVocab.dictentry,
        audioLocal: JSON.stringify({
          mp3: '/audio/apple.mp3'
        })
      }
    };

    render(
      <VocabCard
        vocab={vocabWithAudio}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const audioButton = screen.getByRole('button', { name: /play|재생/i });
    fireEvent.click(audioButton);

    expect(Audio).toHaveBeenCalledWith('/audio/apple.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('should be accessible with proper ARIA labels', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('apple'));

    const addButton = screen.getByRole('button', { name: /add|추가/i });
    expect(addButton).toHaveAttribute('aria-label', expect.stringContaining('wordbook'));

    const detailButton = screen.getByRole('button', { name: /detail|상세/i });
    expect(detailButton).toHaveAttribute('aria-label', expect.stringContaining('detail'));
  });

  it('should handle keyboard navigation', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
      />
    );

    const detailButton = screen.getByRole('button', { name: /detail|상세/i });
    
    detailButton.focus();
    fireEvent.keyDown(detailButton, { key: 'Enter', code: 'Enter' });
    
    expect(mockOnDetailClick).toHaveBeenCalledWith(mockVocab);
  });

  it('should show already added state when vocabulary is in wordbook', () => {
    render(
      <VocabCard
        vocab={mockVocab}
        onAddToWordbook={mockOnAddToWordbook}
        onDetailClick={mockOnDetailClick}
        isInWordbook={true}
      />
    );

    const addButton = screen.getByRole('button', { name: /added|추가됨/i });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveClass('btn-success');
  });
});