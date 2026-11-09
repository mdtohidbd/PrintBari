import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ITextBlock {
  id: string;
  text: string;
  confidence: number;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface IFormattedDocSection {
  type: 'title' | 'heading1' | 'heading2' | 'paragraph' | 'bullet' | 'numbered';
  text: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

export interface IOcrJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  language: 'eng' | 'ben' | 'both';
  engine: 'tesseract' | 'cloud' | 'simulation';
  originalImage: string;
  preprocessedImage?: string;
  preprocessingOptions: {
    grayscale: boolean;
    contrast: number;
    binarize: boolean;
    denoise: boolean;
    deskew: boolean;
  };
  overallConfidence: number;
  textBlocks: ITextBlock[];
  rawExtractedText: string;
  editedText: string;
  formattedDoc: IFormattedDocSection[];
  exportFormats: {
    docxGenerated: boolean;
    pdfGenerated: boolean;
  };
  notes?: string;
  status: 'DRAFT' | 'PROCESSED' | 'SAVED' | 'EXPORTED' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const TextBlockSchema = new Schema<ITextBlock>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    confidence: { type: Number, required: true, default: 0 },
    bbox: {
      x0: { type: Number },
      y0: { type: Number },
      x1: { type: Number },
      y1: { type: Number },
    },
  },
  { _id: false }
);

const FormattedDocSectionSchema = new Schema<IFormattedDocSection>(
  {
    type: {
      type: String,
      enum: ['title', 'heading1', 'heading2', 'paragraph', 'bullet', 'numbered'],
      default: 'paragraph',
    },
    text: { type: String, required: true },
    bold: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    alignment: {
      type: String,
      enum: ['left', 'center', 'right', 'justify'],
      default: 'left',
    },
  },
  { _id: false }
);

const OcrJobSchema = new Schema<IOcrJob>(
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
    language: {
      type: String,
      enum: ['eng', 'ben', 'both'],
      default: 'eng',
    },
    engine: {
      type: String,
      enum: ['tesseract', 'cloud', 'simulation'],
      default: 'tesseract',
    },
    originalImage: {
      type: String,
      required: true,
    },
    preprocessedImage: {
      type: String,
    },
    preprocessingOptions: {
      grayscale: { type: Boolean, default: true },
      contrast: { type: Number, default: 1.2 },
      binarize: { type: Boolean, default: false },
      denoise: { type: Boolean, default: true },
      deskew: { type: Boolean, default: false },
    },
    overallConfidence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    textBlocks: [TextBlockSchema],
    rawExtractedText: {
      type: String,
      default: '',
    },
    editedText: {
      type: String,
      default: '',
    },
    formattedDoc: [FormattedDocSectionSchema],
    exportFormats: {
      docxGenerated: { type: Boolean, default: false },
      pdfGenerated: { type: Boolean, default: false },
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PROCESSED', 'SAVED', 'EXPORTED', 'COMPLETED'],
      default: 'PROCESSED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for tenant lookup and sorting
OcrJobSchema.index({ tenantId: 1, createdAt: -1 });

export const OcrJob: Model<IOcrJob> = mongoose.model<IOcrJob>('OcrJob', OcrJobSchema);

