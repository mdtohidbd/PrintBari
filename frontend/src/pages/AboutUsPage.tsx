import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShieldCheck, Heart, Zap, Target, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export const AboutUsPage: React.FC = () => {
  return (
    <div className="py-16 space-y-24">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="primary">Our Mission & Purpose</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto">
          Empowering the World’s Neighborhood Document Hubs
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Behind every visa application, college enrollment, passport renewal, and property deed is a hardworking local photocopy shop or digital studio. We build the operating system they deserve.
        </p>
      </section>

      {/* Story / Problem */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-slate-200/90 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
              The Genesis Story
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Why We Built DocuStudio
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Every day, millions of people walk into local Xerox centers, typing kiosks, and photo studios. Yet, despite being essential infrastructure of daily commerce, these shops were forced to rely on cracked, 15-year-old software, clumsy manual copy-pasting for dual-sided IDs, and chaotic paper receipts.
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              We asked ourselves: <em>What if an entire studio workflow could happen in 10 seconds with zero graphic skills required?</em> That question led to the creation of DocuStudio — an intelligent, cloud-to-hardware operating system built from the ground up for the speed of the walk-in counter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                01
              </div>
              <h4 className="font-bold text-slate-900 text-base">Speed Over Complexity</h4>
              <p className="text-xs text-slate-500">
                Never ask an operator to draw a path or set feather radii. Everything is calculated automatically.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                02
              </div>
              <h4 className="font-bold text-slate-900 text-base">Zero-Retention Privacy</h4>
              <p className="text-xs text-slate-500">
                Customer identity cards and photos are purged within 24 hours to protect citizens from identity theft.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                03
              </div>
              <h4 className="font-bold text-slate-900 text-base">Hardware Freedom</h4>
              <p className="text-xs text-slate-500">
                Seamless compatibility with any printer brand: Canon, Epson, Xerox, HP, DNP, and thermal receipt POS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <Badge variant="neutral">Engineering Standards</Badge>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Our Guiding Values
          </h2>
          <p className="text-slate-600 text-sm">
            What guides our team as we build software for front-line shop workers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Respect the Counter Rush',
              desc: 'During morning school and office rushes, every second counts. Our interfaces are designed to eliminate clicks.',
              icon: Zap,
            },
            {
              title: 'Bulletproof Reliability',
              desc: 'Even if the internet flickers, offline caching ensures the counter queue never halts.',
              icon: ShieldCheck,
            },
            {
              title: 'Empower Non-Designers',
              desc: 'High school graduates and apprentices can operate the entire studio on day one.',
              icon: Users,
            },
            {
              title: 'Fair Pricing',
              desc: 'Our plans are priced to guarantee that one day of extra shop turnover pays for an entire month.',
              icon: Target,
            },
          ].map((val, idx) => {
            const Icon = val.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Icon className="w-5 h-5 text-brand-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">{val.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{val.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-slate-900">
          Join the Movement Modernizing Local Print Businesses
        </h2>
        <p className="text-slate-600 text-sm">
          Get started today with zero risk. Try the full system free for 14 days.
        </p>
        <Link to="/register">
          <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Start Free 14-Day Trial
          </Button>
        </Link>
      </section>
    </div>
  );
};

