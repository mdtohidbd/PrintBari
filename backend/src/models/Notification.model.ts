import mongoose, { Document, Schema, Model } from 'mongoose';

export type NotificationType = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
export type NotificationCategory = 'JOB_EVENT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface INotification extends Document {
  tenantId: mongoose.Types.ObjectId;
  recipientId?: mongoose.Types.ObjectId; // Staff user ID or null for customer
  customerPhone?: string; // For SMS / WhatsApp
  customerEmail?: string; // For Email
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, any>;
  deliveryStatus: NotificationDeliveryStatus;
  idempotencyKey?: string;
  isRead: boolean;
  readAt?: Date;
  retryCount: number;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'],
      default: 'IN_APP',
      index: true,
    },
    category: {
      type: String,
      enum: ['JOB_EVENT', 'SUBSCRIPTION', 'PAYMENT', 'SYSTEM'],
      default: 'JOB_EVENT',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ'],
      default: 'DELIVERED',
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    errorDetails: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ tenantId: 1, recipientId: 1, isRead: 1 });
NotificationSchema.index({ tenantId: 1, idempotencyKey: 1 });

export const NotificationModel: Model<INotification> = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);

export const Notification = NotificationModel;

