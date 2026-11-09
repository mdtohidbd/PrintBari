import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IServiceItem extends Document {
  tenantId?: mongoose.Types.ObjectId; // null = Global System Service; non-null = Shop Custom Service / Override
  serviceCode: string;
  category: string;
  name: string;
  nameBn?: string;
  description?: string;
  unitPrice: number;
  minPrice: number;
  pricingUnit: 'PER_COPY' | 'PER_PAGE' | 'PER_SET' | 'PER_PIECE' | 'PER_SQFT';
  paperSizes?: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceItemSchema = new Schema<IServiceItem>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    serviceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
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
    description: {
      type: String,
      default: '',
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    minPrice: {
      type: Number,
      default: 5,
      min: 0,
    },
    pricingUnit: {
      type: String,
      enum: ['PER_COPY', 'PER_PAGE', 'PER_SET', 'PER_PIECE', 'PER_SQFT'],
      default: 'PER_COPY',
    },
    paperSizes: [{ type: String }],
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

// Compound index: unique serviceCode per tenant (where tenantId can be null for global)
ServiceItemSchema.index({ tenantId: 1, serviceCode: 1 }, { unique: true });

export const ServiceItem: Model<IServiceItem> = mongoose.model<IServiceItem>('ServiceItem', ServiceItemSchema);

