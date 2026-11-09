import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'production' ? 30 : 5000, // Relaxed for dev and automated suites
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts from this IP, please try again in 15 minutes',
    timestamp: new Date().toISOString(),
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 500, // 500 requests per 15 min per IP in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    errorCode: 'API_RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this client. Please slow down.',
    timestamp: new Date().toISOString(),
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100, // 100 file processing calls per 10 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    errorCode: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    message: 'File processing rate limit reached. Please wait a few minutes.',
    timestamp: new Date().toISOString(),
  },
});


