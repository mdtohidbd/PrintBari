import { Request, Response, NextFunction } from 'express';

// Augment Express Request interface with tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export const tenantContextMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  // Support tenant identification via header, subdomain, or query
  const tenantIdHeader = req.header('x-tenant-id');
  const host = req.hostname;
  
  if (tenantIdHeader) {
    req.tenantId = tenantIdHeader;
  } else if (host && host.includes('.')) {
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'www') {
      req.tenantId = parts[0];
    }
  }

  next();
};

