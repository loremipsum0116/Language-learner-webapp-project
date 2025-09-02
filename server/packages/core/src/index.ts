// Core package main entry point
export * from './shared/types';
export * from './shared/validators';

// Domain exports (SRS services removed - using existing server implementation)

// Re-export commonly used types for convenience
export type {
  User,
  Vocab,
  UserProgress,
  ApiResponse,
  MobileApiResponse,
  ServiceResponse,
  ValidationError,
  BusinessRuleError,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  JwtPayload,
  DeviceInfo,
  UserDevice,
  BatchRequest,
  BatchResponse,
  PaginationInfo,
  ApiResponseMeta
} from './shared/types';