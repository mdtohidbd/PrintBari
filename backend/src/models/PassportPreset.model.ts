import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPassportPreset extends Document {
  tenantId?: mongoose.Types.ObjectId; // null = Global System Preset; non-null = Shop Custom Preset
  presetKey: string;
  name: string;
  nameBn?: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // calculated at 300 DPI
  heightPx: number; // calculated at 300 DPI
  bgColor: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PassportPresetSchema = new Schema<IPassportPreset>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    presetKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
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
    country: {
      type: String,
      required: true,
      trim: true,
    },
    widthMm: {
      type: Number,
      required: true,
      min: 10,
      max: 300,
    },
    heightMm: {
      type: Number,
      required: true,
      min: 10,
      max: 300,
    },
    widthPx: {
      type: Number,
      required: true,
    },
    heightPx: {
      type: Number,
      required: true,
    },
    bgColor: {
      type: String,
      default: '#FFFFFF',
    },
    description: {
      type: String,
      default: '',
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

PassportPresetSchema.index({ tenantId: 1, presetKey: 1 }, { unique: true });

// Pre-validate hook: auto-calculate exact 300 DPI dimensions from millimeters
PassportPresetSchema.pre('validate', function (next) {
  if (this.widthMm && (!this.widthPx || this.isModified('widthMm'))) {
    this.widthPx = Math.round((this.widthMm / 25.4) * 300);
  }
  if (this.heightMm && (!this.heightPx || this.isModified('heightMm'))) {
    this.heightPx = Math.round((this.heightMm / 25.4) * 300);
  }
  next();
});

export const PassportPresetModel: Model<IPassportPreset> = mongoose.model<IPassportPreset>(
  'PassportPreset',
  PassportPresetSchema
);

