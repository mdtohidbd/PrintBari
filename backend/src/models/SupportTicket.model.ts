import mongoose, { Document, Schema } from 'mongoose';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'BILLING'
  | 'PRINTER_HARDWARE'
  | 'STUDIO_ENGINE'
  | 'ACCOUNT'
  | 'BUG_REPORT'
  | 'FEATURE_REQUEST';

export interface ITicketMessage {
  _id?: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: string;
  senderName: string;
  message: string;
  isInternalNote: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    bytes?: number;
  }>;
  createdAt: Date;
}

export interface ITicketHistory {
  action: string;
  actorId: mongoose.Types.ObjectId;
  actorName: string;
  details?: string;
  timestamp: Date;
}

export interface ISupportTicket extends Document {
  ticketCode: string;
  tenantId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messages: ITicketMessage[];
  history: ITicketHistory[];
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    isInternalNote: { type: Boolean, default: false },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        bytes: { type: Number },
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TicketHistorySchema = new Schema<ITicketHistory>(
  {
    action: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    details: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketCode: { type: String, required: true, unique: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['BILLING', 'PRINTER_HARDWARE', 'STUDIO_ENGINE', 'ACCOUNT', 'BUG_REPORT', 'FEATURE_REQUEST'],
      default: 'STUDIO_ENGINE',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    messages: [TicketMessageSchema],
    history: [TicketHistorySchema],
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ tenantId: 1, status: 1 });
SupportTicketSchema.index({ status: 1, priority: 1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

// ─────────────────────────────────────────────
// KNOWLEDGE BASE / HELP CENTER ARTICLES
// ─────────────────────────────────────────────

export interface ISupportArticle extends Document {
  articleId: string;
  title: string;
  slug: string;
  category: TicketCategory;
  summary: string;
  contentMarkdown: string;
  helpfulCount: number;
  tags: string[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupportArticleSchema = new Schema<ISupportArticle>(
  {
    articleId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      enum: ['BILLING', 'PRINTER_HARDWARE', 'STUDIO_ENGINE', 'ACCOUNT', 'BUG_REPORT', 'FEATURE_REQUEST'],
      required: true,
      index: true,
    },
    summary: { type: String, required: true },
    contentMarkdown: { type: String, required: true },
    helpfulCount: { type: Number, default: 0 },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const SupportArticle = mongoose.model<ISupportArticle>('SupportArticle', SupportArticleSchema);

