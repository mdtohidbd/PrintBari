import { Request, Response, NextFunction } from 'express';
import { TokenService, JwtAccessPayload } from '../utils/token';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { User, IUser } from '../models/User.model';
import { Tenant, ITenant } from '../models/Tenant.model';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      tenant?: ITenant;
      tokenPayload?: JwtAccessPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Malformed authorization header');
    }

    let payload: JwtAccessPayload;
    try {
      payload = TokenService.verifyAccessToken(token);
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authentication token has expired. Please refresh token.');
      }
      throw new UnauthorizedError('Invalid or corrupted authentication token');
    }

    // Verify user exists and is active
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or has been deactivated');
    }

    // Verify tenant exists and is active
    const tenant = await Tenant.findById(payload.tenantId);
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenError('Shop account not found or subscription is inactive');
    }

    // Verify user belongs to the token's tenant
    if (user.tenantId.toString() !== tenant._id.toString()) {
      throw new ForbiddenError('Tenant membership mismatch');
    }

    // Verify suspension status
    if (
      tenant.subscription?.status === 'SUSPENDED' &&
      user.role !== 'SUPER_ADMIN' &&
      !req.originalUrl.includes('/subscription') &&
      !req.originalUrl.includes('/billing') &&
      !req.originalUrl.includes('/enterprise/recover')
    ) {
      throw new ForbiddenError(
        `Shop account is suspended (${tenant.subscription.suspensionReason || 'Administrative suspension'}). Please contact billing to reactivate.`
      );
    }

    req.user = user;
    req.tenant = tenant;
    req.tenantId = tenant.subdomain;
    req.tokenPayload = payload;

    next();
  } catch (error) {
    next(error);
  }
};

