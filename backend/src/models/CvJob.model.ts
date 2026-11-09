import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICvData {
  personalInfo: {
    fullName: string;
    jobTitle?: string;
    email: string;
    phone: string;
    address?: string;
    website?: string;
    linkedin?: string;
    photoUrl?: string;
    dateOfBirth?: string;
    nationality?: string;
    religion?: string;
    maritalStatus?: string;
    fatherName?: string;
    motherName?: string;
  };
  objective?: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    description?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    passingYear?: string;
    result?: string;
    boardOrMajor?: string;
  }>;
  skills: string[];
  projects: Array<{
    title: string;
    link?: string;
    description?: string;
  }>;
  languages: Array<{
    name: string;
    proficiency?: string;
  }>;
  references: Array<{
    name: string;
    designation?: string;
    company?: string;
    phone?: string;
    email?: string;
  }>;
  customSections?: Array<{
    title: string;
    content: string;
  }>;
}

export interface ICvJob extends Document {
  tenantId: mongoose.Types.ObjectId;
  jobCode: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  language: 'BN' | 'EN';
  templateId: 'modern' | 'classic' | 'bangla' | 'minimal';
  theme: {
    primaryColor: string;
    fontFamily: string;
    fontSize: string;
  };
  cvData: ICvData;
  copies: number;
  totalAmount: number;
  notes?: string;
  status: 'DRAFT' | 'SAVED' | 'PRINT_READY' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const CvJobSchema = new Schema<ICvJob>(
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
      enum: ['BN', 'EN'],
      default: 'EN',
    },
    templateId: {
      type: String,
      enum: ['modern', 'classic', 'bangla', 'minimal'],
      default: 'modern',
    },
    theme: {
      primaryColor: { type: String, default: '#1E3A8A' },
      fontFamily: { type: String, default: 'Inter' },
      fontSize: { type: String, default: 'normal' },
    },
    cvData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    copies: { type: Number, default: 1, min: 1 },
    totalAmount: { type: Number, default: 50 }, // Typical 50 BDT for CV compose & print
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

CvJobSchema.index({ tenantId: 1, createdAt: -1 });

export const CvJob: Model<ICvJob> = mongoose.model<ICvJob>('CvJob', CvJobSchema);

