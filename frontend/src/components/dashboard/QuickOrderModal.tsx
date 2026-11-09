import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { jobApi } from '../../api/job.api';
import { Camera, CreditCard, FileText, FileSpreadsheet, PenTool, Printer, Sparkles } from 'lucide-react';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [serviceType, setServiceType] = useState('PASSPORT_PHOTO');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      priority: 'NORMAL',
      copies: 8,
      paperType: '4x6 Photo Glossy',
      totalAmount: 5.0,
      paidAmount: 5.0,
      paymentMethod: 'CASH',
      notes: '',
    },
  });

  const services = [
    { id: 'PASSPORT_PHOTO', name: 'Passport Studio', icon: Camera, defaultPaper: '4x6 Photo Glossy', defaultCopies: 8, defaultPrice: 5.0 },
    { id: 'ID_CARD_A4', name: 'ID Card A4', icon: CreditCard, defaultPaper: 'A4 Plain 80gsm', defaultCopies: 2, defaultPrice: 3.5 },
    { id: 'DOCUMENT_A4', name: 'Document Dewarp', icon: FileText, defaultPaper: 'A4 Plain 80gsm', defaultCopies: 1, defaultPrice: 2.0 },
    { id: 'CV_BUILDER', name: 'CV / Bio-Data', icon: FileSpreadsheet, defaultPaper: 'A4 Executive Bond', defaultCopies: 2, defaultPrice: 8.0 },
    { id: 'HANDWRITING_OCR', name: 'OCR to Word', icon: PenTool, defaultPaper: 'Digital .docx download', defaultCopies: 1, defaultPrice: 6.0 },
    { id: 'PHOTOCOPY_PRINT', name: 'Print / Xerox', icon: Printer, defaultPaper: 'A4 Plain', defaultCopies: 10, defaultPrice: 2.5 },
  ];

  const handleSelectService = (s: typeof services[0]) => {
    setServiceType(s.id);
    reset((prev) => ({
      ...prev,
      paperType: s.defaultPaper,
      copies: s.defaultCopies,
      totalAmount: s.defaultPrice,
      paidAmount: s.defaultPrice,
    }));
  };

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await jobApi.createJob({
        ...data,
        serviceType,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Walk-In Customer Job"
      description="Quickly intake a walk-in order and queue it into the processing pipeline"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Service Type Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Select Service Type *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {services.map((s) => {
              const Icon = s.icon;
              const isSelected = serviceType === s.id;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => handleSelectService(s)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20 text-brand-900 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span className="text-xs">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Customer Full Name *"
            placeholder="e.g. John Doe"
            required
            {...register('customerName', { required: true })}
          />
          <Input
            label="Phone / WhatsApp Number *"
            placeholder="e.g. +1 555 123 4567"
            required
            {...register('customerPhone', { required: true })}
          />
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Quantity / Copies"
            type="number"
            min="1"
            {...register('copies')}
          />
          <Input
            label="Paper Type / Target"
            placeholder="e.g. 4x6 Photo Glossy"
            {...register('paperType')}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Priority
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
              {...register('priority')}
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent (Express)</option>
            </select>
          </div>
        </div>

        {/* Payment & Settlement */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Total Amount ($) *"
            type="number"
            step="0.5"
            required
            {...register('totalAmount', { required: true })}
          />
          <Input
            label="Paid Amount ($) *"
            type="number"
            step="0.5"
            required
            {...register('paidAmount', { required: true })}
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 py-2.5 px-3 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
              {...register('paymentMethod')}
            >
              <option value="CASH">Cash Drawer</option>
              <option value="UPI_BKASH">UPI / bKash / Mobile Pay</option>
              <option value="CARD">Debit / Credit Card</option>
            </select>
          </div>
        </div>

        <Input
          label="Notes / Special Requirements"
          placeholder="e.g. White background, light blue shirt, 2x2 US Visa format"
          {...register('notes')}
        />

        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} leftIcon={<Sparkles className="w-4 h-4" />}>
            Create & Dispatch Job
          </Button>
        </div>
      </form>
    </Modal>
  );
};

