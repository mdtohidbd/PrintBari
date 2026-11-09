import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User.model';
import { RolePermission, PermissionKey } from '../models/RolePermission.model';
import { ForbiddenError, UnauthorizedError } from '../errors';
import { configCache } from '../utils/configCache';

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: [
    'JOBS_READ',
    'JOBS_CREATE',
    'JOBS_UPDATE_STATUS',
    'JOBS_DELETE',
    'JOBS_PRINT',
    'CUSTOMERS_READ',
    'CUSTOMERS_MANAGE',
    'PRINTERS_READ',
    'PRINTERS_SPOOL',
    'STAFF_READ',
    'STAFF_MANAGE',
    'SETTINGS_MANAGE',
    'BILLING_MANAGE',
    'TEMPLATES_MANAGE',
    'SUPER_ADMIN_MANAGE',
  ],
  OWNER: [
    'JOBS_READ',
    'JOBS_CREATE',
    'JOBS_UPDATE_STATUS',
    'JOBS_DELETE',
    'JOBS_PRINT',
    'CUSTOMERS_READ',
    'CUSTOMERS_MANAGE',
    'PRINTERS_READ',
    'PRINTERS_SPOOL',
    'STAFF_READ',
    'STAFF_MANAGE',
    'SETTINGS_MANAGE',
    'BILLING_MANAGE',
    'TEMPLATES_MANAGE',
  ],
  MANAGER: [
    'JOBS_READ',
    'JOBS_CREATE',
    'JOBS_UPDATE_STATUS',
    'JOBS_PRINT',
    'CUSTOMERS_READ',
    'CUSTOMERS_MANAGE',
    'PRINTERS_READ',
    'PRINTERS_SPOOL',
    'STAFF_READ',
    'SETTINGS_MANAGE',
    'TEMPLATES_MANAGE',
  ],
  OPERATOR: [
    'JOBS_READ',
    'JOBS_CREATE',
    'JOBS_UPDATE_STATUS',
    'JOBS_PRINT',
    'CUSTOMERS_READ',
    'PRINTERS_READ',
    'PRINTERS_SPOOL',
  ],
  REVIEWER: [
    'JOBS_READ',
    'JOBS_UPDATE_STATUS',
    'CUSTOMERS_READ',
  ],
  PRINTER: [
    'JOBS_READ',
    'JOBS_PRINT',
    'PRINTERS_READ',
    'PRINTERS_SPOOL',
  ],
  STAFF: [
    'JOBS_READ',
    'JOBS_CREATE',
    'JOBS_UPDATE_STATUS',
    'CUSTOMERS_READ',
    'PRINTERS_READ',
  ],
};

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before permission check'));
    }

    // Super Admin has universal operational clearance
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Permission denied: Your role (${req.user.role}) is not authorized for this resource`
        )
      );
    }

    next();
  };
};

export const authorizePermissions = (...requiredPermissions: PermissionKey[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required before permission check'));
      }

      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      const userRole = req.user.role;
      const cacheKey = `role_permissions:${userRole}`;
      let assignedPermissions = configCache.get<PermissionKey[]>(cacheKey);

      if (!assignedPermissions) {
        const doc = await RolePermission.findOne({ role: userRole }).lean();
        if (doc && Array.isArray(doc.permissions)) {
          assignedPermissions = doc.permissions;
        } else {
          assignedPermissions = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
        }
        configCache.set(cacheKey, assignedPermissions, 5 * 60 * 1000);
      }

      const hasAllPermissions = requiredPermissions.every((perm) => assignedPermissions!.includes(perm));

      if (!hasAllPermissions) {
        return next(
          new ForbiddenError(
            `Access denied: Your role '${userRole}' lacks required permissions: [${requiredPermissions.join(', ')}]`
          )
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
