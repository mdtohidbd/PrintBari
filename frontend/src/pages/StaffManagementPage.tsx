import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '../api/tenant.api';
import { useAppStore } from '../store/useAppStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Edit2,
  Power,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  Phone,
  UserCheck,
} from 'lucide-react';

export const StaffManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  // Forms
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'STAFF',
  });

  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    role: 'STAFF',
  });

  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch current shop & quotas
  const { data: shopResponse } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: tenantApi.getCurrentShop,
  });
  const shopData = shopResponse?.data;
  const quotas = shopData?.quotas;

  // 2. Fetch staff list
  const { data: staffResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-list', searchQuery, roleFilter, statusFilter],
    queryFn: () =>
      tenantApi.listStaff({
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
      }),
  });
  const staffList = staffResponse?.data || [];

  // 3. Fetch activity history for selected staff
  const { data: activityResponse, isLoading: activityLoading } = useQuery({
    queryKey: ['staff-activity', selectedStaff?._id],
    queryFn: () => tenantApi.getStaffActivity(selectedStaff._id),
    enabled: !!selectedStaff && activityModalOpen,
  });
  const staffActivities = activityResponse?.data || [];

  // Mutations
  const addStaffMutation = useMutation({
    mutationFn: tenantApi.addStaff,
    onSuccess: () => {
      setAddModalOpen(false);
      setAddForm({ fullName: '', email: '', password: '', phone: '', role: 'STAFF' });
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to add staff member');
    },
  });

  const editStaffMutation = useMutation({
    mutationFn: ({ staffId, data }: { staffId: string; data: any }) =>
      tenantApi.editStaff(staffId, data),
    onSuccess: () => {
      setEditModalOpen(false);
      setSelectedStaff(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to update staff member');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: tenantApi.toggleStaffStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] });
    },
  });

  const handleOpenEdit = (staff: any) => {
    setSelectedStaff(staff);
    setEditForm({
      fullName: staff.fullName,
      phone: staff.phone || '',
      role: staff.role,
    });
    setEditModalOpen(true);
  };

  const handleOpenActivity = (staff: any) => {
    setSelectedStaff(staff);
    setActivityModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    addStaffMutation.mutate(addForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setActionError(null);
    editStaffMutation.mutate({ staffId: selectedStaff._id, data: editForm });
  };

  const isOwner = currentUser?.role === 'OWNER';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Staff & Role Management
            </h1>
            <Badge variant="primary">
              {quotas?.activeStaffCount || staffList.filter((s: any) => s.isActive).length} / {quotas?.maxStaffSeats || 6} Seats
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage counter operators, photo studio editors, and printers with granular role-based permissions.
          </p>
        </div>

        {isOwner && (
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setAddModalOpen(true);
            }}
            disabled={quotas?.seatsAvailable === 0}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Add New Staff Member
          </Button>
        )}
      </div>

      {/* Quota Banner */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              Subscription Plan: {shopData?.subscription.plan || 'PROFESSIONAL'}
            </p>
            <p className="text-[11px] text-slate-500">
              {quotas?.seatsAvailable !== undefined ? quotas.seatsAvailable : 2} staff seat(s) available on this tier.
            </p>
          </div>
        </div>

        {quotas?.seatsAvailable === 0 && (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Staff Seat Quota Reached
          </span>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-700 focus:outline-none font-medium"
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff (Front Desk)</option>
            <option value="OPERATOR">Operator (Editor)</option>
            <option value="REVIEWER">Reviewer (QA)</option>
            <option value="PRINTER">Printer (Hardware)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs text-slate-700 focus:outline-none font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading staff accounts...
            </div>
          ) : staffList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-700">No staff members found</p>
              <p className="text-xs text-slate-400">
                {searchQuery ? 'Try clearing your search filters' : 'Click Add New Staff Member to register your counter staff'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Staff roster table">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 uppercase tracking-wider font-semibold">
                  <tr>
                    <th scope="col" className="py-3 px-4">Staff Member</th>
                    <th scope="col" className="py-3 px-4">Role & Clearance</th>
                    <th scope="col" className="py-3 px-4">Contact</th>
                    <th scope="col" className="py-3 px-4">Account Status</th>
                    <th scope="col" className="py-3 px-4">Last Activity</th>
                    <th scope="col" className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffList.map((staff: any) => (
                    <tr key={staff._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 uppercase text-xs">
                          {staff.fullName.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{staff.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{staff.email}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-semibold text-[11px] px-2.5 py-1 rounded-md border ${
                            staff.role === 'OWNER'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : staff.role === 'MANAGER'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : staff.role === 'OPERATOR'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {staff.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {staff.phone || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={staff.isActive ? 'success' : 'neutral'} size="sm">
                          {staff.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {staff.lastLoginAt
                          ? new Date(staff.lastLoginAt).toLocaleDateString()
                          : 'Never logged in'}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleOpenActivity(staff)}
                          title="View activity history"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        {isOwner && staff.role !== 'OWNER' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(staff)}
                              title="Edit staff details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => toggleStatusMutation.mutate(staff._id)}
                              title={staff.isActive ? 'Deactivate staff' : 'Activate staff'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                staff.isActive
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Staff Member"
        description="Provision a new account for counter staff, studio operator, or printer"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {actionError}
            </div>
          )}

          <Input
            label="Full Name *"
            value={addForm.fullName}
            onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
            placeholder="e.g. Oscar Operator"
            required
          />

          <Input
            label="Email Address *"
            type="email"
            value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            placeholder="oscar@yourshop.com"
            required
          />

          <Input
            label="Initial Password *"
            type="password"
            value={addForm.password}
            onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            placeholder="••••••••"
            required
          />

          <Input
            label="Phone Number"
            value={addForm.phone}
            onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
            placeholder="+1 555 123 4567"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Role *
            </label>
            <select
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
              className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="STAFF">Staff (Front-Desk Intake & Billing)</option>
              <option value="OPERATOR">Operator (Passport, ID & Dewarping Editor)</option>
              <option value="REVIEWER">Reviewer (Quality Assurance Inspector)</option>
              <option value="PRINTER">Printer (Hardware Print Spooler Operator)</option>
              <option value="MANAGER">Manager (Store Supervisor)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={addStaffMutation.isPending}>
              Create Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Staff Member"
        description="Update role and contact details"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {actionError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {actionError}
            </div>
          )}

          <Input
            label="Full Name *"
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            required
          />

          <Input
            label="Phone Number"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Role *
            </label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="STAFF">Staff (Front-Desk Intake & Billing)</option>
              <option value="OPERATOR">Operator (Passport, ID & Dewarping Editor)</option>
              <option value="REVIEWER">Reviewer (Quality Assurance Inspector)</option>
              <option value="PRINTER">Printer (Hardware Print Spooler Operator)</option>
              <option value="MANAGER">Manager (Store Supervisor)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={editStaffMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Staff Activity History Modal */}
      <Modal
        isOpen={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        title={`Activity History: ${selectedStaff?.fullName || ''}`}
        description="Audit log of actions performed by this user"
      >
        <div className="space-y-3">
          {activityLoading ? (
            <p className="text-center py-6 text-xs text-slate-400">Loading audit history...</p>
          ) : staffActivities.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">No recorded audit logs for this staff member.</p>
          ) : (
            staffActivities.map((act: any) => (
              <div key={act._id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{act.action.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>
                {act.details && (
                  <pre className="text-[10px] text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                    {JSON.stringify(act.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

