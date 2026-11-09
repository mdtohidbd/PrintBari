import { z } from 'zod';

export const registerShopSchema = z.object({
  body: z.object({
    shopName: z.string().min(2, 'Shop name must be at least 2 characters').max(100),
    subdomain: z
      .string()
      .min(3, 'Subdomain must be at least 3 characters')
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
    ownerName: z.string().min(2, 'Owner full name is required').max(100),
    email: z.string().email('Please provide a valid email address'),
    phone: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    plan: z.enum(['STARTER', 'PRO', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE']).default('PROFESSIONAL'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(1, 'Password is required'),
    subdomain: z.string().optional(),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    subdomain: z.string().optional(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
});

