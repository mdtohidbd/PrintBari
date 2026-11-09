import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';
import mongoose from 'mongoose';

export class NotificationController {
  /**
   * Get notifications for the authenticated user and their tenant
   */
  public listNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user?._id;
    const { type, category, isRead, page = '1', limit = '20' } = req.query;

    let parsedIsRead: boolean | undefined = undefined;
    if (isRead === 'true') parsedIsRead = true;
    if (isRead === 'false') parsedIsRead = false;

    const result = await notificationService.getNotifications({
      tenantId,
      userId,
      type: type as string,
      category: category as string,
      isRead: parsedIsRead,
      page: parseInt(String(page)),
      limit: parseInt(String(limit)),
    });

    ApiResponse.success(res, result, 'Notifications retrieved');
  });

  /**
   * Mark a single notification as read
   */
  public markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError('Invalid notification ID');
    }

    const notification = await notificationService.markAsRead(tenantId, id);
    ApiResponse.success(res, notification, 'Notification marked as read');
  });

  /**
   * Mark all notifications as read
   */
  public markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id;
    const userId = req.user?._id;

    const result = await notificationService.markAllAsRead(tenantId, userId);
    ApiResponse.success(res, result, 'All notifications marked as read');
  });
}

export const notificationController = new NotificationController();

