import mongoose, { Document, Schema, Model } from 'mongoose';
import { UserRole } from './User.model';

export type PermissionKey =
  | 'JOBS_READ'
  | 'JOBS_CREATE'
  | 'JOBS_UPDATE_STATUS'
  | 'JOBS_DELETE'
  | 'JOBS_PRINT'
  | 'CUSTOMERS_READ'
  | 'CUSTOMERS_MANAGE'
  | 'PRINTERS_READ'
  | 'PRINTERS_SPOOL'
  | 'STAFF_READ'
  | 'STAFF_MANAGE'
  | 'SETTINGS_MANAGE'
  | 'BILLING_MANAGE'
  | 'TEMPLATES_MANAGE'
  | 'SUPER_ADMIN_MANAGE';

export interface IRolePermission extends Document {
  role: UserRole;
  displayName: string;
  description: string;
  permissions: PermissionKey[];
  isCustomizable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RolePermissionSchema = new Schema<IRolePermission>(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    permissions: {
      type: [String],
      required: true,
      default: [],
    },
    isCustomizable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const RolePermission: Model<IRolePermission> = mongoose.model<IRolePermission>(
  'RolePermission',
  RolePermissionSchema
);

