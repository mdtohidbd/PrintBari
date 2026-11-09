import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICustomerFile {
  fileId: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  sourceJobCode?: string;
  addedAt: Date;
}

export interface ICustomer extends Document {
  tenantId: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  totalOrdersCount: number;
  totalSpent: number;
  dueBalance: number;
  lastVisitAt: Date;
  notes?: string;
  fileLibrary: ICustomerFile[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerFileSchema = new Schema<ICustomerFile>(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    sourceJobCode: { type: String },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    totalOrdersCount: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    dueBalance: {
      type: Number,
      default: 0,
      index: true,
    },
    lastVisitAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
    fileLibrary: [CustomerFileSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index({ tenantId: 1, isDeleted: 1, createdAt: -1 });

export const Customer: Model<ICustomer> = mongoose.model<ICustomer>('Customer', CustomerSchema);
