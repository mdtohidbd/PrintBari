import mongoose, { Document, Schema, Model } from 'mongoose';

export type CvCategory = 'MODERN' | 'CLASSIC' | 'PROFESSIONAL' | 'EXECUTIVE' | 'BIODATA';

export interface ICvTemplate extends Document {
  tenantId?: mongoose.Types.ObjectId;
  templateKey: string;
  name: string;
  nameBn?: string;
  category: CvCategory;
  description: string;
  thumbnailUrl?: string;
  supportedColors: string[];
  version: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CvTemplateSchema = new Schema<ICvTemplate>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    templateKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameBn: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['MODERN', 'CLASSIC', 'PROFESSIONAL', 'EXECUTIVE', 'BIODATA'],
      default: 'MODERN',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    supportedColors: {
      type: [String],
      default: ['#1E3A8A', '#059669', '#881337', '#334155', '#4F46E5'],
    },
    version: {
      type: Number,
      default: 1,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

CvTemplateSchema.index({ tenantId: 1, templateKey: 1 }, { unique: true });

export const CvTemplateModel: Model<ICvTemplate> = mongoose.model<ICvTemplate>('CvTemplate', CvTemplateSchema);

