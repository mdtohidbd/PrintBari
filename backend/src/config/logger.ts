import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'authorization',
  'secret',
  'signature',
  'creditcard',
  'cvv',
  'pin',
  'apikey',
];

function sanitizeLogData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeLogData);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      clean[key] = '[REDACTED_PII]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeLogData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

const sanitizeFormat = winston.format((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  return {
    level,
    message,
    timestamp,
    stack,
    ...sanitizeLogData(meta),
  };
});

const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const errorStack = stack ? `\n${stack}` : '';
  return `[${timestamp}] [${level}]: ${message}${metaString}${errorStack}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    sanitizeFormat(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        sanitizeFormat(),
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        customFormat
      ),
    }),
  ],
});

