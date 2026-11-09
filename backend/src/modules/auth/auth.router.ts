import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import {
  registerShopSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';

const router = Router();

// Public authentication routes (Rate limited)
router.post(
  '/register-shop',
  authRateLimiter,
  validateRequest(registerShopSchema),
  authController.registerShop
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  authController.login
);

router.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  authController.refresh
);

router.post(
  '/logout',
  validateRequest(refreshTokenSchema),
  authController.logout
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

router.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  authController.verifyEmail
);

// Protected Identity Route
router.get('/me', authenticate, authController.me);

export const authRouter = router;

