import React, { useState } from 'react';
import { Camera, CreditCard, Layers, Check, Printer, Sparkles, Scissors, Eye, RotateCw } from 'lucide-react';
import { Badge } from '../common/Badge';

export const HeroPreviewMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'passport' | 'idcard' | 'queue'>('passport');
  const [bgColor, setBgColor] = useState<'white' | 'blue' | 'gray'>('white');

  const bgClassMap = {
    white: 'bg-white',
    blue: 'bg-sky-100',
    gray: 'bg-slate-200',
  };

  return (
    <div className="relative mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-4 shadow-2xl shadow-brand-500/10">
      {/* Window Titlebar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 px-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-400" />
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-slate-400 ml-2">
            DocuStudio Cloud Studio Engine • v1.0
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab('passport')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'passport'
                ? 'bg-white text-brand-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Passport Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('idcard')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'idcard'
                ? 'bg-white text-brand-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>ID Card to A4</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'queue'
                ? 'bg-white text-brand-600 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Live Kanban Queue</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Passport Studio Preview */}
      {activeTab === 'passport' && (
        <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Controls Panel */}
          <div className="md:col-span-5 space-y-4 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="success" size="sm">
                AI Auto-Cropped 2x2" (US Spec)
              </Badge>
              <span className="text-xs text-slate-400">300 DPI</span>
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              Instant 8-Pack Passport Sheet with Cut Lines
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload customer portrait from smartphone or webcam. Auto-replaces background, centers eye-line, and arranges into standard 4×6 photo paper in under 5 seconds.
            </p>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Instant Background Color
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'white', label: 'White', color: 'bg-white border-slate-300' },
                  { id: 'blue', label: 'Sky Blue', color: 'bg-sky-200 border-sky-400' },
                  { id: 'gray', label: 'Off-White', color: 'bg-slate-200 border-slate-400' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBgColor(b.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      bgColor === b.id ? 'ring-2 ring-brand-500 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border ${b.color}`} />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Biometric Standards Compliant
              </span>
            </div>
          </div>

          {/* Interactive Sheet Preview */}
          <div className="md:col-span-7 bg-slate-900/5 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
            <div className="text-[11px] font-mono text-slate-500 mb-2 flex items-center justify-between w-full px-2">
              <span className="flex items-center gap-1">
                <Scissors className="w-3 h-3 text-slate-400" /> 4×6 Inch Sheet (8 Copies)
              </span>
              <span className="text-brand-600 font-semibold flex items-center gap-1">
                <Printer className="w-3 h-3" /> Ready for DNP / Epson Inkjet
              </span>
            </div>

            {/* 8-Photo Grid Layout */}
            <div className="bg-white p-3 rounded-lg shadow-md border border-slate-300 grid grid-cols-4 gap-2 max-w-sm">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                <div
                  key={idx}
                  className={`relative aspect-[35/45] rounded border border-dashed border-slate-300 overflow-hidden flex flex-col items-center justify-end p-1 transition-colors ${bgClassMap[bgColor]}`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-400/40 mb-1" />
                  <div className="w-10 h-6 rounded-t-xl bg-slate-500/40" />
                  <span className="absolute top-0.5 right-0.5 text-[8px] font-mono text-slate-400">
                    #{idx}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              Margin: 3mm • Cut Guides: Enabled • Output: 300 DPI High Gloss
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: ID Card Auto-Stitch */}
      {activeTab === 'idcard' && (
        <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5 space-y-4 text-left">
            <Badge variant="primary" size="sm">
              Dual-Sided Auto-Alignment
            </Badge>
            <h4 className="text-lg font-bold text-slate-900">
              Front & Back National ID on 1 A4 Sheet
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              No manual copy-paste in Photoshop. DocuStudio automatically detects card edges from flatbed scan or mobile photo, crops front & back, enhances contrast, and places both perfectly centered on A4 paper.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Standard Layout</span>
                <span className="font-semibold text-slate-800">1 Copy Front + Back</span>
              </div>
              <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-200">
                <span className="text-brand-600 block">Government Pack</span>
                <span className="font-semibold text-brand-900">4 Copies on 1 A4</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 bg-slate-900/5 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
            {/* A4 Sheet Simulation */}
            <div className="bg-white w-48 aspect-[1/1.414] rounded shadow-md border border-slate-300 p-4 flex flex-col justify-around items-center">
              <div className="w-full h-12 rounded border border-slate-400 bg-slate-100 flex items-center justify-between px-2 text-[8px] font-mono text-slate-600 shadow-sm">
                <div className="w-6 h-7 bg-slate-300 rounded" />
                <div className="flex-1 ml-2 space-y-1">
                  <div className="w-16 h-1.5 bg-slate-400 rounded" />
                  <div className="w-12 h-1 bg-slate-300 rounded" />
                </div>
                <span className="text-[7px] font-bold text-brand-600">FRONT</span>
              </div>

              <div className="w-full border-t border-dashed border-slate-300 my-1" />

              <div className="w-full h-12 rounded border border-slate-400 bg-slate-100 flex items-center justify-between px-2 text-[8px] font-mono text-slate-600 shadow-sm">
                <div className="flex-1 space-y-1">
                  <div className="w-20 h-1 bg-slate-300 rounded" />
                  <div className="w-16 h-1 bg-slate-300 rounded" />
                </div>
                <div className="w-8 h-4 bg-slate-300 rounded" />
                <span className="text-[7px] font-bold text-slate-500 ml-1">BACK</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              Auto-Enhanced Greyscale Contrast • 100% Scale 1:1 Actual Size
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Live Kanban Queue */}
      {activeTab === 'queue' && (
        <div className="p-3 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-900">
                Live Walk-In Order Pipeline
              </h4>
              <p className="text-xs text-slate-500">
                Front desk counter staff, graphic editors, and print operators synchronized via WebSockets
              </p>
            </div>
            <Badge variant="success">Shop Floor Live</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            {/* Column 1 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">1. Intake Pending</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-bold">
                  2
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>#ORD-9021</span>
                    <span className="text-brand-600">$4.50</span>
                  </div>
                  <p className="text-[11px] text-slate-500">8x Passport Photos (Rush)</p>
                  <p className="text-[10px] text-slate-400 mt-1">Customer: Karim A.</p>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-900">2. In Processing</span>
                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded-full font-bold">
                  1
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white border border-blue-200 shadow-xs text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>#ORD-9019</span>
                    <span className="text-brand-600">$8.00</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Handwritten Notes to Word (.docx)</p>
                  <p className="text-[10px] text-indigo-600 font-medium mt-1">AI OCR Running...</p>
                </div>
              </div>
            </div>

            {/* Column 3 */}
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900">3. Print Spooler</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full font-bold">
                  Ready
                </span>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white border border-emerald-200 shadow-xs text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>#ORD-9018</span>
                    <span className="text-emerald-600 font-bold">PAID</span>
                  </div>
                  <p className="text-[11px] text-slate-500">4x NID Copies on A4</p>
                  <button className="mt-2 w-full py-1 rounded bg-emerald-600 text-white font-medium text-[11px] flex items-center justify-center gap-1">
                    <Printer className="w-3 h-3" /> Auto-Print (Tray 1)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

