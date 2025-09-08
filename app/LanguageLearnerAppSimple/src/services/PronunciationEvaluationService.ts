export interface PronunciationEvaluation {
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore: number;
  phoneticDetails: PhoneticDetail[];
  feedback: EvaluationFeedback;
  recommendations: string[];
}

export interface PhoneticDetail {
  phoneme: string;
  expectedPhoneme: string;
  score: number;
  accuracy: 'correct' | 'substitution' | 'omission' | 'insertion';
  position: number;
  confidence: number;
}

export interface EvaluationFeedback {
  strengths: string[];
  weaknesses: string[];
  specificIssues: IssueDetail[];
  improvementTips: string[];
}

export interface IssueDetail {
  type: 'pronunciation' | 'rhythm' | 'intonation' | 'stress' | 'volume';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  examples?: string[];
}

export interface ServerEvaluationRequest {
  audioData: string; // base64 encoded audio
  referenceText: string;
  language: string;
  evaluationMode: 'word' | 'sentence' | 'paragraph';
  userId?: string;
  sessionId?: string;
}

export interface ServerEvaluationResponse {
  success: boolean;
  evaluation?: PronunciationEvaluation;
  error?: string;
  processingTime: number;
  credits?: number;
}

export class PronunciationEvaluationService {
  private apiEndpoint: string = 'https://api.pronunciationeval.com/v1/evaluate';
  private apiKey: string = '';
  private fallbackEnabled: boolean = true;

  constructor(apiKey?: string, endpoint?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
    if (endpoint) {
      this.apiEndpoint = endpoint;
    }
  }

  async evaluatePronunciation(
    audioUri: string,
    referenceText: string,
    language: string,
    options?: {
      mode?: 'word' | 'sentence' | 'paragraph';
      userId?: string;
      sessionId?: string;
      useServer?: boolean;
    }
  ): Promise<PronunciationEvaluation> {
    const useServer = options?.useServer ?? this.apiKey.length > 0;

    if (useServer) {
      try {
        return await this.evaluateWithServer(audioUri, referenceText, language, options);
      } catch (error) {
        console.warn('Server evaluation failed, falling back to local:', error);
        if (!this.fallbackEnabled) {
          throw error;
        }
      }
    }

    return this.evaluateLocally(audioUri, referenceText, language, options);
  }

  private async evaluateWithServer(
    audioUri: string,
    referenceText: string,
    language: string,
    options?: {
      mode?: 'word' | 'sentence' | 'paragraph';
      userId?: string;
      sessionId?: string;
    }
  ): Promise<PronunciationEvaluation> {
    try {
      // Convert audio file to base64
      const audioData = await this.convertAudioToBase64(audioUri);

      const requestData: ServerEvaluationRequest = {
        audioData,
        referenceText,
        language: this.getServerLanguageCode(language),
        evaluationMode: options?.mode || 'sentence',
        userId: options?.userId,
        sessionId: options?.sessionId,
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Version': '1.0',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Server evaluation failed: ${response.status} ${response.statusText}`);
      }

      const result: ServerEvaluationResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Server evaluation failed');
      }

      if (!result.evaluation) {
        throw new Error('Invalid server response: missing evaluation data');
      }

      return result.evaluation;

    } catch (error) {
      console.error('Server evaluation error:', error);
      throw error;
    }
  }

  private async evaluateLocally(
    audioUri: string,
    referenceText: string,
    language: string,
    options?: {
      mode?: 'word' | 'sentence' | 'paragraph';
      userId?: string;
      sessionId?: string;
    }
  ): Promise<PronunciationEvaluation> {
    // This is a simplified local evaluation for demonstration
    // In a real implementation, you would use native audio analysis libraries
    
    console.log('Performing local pronunciation evaluation...');

    const words = referenceText.toLowerCase().split(/\s+/);
    const phoneticDetails: PhoneticDetail[] = [];
    
    // Simulate phonetic analysis
    words.forEach((word, index) => {
      const phonemes = this.getPhonemes(word, language);
      phonemes.forEach((phoneme, phoneIndex) => {
        phoneticDetails.push({
          phoneme,
          expectedPhoneme: phoneme,
          score: Math.random() * 40 + 60, // Random score between 60-100
          accuracy: Math.random() > 0.8 ? 'substitution' : 'correct',
          position: index * 10 + phoneIndex,
          confidence: Math.random() * 30 + 70,
        });
      });
    });

    // Calculate scores based on local analysis
    const accuracyScore = this.calculateAccuracyScore(phoneticDetails);
    const fluencyScore = this.calculateFluencyScore(audioUri, referenceText);
    const completenessScore = this.calculateCompletenessScore(referenceText, phoneticDetails);
    const prosodyScore = this.calculateProsodyScore(audioUri);
    const overallScore = this.calculateOverallScore(accuracyScore, fluencyScore, completenessScore, prosodyScore);

    const feedback = this.generateFeedback(phoneticDetails, language);

    return {
      overallScore,
      accuracyScore,
      fluencyScore,
      completenessScore,
      prosodyScore,
      phoneticDetails,
      feedback,
      recommendations: this.generateRecommendations(feedback, language),
    };
  }

  private getPhonemes(word: string, language: string): string[] {
    // Simplified phoneme mapping - in reality, this would use proper phonetic dictionaries
    const phoneticMaps: { [key: string]: { [key: string]: string[] } } = {
      'ko-KR': {
        '안녕하세요': ['ɐn', 'njʌŋ', 'hɐ', 'se', 'jo'],
        '감사합니다': ['kɐm', 'sɐ', 'hɐm', 'ni', 'dɐ'],
        '잘': ['t͡ʃɐl'],
        '지냈어요': ['t͡ʃi', 'nɛ', 's͈ʌ', 'jo'],
      },
      'en-US': {
        'hello': ['h', 'ə', 'ˈl', 'oʊ'],
        'world': ['ˈw', 'ɝ', 'l', 'd'],
        'thank': ['θ', 'æ', 'ŋ', 'k'],
        'you': ['j', 'u'],
      },
    };

    const langMap = phoneticMaps[language] || phoneticMaps['en-US'];
    return langMap[word] || word.split('');
  }

  private calculateAccuracyScore(phoneticDetails: PhoneticDetail[]): number {
    if (phoneticDetails.length === 0) return 0;
    
    const correctPhonemes = phoneticDetails.filter(detail => detail.accuracy === 'correct');
    return Math.round((correctPhonemes.length / phoneticDetails.length) * 100);
  }

  private async calculateFluencyScore(audioUri: string, referenceText: string): Promise<number> {
    // Simplified fluency calculation based on speech rate and pauses
    // In reality, this would analyze audio timing and rhythm
    const wordCount = referenceText.split(/\s+/).length;
    const estimatedDuration = wordCount * 0.6; // Assume 0.6 seconds per word for normal speech
    
    // Simulate analysis
    const speechRate = Math.random() * 2 + 1; // 1-3 words per second
    const pauseCount = Math.floor(Math.random() * 3);
    
    let fluencyScore = 100;
    if (speechRate < 1.5) fluencyScore -= 20; // Too slow
    if (speechRate > 2.5) fluencyScore -= 15; // Too fast
    if (pauseCount > 2) fluencyScore -= 10 * pauseCount; // Too many pauses
    
    return Math.max(0, Math.min(100, fluencyScore));
  }

  private calculateCompletenessScore(referenceText: string, phoneticDetails: PhoneticDetail[]): number {
    const expectedWords = referenceText.split(/\s+/).length;
    const detectedPhonemes = phoneticDetails.filter(detail => detail.accuracy !== 'omission').length;
    const expectedPhonemes = phoneticDetails.length;
    
    if (expectedPhonemes === 0) return 100;
    
    return Math.round((detectedPhonemes / expectedPhonemes) * 100);
  }

  private async calculateProsodyScore(audioUri: string): Promise<number> {
    // Simplified prosody analysis - in reality, this would analyze pitch, stress, and rhythm
    // Simulate prosody analysis based on audio characteristics
    const pitchVariation = Math.random() * 50 + 25; // 25-75
    const stressAccuracy = Math.random() * 30 + 60; // 60-90
    const rhythmAccuracy = Math.random() * 40 + 50; // 50-90
    
    return Math.round((pitchVariation + stressAccuracy + rhythmAccuracy) / 3);
  }

  private calculateOverallScore(
    accuracy: number,
    fluency: number,
    completeness: number,
    prosody: number
  ): number {
    // Weighted average of all scores
    const weights = {
      accuracy: 0.4,
      fluency: 0.3,
      completeness: 0.2,
      prosody: 0.1,
    };

    return Math.round(
      accuracy * weights.accuracy +
      fluency * weights.fluency +
      completeness * weights.completeness +
      prosody * weights.prosody
    );
  }

  private generateFeedback(phoneticDetails: PhoneticDetail[], language: string): EvaluationFeedback {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const specificIssues: IssueDetail[] = [];
    const improvementTips: string[] = [];

    const correctPhonemes = phoneticDetails.filter(detail => detail.accuracy === 'correct');
    const incorrectPhonemes = phoneticDetails.filter(detail => detail.accuracy !== 'correct');

    // Analyze strengths
    if (correctPhonemes.length / phoneticDetails.length > 0.8) {
      strengths.push('전반적인 발음 정확도가 높습니다');
    }
    if (correctPhonemes.filter(p => p.confidence > 80).length > correctPhonemes.length * 0.7) {
      strengths.push('자신감 있는 발음을 보여줍니다');
    }

    // Analyze weaknesses and issues
    const substitutions = incorrectPhonemes.filter(p => p.accuracy === 'substitution');
    const omissions = incorrectPhonemes.filter(p => p.accuracy === 'omission');
    
    if (substitutions.length > 0) {
      weaknesses.push('일부 음소가 다른 소리로 발음되었습니다');
      specificIssues.push({
        type: 'pronunciation',
        description: `${substitutions.length}개의 음소가 잘못 발음되었습니다`,
        severity: substitutions.length > 3 ? 'high' : 'medium',
        suggestion: '정확한 입 모양과 혀 위치를 연습해보세요',
        examples: substitutions.slice(0, 3).map(s => `${s.expectedPhoneme} → ${s.phoneme}`),
      });
    }

    if (omissions.length > 0) {
      weaknesses.push('일부 소리가 누락되었습니다');
      specificIssues.push({
        type: 'pronunciation',
        description: `${omissions.length}개의 음소가 누락되었습니다`,
        severity: omissions.length > 2 ? 'high' : 'low',
        suggestion: '모든 소리를 명확하게 발음하도록 주의하세요',
      });
    }

    // Generate improvement tips based on language
    if (language === 'ko-KR') {
      improvementTips.push('받침 발음에 특히 주의하세요');
      improvementTips.push('모음의 장단을 구분하여 발음하세요');
    } else if (language === 'en-US') {
      improvementTips.push('영어의 강세와 리듬에 주의하세요');
      improvementTips.push('자음 연결음을 자연스럽게 발음하세요');
    }

    return {
      strengths,
      weaknesses,
      specificIssues,
      improvementTips,
    };
  }

  private generateRecommendations(feedback: EvaluationFeedback, language: string): string[] {
    const recommendations: string[] = [];

    // Based on specific issues
    feedback.specificIssues.forEach(issue => {
      if (issue.severity === 'high') {
        recommendations.push(`우선적으로 ${issue.type} 문제를 해결하세요: ${issue.suggestion}`);
      }
    });

    // General recommendations based on language
    if (language === 'ko-KR') {
      recommendations.push('한국어 발음 교정 영상을 시청하세요');
      recommendations.push('원어민 발음을 따라하며 연습하세요');
    } else if (language === 'en-US') {
      recommendations.push('영어 발음 기호를 학습하세요');
      recommendations.push('쉐도잉(shadowing) 기법을 활용하세요');
    }

    // Add improvement tips
    recommendations.push(...feedback.improvementTips);

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private async convertAudioToBase64(audioUri: string): Promise<string> {
    // This would typically use react-native-fs to read and encode the audio file
    // For now, return a placeholder
    return 'base64_encoded_audio_data_placeholder';
  }

  private getServerLanguageCode(language: string): string {
    const languageCodes: { [key: string]: string } = {
      'korean': 'ko-KR',
      'english': 'en-US',
      'japanese': 'ja-JP',
      'chinese': 'zh-CN',
    };
    return languageCodes[language] || 'en-US';
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setApiEndpoint(endpoint: string): void {
    this.apiEndpoint = endpoint;
  }

  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('No API key configured');
      return false;
    }

    try {
      const response = await fetch(this.apiEndpoint + '/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getCreditsRemaining(): Promise<number> {
    if (!this.apiKey) {
      return 0;
    }

    try {
      const response = await fetch(this.apiEndpoint + '/credits', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.credits || 0;
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }

    return 0;
  }

  generateDetailedReport(evaluation: PronunciationEvaluation, referenceText: string): string {
    const report = [];

    report.push('=== 발음 평가 리포트 ===\n');
    report.push(`전체 점수: ${evaluation.overallScore}/100`);
    report.push(`정확도: ${evaluation.accuracyScore}/100`);
    report.push(`유창성: ${evaluation.fluencyScore}/100`);
    report.push(`완성도: ${evaluation.completenessScore}/100`);
    report.push(`억양: ${evaluation.prosodyScore}/100\n`);

    if (evaluation.feedback.strengths.length > 0) {
      report.push('강점:');
      evaluation.feedback.strengths.forEach(strength => {
        report.push(`  ✓ ${strength}`);
      });
      report.push('');
    }

    if (evaluation.feedback.weaknesses.length > 0) {
      report.push('개선점:');
      evaluation.feedback.weaknesses.forEach(weakness => {
        report.push(`  • ${weakness}`);
      });
      report.push('');
    }

    if (evaluation.recommendations.length > 0) {
      report.push('추천사항:');
      evaluation.recommendations.forEach((rec, index) => {
        report.push(`  ${index + 1}. ${rec}`);
      });
    }

    return report.join('\n');
  }
}

export default new PronunciationEvaluationService();