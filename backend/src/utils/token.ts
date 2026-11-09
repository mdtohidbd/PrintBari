import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { UserRole } from '../models/User.model';

export interface JwtAccessPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export class TokenService {
  public static generateAccessToken(payload: JwtAccessPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });
  }

  public static verifyAccessToken(token: string): JwtAccessPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
  }

  public static generateRefreshTokenString(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

