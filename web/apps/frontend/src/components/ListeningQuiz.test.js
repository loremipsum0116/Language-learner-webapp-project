import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ListeningQuiz from './ListeningQuiz';

// Mock Audio API
const mockAudio = {
  play: jest.fn().mockResolvedValue(),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 10,
  paused: true,
  ended: false
};

global.Audio = jest.fn().mockImplementation(() => mockAudio);

// Mock fetch
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

describe('ListeningQuiz Component', () => {
  const mockListeningData = {
    id: 1,
    title: 'A1 Listening Test',
    level: 'A1',
    audio_url: '/audio/test.mp3',
    questions: [
      {
        id: 1,
        question: 'What is the speaker talking about?',
        options: ['Food', 'Weather', 'Travel', 'Work'],
        correctAnswer: 'Weather',
        timestamp: 5
      },
      {
        id: 2,
        question: 'What time is mentioned?',
        options: ['2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'],
        correctAnswer: '3:00 PM',
        timestamp: 15
      }
    ]
  };

  const mockOnComplete = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    mockAudio.play.mockClear();
    mockAudio.pause.mockClear();
  });

  it('should render listening quiz with title and level', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('A1 Listening Test')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('should show audio controls', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('button', { name: /play|재생/i })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument(); // Progress bar
  });

  it('should play audio when play button is clicked', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const playButton = screen.getByRole('button', { name: /play|재생/i });
    fireEvent.click(playButton);

    expect(Audio).toHaveBeenCalledWith('/audio/test.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('should pause audio when pause button is clicked', async () => {
    mockAudio.paused = false;

    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const pauseButton = screen.getByRole('button', { name: /pause|일시정지/i });
    fireEvent.click(pauseButton);

    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('should seek to specific timestamp when question hint is clicked', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const hintButton = screen.getByRole('button', { name: /5s.*hint|힌트/i });
    fireEvent.click(hintButton);

    expect(mockAudio.currentTime).toBe(5);
  });

  it('should display first question initially', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('What is the speaker talking about?')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('should navigate to next question after answering', async () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Answer first question
    fireEvent.click(screen.getByText('Weather'));

    await waitFor(() => {
      expect(screen.getByText('What time is mentioned?')).toBeInTheDocument();
    });

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('should show feedback for answers', async () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Select correct answer
    fireEvent.click(screen.getByText('Weather'));

    await waitFor(() => {
      expect(screen.getByText(/correct|정답/i)).toBeInTheDocument();
    });
  });

  it('should show incorrect feedback for wrong answers', async () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Select wrong answer
    fireEvent.click(screen.getByText('Food'));

    await waitFor(() => {
      expect(screen.getByText(/incorrect|오답/i)).toBeInTheDocument();
      expect(screen.getByText(/correct answer.*Weather/i)).toBeInTheDocument();
    });
  });

  it('should submit results after completing all questions', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { id: 1, score: 2, totalQuestions: 2 },
        progress: { completedListening: 1 }
      })
    });

    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Complete both questions correctly
    fireEvent.click(screen.getByText('Weather'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('3:00 PM'));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/listening/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          listeningId: 1,
          answers: [
            { questionId: 1, selectedAnswer: 'Weather', isCorrect: true },
            { questionId: 2, selectedAnswer: '3:00 PM', isCorrect: true }
          ],
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

  it('should show progress bar and question counter', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '2');
  });

  it('should handle audio loading errors', async () => {
    mockAudio.addEventListener.mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(() => callback(), 10);
      }
    });

    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('audio'));
    });
  });

  it('should update progress bar as audio plays', () => {
    mockAudio.addEventListener.mockImplementation((event, callback) => {
      if (event === 'timeupdate') {
        mockAudio.currentTime = 5;
        callback();
      }
    });

    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Simulate timeupdate
    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')[1];
    timeUpdateCallback();

    const progressBar = screen.getByRole('slider');
    expect(progressBar).toHaveValue('5');
  });

  it('should allow manual seeking in audio', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const seekSlider = screen.getByRole('slider');
    fireEvent.change(seekSlider, { target: { value: '7' } });

    expect(mockAudio.currentTime).toBe(7);
  });

  it('should show different audio controls based on playback state', () => {
    const { rerender } = render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('button', { name: /play|재생/i })).toBeInTheDocument();

    // Simulate playing state
    mockAudio.paused = false;
    
    rerender(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('button', { name: /pause|일시정지/i })).toBeInTheDocument();
  });

  it('should show volume control', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const volumeSlider = screen.getByRole('slider', { name: /volume|음량/i });
    expect(volumeSlider).toBeInTheDocument();
  });

  it('should adjust volume when volume slider is changed', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const volumeSlider = screen.getByRole('slider', { name: /volume|음량/i });
    fireEvent.change(volumeSlider, { target: { value: '0.5' } });

    expect(mockAudio.volume).toBe(0.5);
  });

  it('should be accessible with proper ARIA labels', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('main')).toHaveAttribute('aria-label', /listening/i);
    
    const audioControls = screen.getByRole('group', { name: /audio controls|오디오 컨트롤/i });
    expect(audioControls).toBeInTheDocument();

    const questionSection = screen.getByRole('region', { name: /question|문제/i });
    expect(questionSection).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts for audio control', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Space key should play/pause
    fireEvent.keyDown(document, { key: ' ', code: 'Space' });
    expect(mockAudio.play).toHaveBeenCalled();

    // Arrow keys should seek
    fireEvent.keyDown(document, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(mockAudio.currentTime).toBeGreaterThan(0);
  });

  it('should show replay button after audio ends', async () => {
    mockAudio.addEventListener.mockImplementation((event, callback) => {
      if (event === 'ended') {
        mockAudio.ended = true;
        callback();
      }
    });

    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    // Simulate audio ended
    const endedCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'ended')[1];
    endedCallback();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /replay|다시 재생/i })).toBeInTheDocument();
    });
  });

  it('should close quiz when close button is clicked', () => {
    render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close|닫기/i });
    fireEvent.click(closeButton);

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should cleanup audio on unmount', () => {
    const { unmount } = render(
      <ListeningQuiz
        listeningData={mockListeningData}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />
    );

    unmount();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.removeEventListener).toHaveBeenCalled();
  });
});