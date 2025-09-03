import Voice from '@react-native-voice/voice';

export interface RecognitionResult {
  transcription: string;
  confidence: number;
  alternatives?: string[];
  language: string;
  isFinal: boolean;
}

export interface RecognitionError {
  code: string;
  message: string;
}

export interface RecognitionProgress {
  isListening: boolean;
  partialResults: string[];
  volume?: number;
}

export class VoiceRecognitionService {
  private isListening: boolean = false;
  private currentLanguage: string = 'ko-KR';
  private onResult?: (result: RecognitionResult) => void;
  private onError?: (error: RecognitionError) => void;
  private onProgress?: (progress: RecognitionProgress) => void;
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;

  constructor() {
    this.setupVoiceListeners();
  }

  private setupVoiceListeners() {
    Voice.onSpeechStart = this.handleSpeechStart.bind(this);
    Voice.onSpeechEnd = this.handleSpeechEnd.bind(this);
    Voice.onSpeechError = this.handleSpeechError.bind(this);
    Voice.onSpeechResults = this.handleSpeechResults.bind(this);
    Voice.onSpeechPartialResults = this.handlePartialResults.bind(this);
    Voice.onSpeechVolumeChanged = this.handleVolumeChanged.bind(this);
  }

  private handleSpeechStart() {
    console.log('Speech recognition started');
    this.isListening = true;
    if (this.onSpeechStart) {
      this.onSpeechStart();
    }
  }

  private handleSpeechEnd() {
    console.log('Speech recognition ended');
    this.isListening = false;
    if (this.onSpeechEnd) {
      this.onSpeechEnd();
    }
  }

  private handleSpeechError(error: any) {
    console.error('Speech recognition error:', error);
    this.isListening = false;
    
    if (this.onError) {
      this.onError({
        code: error.code || 'UNKNOWN_ERROR',
        message: this.getErrorMessage(error.code),
      });
    }
  }

  private handleSpeechResults(event: any) {
    const results = event.value || [];
    if (results.length > 0) {
      const transcription = results[0];
      const confidence = event.confidence?.[0] || 0.8;
      
      if (this.onResult) {
        this.onResult({
          transcription,
          confidence,
          alternatives: results.slice(1),
          language: this.currentLanguage,
          isFinal: true,
        });
      }
    }
  }

  private handlePartialResults(event: any) {
    const partialResults = event.value || [];
    
    if (this.onProgress) {
      this.onProgress({
        isListening: this.isListening,
        partialResults,
      });
    }
  }

  private handleVolumeChanged(event: any) {
    const volume = event.value;
    
    if (this.onProgress) {
      this.onProgress({
        isListening: this.isListening,
        partialResults: [],
        volume,
      });
    }
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      '1': '네트워크 오류가 발생했습니다.',
      '2': '네트워크 연결 시간이 초과되었습니다.',
      '3': '오디오 오류가 발생했습니다.',
      '4': '서버 오류가 발생했습니다.',
      '5': '클라이언트 오류가 발생했습니다.',
      '6': '음성 입력 시간이 초과되었습니다.',
      '7': '일치하는 결과를 찾을 수 없습니다.',
      '8': '인식이 중단되었습니다.',
      '9': '권한이 거부되었습니다.',
    };

    return errorMessages[errorCode] || '알 수 없는 오류가 발생했습니다.';
  }

  async startListening(
    language: string = 'ko-KR',
    options?: {
      onResult?: (result: RecognitionResult) => void;
      onError?: (error: RecognitionError) => void;
      onProgress?: (progress: RecognitionProgress) => void;
      onSpeechStart?: () => void;
      onSpeechEnd?: () => void;
      continuous?: boolean;
      partialResults?: boolean;
    }
  ): Promise<void> {
    if (this.isListening) {
      await this.stopListening();
    }

    this.currentLanguage = language;
    this.onResult = options?.onResult;
    this.onError = options?.onError;
    this.onProgress = options?.onProgress;
    this.onSpeechStart = options?.onSpeechStart;
    this.onSpeechEnd = options?.onSpeechEnd;

    try {
      const voiceOptions = {
        locale: language,
        partialResults: options?.partialResults ?? true,
        continuous: options?.continuous ?? false,
        interimResults: true,
        maxAlternatives: 3,
      };

      await Voice.start(voiceOptions.locale, voiceOptions);
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    try {
      await Voice.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to stop voice recognition:', error);
    }
  }

  async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to cancel voice recognition:', error);
    }
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  getSupportedLanguages(): Promise<string[]> {
    return Voice.getSupportedLanguages();
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await Voice.isAvailable();
    } catch (error) {
      console.error('Voice recognition availability check failed:', error);
      return false;
    }
  }

  getLanguageDisplayName(languageCode: string): string {
    const languages: { [key: string]: string } = {
      'ko-KR': '한국어',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'ja-JP': '日本語',
      'zh-CN': '中文 (简体)',
      'zh-TW': '中文 (繁體)',
      'es-ES': 'Español',
      'fr-FR': 'Français',
      'de-DE': 'Deutsch',
      'it-IT': 'Italiano',
      'pt-BR': 'Português (Brasil)',
      'ru-RU': 'Русский',
      'ar-SA': 'العربية',
      'hi-IN': 'हिन्दी',
      'th-TH': 'ไทย',
      'vi-VN': 'Tiếng Việt',
    };

    return languages[languageCode] || languageCode;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('Voice recognition not available');
      }
      return true;
    } catch (error) {
      console.error('Voice recognition permission check failed:', error);
      return false;
    }
  }

  cleanup(): void {
    if (this.isListening) {
      this.cancelListening();
    }
    
    Voice.removeAllListeners();
    this.onResult = undefined;
    this.onError = undefined;
    this.onProgress = undefined;
    this.onSpeechStart = undefined;
    this.onSpeechEnd = undefined;
  }

  async performDictation(
    targetText: string,
    language: string = 'ko-KR',
    options?: {
      timeout?: number;
      onProgress?: (progress: RecognitionProgress) => void;
      onAccuracyUpdate?: (accuracy: number, errors: string[]) => void;
    }
  ): Promise<{
    transcription: string;
    accuracy: number;
    errors: string[];
    completionTime: number;
  }> {
    const startTime = Date.now();
    let transcription = '';
    const errors: string[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stopListening();
        reject(new Error('Dictation timeout'));
      }, options?.timeout || 30000);

      this.startListening(language, {
        onResult: (result) => {
          transcription = result.transcription;
          const accuracy = this.calculateAccuracy(targetText, transcription);
          const detectedErrors = this.detectErrors(targetText, transcription);
          
          if (options?.onAccuracyUpdate) {
            options.onAccuracyUpdate(accuracy, detectedErrors);
          }

          clearTimeout(timeout);
          resolve({
            transcription,
            accuracy,
            errors: detectedErrors,
            completionTime: Date.now() - startTime,
          });
        },
        onError: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        onProgress: options?.onProgress,
        partialResults: true,
      });
    });
  }

  private calculateAccuracy(target: string, transcription: string): number {
    if (!target || !transcription) return 0;

    const targetWords = target.toLowerCase().trim().split(/\s+/);
    const transcribedWords = transcription.toLowerCase().trim().split(/\s+/);

    const maxLength = Math.max(targetWords.length, transcribedWords.length);
    if (maxLength === 0) return 100;

    let matches = 0;
    const minLength = Math.min(targetWords.length, transcribedWords.length);

    for (let i = 0; i < minLength; i++) {
      if (targetWords[i] === transcribedWords[i]) {
        matches++;
      }
    }

    return Math.round((matches / maxLength) * 100);
  }

  private detectErrors(target: string, transcription: string): string[] {
    const errors: string[] = [];
    const targetWords = target.toLowerCase().trim().split(/\s+/);
    const transcribedWords = transcription.toLowerCase().trim().split(/\s+/);

    if (transcribedWords.length > targetWords.length) {
      errors.push('추가된 단어가 있습니다');
    } else if (transcribedWords.length < targetWords.length) {
      errors.push('누락된 단어가 있습니다');
    }

    const minLength = Math.min(targetWords.length, transcribedWords.length);
    for (let i = 0; i < minLength; i++) {
      if (targetWords[i] !== transcribedWords[i]) {
        errors.push(`"${targetWords[i]}" → "${transcribedWords[i]}" (잘못 인식됨)`);
      }
    }

    return errors;
  }
}

export default new VoiceRecognitionService();