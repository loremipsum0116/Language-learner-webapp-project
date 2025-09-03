// Express type extensions

import { UserWithoutPassword, DeviceInfo } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword;
      deviceInfo?: DeviceInfo;
      networkType?: string;
      optimizeForSlowNetwork?: boolean;
      isBatchRequest?: boolean;
      batchRequests?: any[];
      apiVersion?: number;
      apiVersionSource?: 'url' | 'accept' | 'header' | 'default' | 'fallback';
      isLegacyRoute?: boolean;
    }
  }
}