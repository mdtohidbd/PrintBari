import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPassportJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  presetId: string;
  presetName: string;
  dimensionsMm: {
    width: number;
    height: number;
  };
  targetDpi: number;
  backgroundColor: string;
  adjustments: {
    brightness: number;
    contrast: number;
    rotation: number;
  };
  cropBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  copies: number;
  sheetLayout: '4x6' | 'A4';
  originalImageUrl?: string;
  processedImageUrl?: string;
  sheetImageUrl?: string;
  notes?: string;
  status: 'DRAFT' | 'SAVED' | 'PRINT_READY' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const PassportJobSchema = new Schema<IPassportJob>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    jobCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      default: 'Walk-in Customer',
    },
    customerPhone: {
      type: String,
      trim: true,
      default: '',
    },
    presetId: {
      type: String,
      required: true,
      default: 'us_passport_2x2',
    },
    presetName: {
      type: String,
      required: true,
      default: 'US Passport / Visa (2x2 in)',
    },
    dimensionsMm: {
      width: { type: Number, default: 51 },
      height: { type: Number, default: 51 },
    },
    targetDpi: {
      type: Number,
      default: 300,
    },
    backgroundColor: {
      type: String,
      default: '#FFFFFF',
    },
    adjustments: {
      brightness: { type: Number, default: 0 },
      contrast: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
    },
    cropBounds: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    copies: {
      type: Number,
      default: 8,
    },
    sheetLayout: {
      type: String,
      enum: ['4x6', 'A4'],
      default: '4x6',
    },
    originalImageUrl: {
      type: String,
      default: '',
    },
    processedImageUrl: {
      type: String,
      default: '',
    },
    sheetImageUrl: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SAVED', 'PRINT_READY', 'COMPLETED'],
      default: 'SAVED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PassportJobSchema.index({ tenantId: 1, createdAt: -1 });

export const PassportJob: Model<IPassportJob> = mongoose.model<IPassportJob>(
  'PassportJob',
  PassportJobSchema
);

