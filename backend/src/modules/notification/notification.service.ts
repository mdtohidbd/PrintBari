import mongoose from 'mongoose';
import { Notification, INotification, NotificationType, NotificationCategory } from '../../models/Notification.model';
import { NotFoundError } from '../../errors';

export interface NotificationFilterOptions {
  tenantId: string | mongoose.Types.ObjectId;
  userId?: string | mongoose.Types.ObjectId;
  type?: NotificationType | string;
  category?: NotificationCategory | string;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export class NotificationService {
  /**
   * Get paginated notifications for a tenant / staff user
   */
  public async getNotifications(options: NotificationFilterOptions): Promise<{
    notifications: INotification[];
    total: number;
    unreadCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { tenantId, userId, type, category, isRead, page = 1, limit = 20 } = options;

    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
    };

    if (userId) {
      // Either broadcast to shop (recipientId null/undefined) or targeted to this user
      query.$or = [
        { recipientId: new mongoose.Types.ObjectId(userId) },
        { recipientId: null },
        { recipientId: { $exists: false } },
      ];
    }

    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (typeof isRead === 'boolean') {
      query.isRead = isRead;
    }

    const pageSize = Math.min(100, Math.max(1, limit));
    const pageNum = Math.max(1, page);
    const skip = (pageNum - 1) * pageSize;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        ...(userId
          ? {
              $or: [
                { recipientId: new mongoose.Types.ObjectId(userId) },
                { recipientId: null },
                { recipientId: { $exists: false } },
              ],
            }
          : {}),
        isRead: false,
      }),
    ]);

    return {
      notifications: notifications as unknown as INotification[],
      total,
      unreadCount,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Mark a single notification as read
   */
  public async markAsRead(tenantId: string | mongoose.Types.ObjectId, notifId: string): Promise<INotification> {
    const notification = await Notification.findOne({
      _id: new mongoose.Types.ObjectId(notifId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    notification.deliveryStatus = 'READ';
    await notification.save();

    return notification;
  }

  /**
   * Mark all unread notifications as read for a tenant/user
   */
  public async markAllAsRead(
    tenantId: string | mongoose.Types.ObjectId,
    userId?: string | mongoose.Types.ObjectId
  ): Promise<{ modifiedCount: number }> {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isRead: false,
    };

    if (userId) {
      query.$or = [
        { recipientId: new mongoose.Types.ObjectId(userId) },
        { recipientId: null },
        { recipientId: { $exists: false } },
      ];
    }

    const result = await Notification.updateMany(query, {
      $set: {
        isRead: true,
        readAt: new Date(),
        deliveryStatus: 'READ',
      },
    });

    return { modifiedCount: result.modifiedCount };
  }
}

export const notificationService = new NotificationService();
