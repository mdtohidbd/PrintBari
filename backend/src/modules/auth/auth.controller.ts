import { Request, Response } from 'express';
import { authService } from './auth.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class AuthController {
  public registerShop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await authService.registerShop({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.created(res, result, 'Shop registered successfully with 14-day free trial');
  });

  public login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await authService.login({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.success(res, result, 'Logged in successfully');
  });

  public refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const result = await authService.refreshTokens(refreshToken, req.ip, req.get('user-agent'));

    ApiResponse.success(res, result, 'Tokens refreshed successfully');
  });

  public logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const result = await authService.logout(refreshToken, req.ip, req.get('user-agent'));

    ApiResponse.success(res, result, 'Logged out successfully');
  });

  public forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, subdomain } = req.body;
    const result = await authService.forgotPassword(email, subdomain, req.ip, req.get('user-agent'));

    ApiResponse.success(res, result, result.message);
  });

  public resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword, req.ip, req.get('user-agent'));

    ApiResponse.success(res, result, result.message);
  });

  public verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;
    const result = await authService.verifyEmail(token);

    ApiResponse.success(res, result, result.message);
  });

  public me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    ApiResponse.success(
      res,
      {
        user: {
          id: req.user?._id,
          fullName: req.user?.fullName,
          email: req.user?.email,
          role: req.user?.role,
          isEmailVerified: req.user?.isEmailVerified,
          lastLoginAt: req.user?.lastLoginAt,
        },
        tenant: {
          id: req.tenant?._id,
          businessId: req.tenant?.businessId,
          name: req.tenant?.name,
          subdomain: req.tenant?.subdomain,
          plan: req.tenant?.subscription.plan,
          status: req.tenant?.subscription.status,
          trialEndsAt: req.tenant?.subscription.trialEndsAt,
          quotas: req.tenant?.quotas,
          settings: req.tenant?.settings,
        },
      },
      'Authenticated user profile retrieved'
    );
  });
}

export const authController = new AuthController();

