import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPlatformSettings extends Document {
  key: string;
  category: 'WEBSITE' | 'EMAIL' | 'NOTIFICATION' | 'STORAGE' | 'SECURITY' | 'MAINTENANCE';
  value: any;
  label: string;
  description: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['WEBSITE', 'EMAIL', 'NOTIFICATION', 'STORAGE', 'SECURITY', 'MAINTENANCE'],
      required: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON'],
      default: 'STRING',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export const PlatformSettings: Model<IPlatformSettings> = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);

