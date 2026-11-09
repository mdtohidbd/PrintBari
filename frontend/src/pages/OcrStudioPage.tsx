import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Printer,
  Save,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Languages,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  History,
  FolderOpen,
  Eye,
  Trash2,
  FileCheck,
  ZoomIn,
  Copy,
} from 'lucide-react';
import { ocrApi, TextBlock, FormattedDocSection, OcrJobRecord } from '../api/ocr.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

export const OcrStudioPage: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');

  // Input Image State
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [preprocessedImage, setPreprocessedImage] = useState<string | null>(null);
  const [activeImagePreview, setActiveImagePreview] = useState<'preprocessed' | 'original'>('preprocessed');

  // Preprocessing Options
  const [grayscale, setGrayscale] = useState<boolean>(true);
  const [contrast, setContrast] = useState<number>(1.25);
  const [binarize, setBinarize] = useState<boolean>(false);
  const [denoise, setDenoise] = useState<boolean>(true);
  const [deskew, setDeskew] = useState<boolean>(false);

  // OCR Settings
  const [language, setLanguage] = useState<'eng' | 'ben' | 'both'>('eng');
  const [engine, setEngine] = useState<'tesseract' | 'simulation'>('tesseract');

  // OCR Output & Editing State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [editedText, setEditedText] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('হস্তলিপি প্রতিলিপিকরণ (Transcribed Document)');

  // Formatted Document Sections
  const [formattedSections, setFormattedSections] = useState<FormattedDocSection[]>([]);

  // Customer & Job Details
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [jobNotes, setJobNotes] = useState<string>('');
  const [savedJobCode, setSavedJobCode] = useState<string | null>(null);

  // Feedback & Status
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // History state
  const [jobsList, setJobsList] = useState<OcrJobRecord[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show status banner temporarily
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Sample handwriting images generator for testing and demos
  const loadSampleHandwriting = (sampleLang: 'eng' | 'ben') => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Paper background with warm subtle tint
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle handwriting lines
    ctx.strokeStyle = '#e6e3dc';
    ctx.lineWidth = 1;
    for (let y = 140; y < canvas.height - 80; y += 45) {
      ctx.beginPath();
      ctx.moveTo(70, y);
      ctx.lineTo(canvas.width - 70, y);
      ctx.stroke();
    }

    // Handwriting ink styling
    ctx.fillStyle = '#1e293b';
    ctx.font = '24px "Segoe Script", "Comic Sans MS", cursive';

    if (sampleLang === 'ben') {
      ctx.font = '22px "Kalpurush", "SolaimanLipi", cursive, sans-serif';
      ctx.fillText('বরাবর, উপজেলা নির্বাহী অফিসার', 85, 125);
      ctx.fillText('মিরপুর, ঢাকা।', 85, 170);
      ctx.fillText('বিষয়: এলাকার রাস্তা মেরামতের আবেদন।', 85, 260);
      ctx.fillText('জনাব, বিনীত নিবেদন এই যে, আমাদের এলাকার প্রধান', 85, 350);
      ctx.fillText('সড়কটি দীর্ঘদিন যাবত ভাঙাচোরা অবস্থায় রয়েছে।', 85, 395);
      ctx.fillText('ফলে জনসাধারণের চলাচলে চরম দুর্ভোগ পোহাতে হয়।', 85, 440);
      ctx.fillText('অতএব, জনস্বার্থে উক্ত সড়কটি দ্রুত সংস্কারে', 85, 530);
      ctx.fillText('আপনার মর্জি কামনা করছি।', 85, 575);
      ctx.fillText('বিনীত, এলাকাবাসীর পক্ষে', 85, 710);
      ctx.fillText('মো: আব্দুর রহিম', 85, 755);
    } else {
      ctx.fillText('To Whom It May Concern,', 85, 125);
      ctx.fillText('Subject: Document Verification Request', 85, 215);
      ctx.fillText('This document certifies that the handwritten notes', 85, 305);
      ctx.fillText('have been digitized and formatted accurately.', 85, 350);
      ctx.fillText('All applicant details and signatures have been verified.', 85, 395);
      ctx.fillText('Please proceed with the official registration.', 85, 485);
      ctx.fillText('Sincerely,', 85, 620);
      ctx.fillText('Shop Operator - DocuStudio', 85, 665);
    }

    const dataUrl = canvas.toDataURL('image/png');
    setOriginalImage(dataUrl);
    setPreprocessedImage(null);
    setSavedJobCode(null);
    setRawText('');
    setEditedText('');
    setTextBlocks([]);
    setOverallConfidence(0);
    setLanguage(sampleLang);
    showToast(`Loaded ${sampleLang === 'ben' ? 'Bangla' : 'English'} handwriting sample. Click "Extract Text" to process.`, 'info');
  };

  // Handle image upload from user
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setOriginalImage(dataUrl);
      setPreprocessedImage(null);
      setSavedJobCode(null);
      setRawText('');
      setEditedText('');
      setTextBlocks([]);
      setOverallConfidence(0);
      showToast('Image uploaded. Ready for OCR extraction.', 'info');
    };
    reader.readAsDataURL(file);
  };

  // Run Preprocessing & OCR Extraction
  const handleExtractText = async () => {
    if (!originalImage) {
      showToast('Please upload a handwritten document image first', 'error');
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ text: 'Analyzing image strokes and extracting text with OCR...', type: 'info' });

    try {
      const result = await ocrApi.extract({
        imageBase64: originalImage,
        language,
        engine,
        grayscale,
        contrast,
        binarize,
        denoise,
        deskew,
      });

      setPreprocessedImage(result.preprocessedBase64);
      setActiveImagePreview('preprocessed');
      setOverallConfidence(result.overallConfidence);
      setTextBlocks(result.textBlocks);
      setRawText(result.rawExtractedText);
      setEditedText(result.rawExtractedText);

      // Auto parse initial paragraphs
      syncFormattedSections(result.rawExtractedText);

      showToast(`OCR Completed! Extracted with ${result.overallConfidence}% confidence score.`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error executing OCR extraction. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Sync formatted sections when edited text changes
  const syncFormattedSections = (text: string) => {
    const paras = text
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const sections: FormattedDocSection[] = paras.map((para, idx) => {
      if (idx === 0 && para.length < 90) {
        return { type: 'title', text: para, bold: true, alignment: 'center' };
      }
      if (para.startsWith('Subject:') || para.startsWith('বিষয়:')) {
        return { type: 'heading2', text: para, bold: true, alignment: 'left' };
      }
      if (para.startsWith('- ') || para.startsWith('* ')) {
        return { type: 'bullet', text: para.replace(/^[-*]\s*/, ''), alignment: 'left' };
      }
      return { type: 'paragraph', text: para, alignment: 'justify' };
    });

    setFormattedSections(sections);
  };

  // Update section property
  const updateSection = (idx: number, updates: Partial<FormattedDocSection>) => {
    const updated = [...formattedSections];
    updated[idx] = { ...updated[idx], ...updates };
    setFormattedSections(updated);
  };

  // Add new section
  const addSection = (type: FormattedDocSection['type']) => {
    setFormattedSections([
      ...formattedSections,
      { type, text: '', alignment: type === 'title' ? 'center' : 'left' },
    ]);
  };

  // Remove section
  const removeSection = (idx: number) => {
    setFormattedSections(formattedSections.filter((_, i) => i !== idx));
  };

  // Export to Microsoft Word (.docx)
  const handleExportDocx = async () => {
    if (!editedText && formattedSections.length === 0) {
      showToast('No transcribed text to export. Run OCR first.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await ocrApi.exportDocx({
        title: docTitle,
        content: formattedSections.length > 0 ? formattedSections : editedText,
        filename: `${docTitle.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '_')}.docx`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Word (.docx) document downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to generate Word document.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (!editedText && formattedSections.length === 0) {
      showToast('No transcribed text to export. Run OCR first.', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await ocrApi.exportPdf({
        title: docTitle,
        content: formattedSections.length > 0 ? formattedSections : editedText,
        filename: `${docTitle.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '_')}.pdf`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Printable PDF generated and downloaded successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to generate PDF document.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Save Job to Shop History
  const handleSaveJob = async () => {
    if (!originalImage) {
      showToast('Cannot save empty job. Please upload an image first.', 'error');
      return;
    }

    try {
      const job = await ocrApi.saveJob({
        customerName,
        customerPhone,
        language,
        engine,
        originalImage,
        preprocessedImage: preprocessedImage || undefined,
        preprocessingOptions: {
          grayscale,
          contrast,
          binarize,
          denoise,
          deskew,
        },
        overallConfidence,
        textBlocks,
        rawExtractedText: rawText,
        editedText,
        formattedDoc: formattedSections,
        notes: jobNotes,
      });

      setSavedJobCode(job.jobCode);
      showToast(`Job saved successfully! Code: ${job.jobCode}`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save OCR job.', 'error');
    }
  };

  // Fetch Jobs History
  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await ocrApi.listJobs({ search: searchQuery || undefined });
      setJobsList(res.jobs);
    } catch (err: any) {
      showToast('Failed to load past OCR jobs history.', 'error');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchJobs();
    }
  }, [activeTab]);

  // Reopen past job
  const handleReopenJob = (job: OcrJobRecord) => {
    setOriginalImage(job.originalImage);
    setPreprocessedImage(job.preprocessedImage || null);
    setActiveImagePreview(job.preprocessedImage ? 'preprocessed' : 'original');
    setCustomerName(job.customerName);
    setCustomerPhone(job.customerPhone);
    setLanguage(job.language);
    setOverallConfidence(job.overallConfidence);
    setTextBlocks(job.textBlocks || []);
    setRawText(job.rawExtractedText);
    setEditedText(job.editedText);
    setFormattedSections(job.formattedDoc || []);
    setSavedJobCode(job.jobCode);
    setActiveTab('editor');
    showToast(`Reopened OCR Job ${job.jobCode}`, 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Handwriting to Word & OCR System
                </h1>
                <Badge variant="ocr" size="sm" dot>
                  Tesseract AI Engine
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                হস্তলিপি ও স্ক্যানকৃত ডকুমেন্ট থেকে ওয়ার্ড (.docx) এবং ভেক্টর PDF রূপান্তর ইঞ্জিন
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              OCR Studio Editor
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Job History
            </button>
          </div>

          {activeTab === 'editor' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOriginalImage(null);
                setPreprocessedImage(null);
                setTextBlocks([]);
                setRawText('');
                setEditedText('');
                setFormattedSections([]);
                setSavedJobCode(null);
                setOverallConfidence(0);
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reset Canvas
            </Button>
          )}
        </div>
      </div>

      {/* Alert / Notification Banner */}
      {statusMessage && (
        <div
          className={`max-w-7xl mx-auto mb-4 p-3 rounded-lg text-sm flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-semibold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW: JOB HISTORY */}
      {activeTab === 'history' && (
        <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold">Past OCR Handwriting Conversion Jobs</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                পূর্বে সম্পন্নকৃত ও সংরক্ষিত সকল হস্তলিপি ডকুমেন্ট তালিকা
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search job code, customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchJobs()}
                className="w-full sm:w-64 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={fetchJobs}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {isLoadingJobs ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading saved OCR records...
            </div>
          ) : jobsList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No past OCR conversion jobs found</p>
              <p className="text-xs mt-1">Upload a handwriting document and click Save Job to store records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Job Code</th>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">Language</th>
                    <th className="py-2.5 px-3 font-semibold">Confidence</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {jobsList.map((job) => (
                    <tr key={job._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {job.jobCode}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-200">{job.customerName}</div>
                        <div className="text-[11px] text-slate-500">{job.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 uppercase">
                          {job.language}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.overallConfidence >= 90
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : job.overallConfidence >= 75
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {job.overallConfidence}%
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleReopenJob(job)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-100 transition"
                        >
                          Reopen & Export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW: MAIN STUDIO EDITOR */}
      {activeTab === 'editor' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: UPLOAD, PREPROCESSING & IMAGE PREVIEW (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Upload & Sample Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Step 1: Document Upload
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Demos:</span>
                  <button
                    onClick={() => loadSampleHandwriting('ben')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-indigo-600 dark:text-indigo-400"
                  >
                    বাংলা নমুনা
                  </button>
                  <button
                    onClick={() => loadSampleHandwriting('eng')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-indigo-600 dark:text-indigo-400"
                  >
                    English Sample
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />

              {!originalImage ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-800/20"
                >
                  <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Click to browse or drag & drop handwriting photo
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Supports JPG, PNG, WebP (Max 20MB)</p>
                </div>
              ) : (
                <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center min-h-[320px] max-h-[480px]">
                  <img
                    src={activeImagePreview === 'preprocessed' && preprocessedImage ? preprocessedImage : originalImage}
                    alt="Document preview"
                    className="max-h-[460px] object-contain w-auto rounded"
                  />

                  {/* Toggle Preview Controls */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm p-1 rounded-md text-[10px] text-white">
                    <button
                      onClick={() => setActiveImagePreview('original')}
                      className={`px-2 py-0.5 rounded transition ${
                        activeImagePreview === 'original' ? 'bg-indigo-600 text-white font-bold' : 'opacity-70'
                      }`}
                    >
                      Original
                    </button>
                    {preprocessedImage && (
                      <button
                        onClick={() => setActiveImagePreview('preprocessed')}
                        className={`px-2 py-0.5 rounded transition ${
                          activeImagePreview === 'preprocessed' ? 'bg-indigo-600 text-white font-bold' : 'opacity-70'
                        }`}
                      >
                        Sharp Preprocessed
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 left-2 px-2.5 py-1 text-[11px] bg-black/70 backdrop-blur-sm hover:bg-black text-white rounded transition"
                  >
                    Change Image
                  </button>
                </div>
              )}
            </div>

            {/* Preprocessing & Recognition Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Step 2: Preprocessing & OCR Engine
                </h3>
              </div>

              {/* Language Selection */}
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  OCR Language / ভাষা
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => setLanguage('eng')}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      language === 'eng'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    English (EN)
                  </button>
                  <button
                    onClick={() => setLanguage('ben')}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      language === 'ben'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    বাংলা (Bengali)
                  </button>
                  <button
                    onClick={() => setLanguage('both')}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      language === 'both'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    Bilingual (উভয়)
                  </button>
                </div>
              </div>

              {/* Engine Selector */}
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  OCR Engine / রিকগনিশন ইঞ্জিন
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setEngine('tesseract')}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      engine === 'tesseract'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    Tesseract Engine
                  </button>
                  <button
                    onClick={() => setEngine('simulation')}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition text-center ${
                      engine === 'simulation'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    High-Res Fallback
                  </button>
                </div>
              </div>

              {/* Sliders & Preprocessing Toggles */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Contrast Enhancement:</span>
                    <span className="font-semibold">{contrast}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.0"
                    step="0.05"
                    value={contrast}
                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={grayscale}
                      onChange={(e) => setGrayscale(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Grayscale Filter</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binarize}
                      onChange={(e) => setBinarize(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Binary Threshold</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={denoise}
                      onChange={(e) => setDenoise(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Median Denoise</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deskew}
                      onChange={(e) => setDeskew(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Auto-Deskew</span>
                  </label>
                </div>
              </div>

              {/* Action: Run OCR */}
              <button
                onClick={handleExtractText}
                disabled={!originalImage || isProcessing}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                  !originalImage || isProcessing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Extracting Handwriting Text...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run OCR Extraction (টেক্সট এক্সট্রাক্ট করুন)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: TRANSCRIPTION, FORMATTING & EXPORT (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Confidence Banner */}
            {overallConfidence > 0 && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  overallConfidence >= 90
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : overallConfidence >= 75
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">Recognition Quality:</span>
                  <span className="font-mono text-sm font-extrabold">{overallConfidence}%</span>
                  <span className="opacity-80">
                    ({overallConfidence >= 90 ? 'High Accuracy' : overallConfidence >= 75 ? 'Moderate Accuracy' : 'Low Quality - Manual Review Recommended'})
                  </span>
                </div>
                <span className="text-[11px] font-medium opacity-80">
                  {textBlocks.length} line segments detected
                </span>
              </div>
            )}

            {/* Document Title & Formatting Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Document Title (e.g. জমির বায়নানামা বা চাকরির আবেদন)"
                  className="w-full text-sm font-bold bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-1"
                />
                {savedJobCode && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                    {savedJobCode}
                  </span>
                )}
              </div>

              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs">
                <button
                  onClick={() => addSection('title')}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded text-slate-700 dark:text-slate-200 font-semibold"
                >
                  + Title
                </button>
                <button
                  onClick={() => addSection('heading2')}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded text-slate-700 dark:text-slate-200 font-semibold"
                >
                  + Heading
                </button>
                <button
                  onClick={() => addSection('paragraph')}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded text-slate-700 dark:text-slate-200 font-semibold"
                >
                  + Paragraph
                </button>
                <button
                  onClick={() => addSection('bullet')}
                  className="px-2 py-1 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded text-slate-700 dark:text-slate-200 font-semibold"
                >
                  + Bullet
                </button>

                <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editedText);
                    showToast('Transcribed text copied to clipboard!', 'success');
                  }}
                  className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 flex items-center gap-1"
                  title="Copy Raw Text"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>

              {/* Editable Content Workspace */}
              {formattedSections.length > 0 ? (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {formattedSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-400">
                          {sec.type}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateSection(idx, { bold: !sec.bold })}
                            className={`p-1 rounded ${sec.bold ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            title="Toggle Bold"
                          >
                            B
                          </button>
                          <button
                            onClick={() => updateSection(idx, { italic: !sec.italic })}
                            className={`p-1 rounded ${sec.italic ? 'bg-indigo-600 text-white italic' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            title="Toggle Italic"
                          >
                            I
                          </button>
                          <button
                            onClick={() => updateSection(idx, { alignment: 'left' })}
                            className={`p-1 rounded ${sec.alignment === 'left' ? 'text-indigo-600' : 'opacity-60'}`}
                          >
                            <AlignLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateSection(idx, { alignment: 'center' })}
                            className={`p-1 rounded ${sec.alignment === 'center' ? 'text-indigo-600' : 'opacity-60'}`}
                          >
                            <AlignCenter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateSection(idx, { alignment: 'justify' })}
                            className={`p-1 rounded ${sec.alignment === 'justify' ? 'text-indigo-600' : 'opacity-60'}`}
                          >
                            <AlignJustify className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeSection(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={sec.type === 'title' ? 1 : sec.type.startsWith('heading') ? 2 : 3}
                        value={sec.text}
                        onChange={(e) => {
                          updateSection(idx, { text: e.target.value });
                          // update joined editedText
                          const updated = [...formattedSections];
                          updated[idx].text = e.target.value;
                          setEditedText(updated.map((s) => s.text).join('\n\n'));
                        }}
                        className={`w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                          sec.type === 'title' ? 'font-bold text-sm' : sec.type.startsWith('heading') ? 'font-semibold' : ''
                        }`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={10}
                  value={editedText}
                  onChange={(e) => {
                    setEditedText(e.target.value);
                    syncFormattedSections(e.target.value);
                  }}
                  placeholder="Extracted and formatted text will appear here. You can manually edit or correct any words..."
                  className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Customer Details & Job Persistence Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Customer & Job Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Customer Name / গ্রাহকের নাম</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Customer Phone / মোবাইল নম্বর</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Export & Actions Deck */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleExportDocx}
                disabled={isExporting || (!editedText && formattedSections.length === 0)}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                Word (.DOCX)
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isExporting || (!editedText && formattedSections.length === 0)}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                Vector PDF
              </button>

              <button
                onClick={handlePrint}
                disabled={!editedText && formattedSections.length === 0}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Print A4
              </button>

              <button
                onClick={handleSaveJob}
                disabled={!originalImage}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Save className="w-3.5 h-3.5" />
                Save Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

