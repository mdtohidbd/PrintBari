import React, { useState, useEffect } from 'react';
import {
  Printer,
  Layers,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  ArrowUp,
  ArrowDown,
  Cpu,
  Sliders,
  FileText,
  Search,
  ExternalLink,
  Shield,
  HelpCircle,
  X,
  Copy,
} from 'lucide-react';
import {
  printerApi,
  PrintJobRecord,
  PrinterDeviceRecord,
  PaperSize,
  Orientation,
  ColorMode,
  PrintQuality,
} from '../api/printer.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { Tabs } from '../components/common/Tabs';
import { EmptyState } from '../components/common/EmptyState';
import { Toast } from '../components/common/Toast';

export const PrintSpoolerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'printers' | 'history' | 'agent'>('queue');
  const [queue, setQueue] = useState<PrintJobRecord[]>([]);
  const [printers, setPrinters] = useState<PrinterDeviceRecord[]>([]);
  const [history, setHistory] = useState<PrintJobRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Local Desktop Bridge Status
  const [agentStatus, setAgentStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Preview Modal
  const [previewJob, setPreviewJob] = useState<PrintJobRecord | null>(null);

  // Search & History Filters
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Escape key close for preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewJob) {
        setPreviewJob(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewJob]);

  // Check Local Agent Bridge connectivity (spec test)
  const checkAgentBridge = async () => {
    setAgentStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://127.0.0.1:8989/status', {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        setAgentStatus('connected');
      } else {
        setAgentStatus('disconnected');
      }
    } catch {
      setAgentStatus('disconnected');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueData, printersData] = await Promise.all([
        printerApi.getQueue(),
        printerApi.listPrinters(),
      ]);
      setQueue(queueData);
      setPrinters(printersData);
    } catch (err: any) {
      showToast('Failed to load printer data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await printerApi.getHistory({
        search: historySearch || undefined,
        page: historyPage,
        limit: 20,
      });
      setHistory(data.history);
      setHistoryTotalPages(data.totalPages);
    } catch (err) {
      showToast('Failed to load print history', 'error');
    }
  };

  useEffect(() => {
    fetchData();
    checkAgentBridge();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historySearch, historyPage]);

  // Reorder queue priority (Move Up / Down)
  const handleMoveQueue = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === queue.length - 1) return;

    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    setQueue(newQueue);
    try {
      const orderedIds = newQueue.map((j) => j._id);
      await printerApi.reorderQueue(orderedIds);
      showToast('Queue order updated');
    } catch (err) {
      showToast('Failed to reorder queue', 'error');
      fetchData();
    }
  };

  // Update Settings in Queue
  const handleUpdateSettings = async (id: string, updates: any) => {
    try {
      const updated = await printerApi.updateSettings(id, updates);
      setQueue((prev) => prev.map((j) => (j._id === id ? updated : j)));
      showToast('Print parameters saved');
    } catch (err: any) {
      showToast('Failed to update print settings', 'error');
    }
  };

  // Cancel Job from Queue
  const handleCancelJob = async (id: string) => {
    if (!window.confirm('Cancel this print job from the spool queue?')) return;
    try {
      await printerApi.removeJob(id);
      setQueue((prev) => prev.filter((j) => j._id !== id));
      showToast('Print job cancelled and removed');
    } catch (err) {
      showToast('Failed to cancel job', 'error');
    }
  };

  // Execute Browser Print (Practical Workflow)
  const handleExecutePrint = async (job: PrintJobRecord) => {
    try {
      // 1. Mark printing started
      await printerApi.startPrint(job._id);
      setQueue((prev) =>
        prev.map((j) => (j._id === job._id ? { ...j, status: 'PRINTING' as const } : j))
      );

      // 2. Trigger optimized printable iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${job.documentTitle || job.jobCode}</title>
              <style>
                @page {
                  size: ${job.settings.paperSize === '4x6' ? '4in 6in' : job.settings.paperSize.toLowerCase()} ${job.settings.orientation.toLowerCase()};
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                img {
                  max-width: 100vw;
                  max-height: 100vh;
                  object-fit: contain;
                }
              </style>
            </head>
            <body>
              <img src="${job.documentUrl}" onload="window.print();" />
            </body>
          </html>
        `);
        doc.close();

        iframe.contentWindow?.focus();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 60000);
      }

      showToast(`Printing started for ${job.jobCode}. Click Complete when done!`, 'info');
    } catch (err) {
      showToast('Error initiating print command', 'error');
    }
  };

  // Complete Print
  const handleCompletePrint = async (job: PrintJobRecord) => {
    try {
      await printerApi.completePrint(job._id, job.settings.copies);
      setQueue((prev) => prev.filter((j) => j._id !== job._id));
      showToast(`Print job ${job.jobCode} marked completed and archived!`);
    } catch (err) {
      showToast('Failed to complete print job', 'error');
    }
  };

  // Download Print-Ready PDF
  const handleDownloadPdf = async (job: PrintJobRecord) => {
    try {
      const blob = await printerApi.exportPdf({
        title: job.documentTitle,
        paperSize: job.settings.paperSize,
        orientation: job.settings.orientation,
        imageBase64: job.documentUrl.startsWith('data:image') ? job.documentUrl : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${job.jobCode}_${job.settings.paperSize}_print_ready.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('300 DPI Print-Ready PDF downloaded!');
    } catch (err) {
      showToast('Failed to export PDF', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type === 'info' ? 'info' : toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header Banner */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 rounded-xl">
              <Printer className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Print Queue & Hardware Spooler
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                মাল্টি-প্রিন্টার রাউটিং, কিউ রিঅর্ডার ও ব্রাউজার/ডেস্কটপ প্রিন্টিং কন্ট্রোল
              </p>
            </div>
          </div>
        </div>

        {/* Local Print Bridge Status Indicator */}
        <div className="flex items-center gap-3">
          <Badge
            variant={agentStatus === 'connected' ? 'success' : 'neutral'}
            size="md"
            dot
          >
            {agentStatus === 'connected'
              ? 'Local Print Bridge Connected'
              : 'Browser Dialog Printing Mode'}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            isLoading={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <Tabs
          tabs={[
            { id: 'queue', label: `Active Spool Queue (${queue.length})` },
            { id: 'printers', label: `Connected Printers (${printers.length})` },
            { id: 'history', label: 'Print History & Logs' },
            { id: 'agent', label: 'Desktop Agent Bridge' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
          variant="underline"
        />
      </div>

      {/* TAB 1: ACTIVE SPOOL QUEUE */}
      {activeTab === 'queue' && (
        <div className="max-w-7xl mx-auto space-y-4">
          {isLoading ? (
            <div className="py-24 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Loading print spooler queue...
            </div>
          ) : queue.length === 0 ? (
            <div className="py-20 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 shadow-sm">
              <Printer className="w-12 h-12 mx-auto mb-2 opacity-30 text-brand-600" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Print Spooler is Empty</p>
              <p className="text-xs mt-1">Send jobs to print from Passport, Document, ID Card, or Job Queue.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((job, idx) => (
                <div
                  key={job._id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left: Reorder & Info */}
                  <div className="flex items-center gap-3">
                    {/* Priority Reordering Buttons */}
                    <div className="flex flex-col gap-1 items-center">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveQueue(idx, 'up')}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-600"
                        title="Move Up in Priority"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-xs font-extrabold text-brand-600 dark:text-brand-400">
                        #{idx + 1}
                      </span>
                      <button
                        disabled={idx === queue.length - 1}
                        onClick={() => handleMoveQueue(idx, 'down')}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 rounded text-slate-600"
                        title="Move Down in Priority"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Thumbnail Preview */}
                    <div
                      onClick={() => setPreviewJob(job)}
                      className="w-16 h-20 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer group flex-shrink-0"
                    >
                      {job.documentUrl ? (
                        <img
                          src={job.documentUrl}
                          alt="preview"
                          className="w-full h-full object-contain group-hover:scale-105 transition"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Job & Customer Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-brand-600 dark:text-brand-400">
                          {job.jobCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.status === 'PRINTING'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {job.customerName} <span className="text-slate-400 font-normal">({job.customerPhone})</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {job.serviceType} • Spooled by {job.staffName}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Live Settings Configuration */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs w-full lg:w-auto">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Printer</label>
                      <select
                        value={job.printerId?._id || job.printerId || ''}
                        onChange={(e) => handleUpdateSettings(job._id, { printerId: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded text-[11px] font-semibold"
                      >
                        {printers.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Copies</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={job.settings.copies}
                        onChange={(e) => handleUpdateSettings(job._id, { copies: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded text-[11px] font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Paper & Orient</label>
                      <select
                        value={`${job.settings.paperSize}-${job.settings.orientation}`}
                        onChange={(e) => {
                          const [paperSize, orientation] = e.target.value.split('-');
                          handleUpdateSettings(job._id, { paperSize, orientation });
                        }}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded text-[11px]"
                      >
                        <option value="4x6-PORTRAIT">4x6 (Photo Sheet)</option>
                        <option value="A4-PORTRAIT">A4 Portrait</option>
                        <option value="A4-LANDSCAPE">A4 Landscape</option>
                        <option value="LEGAL-PORTRAIT">Legal Portrait</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Quality & Color</label>
                      <select
                        value={`${job.settings.quality}-${job.settings.colorMode}`}
                        onChange={(e) => {
                          const [quality, colorMode] = e.target.value.split('-');
                          handleUpdateSettings(job._id, { quality, colorMode });
                        }}
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border rounded text-[11px]"
                      >
                        <option value="PHOTO_FINE-COLOR">Photo Fine 1200+ DPI</option>
                        <option value="NORMAL-COLOR">Standard Color</option>
                        <option value="HIGH-GRAYSCALE">High Grayscale</option>
                        <option value="NORMAL-BLACK_WHITE">B&W Document</option>
                      </select>
                    </div>
                  </div>

                  {/* Right: Print Actions Deck */}
                  <div className="flex items-center gap-1.5 flex-wrap lg:flex-nowrap justify-end w-full lg:w-auto">
                    <button
                      onClick={() => setPreviewJob(job)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold rounded flex items-center gap-1"
                      title="Print Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>

                    <button
                      onClick={() => handleDownloadPdf(job)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold rounded flex items-center gap-1"
                      title="Download 300 DPI PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>

                    <button
                      onClick={() => handleExecutePrint(job)}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded flex items-center gap-1 shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Now
                    </button>

                    <button
                      onClick={() => handleCompletePrint(job)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
                      title="Mark Completed"
                    >
                      Done ✓
                    </button>

                    <button
                      onClick={() => handleCancelJob(job._id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-500 rounded"
                      title="Cancel from Queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONNECTED PRINTERS */}
      {activeTab === 'printers' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {printers.map((p) => (
            <div
              key={p._id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{p.type}</span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{p.printerModel}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.isOnline ? 'Online Ready' : 'Offline'}
                </span>
              </div>

              {/* Ink Level Gauges */}
              <div className="space-y-2 pt-2 border-t">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">
                  Hardware Ink & Toner Levels
                </span>

                <div className="space-y-1.5 text-xs">
                  {p.currentInkLevels.black !== undefined && (
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Black (K)</span>
                        <span className="font-mono">{p.currentInkLevels.black}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 dark:bg-slate-100 rounded-full"
                          style={{ width: `${p.currentInkLevels.black}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {p.colorCapable && (
                    <>
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="font-semibold text-cyan-600">Cyan (C)</span>
                          <span className="font-mono">{p.currentInkLevels.cyan}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${p.currentInkLevels.cyan}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="font-semibold text-pink-600">Magenta (M)</span>
                          <span className="font-mono">{p.currentInkLevels.magenta}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pink-500 rounded-full"
                            style={{ width: `${p.currentInkLevels.magenta}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="font-semibold text-amber-500">Yellow (Y)</span>
                          <span className="font-mono">{p.currentInkLevels.yellow}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${p.currentInkLevels.yellow}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Supported Media */}
              <div className="pt-2 border-t text-[11px] text-slate-500">
                <span className="font-semibold block mb-1">Supported Paper Trays:</span>
                <div className="flex flex-wrap gap-1">
                  {p.supportedPaperSizes.map((size) => (
                    <span
                      key={size}
                      className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-semibold"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: PRINT HISTORY & AUDIT LOG */}
      {activeTab === 'history' && (
        <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Print History & Spool Audit Log
              </h3>
              <p className="text-xs text-slate-500">সকল সফল ও বাতিলকৃত প্রিন্ট রেকর্ডের অডিট ট্রেইল</p>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search job code, customer, printer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Print Code</th>
                  <th className="py-2.5 px-3 font-semibold">Job ID</th>
                  <th className="py-2.5 px-3 font-semibold">Customer</th>
                  <th className="py-2.5 px-3 font-semibold">Printer</th>
                  <th className="py-2.5 px-3 font-semibold">Copies</th>
                  <th className="py-2.5 px-3 font-semibold">Staff</th>
                  <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No print history records found.
                    </td>
                  </tr>
                ) : (
                  history.map((record) => (
                    <tr key={record._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {record.printJobCode}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium">{record.jobCode}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.customerName}
                        </div>
                        <div className="text-[10px] text-slate-400">{record.customerPhone}</div>
                      </td>
                      <td className="py-2.5 px-3">{record.printerName}</td>
                      <td className="py-2.5 px-3 font-bold">{record.printedCopies || record.settings.copies}</td>
                      <td className="py-2.5 px-3 text-slate-600">{record.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {record.completedAt ? new Date(record.completedAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            record.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LOCAL AGENT ARCHITECTURE GUIDE */}
      {activeTab === 'agent' && (
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b">
            <Cpu className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold">DocuStudio Desktop Print Bridge Specification</h3>
          </div>

          <div className="space-y-3 leading-relaxed text-slate-700 dark:text-slate-300">
            <p>
              Standard web browsers strictly sandbox hardware access: JavaScript running in Google Chrome or Mozilla
              Firefox cannot silently access local USB, LPT, or CUPS printer ports without triggering a native browser print dialog.
            </p>

            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 pt-2">
              Our 3-Tier Practical Printing Architecture:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-1">
                <span className="font-bold text-brand-600 block">1. Browser Print (Active)</span>
                <p className="text-[11px] text-slate-500">
                  Zero setup required. Auto-formats document via hidden iframe with physical page millimeter sizes and
                  exact color profiles.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-1">
                <span className="font-bold text-brand-600 block">2. Vector 300 DPI PDF</span>
                <p className="text-[11px] text-slate-500">
                  Pre-scaled high-resolution PDF download for Adobe Acrobat or RIP software with manual paper tray selections.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-1">
                <span className="font-bold text-brand-600 block">3. Local Desktop Bridge</span>
                <p className="text-[11px] text-slate-500">
                  Lightweight local service (<code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">127.0.0.1:8989</code>) for direct silent printing via Windows Spooler and ESC/P-R commands.
                </p>
              </div>
            </div>

            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 pt-2">
              Accidental Duplicate Protection:
            </h4>
            <p>
              Photo studios experience frequent accidental duplicate clicks. DocuStudio automatically detects if the
              same job code was printed within the last 15 minutes, alerting the operator and requiring explicit confirmation
              before re-spooling.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: PRINT PREVIEW */}
      {previewJob && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewJob(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-preview-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-scaleIn"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 id="print-preview-title" className="font-bold text-sm text-slate-900 dark:text-white">
                  Print Preview - {previewJob.jobCode}
                </h3>
                <p className="text-xs text-slate-500">
                  {previewJob.settings.paperSize} • {previewJob.settings.orientation} • {previewJob.settings.quality}
                </p>
              </div>
              <button
                onClick={() => setPreviewJob(null)}
                aria-label="Close print preview dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl flex items-center justify-center min-h-[340px] max-h-[500px] overflow-hidden">
              <img
                src={previewJob.documentUrl}
                alt={`Print Preview for job ${previewJob.jobCode}`}
                className="max-h-[460px] object-contain rounded shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-mono">Spool ID: {previewJob.printJobCode}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(previewJob)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    handleExecutePrint(previewJob);
                    setPreviewJob(null);
                  }}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                >
                  Send to Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

