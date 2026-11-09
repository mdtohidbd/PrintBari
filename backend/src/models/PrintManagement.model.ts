import mongoose, { Document, Schema, Model } from 'mongoose';

export type PaperSize = 'A4' | '4x6' | 'LEGAL' | 'LETTER' | 'A3' | 'CUSTOM';
export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
export type ColorMode = 'COLOR' | 'GRAYSCALE' | 'BLACK_WHITE';
export type PrintQuality = 'DRAFT' | 'NORMAL' | 'HIGH' | 'PHOTO_FINE';
export type PrintStatus = 'QUEUED' | 'SENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// 1. Printer Hardware Device
export interface IPrinterDevice extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  printerModel: string;
  type: 'PHOTO' | 'DOCUMENT_COLOR' | 'MONO_LASER' | 'PLOTTER' | 'RECEIPT';
  connectionType: 'BROWSER_DIALOG' | 'LOCAL_AGENT' | 'NETWORK_RAW';
  agentEndpoint?: string;
  isOnline: boolean;
  supportedPaperSizes: PaperSize[];
  colorCapable: boolean;
  defaultCopies: number;
  currentInkLevels: {
    black: number;
    cyan: number;
    magenta: number;
    yellow: number;
    lightCyan?: number;
    lightMagenta?: number;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PrinterDeviceSchema = new Schema<IPrinterDevice>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    printerModel: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['PHOTO', 'DOCUMENT_COLOR', 'MONO_LASER', 'PLOTTER', 'RECEIPT'],
      default: 'DOCUMENT_COLOR',
    },
    connectionType: {
      type: String,
      enum: ['BROWSER_DIALOG', 'LOCAL_AGENT', 'NETWORK_RAW'],
      default: 'BROWSER_DIALOG',
    },
    agentEndpoint: {
      type: String,
      trim: true,
      default: 'http://127.0.0.1:8989',
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    supportedPaperSizes: {
      type: [String],
      default: ['A4', '4x6', 'LEGAL', 'LETTER'],
    },
    colorCapable: {
      type: Boolean,
      default: true,
    },
    defaultCopies: {
      type: Number,
      default: 1,
    },
    currentInkLevels: {
      black: { type: Number, default: 85 },
      cyan: { type: Number, default: 72 },
      magenta: { type: Number, default: 68 },
      yellow: { type: Number, default: 90 },
      lightCyan: { type: Number, default: 75 },
      lightMagenta: { type: Number, default: 80 },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// 2. Print Queue Item & History
export interface IPrintSettings {
  copies: number;
  paperSize: PaperSize;
  orientation: Orientation;
  colorMode: ColorMode;
  quality: PrintQuality;
  duplex?: 'NONE' | 'LONG_EDGE' | 'SHORT_EDGE';
}

export interface IPrintJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  printJobCode: string;
  jobId?: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  printerId?: mongoose.Types.ObjectId;
  printerName: string;
  serviceType: string;
  queuePosition: number;
  documentUrl: string;
  documentTitle: string;
  settings: IPrintSettings;
  status: PrintStatus;
  printedCopies: number;
  staffId?: mongoose.Types.ObjectId;
  staffName: string;
  startedAt?: Date;
  completedAt?: Date;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PrintSettingsSchema = new Schema<IPrintSettings>(
  {
    copies: { type: Number, default: 1, min: 1, max: 1000 },
    paperSize: {
      type: String,
      enum: ['A4', '4x6', 'LEGAL', 'LETTER', 'A3', 'CUSTOM'],
      default: 'A4',
    },
    orientation: {
      type: String,
      enum: ['PORTRAIT', 'LANDSCAPE'],
      default: 'PORTRAIT',
    },
    colorMode: {
      type: String,
      enum: ['COLOR', 'GRAYSCALE', 'BLACK_WHITE'],
      default: 'COLOR',
    },
    quality: {
      type: String,
      enum: ['DRAFT', 'NORMAL', 'HIGH', 'PHOTO_FINE'],
      default: 'NORMAL',
    },
    duplex: {
      type: String,
      enum: ['NONE', 'LONG_EDGE', 'SHORT_EDGE'],
      default: 'NONE',
    },
  },
  { _id: false }
);

const PrintJobSchema = new Schema<IPrintJob>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    printJobCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
    },
    jobCode: {
      type: String,
      required: true,
      trim: true,
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
    printerId: {
      type: Schema.Types.ObjectId,
      ref: 'PrinterDevice',
    },
    printerName: {
      type: String,
      required: true,
      trim: true,
      default: 'Default Shop Printer',
    },
    serviceType: {
      type: String,
      required: true,
      default: 'DOCUMENT_PRINT',
    },
    queuePosition: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    documentUrl: {
      type: String,
      required: true,
    },
    documentTitle: {
      type: String,
      default: 'Print Document',
    },
    settings: {
      type: PrintSettingsSchema,
      default: () => ({
        copies: 1,
        paperSize: 'A4',
        orientation: 'PORTRAIT',
        colorMode: 'COLOR',
        quality: 'NORMAL',
        duplex: 'NONE',
      }),
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index: true,
    },
    printedCopies: {
      type: Number,
      default: 0,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    staffName: {
      type: String,
      required: true,
      default: 'Staff',
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    errorDetails: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

PrintJobSchema.index({ tenantId: 1, status: 1, queuePosition: 1 });
PrintJobSchema.index({ tenantId: 1, createdAt: -1 });

export const PrinterDevice: Model<IPrinterDevice> = mongoose.model<IPrinterDevice>(
  'PrinterDevice',
  PrinterDeviceSchema
);

export const PrintJob: Model<IPrintJob> = mongoose.model<IPrintJob>('PrintJob', PrintJobSchema);
