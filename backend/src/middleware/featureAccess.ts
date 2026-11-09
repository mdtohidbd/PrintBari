import { Request, Response, NextFunction } from 'express';
import { PlanConfig } from '../models/Subscription.model';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { configCache } from '../utils/configCache';
import { logger } from '../config/logger';

export const enforceModuleAccess = (moduleName: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.tenant) {
        return next(new UnauthorizedError('Authentication required to verify feature entitlement'));
      }

      // Super Admin has universal access
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const planKey = (req.tenant.subscription?.plan || 'STARTER').toUpperCase();

      // Check cache first
      const cacheKey = `plan:${planKey}`;
      let plan = configCache.get<any>(cacheKey);

      if (!plan) {
        plan = await PlanConfig.findOne({ planKey }).lean();
        if (plan) {
          configCache.set(cacheKey, plan, 5 * 60 * 1000);
        }
      }

      // Fallback default: if plan configuration not yet in DB, allow baseline modules
      if (!plan) {
        return next();
      }

      const enabledModules = (plan.enabledModules || []).map((m: string) => m.toUpperCase());
      const normalizedTargetModule = moduleName.toUpperCase();

      if (!enabledModules.includes(normalizedTargetModule)) {
        logger.warn(
          `[FeatureAccess] Tenant ${req.tenant.subdomain} (Plan: ${planKey}) attempted access to disabled module: ${normalizedTargetModule}`
        );
        throw new ForbiddenError(
          `The '${moduleName}' module is not included in your current subscription plan (${plan.displayName || planKey}). Please upgrade your plan in Subscription Settings.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export const enforceFeatureRestriction = (restrictionKey: 'watermark' | 'highDpiExport' | 'multiPrinterSpool' | 'customBranding' | 'apiAccess') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.tenant) {
        return next(new UnauthorizedError('Authentication required'));
      }

      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const planKey = (req.tenant.subscription?.plan || 'STARTER').toUpperCase();
      const cacheKey = `plan:${planKey}`;
      let plan = configCache.get<any>(cacheKey);

      if (!plan) {
        plan = await PlanConfig.findOne({ planKey }).lean();
        if (plan) configCache.set(cacheKey, plan, 5 * 60 * 1000);
      }

      if (!plan || !plan.featureRestrictions) {
        return next();
      }

      const allowed = Boolean(plan.featureRestrictions[restrictionKey]);
      if (!allowed) {
        throw new ForbiddenError(
          `Your current subscription plan (${plan.displayName || planKey}) does not include entitlement for '${restrictionKey}'. Please upgrade to enable this feature.`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

