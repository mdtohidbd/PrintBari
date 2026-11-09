import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IDocumentPage {
  pageNumber: number;
  originalImageUrl?: string;
  processedImageUrl?: string;
  filterMode: 'ORIGINAL' | 'MAGIC_COLOR' | 'GRAYSCALE' | 'BW_PHOTOCOPY' | 'SHADOW_CLEAN';
  adjustments: {
    brightness: number;
    contrast: number;
    rotation: number;
    threshold?: number;
  };
  cropCorners?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  };
}

export interface IDocumentJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  title?: string;
  pages: IDocumentPage[];
  pageSettings: {
    pageSize: 'A4' | 'LEGAL' | 'LETTER';
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    marginMm: number;
    fitMode: 'FIT_PAGE' | 'FILL_PAGE' | 'ORIGINAL_SCALE';
  };
  copies: number;
  totalAmount: number;
  notes?: string;
  pdfUrl?: string;
  status: 'DRAFT' | 'SAVED' | 'PRINT_READY' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const DocumentPageSchema = new Schema<IDocumentPage>(
  {
    pageNumber: { type: Number, required: true },
    originalImageUrl: { type: String },
    processedImageUrl: { type: String },
    filterMode: {
      type: String,
      enum: ['ORIGINAL', 'MAGIC_COLOR', 'GRAYSCALE', 'BW_PHOTOCOPY', 'SHADOW_CLEAN'],
      default: 'MAGIC_COLOR',
    },
    adjustments: {
      brightness: { type: Number, default: 0 },
      contrast: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
      threshold: { type: Number, default: 128 },
    },
    cropCorners: {
      topLeft: { x: Number, y: Number },
      topRight: { x: Number, y: Number },
      bottomRight: { x: Number, y: Number },
      bottomLeft: { x: Number, y: Number },
    },
  },
  { _id: false }
);

const DocumentJobSchema = new Schema<IDocumentJob>(
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
      default: 'N/A',
    },
    title: {
      type: String,
      default: 'A4 Scanned Document',
    },
    pages: [DocumentPageSchema],
    pageSettings: {
      pageSize: {
        type: String,
        enum: ['A4', 'LEGAL', 'LETTER'],
        default: 'A4',
      },
      orientation: {
        type: String,
        enum: ['PORTRAIT', 'LANDSCAPE'],
        default: 'PORTRAIT',
      },
      marginMm: {
        type: Number,
        default: 5,
      },
      fitMode: {
        type: String,
        enum: ['FIT_PAGE', 'FILL_PAGE', 'ORIGINAL_SCALE'],
        default: 'FIT_PAGE',
      },
    },
    copies: {
      type: Number,
      default: 1,
      min: 1,
    },
    totalAmount: {
      type: Number,
      default: 10,
    },
    notes: {
      type: String,
      trim: true,
    },
    pdfUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SAVED', 'PRINT_READY', 'COMPLETED'],
      default: 'SAVED',
    },
  },
  {
    timestamps: true,
  }
);

DocumentJobSchema.index({ tenantId: 1, createdAt: -1 });

export const DocumentJob: Model<IDocumentJob> = mongoose.model<IDocumentJob>(
  'DocumentJob',
  DocumentJobSchema
);

