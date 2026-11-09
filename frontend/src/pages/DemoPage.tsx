import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Monitor,
  Store,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

const demoSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  shopName: z.string().min(2, 'Shop or studio name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(11, 'Please enter a valid 11-digit Bangladesh phone number (01XXXXXXXXX)'),
  city: z.string().min(2, 'City or district is required'),
  shopType: z.enum([
    'PHOTO_STUDIO',
    'PHOTOCOPY_SHOP',
    'COMPUTER_CENTER',
    'CYBER_CAFE',
    'ENTERPRISE_PRESS',
    'OTHER',
  ]),
  demoDate: z.string().min(1, 'Please select a preferred date'),
  timeSlot: z.string().min(1, 'Please choose a preferred time slot'),
  currentSoftware: z.string().optional(),
  marketingConsent: z.boolean().refine((val) => val === true, {
    message: 'Marketing and follow-up consent is required to schedule a demo',
  }),
});

type DemoFormData = z.infer<typeof demoSchema>;

export const DemoPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DemoFormData>({
    resolver: zodResolver(demoSchema),
    defaultValues: {
      shopType: 'PHOTO_STUDIO',
      marketingConsent: true,
      timeSlot: '11:00 AM - 11:30 AM',
    },
  });

  const onSubmit = async (data: DemoFormData) => {
    setErrorMsg(null);
    try {
      const preferredDate = new Date(`${data.demoDate}T12:00:00Z`);
      await axios.post('/api/v1/growth/leads', {
        fullName: data.fullName,
        shopName: data.shopName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        shopType: data.shopType,
        currentSoftware: data.currentSoftware,
        isDemoRequest: true,
        preferredDate,
        demoNotes: `Selected time slot: ${data.timeSlot}`,
        marketingConsent: data.marketingConsent,
        utmSource: 'website_demo_booking',
      });
      setSubmitted(true);
      reset();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit demo request. Please try again.');
    }
  };

  const timeSlots = [
    '10:30 AM - 11:00 AM',
    '11:30 AM - 12:00 PM',
    '02:30 PM - 03:00 PM',
    '04:00 PM - 04:30 PM',
    '06:00 PM - 06:30 PM',
    '08:00 PM - 08:30 PM',
  ];

  return (
    <div className="py-16 space-y-16">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <Badge variant="primary">Personalized Walkthrough</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-2xl mx-auto">
          See DocuStudio in Action on Your Shop Floor
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
          Book a 15-minute live screen share with our shop specialists. We’ll show you real passport grid creation, NID card stitching, and printer spooling live.
        </p>
      </section>

      {/* Main Form + Value Column */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: What you'll experience */}
          <div className="lg:col-span-5 space-y-8">
            <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 shadow-xl space-y-8">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white">What We’ll Cover</h3>
                <p className="text-xs text-slate-400">
                  Customized to your exact shop operations, printer models, and counter volume.
                </p>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">10-Second Passport Photo Grid</strong>
                    Live demo replacing backgrounds with White/Blue and generating a 4R cut layout.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Monitor className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">Smart ID Card 1-Click Duplication</strong>
                    Stitching front and back NID cards onto A4 without opening Photoshop.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="text-white block font-semibold">Instant Printer Bridge Connection</strong>
                    Testing direct spooling to Epson L805, Canon G2010, and thermal POS printers.
                  </div>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>No obligation, no credit card required</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Phone className="w-4 h-4 text-brand-400" />
                  <span>Direct phone / WhatsApp support during demo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Booking Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-6">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Demo Scheduled!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you! Our shop specialist has received your booking. We will send meeting link details and a WhatsApp confirmation 30 minutes before your scheduled slot.
                </p>
                <div className="pt-4">
                  <Button variant="outline" onClick={() => setSubmitted(false)}>
                    Schedule Another Demo
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">Choose a Convenient Time Slot</h3>
                  <p className="text-xs text-slate-500">
                    Fill out your shop information to reserve your 1-on-1 walkthrough.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Your Full Name"
                    placeholder="e.g. Al-Amin Hossain"
                    {...register('fullName')}
                    error={errors.fullName?.message}
                  />
                  <Input
                    label="Shop / Studio Name"
                    placeholder="e.g. Al-Amin Digital Studio"
                    {...register('shopName')}
                    error={errors.shopName?.message}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="WhatsApp / Phone Number"
                    placeholder="017XXXXXXXX"
                    {...register('phone')}
                    error={errors.phone?.message}
                  />
                  <Input
                    label="Work Email Address"
                    placeholder="alamin@studio.com"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="City / District"
                    placeholder="e.g. Dhaka, Chittagong, Sylhet"
                    {...register('city')}
                    error={errors.city?.message}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Business Category
                    </label>
                    <select
                      {...register('shopType')}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="PHOTO_STUDIO">Digital Photo Studio</option>
                      <option value="PHOTOCOPY_SHOP">Photocopy / Xerox Shop</option>
                      <option value="COMPUTER_CENTER">Computer Training & Service Center</option>
                      <option value="CYBER_CAFE">Cyber Café / Public Kiosk</option>
                      <option value="ENTERPRISE_PRESS">Commercial Press / Multi-Branch</option>
                      <option value="OTHER">Other Print Business</option>
                    </select>
                  </div>
                </div>

                {/* Date & Time Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      {...register('demoDate')}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {errors.demoDate && (
                      <p className="text-[11px] text-red-600 mt-0.5">{errors.demoDate.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Preferred Time Slot (BST)
                    </label>
                    <select
                      {...register('timeSlot')}
                      className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {timeSlots.map((ts, idx) => (
                        <option key={idx} value={ts}>
                          {ts}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('marketingConsent')}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-[11px] text-slate-600 leading-normal">
                      I agree to receive the demo link, setup guides, and occasional studio tips via email and WhatsApp. We respect your privacy and never sell contact data.
                    </span>
                  </label>
                  {errors.marketingConsent && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {errors.marketingConsent.message}
                    </p>
                  )}
                </div>

                <div className="pt-3">
                  <Button
                    type="submit"
                    className="w-full justify-center"
                    size="lg"
                    isLoading={isSubmitting}
                  >
                    Confirm & Reserve My Live Demo
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

