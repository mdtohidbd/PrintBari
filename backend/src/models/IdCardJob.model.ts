import mongoose, { Document, Schema, Model } from 'mongoose';

export type IdCardType =
  | 'SMART_NID'
  | 'OLD_NID'
  | 'DRIVING_LICENSE'
  | 'STUDENT_ID'
  | 'CUSTOM';

export type CardArrangement = 'SIDE_BY_SIDE' | 'STACKED' | 'GRID';

export interface ICardSide {
  originalUrl?: string;
  processedUrl?: string;
  rotation: number;
  brightness: number;
  contrast: number;
  filterMode: 'ORIGINAL' | 'MAGIC_COLOR' | 'BW_PHOTOCOPY' | 'GRAYSCALE';
}

export interface IIdCardJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  cardType: IdCardType;
  cardTitle: string;
  cardDimensionsMm: {
    width: number;
    height: number;
  };
  frontImage: ICardSide;
  backImage: ICardSide;
  layoutSettings: {
    arrangement: CardArrangement;
    copies: number;
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    marginMm: number;
    gapMm: number;
    showCutMarks: boolean;
  };
  sheetImageUrl?: string;
  copies: number;
  totalAmount: number;
  notes?: string;
  status: 'DRAFT' | 'SAVED' | 'PRINT_READY' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const CardSideSchema = new Schema<ICardSide>(
  {
    originalUrl: { type: String },
    processedUrl: { type: String },
    rotation: { type: Number, default: 0 },
    brightness: { type: Number, default: 0 },
    contrast: { type: Number, default: 0 },
    filterMode: {
      type: String,
      enum: ['ORIGINAL', 'MAGIC_COLOR', 'BW_PHOTOCOPY', 'GRAYSCALE'],
      default: 'MAGIC_COLOR',
    },
  },
  { _id: false }
);

const IdCardJobSchema = new Schema<IIdCardJob>(
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
    cardType: {
      type: String,
      enum: ['SMART_NID', 'OLD_NID', 'DRIVING_LICENSE', 'STUDENT_ID', 'CUSTOM'],
      default: 'SMART_NID',
    },
    cardTitle: {
      type: String,
      default: 'Smart NID Card Photocopy',
    },
    cardDimensionsMm: {
      width: { type: Number, default: 85.6 },
      height: { type: Number, default: 54 },
    },
    frontImage: {
      type: CardSideSchema,
      default: () => ({}),
    },
    backImage: {
      type: CardSideSchema,
      default: () => ({}),
    },
    layoutSettings: {
      arrangement: {
        type: String,
        enum: ['SIDE_BY_SIDE', 'STACKED', 'GRID'],
        default: 'SIDE_BY_SIDE',
      },
      copies: { type: Number, default: 1 },
      orientation: {
        type: String,
        enum: ['PORTRAIT', 'LANDSCAPE'],
        default: 'PORTRAIT',
      },
      marginMm: { type: Number, default: 15 },
      gapMm: { type: Number, default: 10 },
      showCutMarks: { type: Boolean, default: true },
    },
    sheetImageUrl: { type: String },
    copies: { type: Number, default: 1, min: 1 },
    totalAmount: { type: Number, default: 10 },
    notes: { type: String, trim: true },
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

IdCardJobSchema.index({ tenantId: 1, createdAt: -1 });

export const IdCardJob: Model<IIdCardJob> = mongoose.model<IIdCardJob>(
  'IdCardJob',
  IdCardJobSchema
);

