import {Platform, DeviceEventEmitter, NativeEventEmitter, NativeModules} from 'react-native';

export interface HeadphoneInfo {
  isConnected: boolean;
  type: 'wired' | 'bluetooth' | 'usbc' | 'lightning' | 'none';
  deviceName?: string;
  supportsMicrophone?: boolean;
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface AudioRouteInfo {
  inputs: AudioRoute[];
  outputs: AudioRoute[];
  currentInput?: AudioRoute;
  currentOutput?: AudioRoute;
}

export interface AudioRoute {
  type: string;
  name: string;
  uid?: string;
  isDefault: boolean;
  channels: number;
  sampleRate?: number;
}

export class HeadphoneDetection {
  private isListening = false;
  private eventEmitter: any;
  private listeners: Array<(info: HeadphoneInfo) => void> = [];
  private currentHeadphoneInfo: HeadphoneInfo = {
    isConnected: false,
    type: 'none',
  };

  constructor() {
    this.setupEventEmitter();
  }

  private setupEventEmitter() {
    if (Platform.OS === 'ios') {
      this.eventEmitter = new NativeEventEmitter(NativeModules.AudioRouteDetector);
    } else {
      this.eventEmitter = DeviceEventEmitter;
    }
  }

  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      this.isListening = true;
      
      // Get initial headphone status
      await this.checkHeadphoneStatus();

      // Listen for headphone connection changes
      this.setupEventListeners();

      console.log('Headphone detection started');
    } catch (error) {
      console.error('Failed to start headphone detection:', error);
      this.isListening = false;
    }
  }

  stopListening(): void {
    if (!this.isListening) return;

    this.removeEventListeners();
    this.isListening = false;
    console.log('Headphone detection stopped');
  }

  private setupEventListeners() {
    if (Platform.OS === 'ios') {
      this.setupIOSListeners();
    } else {
      this.setupAndroidListeners();
    }
  }

  private setupIOSListeners() {
    // iOS audio route change notifications
    this.eventEmitter.addListener('AudioRouteChange', this.handleIOSAudioRouteChange.bind(this));
    this.eventEmitter.addListener('HeadphoneStatusChanged', this.handleHeadphoneChange.bind(this));
  }

  private setupAndroidListeners() {
    // Android headphone connection events
    this.eventEmitter.addListener('android.intent.action.HEADSET_PLUG', this.handleAndroidHeadsetPlug.bind(this));
    this.eventEmitter.addListener('android.bluetooth.headset.profile.action.CONNECTION_STATE_CHANGED', this.handleBluetoothHeadsetChange.bind(this));
    this.eventEmitter.addListener('android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED', this.handleBluetoothA2DPChange.bind(this));
  }

  private removeEventListeners() {
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('AudioRouteChange');
      this.eventEmitter.removeAllListeners('HeadphoneStatusChanged');
      this.eventEmitter.removeAllListeners('android.intent.action.HEADSET_PLUG');
      this.eventEmitter.removeAllListeners('android.bluetooth.headset.profile.action.CONNECTION_STATE_CHANGED');
      this.eventEmitter.removeAllListeners('android.bluetooth.a2dp.profile.action.CONNECTION_STATE_CHANGED');
    }
  }

  private handleIOSAudioRouteChange(event: any) {
    const routeInfo = this.parseIOSAudioRoute(event);
    const headphoneInfo = this.extractHeadphoneInfoFromRoute(routeInfo);
    this.updateHeadphoneInfo(headphoneInfo);
  }

  private handleAndroidHeadsetPlug(event: any) {
    const isConnected = event.state === 1;
    const hasMicrophone = event.microphone === 1;
    
    const headphoneInfo: HeadphoneInfo = {
      isConnected,
      type: isConnected ? 'wired' : 'none',
      deviceName: event.name || 'Wired Headphones',
      supportsMicrophone: hasMicrophone,
    };

    this.updateHeadphoneInfo(headphoneInfo);
  }

  private handleBluetoothHeadsetChange(event: any) {
    const isConnected = event.state === 'CONNECTED';
    
    if (isConnected) {
      const headphoneInfo: HeadphoneInfo = {
        isConnected: true,
        type: 'bluetooth',
        deviceName: event.device?.name || 'Bluetooth Headset',
        supportsMicrophone: true,
        batteryLevel: event.batteryLevel,
      };
      this.updateHeadphoneInfo(headphoneInfo);
    }
  }

  private handleBluetoothA2DPChange(event: any) {
    const isConnected = event.state === 'CONNECTED';
    
    if (isConnected) {
      const headphoneInfo: HeadphoneInfo = {
        isConnected: true,
        type: 'bluetooth',
        deviceName: event.device?.name || 'Bluetooth Audio Device',
        supportsMicrophone: false,
        batteryLevel: event.batteryLevel,
      };
      this.updateHeadphoneInfo(headphoneInfo);
    } else {
      // Check if any headphones are still connected
      this.checkHeadphoneStatus();
    }
  }

  private handleHeadphoneChange(headphoneInfo: HeadphoneInfo) {
    this.updateHeadphoneInfo(headphoneInfo);
  }

  private parseIOSAudioRoute(event: any): AudioRouteInfo {
    // Parse iOS audio route change event
    return {
      inputs: event.inputs || [],
      outputs: event.outputs || [],
      currentInput: event.currentInput,
      currentOutput: event.currentOutput,
    };
  }

  private extractHeadphoneInfoFromRoute(routeInfo: AudioRouteInfo): HeadphoneInfo {
    const currentOutput = routeInfo.currentOutput;
    
    if (!currentOutput) {
      return {isConnected: false, type: 'none'};
    }

    // Check output type to determine headphone connection
    const outputType = currentOutput.type.toLowerCase();
    const outputName = currentOutput.name || '';

    if (outputType.includes('headphone') || outputType.includes('headset')) {
      return {
        isConnected: true,
        type: 'wired',
        deviceName: outputName,
        supportsMicrophone: routeInfo.inputs.some(input => 
          input.type.toLowerCase().includes('headset') || 
          input.type.toLowerCase().includes('microphone')
        ),
      };
    }

    if (outputType.includes('bluetooth') || outputName.toLowerCase().includes('bluetooth')) {
      return {
        isConnected: true,
        type: 'bluetooth',
        deviceName: outputName,
        supportsMicrophone: true,
      };
    }

    if (outputType.includes('usb') || outputName.toLowerCase().includes('usb')) {
      return {
        isConnected: true,
        type: 'usbc',
        deviceName: outputName,
        supportsMicrophone: true,
      };
    }

    if (outputType.includes('lightning')) {
      return {
        isConnected: true,
        type: 'lightning',
        deviceName: outputName,
        supportsMicrophone: true,
      };
    }

    return {isConnected: false, type: 'none'};
  }

  private updateHeadphoneInfo(newInfo: HeadphoneInfo) {
    const hasChanged = JSON.stringify(this.currentHeadphoneInfo) !== JSON.stringify(newInfo);
    
    if (hasChanged) {
      this.currentHeadphoneInfo = newInfo;
      console.log('Headphone status changed:', newInfo);
      
      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(newInfo);
        } catch (error) {
          console.error('Error in headphone listener:', error);
        }
      });
    }
  }

  async checkHeadphoneStatus(): Promise<HeadphoneInfo> {
    try {
      if (Platform.OS === 'ios') {
        return await this.checkIOSHeadphoneStatus();
      } else {
        return await this.checkAndroidHeadphoneStatus();
      }
    } catch (error) {
      console.error('Failed to check headphone status:', error);
      return {isConnected: false, type: 'none'};
    }
  }

  private async checkIOSHeadphoneStatus(): Promise<HeadphoneInfo> {
    // In a real implementation, this would use iOS AVAudioSession
    // to get current audio route information
    
    // Mock implementation for demonstration
    const mockRouteInfo: AudioRouteInfo = {
      inputs: [
        {
          type: 'MicrophoneBuiltIn',
          name: 'Built-in Microphone',
          isDefault: true,
          channels: 1,
        }
      ],
      outputs: [
        {
          type: 'Speaker',
          name: 'Speaker',
          isDefault: true,
          channels: 2,
        }
      ],
    };

    return this.extractHeadphoneInfoFromRoute(mockRouteInfo);
  }

  private async checkAndroidHeadphoneStatus(): Promise<HeadphoneInfo> {
    // In a real implementation, this would use Android AudioManager
    // to check for connected audio devices
    
    // Mock implementation for demonstration
    return {
      isConnected: false,
      type: 'none',
    };
  }

  getCurrentHeadphoneInfo(): HeadphoneInfo {
    return {...this.currentHeadphoneInfo};
  }

  addListener(callback: (info: HeadphoneInfo) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  removeListener(callback: (info: HeadphoneInfo) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async getAudioRouteInfo(): Promise<AudioRouteInfo> {
    if (Platform.OS === 'ios') {
      return await this.getIOSAudioRouteInfo();
    } else {
      return await this.getAndroidAudioRouteInfo();
    }
  }

  private async getIOSAudioRouteInfo(): Promise<AudioRouteInfo> {
    // Mock implementation - in reality would use AVAudioSession
    return {
      inputs: [
        {
          type: this.currentHeadphoneInfo.supportsMicrophone ? 'HeadsetMicrophone' : 'MicrophoneBuiltIn',
          name: this.currentHeadphoneInfo.supportsMicrophone ? 'Headset Microphone' : 'Built-in Microphone',
          isDefault: true,
          channels: 1,
        }
      ],
      outputs: [
        {
          type: this.currentHeadphoneInfo.isConnected ? 'Headphones' : 'Speaker',
          name: this.currentHeadphoneInfo.deviceName || (this.currentHeadphoneInfo.isConnected ? 'Headphones' : 'Speaker'),
          isDefault: true,
          channels: 2,
        }
      ],
    };
  }

  private async getAndroidAudioRouteInfo(): Promise<AudioRouteInfo> {
    // Mock implementation - in reality would use AudioManager
    return {
      inputs: [
        {
          type: this.currentHeadphoneInfo.supportsMicrophone ? 'HEADSET_MIC' : 'MIC',
          name: this.currentHeadphoneInfo.supportsMicrophone ? 'Headset Microphone' : 'Built-in Microphone',
          isDefault: true,
          channels: 1,
        }
      ],
      outputs: [
        {
          type: this.currentHeadphoneInfo.isConnected ? 
            (this.currentHeadphoneInfo.type === 'bluetooth' ? 'BLUETOOTH_A2DP' : 'WIRED_HEADPHONES') : 
            'SPEAKER',
          name: this.currentHeadphoneInfo.deviceName || 
            (this.currentHeadphoneInfo.isConnected ? 'Headphones' : 'Speaker'),
          isDefault: true,
          channels: 2,
        }
      ],
    };
  }

  // Utility methods
  isWiredHeadphonesConnected(): boolean {
    return this.currentHeadphoneInfo.isConnected && 
           ['wired', 'usbc', 'lightning'].includes(this.currentHeadphoneInfo.type);
  }

  isBluetoothHeadphonesConnected(): boolean {
    return this.currentHeadphoneInfo.isConnected && 
           this.currentHeadphoneInfo.type === 'bluetooth';
  }

  hasHeadphoneMicrophone(): boolean {
    return this.currentHeadphoneInfo.isConnected && 
           (this.currentHeadphoneInfo.supportsMicrophone ?? false);
  }

  getRecommendedAudioSettings(): {
    volume: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    automaticGainControl: boolean;
  } {
    const isHeadphonesConnected = this.currentHeadphoneInfo.isConnected;
    const isBluetoothConnected = this.isBluetoothHeadphonesConnected();

    return {
      volume: isHeadphonesConnected ? 0.7 : 0.8, // Lower volume for headphones
      echoCancellation: !isHeadphonesConnected, // Less needed with headphones
      noiseSuppression: !isHeadphonesConnected || isBluetoothConnected, // More needed for speaker/bluetooth
      automaticGainControl: true, // Always recommended
    };
  }

  async testHeadphoneConnection(): Promise<{
    detected: boolean;
    type: string;
    latency?: number;
    quality: 'poor' | 'good' | 'excellent';
  }> {
    const info = await this.checkHeadphoneStatus();
    
    let quality: 'poor' | 'good' | 'excellent' = 'good';
    let latency: number | undefined;

    if (info.type === 'bluetooth') {
      quality = 'good';
      latency = 150; // Bluetooth latency
    } else if (info.type === 'wired') {
      quality = 'excellent';
      latency = 10; // Wired latency
    } else {
      quality = 'poor';
      latency = 50; // Speaker latency
    }

    return {
      detected: info.isConnected,
      type: info.type,
      latency,
      quality,
    };
  }

  cleanup(): void {
    this.stopListening();
    this.listeners = [];
  }
}

export default new HeadphoneDetection();