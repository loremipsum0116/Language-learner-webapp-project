import { Request, Response } from 'express';
import { JwtPayload, DeviceInfo, UserWithoutPassword } from '../types';
interface TokenPayload {
    id: number;
    email: string;
    role: string;
}
interface DecodedToken extends TokenPayload {
    type: string;
    iat: number;
    exp: number;
}
interface TokenPair {
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
}
declare class JWTService {
    private readonly JWT_SECRET;
    private readonly ACCESS_TOKEN_EXPIRY;
    private readonly COOKIE_NAME;
    private readonly REFRESH_COOKIE_NAME;
    constructor();
    generateAccessToken(payload: TokenPayload): string;
    generateAccessTokenById(userId: number): string;
    verifyAccessToken(token: string): JwtPayload;
    setAuthCookies(res: Response, accessToken: string, refreshToken: string): void;
    clearAuthCookies(res: Response): void;
    extractToken(req: Request, tokenType?: 'access' | 'refresh'): string | null;
    getDeviceInfo(req: Request): DeviceInfo;
    private detectPlatform;
    generateDeviceId(req: Request): string;
    getDeviceName(req: Request): string;
    isTokenNearExpiry(decoded: DecodedToken): boolean;
    generateTokenPair(user: UserWithoutPassword, deviceInfo: DeviceInfo): Promise<TokenPair>;
}
declare const _default: JWTService;
export default _default;
//# sourceMappingURL=jwtService.d.ts.map