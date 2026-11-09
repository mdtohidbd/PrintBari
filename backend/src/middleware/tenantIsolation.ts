import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { AuditLog } from '../models/AuditLog.model';
import { logger } from '../config/logger';

export const enforceTenantIsolation = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !req.tenant) {
    return next(new UnauthorizedError('Tenant verification requires authentication'));
  }

  // Super Admin can inspect cross-tenant contexts for system diagnostics
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Inspect route params, query, or body for tenant identifiers supplied by client
  const targetTenantId =
    req.params.tenantId ||
    req.query.tenantId ||
    req.body.tenantId;

  const targetBusinessId =
    req.params.businessId ||
    req.query.businessId ||
    req.body.businessId;

  const headerTargetTenant = (req.headers['x-target-tenant'] as string) || undefined;

  const authenticatedTenantId = req.tenant._id.toString();
  const authenticatedBusinessId = req.tenant.businessId;

  let violationDetected = false;
  let requestedIdentifier: string | undefined;

  if (targetTenantId && targetTenantId.toString() !== authenticatedTenantId) {
    violationDetected = true;
    requestedIdentifier = targetTenantId.toString();
  } else if (targetBusinessId && targetBusinessId.toString().toUpperCase() !== authenticatedBusinessId.toUpperCase()) {
    violationDetected = true;
    requestedIdentifier = targetBusinessId.toString();
  } else if (
    headerTargetTenant &&
    headerTargetTenant !== authenticatedTenantId &&
    headerTargetTenant.toUpperCase() !== authenticatedBusinessId.toUpperCase()
  ) {
    violationDetected = true;
    requestedIdentifier = headerTargetTenant;
  }

  if (violationDetected) {
    // Record security violation in AuditLog
    await AuditLog.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      action: 'SECURITY_CROSS_TENANT_VIOLATION_BLOCKED',
      resource: req.originalUrl,
      details: {
        method: req.method,
        attemptedTarget: requestedIdentifier,
        authenticatedTenant: authenticatedBusinessId,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'BLOCKED',
    });

    logger.warn(`🚨 SECURITY ALERT: Cross-tenant data breach attempt blocked for user ${req.user.email} -> Target: ${requestedIdentifier}`);

    return next(
      new ForbiddenError('Access Denied: Cross-tenant resource manipulation is strictly forbidden')
    );
  }

  next();
};

