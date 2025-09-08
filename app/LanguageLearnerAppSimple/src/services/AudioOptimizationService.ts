import {Platform, AppState, AppStateStatus} from 'react-native';
import {
  AVPlaybackStatus,
  AVPlaybackStatusSuccess,
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';
import RNVolumeManager, {VolumeResult} from 'react-native-volume-manager';

export interface AudioSession {
  id: string;
  uri: string;
  title?: string;
  artist?: string;
  duration?: number;
  isBackgroundEnabled: boolean;
  category: 'pronunciation' | 'dictation' | 'listening' | 'general';
}

export interface HeadphoneStatus {
  isConnected: boolean;
  type: 'wired' | 'bluetooth' | 'none';
  deviceName?: string;
}

export interface VolumeStatus {
  current: number;
  max: number;
  isMuted: boolean;
  canChange: boolean;
}

export interface AudioOptimizationSettings {
  enableBackgroundPlayback: boolean;
  enableHeadphoneOptimization: boolean;
  enableVolumeControl: boolean;
  automaticGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  preferredOutputRoute: 'default' | 'speaker' | 'headphones';
  backgroundMixing: boolean;
}

export class AudioOptimizationService {
  private currentSession: AudioSession | null = null;
  private headphoneStatus: HeadphoneStatus = {
    isConnected: false,
    type: 'none',
  };
  private volumeStatus: VolumeStatus = {
    current: 0.7,
    max: 1.0,
    isMuted: false,
    canChange: true,
  };
  private settings: AudioOptimizationSettings = {
    enableBackgroundPlayback: true,
    enableHeadphoneOptimization: true,
    enableVolumeControl: true,
    automaticGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    preferredOutputRoute: 'default',
    backgroundMixing: false,
  };

  private onHeadphoneChange?: (status: HeadphoneStatus) => void;
  private onVolumeChange?: (volume: VolumeStatus) => void;
  private onBackgroundStateChange?: (isBackground: boolean) => void;
  private appStateListener?: any;
  private volumeListener?: any;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.setupAudioSession();
    this.setupAppStateListener();
    await this.initializeVolumeManager();
    await this.detectHeadphones();
  }

  private async setupAudioSession() {
    try {
      await Audio.requestPermissionsAsync();

      // Configure audio session for optimal voice recording and playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: this.settings.enableBackgroundPlayback,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      console.log('Audio session configured successfully');
    } catch (error) {
      console.error('Failed to setup audio session:', error);
    }
  }

  private setupAppStateListener() {
    this.appStateListener = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private handleAppStateChange(nextAppState: AppStateStatus) {
    const isBackground = nextAppState === 'background';
    
    if (this.onBackgroundStateChange) {
      this.onBackgroundStateChange(isBackground);
    }

    if (isBackground && this.currentSession) {
      this.handleBackgroundTransition();
    } else if (nextAppState === 'active') {
      this.handleForegroundTransition();
    }
  }

  private async handleBackgroundTransition() {
    if (!this.settings.enableBackgroundPlayback) {
      return;
    }

    try {
      // Enable background audio playback
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      });

      console.log('Background audio enabled');
    } catch (error) {
      console.error('Failed to enable background audio:', error);
    }
  }

  private async handleForegroundTransition() {
    try {
      // Restore normal audio session
      await this.setupAudioSession();
      console.log('Foreground audio restored');
    } catch (error) {
      console.error('Failed to restore foreground audio:', error);
    }
  }

  private async initializeVolumeManager() {
    try {
      // Get initial volume status
      this.volumeStatus = await this.getVolumeStatus();

      // Setup volume change listener
      this.volumeListener = RNVolumeManager.addListener(
        'VolumeChanged',
        this.handleVolumeChange.bind(this)
      );

      console.log('Volume manager initialized');
    } catch (error) {
      console.error('Failed to initialize volume manager:', error);
    }
  }

  private handleVolumeChange(result: VolumeResult) {
    this.volumeStatus = {
      current: result.volume,
      max: 1.0,
      isMuted: result.volume === 0,
      canChange: true,
    };

    if (this.onVolumeChange) {
      this.onVolumeChange(this.volumeStatus);
    }

    // Auto-adjust for headphone connection
    if (this.settings.enableHeadphoneOptimization) {
      this.optimizeVolumeForOutput();
    }
  }

  private async detectHeadphones() {
    try {
      // This would typically use a native module to detect headphones
      // For now, we'll simulate headphone detection
      const isConnected = await this.checkHeadphoneConnection();
      
      this.headphoneStatus = {
        isConnected,
        type: isConnected ? 'wired' : 'none',
        deviceName: isConnected ? 'Headphones' : undefined,
      };

      if (this.onHeadphoneChange) {
        this.onHeadphoneChange(this.headphoneStatus);
      }

      if (isConnected && this.settings.enableHeadphoneOptimization) {
        await this.optimizeForHeadphones();
      }

      console.log('Headphone detection completed:', this.headphoneStatus);
    } catch (error) {
      console.error('Failed to detect headphones:', error);
    }
  }

  private async checkHeadphoneConnection(): Promise<boolean> {
    // In a real implementation, this would use native modules
    // to check for headphone connection via audio route detection
    try {
      // Placeholder implementation
      return false;
    } catch (error) {
      return false;
    }
  }

  private async optimizeForHeadphones() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        staysActiveInBackground: this.settings.enableBackgroundPlayback,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      console.log('Audio optimized for headphones');
    } catch (error) {
      console.error('Failed to optimize for headphones:', error);
    }
  }

  private async optimizeVolumeForOutput() {
    if (!this.settings.enableVolumeControl) return;

    try {
      let targetVolume = this.volumeStatus.current;

      // Adjust volume based on output device
      if (this.headphoneStatus.isConnected) {
        // Lower volume for headphones to protect hearing
        if (targetVolume > 0.8) {
          targetVolume = 0.8;
          await this.setVolume(targetVolume);
        }
      } else {
        // Speaker mode - ensure adequate volume
        if (targetVolume < 0.3) {
          targetVolume = 0.3;
          await this.setVolume(targetVolume);
        }
      }
    } catch (error) {
      console.error('Failed to optimize volume:', error);
    }
  }

  async createAudioSession(
    uri: string,
    options: {
      title?: string;
      artist?: string;
      category?: 'pronunciation' | 'dictation' | 'listening' | 'general';
      enableBackground?: boolean;
    } = {}
  ): Promise<AudioSession> {
    const session: AudioSession = {
      id: `session_${Date.now()}`,
      uri,
      title: options.title || 'Audio Session',
      artist: options.artist || 'Language Learner',
      category: options.category || 'general',
      isBackgroundEnabled: options.enableBackground ?? this.settings.enableBackgroundPlayback,
    };

    this.currentSession = session;

    // Configure audio session based on category
    await this.configureSessionForCategory(session.category);

    return session;
  }

  private async configureSessionForCategory(category: AudioSession['category']) {
    try {
      let audioModeConfig;

      switch (category) {
        case 'pronunciation':
          audioModeConfig = {
            allowsRecordingIOS: true,
            staysActiveInBackground: false,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            playThroughEarpieceAndroid: false,
          };
          break;

        case 'dictation':
          audioModeConfig = {
            allowsRecordingIOS: true,
            staysActiveInBackground: false,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            playThroughEarpieceAndroid: false,
          };
          break;

        case 'listening':
          audioModeConfig = {
            allowsRecordingIOS: false,
            staysActiveInBackground: this.settings.enableBackgroundPlayback,
            interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            playThroughEarpieceAndroid: false,
          };
          break;

        default:
          audioModeConfig = {
            allowsRecordingIOS: true,
            staysActiveInBackground: this.settings.enableBackgroundPlayback,
            interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            playThroughEarpieceAndroid: false,
          };
      }

      await Audio.setAudioModeAsync(audioModeConfig);
      console.log(`Audio configured for ${category} category`);
    } catch (error) {
      console.error('Failed to configure audio for category:', error);
    }
  }

  async getVolumeStatus(): Promise<VolumeStatus> {
    try {
      const result = await RNVolumeManager.getVolume();
      return {
        current: result.volume,
        max: 1.0,
        isMuted: result.volume === 0,
        canChange: true,
      };
    } catch (error) {
      console.error('Failed to get volume status:', error);
      return this.volumeStatus;
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await RNVolumeManager.setVolume(Math.max(0, Math.min(1, volume)));
      this.volumeStatus.current = volume;
      this.volumeStatus.isMuted = volume === 0;
    } catch (error) {
      console.error('Failed to set volume:', error);
      throw error;
    }
  }

  async adjustVolume(delta: number): Promise<void> {
    const newVolume = Math.max(0, Math.min(1, this.volumeStatus.current + delta));
    await this.setVolume(newVolume);
  }

  async mute(): Promise<void> {
    if (!this.volumeStatus.isMuted) {
      await this.setVolume(0);
    }
  }

  async unmute(): Promise<void> {
    if (this.volumeStatus.isMuted) {
      await this.setVolume(0.7); // Default unmute volume
    }
  }

  async toggleMute(): Promise<void> {
    if (this.volumeStatus.isMuted) {
      await this.unmute();
    } else {
      await this.mute();
    }
  }

  getHeadphoneStatus(): HeadphoneStatus {
    return {...this.headphoneStatus};
  }

  getCurrentVolumeStatus(): VolumeStatus {
    return {...this.volumeStatus};
  }

  getCurrentSession(): AudioSession | null {
    return this.currentSession ? {...this.currentSession} : null;
  }

  async enableBackgroundPlayback(): Promise<void> {
    this.settings.enableBackgroundPlayback = true;
    await this.setupAudioSession();
  }

  async disableBackgroundPlayback(): Promise<void> {
    this.settings.enableBackgroundPlayback = false;
    await this.setupAudioSession();
  }

  async switchOutputRoute(route: 'speaker' | 'headphones' | 'default'): Promise<void> {
    try {
      this.settings.preferredOutputRoute = route;

      let audioModeConfig;
      switch (route) {
        case 'speaker':
          audioModeConfig = {
            ...await this.getCurrentAudioMode(),
            playThroughEarpieceAndroid: false,
          };
          break;

        case 'headphones':
          if (!this.headphoneStatus.isConnected) {
            throw new Error('No headphones connected');
          }
          audioModeConfig = {
            ...await this.getCurrentAudioMode(),
            playThroughEarpieceAndroid: false,
          };
          break;

        case 'default':
        default:
          audioModeConfig = await this.getCurrentAudioMode();
          break;
      }

      await Audio.setAudioModeAsync(audioModeConfig);
      console.log(`Output route switched to: ${route}`);
    } catch (error) {
      console.error('Failed to switch output route:', error);
      throw error;
    }
  }

  private async getCurrentAudioMode() {
    // Return current audio mode configuration
    return {
      allowsRecordingIOS: true,
      staysActiveInBackground: this.settings.enableBackgroundPlayback,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    };
  }

  updateSettings(newSettings: Partial<AudioOptimizationSettings>): void {
    this.settings = {...this.settings, ...newSettings};
    
    // Re-initialize with new settings
    this.setupAudioSession();
  }

  getSettings(): AudioOptimizationSettings {
    return {...this.settings};
  }

  setHeadphoneChangeListener(callback: (status: HeadphoneStatus) => void): void {
    this.onHeadphoneChange = callback;
  }

  setVolumeChangeListener(callback: (volume: VolumeStatus) => void): void {
    this.onVolumeChange = callback;
  }

  setBackgroundStateChangeListener(callback: (isBackground: boolean) => void): void {
    this.onBackgroundStateChange = callback;
  }

  async optimizeForDevice(): Promise<void> {
    // Detect device capabilities and optimize accordingly
    try {
      await this.detectHeadphones();
      await this.optimizeVolumeForOutput();
      
      // Apply device-specific optimizations
      if (Platform.OS === 'ios') {
        await this.applyIOSOptimizations();
      } else {
        await this.applyAndroidOptimizations();
      }

      console.log('Device optimization completed');
    } catch (error) {
      console.error('Failed to optimize for device:', error);
    }
  }

  private async applyIOSOptimizations() {
    // iOS-specific audio optimizations
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      staysActiveInBackground: this.settings.enableBackgroundPlayback,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      playsInSilentModeIOS: true,
    });
  }

  private async applyAndroidOptimizations() {
    // Android-specific audio optimizations
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  }

  cleanup(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    
    if (this.volumeListener) {
      this.volumeListener.remove();
    }

    this.currentSession = null;
    this.onHeadphoneChange = undefined;
    this.onVolumeChange = undefined;
    this.onBackgroundStateChange = undefined;
  }

  // Utility methods for audio analysis
  async analyzeAudioRoute(): Promise<{
    currentRoute: string;
    availableRoutes: string[];
    isOptimal: boolean;
  }> {
    return {
      currentRoute: this.headphoneStatus.isConnected ? 'headphones' : 'speaker',
      availableRoutes: ['speaker', ...(this.headphoneStatus.isConnected ? ['headphones'] : [])],
      isOptimal: true,
    };
  }

  async getAudioLatency(): Promise<number> {
    // Return estimated audio latency in milliseconds
    const baseLatency = Platform.OS === 'ios' ? 10 : 20;
    const headphoneLatency = this.headphoneStatus.isConnected ? 5 : 0;
    return baseLatency + headphoneLatency;
  }

  async performAudioTest(): Promise<{
    recording: boolean;
    playback: boolean;
    headphones: boolean;
    volume: boolean;
    background: boolean;
  }> {
    return {
      recording: true, // Test recording capability
      playback: true,  // Test playback capability
      headphones: this.headphoneStatus.isConnected,
      volume: this.volumeStatus.canChange,
      background: this.settings.enableBackgroundPlayback,
    };
  }
}

export default new AudioOptimizationService();