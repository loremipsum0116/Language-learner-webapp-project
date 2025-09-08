// src/utils/biometric.ts
// 생체인증 유틸리티 (향후 구현 예정)

import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Install react-native-biometrics
// import ReactNativeBiometrics from 'react-native-biometrics';

export interface BiometricConfig {
  enabled: boolean;
  availableBiometrics: string[];
  lastUsed: string | null;
}

class BiometricService {
  private static instance: BiometricService;
  private readonly STORAGE_KEY = '@biometric_config';
  
  static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  /**
   * 생체인증 가능 여부 확인
   */
  async isAvailable(): Promise<boolean> {
    try {
      // TODO: react-native-biometrics 구현
      // const rnBiometrics = new ReactNativeBiometrics();
      // const { available } = await rnBiometrics.isSensorAvailable();
      // return available;
      
      // 임시로 true 반환 (시뮬레이터에서는 false로 설정)
      return __DEV__ ? false : true;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }

  /**
   * 사용 가능한 생체인증 타입 조회
   */
  async getAvailableBiometrics(): Promise<string[]> {
    try {
      // TODO: react-native-biometrics 구현
      // const rnBiometrics = new ReactNativeBiometrics();
      // const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      // return available ? [biometryType] : [];
      
      // 임시 반환값
      return ['TouchID', 'FaceID'];
    } catch (error) {
      console.error('Available biometrics check failed:', error);
      return [];
    }
  }

  /**
   * 생체인증 활성화 상태 확인
   */
  async isEnabled(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      return config.enabled && await this.isAvailable();
    } catch (error) {
      console.error('Biometric enabled check failed:', error);
      return false;
    }
  }

  /**
   * 생체인증 설정
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      const config = await this.getConfig();
      const updatedConfig: BiometricConfig = {
        ...config,
        enabled,
        lastUsed: enabled ? new Date().toISOString() : null,
      };
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Biometric set enabled failed:', error);
      throw new Error('생체인증 설정 저장에 실패했습니다.');
    }
  }

  /**
   * 생체인증 실행
   */
  async authenticate(reason: string = '로그인을 위해 생체인증을 사용합니다'): Promise<boolean> {
    try {
      if (!await this.isEnabled()) {
        throw new Error('생체인증이 비활성화되어 있습니다.');
      }

      // TODO: react-native-biometrics 구현
      // const rnBiometrics = new ReactNativeBiometrics({
      //   allowDeviceCredentials: true,
      // });
      
      // const { success } = await rnBiometrics.simplePrompt({
      //   promptMessage: reason,
      //   cancelButtonText: '취소',
      // });

      // if (success) {
      //   await this.updateLastUsed();
      //   return true;
      // }

      // return false;

      // 임시 구현 (개발용)
      return new Promise((resolve) => {
        setTimeout(() => {
          // 70% 확률로 성공
          const success = Math.random() > 0.3;
          if (success) {
            this.updateLastUsed();
          }
          resolve(success);
        }, 1000);
      });
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      throw error;
    }
  }

  /**
   * 생체인증 키 생성 (보안 저장용)
   */
  async createKeys(): Promise<void> {
    try {
      // TODO: react-native-biometrics 구현
      // const rnBiometrics = new ReactNativeBiometrics();
      // await rnBiometrics.createKeys();
      
      console.log('Biometric keys created (mock implementation)');
    } catch (error) {
      console.error('Biometric key creation failed:', error);
      throw new Error('생체인증 키 생성에 실패했습니다.');
    }
  }

  /**
   * 생체인증으로 데이터 서명
   */
  async createSignature(payload: string): Promise<string | null> {
    try {
      // TODO: react-native-biometrics 구현
      // const rnBiometrics = new ReactNativeBiometrics();
      // const { success, signature } = await rnBiometrics.createSignature({
      //   promptMessage: '안전한 로그인을 위해 생체인증이 필요합니다',
      //   payload: payload,
      // });
      
      // return success ? signature : null;
      
      // 임시 구현
      return 'mock_signature_' + Date.now();
    } catch (error) {
      console.error('Biometric signature creation failed:', error);
      return null;
    }
  }

  /**
   * 생체인증 설정 조회
   */
  private async getConfig(): Promise<BiometricConfig> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // 기본 설정
      const defaultConfig: BiometricConfig = {
        enabled: false,
        availableBiometrics: await this.getAvailableBiometrics(),
        lastUsed: null,
      };
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaultConfig));
      return defaultConfig;
    } catch (error) {
      console.error('Biometric config get failed:', error);
      return {
        enabled: false,
        availableBiometrics: [],
        lastUsed: null,
      };
    }
  }

  /**
   * 마지막 사용 시간 업데이트
   */
  private async updateLastUsed(): Promise<void> {
    try {
      const config = await this.getConfig();
      const updatedConfig: BiometricConfig = {
        ...config,
        lastUsed: new Date().toISOString(),
      };
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Biometric last used update failed:', error);
    }
  }

  /**
   * 생체인증 데이터 초기화
   */
  async reset(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      // TODO: react-native-biometrics 키 삭제
      // const rnBiometrics = new ReactNativeBiometrics();
      // await rnBiometrics.deleteKeys();
    } catch (error) {
      console.error('Biometric reset failed:', error);
      throw new Error('생체인증 초기화에 실패했습니다.');
    }
  }
}

export default BiometricService.getInstance();