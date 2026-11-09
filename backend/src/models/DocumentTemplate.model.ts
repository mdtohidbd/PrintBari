import mongoose, { Document, Schema, Model } from 'mongoose';

export type TemplateCategory =
  | 'APPLICATION'
  | 'AGREEMENT'
  | 'CERTIFICATE'
  | 'BUSINESS'
  | 'LEGAL';

export interface ITemplateField {
  key: string;
  label: string;
  labelBn?: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export interface IDocumentTemplate extends Document {
  tenantId?: mongoose.Types.ObjectId; // null if official global system template
  category: TemplateCategory;
  title: string;
  titleBn: string;
  description: string;
  language: 'BN' | 'EN' | 'BILINGUAL';
  version: number;
  isSystemTemplate: boolean;
  fields: ITemplateField[];
  contentTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateFieldSchema = new Schema<ITemplateField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    labelBn: { type: String },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'textarea', 'select'],
      default: 'text',
    },
    options: [{ type: String }],
    defaultValue: { type: String },
    placeholder: { type: String },
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const DocumentTemplateSchema = new Schema<IDocumentTemplate>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    category: {
      type: String,
      enum: ['APPLICATION', 'AGREEMENT', 'CERTIFICATE', 'BUSINESS', 'LEGAL'],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    titleBn: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    language: {
      type: String,
      enum: ['BN', 'EN', 'BILINGUAL'],
      default: 'BN',
    },
    version: { type: Number, default: 1 },
    isSystemTemplate: { type: Boolean, default: true },
    fields: [TemplateFieldSchema],
    contentTemplate: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const DocumentTemplate: Model<IDocumentTemplate> = mongoose.model<IDocumentTemplate>(
  'DocumentTemplate',
  DocumentTemplateSchema
);

// Companion Job model for filled ready-made documents
export interface IReadyDocumentJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  templateId: mongoose.Types.ObjectId;
  templateTitle: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  filledValues: Record<string, any>;
  renderedContent: string;
  copies: number;
  totalAmount: number;
  notes?: string;
  status: 'DRAFT' | 'SAVED' | 'PRINT_READY' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const ReadyDocumentJobSchema = new Schema<IReadyDocumentJob>(
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
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentTemplate',
      required: true,
    },
    templateTitle: {
      type: String,
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      required: true,
      default: 'Walk-in Customer',
    },
    customerPhone: {
      type: String,
      default: 'N/A',
    },
    filledValues: {
      type: Schema.Types.Mixed,
      required: true,
    },
    renderedContent: {
      type: String,
      required: true,
    },
    copies: { type: Number, default: 1 },
    totalAmount: { type: Number, default: 20 },
    notes: { type: String },
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

ReadyDocumentJobSchema.index({ tenantId: 1, createdAt: -1 });

export const ReadyDocumentJob: Model<IReadyDocumentJob> = mongoose.model<IReadyDocumentJob>(
  'ReadyDocumentJob',
  ReadyDocumentJobSchema
);

