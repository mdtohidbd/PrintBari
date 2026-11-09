import { z } from 'zod';

export const addStaffSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Staff name must be at least 2 characters').max(100),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['MANAGER', 'STAFF', 'OPERATOR', 'REVIEWER', 'PRINTER']),
    phone: z.string().optional(),
  }),
});

export const updateStaffRoleSchema = z.object({
  body: z.object({
    role: z.enum(['MANAGER', 'STAFF', 'OPERATOR', 'REVIEWER', 'PRINTER']),
  }),
});

export const updateTenantSettingsSchema = z.object({
  body: z.object({
    currency: z.string().min(2).max(5).optional(),
    timezone: z.string().optional(),
    whatsappNotificationsEnabled: z.boolean().optional(),
    autoPurgeHours: z.number().min(1).max(720).optional(),
  }),
});

