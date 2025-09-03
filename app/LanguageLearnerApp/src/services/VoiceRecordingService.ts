import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSet,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import {PermissionsAndroid, Platform, AppState, AppStateStatus} from 'react-native';
import RNFS from 'react-native-fs';
import AudioOptimizationService, {AudioSession} from './AudioOptimizationService';
import HeadphoneDetection, {HeadphoneInfo} from '../utils/HeadphoneDetection';

export interface RecordingResult {
  uri: string;
  duration: number;
  size: number;
}

export interface RecordingProgress {
  currentPosition: number;
  currentMetering?: number;
}

export interface PlaybackProgress {
  currentPosition: number;
  duration: number;
}

export interface VoiceAnalysis {
  amplitude: number[];
  frequency: number[];
  pitch: number;
  volume: number;
  timestamp: number;
}

export class VoiceRecordingService {
  private audioRecorderPlayer: AudioRecorderPlayer;
  private recordingPath: string = '';
  private isRecording: boolean = false;
  private isPlaying: boolean = false;
  private recordingStartTime: number = 0;
  private amplitudeData: number[] = [];
  private onRecordingProgress?: (progress: RecordingProgress) => void;
  private onPlaybackProgress?: (progress: PlaybackProgress) => void;
  private currentSession: AudioSession | null = null;
  private headphoneInfo: HeadphoneInfo | null = null;
  private backgroundSupported: boolean = false;
  private appStateListener: any;

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.setupRecorder();
    this.initializeOptimizations();
  }

  private setupRecorder() {
    this.audioRecorderPlayer.setSubscriptionDuration(0.1); // Update every 100ms
  }

  private async initializeOptimizations() {
    try {
      // Setup audio optimization service
      await AudioOptimizationService.optimizeForDevice();
      
      // Start headphone detection
      await HeadphoneDetection.startListening();
      HeadphoneDetection.addListener(this.handleHeadphoneChange.bind(this));
      
      // Setup app state listener for background support
      this.appStateListener = AppState.addEventListener(
        'change',
        this.handleAppStateChange.bind(this)
      );

      console.log('Audio optimizations initialized');
    } catch (error) {
      console.error('Failed to initialize audio optimizations:', error);
    }
  }

  private handleHeadphoneChange(headphoneInfo: HeadphoneInfo) {
    this.headphoneInfo = headphoneInfo;
    console.log('Headphone status changed:', headphoneInfo);
    
    // Adjust recording settings based on headphone connection
    if (this.isRecording || this.isPlaying) {
      this.optimizeForCurrentDevice();
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'background' && (this.isRecording || this.isPlaying)) {
      this.handleBackgroundTransition();
    } else if (nextAppState === 'active') {
      this.handleForegroundTransition();
    }
  }

  private async handleBackgroundTransition() {
    if (!this.backgroundSupported) return;
    
    try {
      // Enable background audio if supported
      await AudioOptimizationService.enableBackgroundPlayback();
      console.log('Background audio enabled for recording/playback');
    } catch (error) {
      console.error('Failed to enable background audio:', error);
    }
  }

  private async handleForegroundTransition() {
    try {
      // Restore foreground audio settings
      await AudioOptimizationService.optimizeForDevice();
      console.log('Foreground audio restored');
    } catch (error) {
      console.error('Failed to restore foreground audio:', error);
    }
  }

  private async optimizeForCurrentDevice() {
    try {
      const recommendations = this.headphoneInfo 
        ? HeadphoneDetection.getRecommendedAudioSettings()
        : {
            volume: 0.8,
            echoCancellation: true,
            noiseSuppression: true,
            automaticGainControl: true,
          };

      // Apply recommendations to audio optimization service
      AudioOptimizationService.updateSettings({
        automaticGainControl: recommendations.automaticGainControl,
        noiseSuppression: recommendations.noiseSuppression,
        echoCancellation: recommendations.echoCancellation,
      });

      console.log('Audio optimized for current device:', recommendations);
    } catch (error) {
      console.error('Failed to optimize for current device:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        return (
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission request failed:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled in Info.plist
  }

  async startRecording(
    onProgress?: (progress: RecordingProgress) => void,
    options?: {
      enableBackgroundRecording?: boolean;
      category?: 'pronunciation' | 'dictation' | 'general';
    }
  ): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Recording permission not granted');
    }

    this.onRecordingProgress = onProgress;
    this.amplitudeData = [];
    this.recordingStartTime = Date.now();
    this.backgroundSupported = options?.enableBackgroundRecording ?? false;

    // Create audio session for optimized recording
    const timestamp = Date.now();
    const fileName = `recording_${timestamp}.aac`;
    
    this.recordingPath = Platform.select({
      ios: `${RNFS.DocumentDirectoryPath}/${fileName}`,
      android: `${RNFS.DocumentDirectoryPath}/${fileName}`,
    }) || '';

    this.currentSession = await AudioOptimizationService.createAudioSession(
      this.recordingPath,
      {
        title: `Recording ${new Date().toLocaleTimeString()}`,
        category: options?.category || 'general',
        enableBackground: this.backgroundSupported,
      }
    );

    // Optimize audio settings based on headphone connection
    await this.optimizeForCurrentDevice();

    // Configure audio set with optimizations
    const audioSet: AudioSet = {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: this.headphoneInfo?.supportsMicrophone 
        ? AudioSourceAndroidType.MIC 
        : AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 1,
      AVFormatIDKeyIOS: AVEncodingOption.aac,
      OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
    };

    try {
      const result = await this.audioRecorderPlayer.startRecorder(
        this.recordingPath,
        audioSet
      );
      
      this.isRecording = true;
      console.log('Recording started with optimizations:', result);

      // Set up recording progress listener
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        const progress: RecordingProgress = {
          currentPosition: e.currentPosition,
          currentMetering: e.currentMetering,
        };

        // Store amplitude data for waveform
        if (e.currentMetering !== undefined) {
          this.amplitudeData.push(e.currentMetering);
        }

        if (this.onRecordingProgress) {
          this.onRecordingProgress(progress);
        }
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.isRecording) {
      throw new Error('No active recording to stop');
    }

    try {
      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
      this.isRecording = false;

      const duration = Date.now() - this.recordingStartTime;
      
      // Get file size
      let size = 0;
      try {
        const fileInfo = await RNFS.stat(this.recordingPath);
        size = fileInfo.size;
      } catch (error) {
        console.warn('Could not get file size:', error);
      }

      return {
        uri: this.recordingPath,
        duration,
        size,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async startPlayback(
    uri: string,
    onProgress?: (progress: PlaybackProgress) => void,
    options?: {
      enableBackgroundPlayback?: boolean;
      category?: 'listening' | 'general';
    }
  ): Promise<void> {
    if (this.isPlaying) {
      await this.stopPlayback();
    }

    this.onPlaybackProgress = onProgress;
    this.backgroundSupported = options?.enableBackgroundPlayback ?? false;

    // Create optimized audio session for playback
    this.currentSession = await AudioOptimizationService.createAudioSession(
      uri,
      {
        title: `Playback ${new Date().toLocaleTimeString()}`,
        category: options?.category || 'listening',
        enableBackground: this.backgroundSupported,
      }
    );

    // Optimize for playback
    await this.optimizeForCurrentDevice();

    try {
      const msg = await this.audioRecorderPlayer.startPlayer(uri);
      this.isPlaying = true;
      console.log('Optimized playback started:', msg);

      this.audioRecorderPlayer.addPlayBackListener((e) => {
        const progress: PlaybackProgress = {
          currentPosition: e.currentPosition,
          duration: e.duration,
        };

        if (this.onPlaybackProgress) {
          this.onPlaybackProgress(progress);
        }

        // Auto-stop when playback finishes
        if (e.currentPosition >= e.duration) {
          this.stopPlayback();
        }
      });
    } catch (error) {
      console.error('Failed to start playback:', error);
      throw error;
    }
  }

  async stopPlayback(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }

    try {
      await this.audioRecorderPlayer.stopPlayer();
      this.audioRecorderPlayer.removePlayBackListener();
      this.isPlaying = false;
      console.log('Playback stopped');
    } catch (error) {
      console.error('Failed to stop playback:', error);
      throw error;
    }
  }

  async pausePlayback(): Promise<void> {
    if (!this.isPlaying) {
      return;
    }

    try {
      await this.audioRecorderPlayer.pausePlayer();
      console.log('Playback paused');
    } catch (error) {
      console.error('Failed to pause playback:', error);
      throw error;
    }
  }

  async resumePlayback(): Promise<void> {
    try {
      await this.audioRecorderPlayer.resumePlayer();
      console.log('Playback resumed');
    } catch (error) {
      console.error('Failed to resume playback:', error);
      throw error;
    }
  }

  async seekTo(position: number): Promise<void> {
    try {
      await this.audioRecorderPlayer.seekToPlayer(position);
      console.log('Seeked to:', position);
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  }

  getAmplitudeData(): number[] {
    return [...this.amplitudeData];
  }

  async analyzeVoice(uri: string): Promise<VoiceAnalysis> {
    // This would typically use native audio analysis or send to server
    // For now, return mock data based on amplitude data
    
    const mockAnalysis: VoiceAnalysis = {
      amplitude: this.amplitudeData.length > 0 ? this.amplitudeData : [0.5, 0.7, 0.3, 0.9, 0.6],
      frequency: [440, 523, 659, 783, 880], // Mock frequency data (Hz)
      pitch: 220, // Mock fundamental frequency
      volume: this.calculateAverageVolume(),
      timestamp: Date.now(),
    };

    return mockAnalysis;
  }

  private calculateAverageVolume(): number {
    if (this.amplitudeData.length === 0) return 0;
    
    const sum = this.amplitudeData.reduce((acc, val) => acc + val, 0);
    return sum / this.amplitudeData.length;
  }

  async deleteRecording(uri: string): Promise<void> {
    try {
      const exists = await RNFS.exists(uri);
      if (exists) {
        await RNFS.unlink(uri);
        console.log('Recording deleted:', uri);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  async getDuration(uri: string): Promise<number> {
    try {
      // For now, return 0. In a real implementation, you'd use a library
      // or native module to get audio file duration
      return 0;
    } catch (error) {
      console.error('Failed to get duration:', error);
      return 0;
    }
  }

  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentRecordingPath(): string {
    return this.recordingPath;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isRecording) {
        await this.stopRecording();
      }
      if (this.isPlaying) {
        await this.stopPlayback();
      }
      this.audioRecorderPlayer.removeRecordBackListener();
      this.audioRecorderPlayer.removePlayBackListener();

      // Cleanup optimization services
      if (this.appStateListener) {
        this.appStateListener.remove();
      }
      HeadphoneDetection.cleanup();
      AudioOptimizationService.cleanup();

      this.currentSession = null;
      this.headphoneInfo = null;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // Enhanced methods for audio optimization
  async enableBackgroundMode(): Promise<void> {
    this.backgroundSupported = true;
    await AudioOptimizationService.enableBackgroundPlayback();
  }

  async disableBackgroundMode(): Promise<void> {
    this.backgroundSupported = false;
    await AudioOptimizationService.disableBackgroundPlayback();
  }

  getHeadphoneStatus(): HeadphoneInfo | null {
    return this.headphoneInfo ? {...this.headphoneInfo} : null;
  }

  getCurrentSession(): AudioSession | null {
    return this.currentSession ? {...this.currentSession} : null;
  }

  async switchOutputRoute(route: 'speaker' | 'headphones' | 'default'): Promise<void> {
    await AudioOptimizationService.switchOutputRoute(route);
  }

  async getVolumeStatus() {
    return await AudioOptimizationService.getVolumeStatus();
  }

  async setVolume(volume: number): Promise<void> {
    await AudioOptimizationService.setVolume(volume);
  }

  async getAudioLatency(): Promise<number> {
    return await AudioOptimizationService.getAudioLatency();
  }

  async performAudioTest(): Promise<{
    recording: boolean;
    playback: boolean;
    headphones: boolean;
    volume: boolean;
    background: boolean;
    latency: number;
  }> {
    const basicTest = await AudioOptimizationService.performAudioTest();
    const latency = await this.getAudioLatency();
    
    return {
      ...basicTest,
      latency,
    };
  }

  // Advanced audio analysis
  async analyzeRecordingEnvironment(): Promise<{
    noiseLevel: number;
    recommendedGain: number;
    optimalSettings: {
      echoCancellation: boolean;
      noiseSuppression: boolean;
      automaticGainControl: boolean;
    };
  }> {
    const recommendations = this.headphoneInfo 
      ? HeadphoneDetection.getRecommendedAudioSettings()
      : {
          volume: 0.8,
          echoCancellation: true,
          noiseSuppression: true,
          automaticGainControl: true,
        };

    return {
      noiseLevel: 0.3, // Mock value - would be measured in real implementation
      recommendedGain: recommendations.volume,
      optimalSettings: {
        echoCancellation: recommendations.echoCancellation,
        noiseSuppression: recommendations.noiseSuppression,
        automaticGainControl: recommendations.automaticGainControl,
      },
    };
  }

  // Quality analysis methods
  async getRecordingQuality(uri: string): Promise<{
    quality: 'poor' | 'fair' | 'good' | 'excellent';
    issues: string[];
    score: number;
  }> {
    const analysis = await this.analyzeVoice(uri);
    
    let score = 100;
    const issues: string[] = [];

    // Check volume
    if (analysis.volume < 0.2) {
      score -= 20;
      issues.push('Volume too low');
    } else if (analysis.volume > 0.9) {
      score -= 15;
      issues.push('Volume too high');
    }

    // Check amplitude consistency
    const amplitudeVariance = this.calculateVariance(analysis.amplitude);
    if (amplitudeVariance > 0.5) {
      score -= 10;
      issues.push('Inconsistent volume');
    }

    // Determine quality
    let quality: 'poor' | 'fair' | 'good' | 'excellent' = 'excellent';
    if (score < 60) quality = 'poor';
    else if (score < 75) quality = 'fair';
    else if (score < 90) quality = 'good';

    return { quality, issues, score };
  }

  private calculateVariance(data: number[]): number {
    if (data.length === 0) return 0;
    
    const mean = data.reduce((acc, val) => acc + val, 0) / data.length;
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  }
}

export default new VoiceRecordingService();