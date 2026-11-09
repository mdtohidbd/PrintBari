import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageSquare, Clock } from 'lucide-react';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  shopName: z.string().min(2, 'Shop or business name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(7, 'Please enter a valid contact phone or WhatsApp number'),
  subject: z.string().min(3, 'Please select or enter a subject'),
  message: z.string().min(10, 'Message must be at least 10 characters long'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      await axios.post('/api/v1/growth/leads', {
        fullName: data.fullName,
        shopName: data.shopName,
        email: data.email,
        phone: data.phone,
        city: 'Dhaka',
        demoNotes: `[Contact Form] ${data.subject}: ${data.message}`,
        marketingConsent: true,
        utmSource: 'website_contact_form',
      });
    } catch (err) {
      // Gracefully handle or log
    }
    setSubmitted(true);
    reset();
  };

  return (
    <div className="py-16 space-y-16">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <Badge variant="primary">We’re Here to Help</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-2xl mx-auto">
          Get in Touch with Our Studio Support Specialists
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
          Need hardware integration help, printer setup advice, or an enterprise quote? Our team responds within 2 hours.
        </p>
      </section>

      {/* Main Grid: Form + Details */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 shadow-xl space-y-8">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white">Direct Channels</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fast support for active shop owners, operators, and print technicians.
                </p>
              </div>

              <div className="space-y-6 text-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/30 text-brand-400 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Customer Support</p>
                    <a href="mailto:support@docustudio.io" className="text-white hover:text-brand-300 font-medium">
                      support@docustudio.io
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">WhatsApp Shop Hotline</p>
                    <p className="text-white font-medium">+1 (800) 555-DOCU</p>
                    <p className="text-[11px] text-emerald-400">Average response: &lt; 15 mins</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Operating Hours</p>
                    <p className="text-white font-medium">Monday – Saturday: 8:00 AM – 10:00 PM</p>
                    <p className="text-xs text-slate-400">Sunday: 10:00 AM – 6:00 PM</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-600/30 text-amber-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Headquarters</p>
                    <p className="text-white font-medium">DocuStudio SaaS Engineering Lab</p>
                    <p className="text-xs text-slate-400">Silicon Innovation Hub, Suite 400</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm">
            {submitted ? (
              <div className="text-center py-12 space-y-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Message Received!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out. One of our technical specialists will respond to your email or WhatsApp within 2 hours.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                  className="mt-4"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Send Us an Inquiry</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Fill out the form below and we will get back to you promptly.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Your Name *"
                    placeholder="e.g. John Doe"
                    error={errors.fullName?.message}
                    {...register('fullName')}
                  />
                  <Input
                    label="Shop / Business Name *"
                    placeholder="e.g. Apex Xerox & Digital Photo"
                    error={errors.shopName?.message}
                    {...register('shopName')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="you@shopdomain.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                  <Input
                    label="Phone / WhatsApp Number *"
                    placeholder="+1 234 567 8900"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Topic of Inquiry *
                  </label>
                  <select
                    className="block w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    {...register('subject')}
                  >
                    <option value="General Question">General Product Question</option>
                    <option value="Printer Compatibility">Printer & Hardware Integration</option>
                    <option value="Enterprise / Multi-Store">Multi-Branch Chain Pricing</option>
                    <option value="Billing & Invoicing">Billing & Subscription Support</option>
                  </select>
                  {errors.subject && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {errors.subject.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Your Message / Requirements *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tell us about your shop volume, printer models, or any questions you have..."
                    className="block w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    {...register('message')}
                  />
                  {errors.message && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">
                      {errors.message.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                  rightIcon={<Send className="w-4 h-4" />}
                >
                  Send Inquiry to Support
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

