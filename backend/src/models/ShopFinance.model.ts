import mongoose, { Document, Schema, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// 1. SHOP FINANCIAL TRANSACTIONS (IMMUTABLE LEDGER)
// ---------------------------------------------------------------------------
export type ShopTransactionType =
  | 'SALE'
  | 'PAYMENT_COLLECTION'
  | 'EXPENSE'
  | 'REFUND'
  | 'ADJUSTMENT';

export type ShopPaymentMethod =
  | 'CASH'
  | 'BKASH'
  | 'NAGAD'
  | 'CARD'
  | 'DUE'
  | 'BANK_TRANSFER'
  | 'OTHER';

export interface IShopTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  transactionCode: string;
  type: ShopTransactionType;
  amount: number; // in BDT (rounded to 2 decimal places, stored in cents/paisa equivalent)
  paymentMethod: ShopPaymentMethod;
  category: string; // e.g. PASSPORT_PHOTO, DOCUMENT_A4, SHOP_RENT, PAPER_SUPPLIES
  jobId?: mongoose.Types.ObjectId;
  jobCode?: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  customerPhone?: string;
  recordedBy: mongoose.Types.ObjectId;
  recordedByName: string;
  recordedByRole: string;
  staffCommission?: {
    staffId: mongoose.Types.ObjectId;
    staffName: string;
    ratePercent: number;
    amount: number;
  };
  discount?: {
    amount: number;
    reason?: string;
    approvedBy?: string;
  };
  referenceNote?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ShopTransactionSchema = new Schema<IShopTransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    transactionCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['SALE', 'PAYMENT_COLLECTION', 'EXPENSE', 'REFUND', 'ADJUSTMENT'],
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['CASH', 'BKASH', 'NAGAD', 'CARD', 'DUE', 'BANK_TRANSFER', 'OTHER'],
      default: 'CASH',
      index: true,
    },
    category: {
      type: String,
      required: true,
      default: 'GENERAL',
      trim: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
    },
    jobCode: {
      type: String,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordedByName: {
      type: String,
      required: true,
    },
    recordedByRole: {
      type: String,
      default: 'STAFF',
    },
    staffCommission: {
      staffId: { type: Schema.Types.ObjectId, ref: 'User' },
      staffName: { type: String },
      ratePercent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    discount: {
      amount: { type: Number, default: 0 },
      reason: { type: String },
      approvedBy: { type: String },
    },
    referenceNote: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: unique transaction code per tenant
ShopTransactionSchema.index({ tenantId: 1, transactionCode: 1 }, { unique: true });
// Compound index: unique idempotencyKey per tenant when present
ShopTransactionSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true, $ne: null } } }
);

// ---------------------------------------------------------------------------
// 2. DAILY CASH REGISTER CLOSING & SHIFT AUDIT
// ---------------------------------------------------------------------------
export interface IDailyCashRegister extends Document {
  tenantId: mongoose.Types.ObjectId;
  closingDate: string; // YYYY-MM-DD
  openedAt: Date;
  openedBy: mongoose.Types.ObjectId;
  openedByName: string;
  openingFloat: number; // initial change in cash drawer (e.g. ৳1,000)
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  closedByName?: string;
  status: 'OPEN' | 'CLOSED';
  summary: {
    totalSales: number;
    cashSales: number;
    digitalSales: number; // bKash, Nagad, Card
    duesGiven: number;
    duesCollected: number;
    totalExpenses: number;
    cashExpenses: number;
    expectedCashInDrawer: number;
    actualCountedCash?: number;
    cashDifference?: number; // actualCountedCash - expectedCashInDrawer (over/short)
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyCashRegisterSchema = new Schema<IDailyCashRegister>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    closingDate: {
      type: String,
      required: true,
      index: true,
    },
    openedAt: {
      type: Date,
      default: Date.now,
    },
    openedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    openedByName: {
      type: String,
      required: true,
    },
    openingFloat: {
      type: Number,
      default: 0,
      min: 0,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    closedByName: {
      type: String,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    summary: {
      totalSales: { type: Number, default: 0 },
      cashSales: { type: Number, default: 0 },
      digitalSales: { type: Number, default: 0 },
      duesGiven: { type: Number, default: 0 },
      duesCollected: { type: Number, default: 0 },
      totalExpenses: { type: Number, default: 0 },
      cashExpenses: { type: Number, default: 0 },
      expectedCashInDrawer: { type: Number, default: 0 },
      actualCountedCash: { type: Number },
      cashDifference: { type: Number, default: 0 },
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Unique closing record per day per tenant
DailyCashRegisterSchema.index({ tenantId: 1, closingDate: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// 3. SHOP INVENTORY & CONSUMABLES
// ---------------------------------------------------------------------------
export interface IShopInventoryItem extends Document {
  tenantId: mongoose.Types.ObjectId;
  itemCode: string;
  name: string;
  category: 'PAPER' | 'INK_TONER' | 'LAMINATION' | 'STATIONERY' | 'OTHER';
  unit: 'PACK' | 'SHEET' | 'BOTTLE' | 'PIECE' | 'ROLL';
  costPrice: number;
  sellingPrice?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  lastRestockedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShopInventoryItemSchema = new Schema<IShopInventoryItem>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    itemCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['PAPER', 'INK_TONER', 'LAMINATION', 'STATIONERY', 'OTHER'],
      default: 'PAPER',
      index: true,
    },
    unit: {
      type: String,
      enum: ['PACK', 'SHEET', 'BOTTLE', 'PIECE', 'ROLL'],
      default: 'PACK',
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    lastRestockedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ShopInventoryItemSchema.index({ tenantId: 1, itemCode: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
export const ShopTransaction: Model<IShopTransaction> = mongoose.model<IShopTransaction>(
  'ShopTransaction',
  ShopTransactionSchema
);

export const DailyCashRegister: Model<IDailyCashRegister> = mongoose.model<IDailyCashRegister>(
  'DailyCashRegister',
  DailyCashRegisterSchema
);

export const ShopInventoryItem: Model<IShopInventoryItem> = mongoose.model<IShopInventoryItem>(
  'ShopInventoryItem',
  ShopInventoryItemSchema
);

