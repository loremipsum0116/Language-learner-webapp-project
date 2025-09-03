import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MiniQuiz from './MiniQuiz';

// Mock the global fetch function
global.fetch = jest.fn();

// Mock react-toastify
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

jest.mock('react-toastify', () => ({
  toast: mockToast
}));

describe('MiniQuiz Component', () => {
  const mockQuizData = {
    questions: [
      {
        id: 1,
        question: 'What is the meaning of "apple"?',
        options: ['사과', '바나나', '오렌지', '포도'],
        correctAnswer: '사과',
        word: 'apple',
        pos: 'noun'
      },
      {
        id: 2,
        question: 'What is the meaning of "book"?',
        options: ['책', '펜', '종이', '연필'],
        correctAnswer: '책',
        word: 'book',
        pos: 'noun'
      }
    ],
    level: 'A1',
    quizType: 'multiple_choice'
  };

  const mockOnComplete = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should render quiz questions correctly', () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('What is the meaning of "apple"?')).toBeInTheDocument();
    expect(screen.getByText('사과')).toBeInTheDocument();
    expect(screen.getByText('바나나')).toBeInTheDocument();
    expect(screen.getByText('오렌지')).toBeInTheDocument();
    expect(screen.getByText('포도')).toBeInTheDocument();
  });

  it('should show progress indicator', () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('should navigate to next question when answer is selected', async () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Answer first question
    const correctOption = screen.getByText('사과');
    fireEvent.click(correctOption);

    // Should show feedback
    await waitFor(() => {
      expect(screen.getByText(/correct|정답/i)).toBeInTheDocument();
    });

    // Wait and move to next question
    await waitFor(() => {
      expect(screen.getByText('What is the meaning of "book"?')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('should show correct feedback for wrong answers', async () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Select wrong answer
    const wrongOption = screen.getByText('바나나');
    fireEvent.click(wrongOption);

    await waitFor(() => {
      expect(screen.getByText(/incorrect|오답/i)).toBeInTheDocument();
    });

    // Should show correct answer
    expect(screen.getByText(/correct answer.*사과/i)).toBeInTheDocument();
  });

  it('should complete quiz and submit results', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        result: { id: 1, score: 1, totalQuestions: 2 },
        progress: { completedQuizzes: 1 }
      })
    });

    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Answer first question correctly
    fireEvent.click(screen.getByText('사과'));
    
    await waitFor(() => {
      expect(screen.getByText('What is the meaning of "book"?')).toBeInTheDocument();
    });

    // Answer second question correctly
    fireEvent.click(screen.getByText('책'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          quizId: expect.any(String),
          answers: [
            { questionId: 1, selectedAnswer: '사과', isCorrect: true },
            { questionId: 2, selectedAnswer: '책', isCorrect: true }
          ],
          level: 'A1',
          quizType: 'multiple_choice',
          score: 2,
          totalQuestions: 2
        })
      });
    });

    expect(mockOnComplete).toHaveBeenCalledWith({
      score: 2,
      totalQuestions: 2,
      percentage: 100
    });
  });

  it('should show final results screen', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        result: { id: 1, score: 1, totalQuestions: 2 }
      })
    });

    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Complete both questions
    fireEvent.click(screen.getByText('사과'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('책'));
    });

    // Should show results
    await waitFor(() => {
      expect(screen.getByText(/quiz complete|퀴즈 완료/i)).toBeInTheDocument();
      expect(screen.getByText(/2.*2/)).toBeInTheDocument(); // Score display
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });
  });

  it('should handle quiz close', () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close|닫기/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show timer when enabled', () => {
    const timedQuizData = {
      ...mockQuizData,
      timeLimit: 30
    };

    render(
      <MiniQuiz
        quizData={timedQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
        showTimer={true}
      />
    );

    expect(screen.getByText(/30/)).toBeInTheDocument(); // Timer display
  });

  it('should auto-submit when timer expires', async () => {
    const timedQuizData = {
      ...mockQuizData,
      timeLimit: 1 // 1 second
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { score: 0, totalQuestions: 2 } })
    });

    render(
      <MiniQuiz
        quizData={timedQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
        showTimer={true}
      />
    );

    // Wait for timer to expire
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/quiz/submit', expect.any(Object));
    }, { timeout: 2000 });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should handle different question types', () => {
    const fillBlankQuiz = {
      questions: [
        {
          id: 1,
          sentence: 'I have an ___.',
          correctAnswer: 'apple',
          word: 'apple',
          type: 'fill_blank'
        }
      ],
      level: 'A1',
      quizType: 'fill_blank'
    };

    render(
      <MiniQuiz
        quizData={fillBlankQuiz}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('I have an ___.', )).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should handle keyboard input for fill-in-the-blank questions', async () => {
    const fillBlankQuiz = {
      questions: [
        {
          id: 1,
          sentence: 'I eat an ___.',
          correctAnswer: 'apple',
          word: 'apple',
          type: 'fill_blank'
        }
      ],
      level: 'A1',
      quizType: 'fill_blank'
    };

    render(
      <MiniQuiz
        quizData={fillBlankQuiz}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'apple' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/correct|정답/i)).toBeInTheDocument();
    });
  });

  it('should be accessible with proper ARIA labels', () => {
    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('main')).toHaveAttribute('aria-label', /quiz|퀴즈/i);
    expect(screen.getByText('What is the meaning of "apple"?')).toHaveAttribute('role', 'heading');
    
    const options = screen.getAllByRole('button', { name: /사과|바나나|오렌지|포도/ });
    options.forEach(option => {
      expect(option).toHaveAttribute('aria-label', expect.stringContaining('option'));
    });
  });

  it('should show loading state while submitting', async () => {
    fetch.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: async () => ({ result: { score: 1 } })
      }), 100);
    }));

    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Complete quiz quickly
    fireEvent.click(screen.getByText('사과'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('책'));
    });

    // Should show loading
    await waitFor(() => {
      expect(screen.getByText(/loading|제출 중/i)).toBeInTheDocument();
    });
  });

  it('should handle network errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Complete quiz
    fireEvent.click(screen.getByText('사과'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('책'));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('error'));
    });
  });

  it('should restart quiz when restart button is clicked', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { score: 1, totalQuestions: 2 } })
    });

    render(
      <MiniQuiz
        quizData={mockQuizData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
        allowRestart={true}
      />
    );

    // Complete quiz
    fireEvent.click(screen.getByText('사과'));
    await waitFor(() => {
      fireEvent.click(screen.getByText('책'));
    });

    // Should show restart option
    await waitFor(() => {
      const restartButton = screen.getByRole('button', { name: /restart|다시 시작/i });
      fireEvent.click(restartButton);
    });

    // Should be back to first question
    expect(screen.getByText('What is the meaning of "apple"?')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
});