import mongoose, { Document, Schema, Model } from 'mongoose';

export type JobServiceType =
  | 'PASSPORT_PHOTO'
  | 'ID_CARD_A4'
  | 'DOCUMENT_A4'
  | 'CV_BUILDER'
  | 'CV_RESUME'
  | 'HANDWRITING_OCR'
  | 'PHOTOCOPY_PRINT'
  | 'CUSTOM_PRINT'
  | 'LAMINATION'
  | 'SCANNING'
  | 'PHOTOCOPY';

export type JobStatus =
  | 'DRAFT'
  | 'NEW'
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'REVIEW'
  | 'APPROVED'
  | 'QUEUED'
  | 'PRINTING'
  | 'PRINT_READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface IJobComment {
  commentId: string;
  userId: mongoose.Types.ObjectId;
  userName: string;
  role: string;
  text: string;
  createdAt: Date;
}

const JobCommentSchema = new Schema<IJobComment>(
  {
    commentId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    role: { type: String, default: 'STAFF' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export interface IJobFile {
  fileId: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  version: number;
  uploadedAt: Date;
}

export interface IJobActivity {
  activityId: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  changedById?: mongoose.Types.ObjectId;
  changedByName: string;
  role?: string;
  note?: string;
  timestamp: Date;
}

export interface IJobPrice {
  subtotal: number;
  discount: number;
  tax: number;
  totalPrice: number;
}

export interface IJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceType: JobServiceType;
  status: JobStatus;
  priority: JobPriority;
  assignedTo?: mongoose.Types.ObjectId;
  reviewerId?: mongoose.Types.ObjectId;
  reviewerName?: string;
  dueDate?: Date;
  cancellationReason?: string;
  internalComments: IJobComment[];
  copies: number;
  paperType: string;
  price: IJobPrice;
  totalAmount: number; // backward compatibility
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BKASH' | 'NAGAD' | 'CARD' | 'DUE' | 'UPI_BKASH' | 'OTHER';
  uploadedFiles: IJobFile[];
  processedFiles: IJobFile[];
  activityLogs: IJobActivity[];
  retryCount?: number;
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobFileSchema = new Schema<IJobFile>(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    version: { type: Number, default: 1 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobActivitySchema = new Schema<IJobActivity>(
  {
    activityId: { type: String, required: true },
    action: { type: String, required: true },
    oldStatus: { type: String },
    newStatus: { type: String },
    changedById: { type: Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String, required: true, default: 'System' },
    role: { type: String },
    note: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const JobPriceSchema = new Schema<IJobPrice>(
  {
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const JobSchema = new Schema<IJob>(
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
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    serviceType: {
      type: String,
      enum: [
        'PASSPORT_PHOTO',
        'ID_CARD_A4',
        'DOCUMENT_A4',
        'CV_BUILDER',
        'CV_RESUME',
        'HANDWRITING_OCR',
        'PHOTOCOPY_PRINT',
        'CUSTOM_PRINT',
        'LAMINATION',
        'SCANNING',
        'PHOTOCOPY',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'NEW',
        'PENDING',
        'PROCESSING',
        'READY_FOR_REVIEW',
        'REVIEW',
        'APPROVED',
        'QUEUED',
        'PRINTING',
        'PRINT_READY',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'NEW',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reviewerName: {
      type: String,
      default: '',
    },
    dueDate: {
      type: Date,
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    internalComments: [JobCommentSchema],
    copies: {
      type: Number,
      default: 1,
    },
    paperType: {
      type: String,
      default: 'A4 Standard',
    },
    price: {
      type: JobPriceSchema,
      default: () => ({ subtotal: 0, discount: 0, tax: 0, totalPrice: 0 }),
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BKASH', 'NAGAD', 'CARD', 'DUE', 'UPI_BKASH', 'OTHER'],
      default: 'CASH',
    },
    uploadedFiles: [JobFileSchema],
    processedFiles: [JobFileSchema],
    activityLogs: [JobActivitySchema],
    retryCount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure price.totalPrice and totalAmount sync
JobSchema.pre('save', function (next) {
  if (this.price && this.price.totalPrice !== undefined) {
    this.totalAmount = this.price.totalPrice;
  } else if (this.totalAmount !== undefined) {
    if (!this.price) {
      this.price = { subtotal: this.totalAmount, discount: 0, tax: 0, totalPrice: this.totalAmount };
    } else {
      this.price.totalPrice = this.totalAmount;
    }
  }
  next();
});

JobSchema.index({ tenantId: 1, createdAt: -1 });
JobSchema.index({ tenantId: 1, status: 1 });
JobSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
JobSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });
JobSchema.index({ tenantId: 1, jobCode: 1 });
JobSchema.index({ tenantId: 1, serviceType: 1, status: 1 });
JobSchema.index({ tenantId: 1, priority: 1, createdAt: -1 });

export const Job: Model<IJob> = mongoose.model<IJob>('Job', JobSchema);
