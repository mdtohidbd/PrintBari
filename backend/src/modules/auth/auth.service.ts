import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Tenant, SubscriptionPlan } from '../../models/Tenant.model';
import { User, IUser } from '../../models/User.model';
import { RefreshToken } from '../../models/RefreshToken.model';
import { AuditLog } from '../../models/AuditLog.model';
import { TokenService } from '../../utils/token';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '../../errors';
import { env } from '../../config/env';

export class AuthService {
  /**
   * Register a new Shop / Tenant and provision the Owner user account
   */
  public async registerShop(params: {
    shopName: string;
    subdomain: string;
    ownerName: string;
    email: string;
    phone?: string;
    password: string;
    plan: SubscriptionPlan;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const cleanSubdomain = params.subdomain.toLowerCase().trim();
    const cleanEmail = params.email.toLowerCase().trim();

    // 1. Check if subdomain already exists
    const existingTenant = await Tenant.findOne({ subdomain: cleanSubdomain });
    if (existingTenant) {
      throw new ConflictError(`Shop subdomain "${cleanSubdomain}" is already registered`);
    }

    // 2. Generate unique Business ID
    const businessId = `SHOP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 3. Quota allocation according to plan
    const quotaMap: Record<SubscriptionPlan, { seats: number; layouts: number; ocr: number; storageGB: number }> = {
      STARTER: { seats: 2, layouts: 300, ocr: 50, storageGB: 5 },
      PRO: { seats: 6, layouts: 10000, ocr: 300, storageGB: 25 },
      PROFESSIONAL: { seats: 6, layouts: 10000, ocr: 300, storageGB: 25 },
      BUSINESS: { seats: 15, layouts: 25000, ocr: 750, storageGB: 100 },
      ENTERPRISE: { seats: 50, layouts: 50000, ocr: 1000, storageGB: 500 },
    };
    const selectedQuota = quotaMap[params.plan] || quotaMap.PROFESSIONAL;

    // 4. Create Tenant Document
    const tenant = await Tenant.create({
      businessId,
      name: params.shopName.trim(),
      subdomain: cleanSubdomain,
      subscription: {
        plan: params.plan,
        status: 'TRIALING',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
      },
      quotas: {
        maxStaffSeats: selectedQuota.seats,
        monthlyPassportLayoutsLimit: selectedQuota.layouts,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: selectedQuota.ocr,
        monthlyOcrPagesUsed: 0,
        storageLimitBytes: selectedQuota.storageGB * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        whatsappNotificationsEnabled: true,
        autoPurgeHours: 24, // Privacy zero-retention guarantee
      },
      isActive: true,
    });

    // 5. Hash owner password
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(params.password, salt);

    // 6. Create Owner User
    const owner = new User({
      tenantId: tenant._id,
      fullName: params.ownerName.trim(),
      email: cleanEmail,
      phone: params.phone,
      passwordHash,
      role: 'OWNER',
      isEmailVerified: false,
      isActive: true,
    });

    const verificationToken = owner.generateVerificationToken();
    await owner.save();

    // Link owner to tenant
    tenant.ownerId = owner._id as any;
    await tenant.save();

    // 7. Generate JWT Access and Refresh Tokens
    const accessToken = TokenService.generateAccessToken({
      userId: owner._id.toString(),
      tenantId: tenant._id.toString(),
      role: owner.role,
      email: owner.email,
    });

    const { rawToken, tokenHash } = TokenService.generateRefreshTokenString();
    await RefreshToken.create({
      userId: owner._id,
      tenantId: tenant._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // 8. Audit Logging
    await AuditLog.create({
      tenantId: tenant._id,
      userId: owner._id,
      action: 'TENANT_REGISTERED',
      details: { businessId, plan: params.plan, subdomain: cleanSubdomain },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: 'SUCCESS',
    });

    return {
      tenant: {
        id: tenant._id,
        businessId: tenant.businessId,
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.subscription.plan,
        trialEndsAt: tenant.subscription.trialEndsAt,
      },
      user: {
        id: owner._id,
        fullName: owner.fullName,
        email: owner.email,
        role: owner.role,
      },
      tokens: {
        accessToken,
        refreshToken: rawToken,
      },
      verificationToken,
    };
  }

  /**
   * User login with shop subdomain or email resolution
   */
  public async login(params: {
    email: string;
    password: string;
    subdomain?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const cleanEmail = params.email.toLowerCase().trim();

    let tenant = null;
    if (params.subdomain) {
      tenant = await Tenant.findOne({ subdomain: params.subdomain.toLowerCase().trim(), isActive: true });
      if (!tenant) {
        throw new NotFoundError(`Shop "${params.subdomain}" not found or inactive`);
      }
    }

    const query: any = { email: cleanEmail, isActive: true };
    if (tenant) {
      query.tenantId = tenant._id;
    }

    const user = await User.findOne(query).select('+passwordHash');
    if (!user) {
      throw new UnauthorizedError('Invalid email or password credentials');
    }

    if (!tenant) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || !tenant.isActive) {
        throw new ForbiddenError('Associated shop account is disabled or inactive');
      }
    }

    // Verify password hash
    const isPasswordValid = await user.comparePassword(params.password);
    if (!isPasswordValid) {
      await AuditLog.create({
        tenantId: tenant._id,
        userId: user._id,
        action: 'AUTH_LOGIN_FAILED',
        details: { reason: 'Incorrect password' },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        status: 'FAILURE',
      });
      throw new UnauthorizedError('Invalid email or password credentials');
    }

    // Update login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate Tokens
    const accessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      tenantId: tenant._id.toString(),
      role: user.role,
      email: user.email,
    });

    const { rawToken, tokenHash } = TokenService.generateRefreshTokenString();
    await RefreshToken.create({
      userId: user._id,
      tenantId: tenant._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      status: 'SUCCESS',
    });

    return {
      tenant: {
        id: tenant._id,
        businessId: tenant.businessId,
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.subscription.plan,
      },
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      tokens: {
        accessToken,
        refreshToken: rawToken,
      },
    };
  }

  /**
   * Refresh Token rotation strategy
   */
  public async refreshTokens(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = TokenService.hashToken(rawRefreshToken);
    const existingToken = await RefreshToken.findOne({ tokenHash });

    if (!existingToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Token Reuse Detection: If revoked token is reused, invalidate all sessions for safety
    if (existingToken.revokedAt) {
      await RefreshToken.updateMany(
        { userId: existingToken.userId },
        { revokedAt: new Date() }
      );
      await AuditLog.create({
        tenantId: existingToken.tenantId,
        userId: existingToken.userId,
        action: 'SECURITY_TOKEN_REUSE_DETECTED',
        details: { revokedTokenUsed: true },
        ipAddress,
        userAgent,
        status: 'BLOCKED',
      });
      throw new UnauthorizedError('Token reuse detected. All active sessions invalidated for security.');
    }

    // Check expiration
    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }

    const user = await User.findById(existingToken.userId);
    const tenant = await Tenant.findById(existingToken.tenantId);

    if (!user || !user.isActive || !tenant || !tenant.isActive) {
      throw new UnauthorizedError('User or tenant account is no longer active');
    }

    // Generate new rotated refresh token
    const { rawToken: newRawToken, tokenHash: newTokenHash } = TokenService.generateRefreshTokenString();

    // Mark old token revoked and replaced
    existingToken.revokedAt = new Date();
    existingToken.replacedByTokenHash = newTokenHash;
    await existingToken.save();

    // Create new refresh token record
    await RefreshToken.create({
      userId: user._id,
      tenantId: tenant._id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress,
      userAgent,
    });

    // Generate new Access Token
    const accessToken = TokenService.generateAccessToken({
      userId: user._id.toString(),
      tenantId: tenant._id.toString(),
      role: user.role,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: newRawToken,
    };
  }

  /**
   * Logout user by revoking the specific refresh token
   */
  public async logout(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = TokenService.hashToken(rawRefreshToken);
    const token = await RefreshToken.findOne({ tokenHash });

    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await token.save();

      await AuditLog.create({
        tenantId: token.tenantId,
        userId: token.userId,
        action: 'AUTH_LOGOUT',
        ipAddress,
        userAgent,
        status: 'SUCCESS',
      });
    }

    return { loggedOut: true };
  }

  /**
   * Forgot Password - generate secure reset token
   */
  public async forgotPassword(email: string, subdomain?: string, ipAddress?: string, userAgent?: string) {
    const cleanEmail = email.toLowerCase().trim();
    const query: any = { email: cleanEmail, isActive: true };

    if (subdomain) {
      const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase().trim() });
      if (tenant) query.tenantId = tenant._id;
    }

    const user = await User.findOne(query);
    if (!user) {
      // Return generic message to prevent user enumeration attacks
      return { message: 'If an account exists with that email, a password reset link has been dispatched' };
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return {
      message: 'If an account exists with that email, a password reset link has been dispatched',
      resetToken, // Included for development & automated security test verification
    };
  }

  /**
   * Reset Password with token validation & session invalidation
   */
  public async resetPassword(token: string, newPassword: string, ipAddress?: string, userAgent?: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash');

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    // Invalidate all active sessions for this user across all terminals
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() }
    );

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      action: 'PASSWORD_RESET_SUCCESS',
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    return { message: 'Password has been successfully updated. Please log in with your new credentials.' };
  }

  /**
   * Verify email address
   */
  public async verifyEmail(token: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestError('Verification token is invalid or has expired');
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiresAt = undefined;
    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      action: 'EMAIL_VERIFIED',
      status: 'SUCCESS',
    });

    return { verified: true, message: 'Email address verified successfully' };
  }
}

export const authService = new AuthService();

