import React from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Camera,
  Monitor,
  GraduationCap,
  Printer,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const UseCasesPage: React.FC = () => {
  const useCases = [
    {
      id: 'photocopy-shops',
      title: 'Photocopy & Digital Print Shops',
      subtitle: 'Nilkhet, Katabon, Press Clubs & Commercial Copy Centers',
      icon: Copy,
      badge: 'High-Volume Document Automation',
      description:
        'Transform high-pressure counter operations. Eliminate manual Photoshop copy-pasting for NID cards and multi-page legal documents with 1-click batch duplication.',
      painPoints: [
        'Wasting 5–10 minutes per customer manually scanning and aligning dual-sided NID cards in Photoshop.',
        'Paper and toner waste caused by incorrect print margins on legal/duplex pages.',
        'Chaotic walk-in customer queues during peak student and office morning hours.',
      ],
      solutions: [
        'Automatic Smart ID dual-sided stitcher outputs 1, 2, or 4 copies on A4 in 5 seconds.',
        'Built-in page margin preserver guarantees 100% border compliance for legal deeds.',
        'Thermal POS receipt printer integration with customer due management.',
      ],
      testimonial: {
        quote:
          'In Nilkhet, we handle 400+ walk-in customers daily. DocuStudio cut our NID card formatting time from 6 minutes to 15 seconds. Our counter operator throughput doubled.',
        author: 'Md. Shahidul Islam',
        shop: 'Nilkhet Digital Copy & Graphics, Dhaka',
      },
      ctaLink: '/register',
      ctaText: 'Start Photocopy Trial',
    },
    {
      id: 'photo-studios',
      title: 'Digital Photography & Portrait Studios',
      subtitle: 'Neighborhood Photo Studios & Passport Print Labs',
      icon: Camera,
      badge: '10-Second Passport Photo Engine',
      description:
        'Produce biometric-compliant passport and visa photos for 50+ countries in under 10 seconds. Automated AI background replacement and instant 4R cut-sheet grids.',
      painPoints: [
        'Manually cutting out hair and backgrounds in Photoshop takes 8–15 minutes per portrait.',
        'Frequent visa photo rejections due to non-compliant head-to-chin ratios or wrong background shades.',
        'Messy cut lines leading to uneven manual trimming on 4R photo paper.',
      ],
      solutions: [
        '1-Click AI background replacement with pure White, Sky Blue, and Light Grey presets.',
        'Biometric alignment guides compliant with Bangladesh, US, Schengen, and GCC specifications.',
        'Automatic 4×6 / 4R layout with precision scissor/rotary cutter hairline guides.',
      ],
      testimonial: {
        quote:
          'No more manual pen-tool selections in Photoshop! Even during rush hours, walk-in customers get their passport photos printed on 4R glossy paper within 2 minutes.',
        author: 'Farhan Tanvir',
        shop: 'Apex Color Lab & Studio, Farmgate, Dhaka',
      },
      ctaLink: '/register',
      ctaText: 'Start Studio Trial',
    },
    {
      id: 'cyber-cafes',
      title: 'Cyber Cafés & Computer Training Centers',
      subtitle: 'Job Application Centers, Typing Shops & Public Service Kiosks',
      icon: Monitor,
      badge: 'CV Builder & Online Form Filing',
      description:
        'Serve walk-in job seekers and government service applicants effortlessly. Generate ATS-compliant resumes, format bio-data, and run high-accuracy Bengali OCR.',
      painPoints: [
        'Job seekers arrive with handwritten notes or unformatted bio-data needing urgent typing.',
        'Typing out certificates and typed documents manually from blurry camera photos.',
        'Loss of customer documents and inability to track printing payments and balance dues.',
      ],
      solutions: [
        'Instant CV & Bio-Data generator with 5 standard bilingual English/Bengali templates.',
        'High-speed OCR extracts printed English and Bengali text into editable text in seconds.',
        'Digital customer database tracks print history and sends pickup alerts via SMS.',
      ],
      testimonial: {
        quote:
          'We type 30+ CVs daily for applicants. The ready-made resume builder saved us 2 staff hours every day. Customers love the professional formatting.',
        author: 'Kamrul Hasan',
        shop: 'City Computer & Training Center, Rajshahi',
      },
      ctaLink: '/register',
      ctaText: 'Start Computer Center Trial',
    },
    {
      id: 'university-hubs',
      title: 'University Campus & Exam Hub Copy Shops',
      subtitle: 'Campus Bookstores, Library Xerox Counters & Research Labs',
      icon: GraduationCap,
      badge: 'Thesis & Bulk Exam Processing',
      description:
        'Handle semester-end thesis printing, lecture note syndication, and double-sided syllabus duplication at maximum speed without software crashes.',
      painPoints: [
        'Huge surges of student crowds before midterms and finals demanding immediate turnaround.',
        'Frequent printer driver hangs when sending 100+ page PDF documents to multiple printers.',
        'Tracking credit accounts and departmental vouchers manually in paper notebooks.',
      ],
      solutions: [
        'High-speed multi-printer spooling dispatches split jobs across multiple networked printers.',
        'Fast A4 document dewarping and contrast enhancement for mobile phone book scans.',
        'Institutional student/departmental ledger management with instant invoice generation.',
      ],
      testimonial: {
        quote:
          'During exam week, our 4 printers run continuously. DocuStudio print spooler prevents print queue crashes and lets our operators work without delays.',
        author: 'Abdur Rahim',
        shop: 'Campus Xerox Corner, Chittagong University',
      },
      ctaLink: '/register',
      ctaText: 'Start University Shop Trial',
    },
  ];

  return (
    <div className="py-16 space-y-20">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <Badge variant="primary">Targeted Industry Solutions</Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto">
          Built for the Exact Realities of Bangladeshi Shop Floors
        </h1>
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Whether you run a solo Xerox counter in Nilkhet or a multi-counter photo lab in Farmgate, DocuStudio eliminates Photoshop bottlenecks and powers fast counter service.
        </p>
      </section>

      {/* Use Cases Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {useCases.map((uc, index) => {
          const Icon = uc.icon;
          return (
            <div
              key={uc.id}
              className={`rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all ${
                index % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                        {uc.badge}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{uc.title}</h2>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-medium">{uc.subtitle}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{uc.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-600">
                        Operational Bottlenecks
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-600">
                        {uc.painPoints.map((p, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-red-500 font-bold">✕</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        DocuStudio Solutions
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-600">
                        {uc.solutions.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap gap-4">
                    <Link to={uc.ctaLink}>
                      <Button rightIcon={<ArrowRight className="w-4 h-4" />}>{uc.ctaText}</Button>
                    </Link>
                    <Link to="/demo">
                      <Button variant="outline">Book Live Demo</Button>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2 text-amber-500">
                    {'★'.repeat(5)}
                    <span className="text-xs text-slate-500 font-semibold ml-2">Verified Shop Owner</span>
                  </div>
                  <blockquote className="text-sm text-slate-800 italic leading-relaxed">
                    "{uc.testimonial.quote}"
                  </blockquote>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-900">{uc.testimonial.author}</p>
                    <p className="text-[11px] text-slate-500">{uc.testimonial.shop}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-900 to-indigo-900 text-white p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            See How Much Counter Time Your Shop Can Save
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Join over 150+ smart photocopy and studio businesses across Bangladesh. Try all modules free for 14 days with zero risk.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link to="/register">
              <Button size="lg" className="bg-white text-brand-900 hover:bg-slate-100 font-bold">
                Start 14-Day Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                Schedule a 15-Min Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

