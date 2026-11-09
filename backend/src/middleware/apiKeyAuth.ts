import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiKey, IApiKey, ApiKeyScope } from '../models/Integration.model';
import { Tenant, ITenant } from '../models/Tenant.model';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { logger } from '../config/logger';

// Augment Express Request interface with apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: IApiKey;
    }
  }
}

// In-memory token bucket for API Key rate limiting
const apiKeyRateBuckets = new Map<string, { tokens: number; lastRefill: number }>();

export const authenticateApiKey = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let rawKey: string | undefined;

    // Check x-api-key header or Authorization Bearer header
    const headerKey = req.header('x-api-key');
    const authHeader = req.header('authorization');

    if (headerKey) {
      rawKey = headerKey.trim();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const candidate = authHeader.split(' ')[1]?.trim();
      if (candidate && (candidate.startsWith('dcu_live_') || candidate.startsWith('dcu_test_'))) {
        rawKey = candidate;
      }
    }

    if (!rawKey) {
      throw new UnauthorizedError('API key is required. Pass via x-api-key or Authorization: Bearer dcu_live_...');
    }

    if (!rawKey.startsWith('dcu_live_') && !rawKey.startsWith('dcu_test_')) {
      throw new UnauthorizedError('Invalid API key format. Must start with dcu_live_ or dcu_test_');
    }

    // Hash the raw key with SHA-256 to lookup in database
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await ApiKey.findOne({ keyHash, isActive: true });
    if (!apiKey) {
      throw new UnauthorizedError('Invalid, inactive, or revoked API key');
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('API key has expired');
    }

    // Find tenant
    const tenant = await Tenant.findById(apiKey.tenantId);
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenError('Tenant account is inactive or not found');
    }

    if (tenant.subscription?.status === 'SUSPENDED') {
      throw new ForbiddenError('Tenant account is suspended. API access is blocked.');
    }

    // Attach to request
    req.apiKey = apiKey;
    req.tenant = tenant;
    req.tenantId = tenant.subdomain;

    // Update lastUsedAt asynchronously
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch((err) => {
      logger.error('Failed to update API key lastUsedAt:', err);
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Guard that enforces required API key scopes
 */
export const requireApiScope = (...requiredScopes: ApiKeyScope[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      return next(new UnauthorizedError('API key authentication required before checking scopes'));
    }

    const assignedScopes = req.apiKey.scopes || [];
    const hasAllScopes = requiredScopes.every((scope) => assignedScopes.includes(scope));

    if (!hasAllScopes) {
      return next(
        new ForbiddenError(
          `Insufficient API Key scopes. Required: [${requiredScopes.join(', ')}]. Granted: [${assignedScopes.join(', ')}]`
        )
      );
    }

    next();
  };
};

/**
 * Rate limiter middleware bound to API Key rateLimitRpm
 */
export const rateLimitApiKey = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.apiKey) {
    return next();
  }

  const keyId = req.apiKey._id.toString();
  const rpm = req.apiKey.rateLimitRpm || 300;
  const now = Date.now();

  let bucket = apiKeyRateBuckets.get(keyId);
  if (!bucket) {
    bucket = { tokens: rpm, lastRefill: now };
    apiKeyRateBuckets.set(keyId, bucket);
  } else {
    // Refill tokens
    const elapsedMs = now - bucket.lastRefill;
    const tokensToAdd = (elapsedMs / (60 * 1000)) * rpm;
    bucket.tokens = Math.min(rpm, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    res.setHeader('X-RateLimit-Limit', rpm);
    res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));
    return next();
  }

  res.setHeader('Retry-After', '60');
  res.status(429).json({
    success: false,
    statusCode: 429,
    errorCode: 'API_KEY_RATE_LIMIT_EXCEEDED',
    message: `API Key rate limit of ${rpm} requests/min exceeded. Please slow down.`,
    timestamp: new Date().toISOString(),
  });
};

// In-memory idempotency cache (short-term window: 10 minutes)
const idempotencyStore = new Map<string, { statusCode: number; body: any; expiresAt: number }>();

export const idempotencyGuard = (req: Request, res: Response, next: NextFunction): void => {
  const idempotencyKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');
  if (!idempotencyKey) {
    return next();
  }

  const tenantPrefix = req.tenant?._id ? req.tenant._id.toString() : 'global';
  const scopedKey = `${tenantPrefix}:${idempotencyKey}`;
  const now = Date.now();

  const cached = idempotencyStore.get(scopedKey);
  if (cached && cached.expiresAt > now) {
    res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  // Intercept response to store
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(scopedKey, {
        statusCode: res.statusCode,
        body,
        expiresAt: now + 10 * 60 * 1000, // 10 minutes cache
      });
    }
    return originalJson(body);
  };

  next();
};

