import { Request, Response, NextFunction } from 'express';
import { TenantUsageMeter } from '../models/TenantUsageMeter.model';
import { logger } from '../config/logger';

interface ITokenBucket {
  tokens: number;
  lastRefillTime: number;
  capacity: number;
  refillRatePerMs: number; // tokens added per millisecond
}

// In-memory token buckets mapped by tenantId
const tenantBuckets = new Map<string, ITokenBucket>();

// Tier limits definition: [requestsPerMinute, capacity/burst]
const PLAN_TIER_LIMITS: Record<string, { rpm: number; burst: number }> = {
  TRIAL: { rpm: 60, burst: 20 },
  STARTER: { rpm: 120, burst: 30 },
  PRO: { rpm: 300, burst: 60 },
  PROFESSIONAL: { rpm: 300, burst: 60 },
  BUSINESS: { rpm: 600, burst: 120 },
  ENTERPRISE: { rpm: 1200, burst: 200 },
};

export const tenantAwareRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // If not authenticated or super admin, bypass tenant-tier rate limiter
  if (!req.tenant || req.user?.role === 'SUPER_ADMIN') {
    return next();
  }

  const tenantId = req.tenant._id.toString();
  const plan = (req.tenant.subscription?.plan || 'TRIAL').toUpperCase();
  const limits = req.tenant.enterpriseConfig?.rateLimits?.requestsPerMinute
    ? {
        rpm: req.tenant.enterpriseConfig.rateLimits.requestsPerMinute,
        burst: req.tenant.enterpriseConfig.rateLimits.burstLimit || 60,
      }
    : PLAN_TIER_LIMITS[plan] || PLAN_TIER_LIMITS.TRIAL;

  const now = Date.now();
  let bucket = tenantBuckets.get(tenantId);

  if (!bucket) {
    bucket = {
      tokens: limits.burst,
      lastRefillTime: now,
      capacity: limits.burst,
      refillRatePerMs: limits.rpm / (60 * 1000),
    };
    tenantBuckets.set(tenantId, bucket);
  } else {
    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefillTime;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillRatePerMs);
    bucket.lastRefillTime = now;
  }

  // Consume 1 token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;

    // Attach headers
    res.setHeader('X-Tenant-RateLimit-Limit', limits.rpm);
    res.setHeader('X-Tenant-RateLimit-Remaining', Math.floor(bucket.tokens));

    // Asynchronously record usage metering without blocking request
    const period = new Date().toISOString().substring(0, 7); // YYYY-MM
    TenantUsageMeter.updateOne(
      { tenantId: req.tenant._id, period },
      {
        $inc: { 'metrics.apiRequestsTotal': 1 },
        $set: { lastCalculatedAt: new Date() },
      },
      { upsert: true }
    ).catch((err) => {
      logger.error('Failed to increment tenant usage meter:', err);
    });

    return next();
  }

  // Token bucket exhausted -> 429 Too Many Requests
  const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / (bucket.refillRatePerMs * 1000));
  res.setHeader('Retry-After', retryAfterSeconds);
  res.setHeader('X-Tenant-RateLimit-Limit', limits.rpm);
  res.setHeader('X-Tenant-RateLimit-Remaining', 0);

  logger.warn(
    `[NoisyNeighborShield] Tenant ${req.tenant.businessId} exceeded rate limit. Current tier: ${plan}. Retry in ${retryAfterSeconds}s.`
  );

  res.status(429).json({
    success: false,
    statusCode: 429,
    errorCode: 'TENANT_RATE_LIMIT_EXCEEDED',
    message: `Tenant rate limit exceeded for plan tier ${plan}. Protected by Noisy-Neighbor Shield.`,
    tenantId: req.tenant.businessId,
    retryAfterSeconds,
  });
};

