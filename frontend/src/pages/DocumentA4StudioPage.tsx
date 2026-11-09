import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Camera,
  RotateCw,
  Sun,
  Sliders,
  Crop,
  Layers,
  Printer,
  Download,
  FileText,
  Save,
  FolderOpen,
  Eye,
  RefreshCw,
  Check,
  AlertCircle,
  HelpCircle,
  User,
  Search,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Languages,
  Sparkles,
  FileCheck,
  SplitSquareVertical,
  SlidersHorizontal,
  Contrast as ContrastIcon,
} from 'lucide-react';
import { documentApi, FilterMode, ProcessPagePayload } from '../api/document.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

interface DocPageItem {
  id: string;
  originalSrc: string;
  processedSrc: string | null;
  a4ComposedSrc: string | null;
  filterMode: FilterMode;
  rotation: number;
  brightness: number;
  contrast: number;
  threshold: number;
  cropBounds?: { x: number; y: number; width: number; height: number };
}

export const DocumentA4StudioPage: React.FC = () => {
  // Bilingual state: 'bn' (Bengali) | 'en' (English)
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Multi-page document state
  const [pages, setPages] = useState<DocPageItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Layout & A4 page settings
  const [pageSize, setPageSize] = useState<'A4' | 'LEGAL' | 'LETTER'>('A4');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [marginMm, setMarginMm] = useState<number>(5);
  const [fitMode, setFitMode] = useState<'FIT_PAGE' | 'FILL_PAGE' | 'ORIGINAL_SCALE'>('FIT_PAGE');

  // Preview Mode: 'split' (side by side) | 'processed' | 'original' | 'a4sheet'
  const [viewMode, setViewMode] = useState<'processed' | 'split' | 'a4sheet'>('processed');

  // Camera capture modal state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Customer & Billing Info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [pricePerPage, setPricePerPage] = useState<number>(5); // 5 BDT per page
  const [docTitle, setDocTitle] = useState<string>('A4 Document Scan');
  const [notes, setNotes] = useState<string>('');

  // Processing & UI States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Saved Jobs Modal
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');
  const [loadingSavedJobs, setLoadingSavedJobs] = useState<boolean>(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePage = pages[activePageIndex] || null;

  // Initialize with sample page on initial mount if empty
  useEffect(() => {
    if (pages.length === 0) {
      loadSampleDocument();
    }
  }, []);

  // Generate Sample Test Document (Certificate / Receipt)
  const loadSampleDocument = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Paper background with subtle shadow gradient
      ctx.fillStyle = '#F3F4F6';
      ctx.fillRect(0, 0, 1200, 1700);

      // Skewed / tilted paper simulation
      ctx.save();
      ctx.translate(60, 60);
      ctx.rotate(-0.015);

      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 15;
      ctx.fillRect(0, 0, 1080, 1550);
      ctx.shadowColor = 'transparent';

      // Header Banner
      ctx.fillStyle = '#1E3A8A';
      ctx.fillRect(40, 50, 1000, 120);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('PEOPLE’S REPUBLIC OF BANGLADESH', 220, 100);
      ctx.font = '22px sans-serif';
      ctx.fillText('OFFICIAL DOCUMENT SCAN & VERIFICATION', 320, 140);

      // Watermark Stamp
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(540, 800, 180, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillText('VERIFIED ORIGINAL', 340, 810);

      // Text Lines
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('CERTIFICATE OF REGISTRATION & CLEARANCE', 80, 240);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#475569';
      for (let i = 0; i < 18; i++) {
        const y = 300 + i * 45;
        ctx.fillRect(80, y, 920 - (i % 3) * 80, 14);
      }

      // Barcode & QR Code simulation
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(80, 1380, 400, 70);
      ctx.fillStyle = '#FFFFFF';
      for (let b = 0; b < 30; b++) {
        ctx.fillRect(90 + b * 13, 1380, b % 2 === 0 ? 3 : 6, 70);
      }

      // Signature area
      ctx.fillStyle = '#1E293B';
      ctx.font = 'italic 26px serif';
      ctx.fillText('Authorized Signature', 740, 1420);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(700, 1440);
      ctx.lineTo(980, 1440);
      ctx.stroke();

      ctx.restore();

      const sampleUrl = canvas.toDataURL('image/jpeg', 0.95);
      const newPage: DocPageItem = {
        id: `page-${Date.now()}`,
        originalSrc: sampleUrl,
        processedSrc: sampleUrl,
        a4ComposedSrc: null,
        filterMode: 'MAGIC_COLOR',
        rotation: 0,
        brightness: 5,
        contrast: 15,
        threshold: 128,
      };

      setPages([newPage]);
      setActivePageIndex(0);
      setStatusMessage({
        type: 'info',
        text: lang === 'bn' ? 'স্যাম্পল ডকুমেন্ট লোড হয়েছে।' : 'Sample document loaded.',
      });
    }
  };

  // Upload New Document Page(s)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newPagesList: DocPageItem[] = [];

      let loadedCount = 0;
      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          newPagesList.push({
            id: `page-${Date.now()}-${index}`,
            originalSrc: base64,
            processedSrc: base64,
            a4ComposedSrc: null,
            filterMode: 'MAGIC_COLOR',
            rotation: 0,
            brightness: 0,
            contrast: 10,
            threshold: 128,
          });

          loadedCount++;
          if (loadedCount === files.length) {
            setPages((prev) => [...prev, ...newPagesList]);
            setActivePageIndex(pages.length); // Switch to newly added page
            setStatusMessage({
              type: 'info',
              text:
                lang === 'bn'
                  ? `${files.length}টি নতুন পৃষ্ঠা সফলভাবে যুক্ত হয়েছে।`
                  : `Added ${files.length} document page(s).`,
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Start Camera Feed
  const startCamera = async () => {
    setCameraActive(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        lang === 'bn'
          ? 'ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে পারমিশন চেক করুন।'
          : 'Could not access camera. Please allow camera permissions.'
      );
    }
  };

  // Stop Camera Feed
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  // Snap Snapshot from Camera
  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshotUrl = canvas.toDataURL('image/jpeg', 0.95);
      const newPage: DocPageItem = {
        id: `page-${Date.now()}`,
        originalSrc: snapshotUrl,
        processedSrc: snapshotUrl,
        a4ComposedSrc: null,
        filterMode: 'SHADOW_CLEAN',
        rotation: 0,
        brightness: 15,
        contrast: 20,
        threshold: 128,
      };

      setPages((prev) => [...prev, newPage]);
      setActivePageIndex(pages.length);
      stopCamera();
      setStatusMessage({
        type: 'success',
        text: lang === 'bn' ? 'ক্যামেরা থেকে ডকুমেন্ট স্ক্যান সম্পন্ন হয়েছে!' : 'Snapshot captured from camera!',
      });
    }
  };

  // Update Active Page Parameter
  const updateActivePage = (updates: Partial<DocPageItem>) => {
    if (!activePage) return;
    setPages((prev) =>
      prev.map((p, idx) => (idx === activePageIndex ? { ...p, ...updates } : p))
    );
  };

  // Delete Active Page
  const handleDeletePage = (indexToDelete: number) => {
    if (pages.length <= 1) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'কমপক্ষে একটি পৃষ্ঠা থাকতে হবে।' : 'At least one page must remain.',
      });
      return;
    }
    const updated = pages.filter((_, idx) => idx !== indexToDelete);
    setPages(updated);
    setActivePageIndex(Math.max(0, indexToDelete - 1));
  };

  // Interactive Live Canvas Render for Active Page
  const renderInteractivePage = useCallback(() => {
    if (!activePage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activePage.originalSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((activePage.rotation * Math.PI) / 180);

      // Filters based on filterMode
      let filterString = `brightness(${100 + activePage.brightness}%) contrast(${100 + activePage.contrast}%)`;
      if (activePage.filterMode === 'GRAYSCALE') {
        filterString += ' grayscale(100%)';
      } else if (activePage.filterMode === 'MAGIC_COLOR') {
        filterString += ' saturate(120%)';
      }
      ctx.filter = filterString;

      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      ctx.restore();

      // Apply Binary Photocopy Threshold if selected
      if (activePage.filterMode === 'BW_PHOTOCOPY') {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const threshold = activePage.threshold || 128;

          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const v = gray >= threshold ? 255 : 0;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // ignore canvas taint
        }
      }
    };
  }, [activePage]);

  useEffect(() => {
    renderInteractivePage();
  }, [renderInteractivePage]);

  // Execute Sharp Server Processing for Current Page (High Quality 300 DPI)
  const handleProcessServerPage = async () => {
    if (!activePage) return;
    try {
      setIsProcessing(true);
      setStatusMessage(null);

      const res = await documentApi.processPage({
        imageBase64: activePage.originalSrc,
        filterMode: activePage.filterMode,
        rotation: activePage.rotation,
        brightness: activePage.brightness,
        contrast: activePage.contrast,
        threshold: activePage.threshold,
        cropBounds: activePage.cropBounds,
      });

      if (res.data?.base64) {
        updateActivePage({ processedSrc: res.data.base64 });
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `পৃষ্ঠা ${activePageIndex + 1} সফলভাবে ৩০০ DPI শার্প প্রসেস হয়েছে!`
              : `Page ${activePageIndex + 1} processed at 300 DPI!`,
        });
      }
    } catch (err: any) {
      console.error('Page process error:', err);
      if (canvasRef.current) {
        const localData = canvasRef.current.toDataURL('image/jpeg', 0.95);
        updateActivePage({ processedSrc: localData });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Compose A4 Page Sheet for Current Page
  const handleComposeA4 = async () => {
    if (!activePage) return;
    try {
      setIsProcessing(true);
      const sourceImage = activePage.processedSrc || activePage.originalSrc;
      const res = await documentApi.composeA4({
        imageBase64: sourceImage,
        pageSize,
        orientation,
        marginMm,
        fitMode,
      });

      if (res.data?.base64) {
        updateActivePage({ a4ComposedSrc: res.data.base64 });
        setViewMode('a4sheet');
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `পৃষ্ঠা ${activePageIndex + 1} কে ${pageSize} (${marginMm}mm মার্জিন) লেআউটে সাজানো হয়েছে!`
              : `Page arranged on ${pageSize} with ${marginMm}mm margins.`,
        });
      }
    } catch (err: any) {
      console.error('Compose A4 error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to arrange A4 layout' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Single Page Image (300 DPI)
  const handleDownloadSinglePage = () => {
    if (!activePage) return;
    const downloadSrc = activePage.a4ComposedSrc || activePage.processedSrc || activePage.originalSrc;
    const a = document.createElement('a');
    a.href = downloadSrc;
    a.download = `document-page-${activePageIndex + 1}-${pageSize}.jpg`;
    a.click();
  };

  // Multi-Page Vector PDF Export
  const handleExportMultiPagePdf = async () => {
    if (pages.length === 0) return;
    try {
      setIsExportingPdf(true);
      const pagesBase64 = pages.map((p) => p.a4ComposedSrc || p.processedSrc || p.originalSrc);

      const blob = await documentApi.exportPdf({
        pagesBase64,
        pageSize,
        orientation,
        marginMm,
        filename: `${docTitle.replace(/\s+/g, '-').toLowerCase()}-${pageSize}.pdf`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle.replace(/\s+/g, '-').toLowerCase()}-${pageSize}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `${pages.length} পৃষ্ঠার প্রিন্ট-রেডি ভেক্টর PDF ডাউনলোড সম্পন্ন হয়েছে!`
            : `Downloaded ${pages.length}-page vector PDF.`,
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to generate multi-page PDF' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    if (pages.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const pageImagesHtml = pages
        .map(
          (p, i) => `
          <div class="print-page">
            <img src="${p.a4ComposedSrc || p.processedSrc || p.originalSrc}" />
          </div>
        `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${docTitle}</title>
          <style>
            @page {
              size: ${pageSize === 'LEGAL' ? 'legal' : pageSize === 'LETTER' ? 'letter' : 'A4'} ${orientation.toLowerCase()};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #FFF;
            }
            .print-page {
              page-break-after: always;
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .print-page:last-child {
              page-break-after: avoid;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          ${pageImagesHtml}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Save Document Job to MongoDB
  const handleSaveJob = async () => {
    if (pages.length === 0) return;
    try {
      setIsSaving(true);
      const totalAmount = pages.length * copies * pricePerPage;

      const res = await documentApi.saveJob({
        customerName: customerName || (lang === 'bn' ? 'সাধারণ কাস্টমার' : 'Walk-in Customer'),
        customerPhone,
        title: docTitle,
        pages: pages.map((p, idx) => ({
          pageNumber: idx + 1,
          originalImageUrl: p.originalSrc,
          processedImageUrl: p.processedSrc || p.originalSrc,
          filterMode: p.filterMode,
          adjustments: {
            brightness: p.brightness,
            contrast: p.contrast,
            rotation: p.rotation,
            threshold: p.threshold,
          },
        })),
        pageSettings: {
          pageSize,
          orientation,
          marginMm,
          fitMode,
        },
        copies,
        totalAmount,
        notes,
      });

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `ডকুমেন্ট জব #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} দোকানে সেভ হয়েছে!`
            : `Job #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} stored in Shop Queue!`,
      });
    } catch (err: any) {
      console.error('Save job error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save job' });
    } finally {
      setIsSaving(false);
    }
  };

  // Open Saved Jobs Modal
  const handleOpenSavedJobs = async () => {
    setShowSavedModal(true);
    try {
      setLoadingSavedJobs(true);
      const res = await documentApi.listJobs();
      setSavedJobs(res.data || []);
    } catch (err: any) {
      console.error('Failed to list jobs:', err);
    } finally {
      setLoadingSavedJobs(false);
    }
  };

  // Restore Saved Job
  const handleLoadJob = (job: any) => {
    if (job.customerName) setCustomerName(job.customerName);
    if (job.customerPhone) setCustomerPhone(job.customerPhone);
    if (job.title) setDocTitle(job.title);
    if (job.copies) setCopies(job.copies);
    if (job.notes) setNotes(job.notes);

    if (job.pageSettings) {
      if (job.pageSettings.pageSize) setPageSize(job.pageSettings.pageSize);
      if (job.pageSettings.orientation) setOrientation(job.pageSettings.orientation);
      if (typeof job.pageSettings.marginMm === 'number') setMarginMm(job.pageSettings.marginMm);
      if (job.pageSettings.fitMode) setFitMode(job.pageSettings.fitMode);
    }

    if (Array.isArray(job.pages) && job.pages.length > 0) {
      const loadedPages: DocPageItem[] = job.pages.map((p: any, idx: number) => ({
        id: `page-${Date.now()}-${idx}`,
        originalSrc: p.originalImageUrl || p.originalSrc || '',
        processedSrc: p.processedImageUrl || p.processedSrc || null,
        a4ComposedSrc: null,
        filterMode: p.filterMode || 'MAGIC_COLOR',
        rotation: p.adjustments?.rotation || 0,
        brightness: p.adjustments?.brightness || 0,
        contrast: p.adjustments?.contrast || 0,
        threshold: p.adjustments?.threshold || 128,
      }));
      setPages(loadedPages);
      setActivePageIndex(0);
    }

    setShowSavedModal(false);
    setStatusMessage({
      type: 'info',
      text:
        lang === 'bn'
          ? `পূর্বের ডকুমেন্ট #${job.jobCode || job.jobNumber} লোড হয়েছে।`
          : `Loaded saved job #${job.jobCode || job.jobNumber}`,
    });
  };

  const filteredSavedJobs = savedJobs.filter((j) => {
    if (!savedSearchQuery) return true;
    const q = savedSearchQuery.toLowerCase();
    return (
      (j.title && j.title.toLowerCase().includes(q)) ||
      (j.customerName && j.customerName.toLowerCase().includes(q)) ||
      (j.customerPhone && j.customerPhone.includes(q)) ||
      (j.jobCode && j.jobCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'bn' ? 'ডকুমেন্ট A4 প্রসেসিং ও স্ক্যানিং' : 'Document A4 Processing Studio'}
            </h1>
            <Badge variant="document" size="sm" dot>
              {lang === 'bn' ? 'A4 স্ক্যান ইঞ্জিন' : 'A4 Scan Engine'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'bn'
              ? 'মোবাইল বা ক্যামেরার ডকুমেন্ট সোজা করা, শ্যাডো রিমুভ, ব্ল্যাক অ্যান্ড হোয়াইট ফটোকপি মোড এবং A4 শিট জেনারেশন।'
              : 'Professional document scanning, perspective straightening, shadow cleanup, B&W photocopy mode, and multi-page A4 PDF export.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            leftIcon={<Languages className="w-3.5 h-3.5 text-slate-500" />}
            title="Switch Language / ভাষা পরিবর্তন"
          >
            {lang === 'bn' ? 'বাংলা' : 'EN'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSavedJobs}
            leftIcon={<FolderOpen className="w-3.5 h-3.5 text-slate-500" />}
          >
            {lang === 'bn' ? 'পূর্বের কাজ' : 'Saved Jobs'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveJob}
            disabled={isSaving || pages.length === 0}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            {lang === 'bn' ? 'দোকানে সেভ করুন' : 'Save to Queue'}
          </Button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {statusMessage.type === 'info' && <HelpCircle className="w-4 h-4 text-blue-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-semibold underline hover:opacity-80">
            {lang === 'bn' ? 'ঠিক আছে' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Multi-Page Thumbnails Reel */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
            {lang === 'bn' ? `পৃষ্ঠা সমূহ (${pages.length}):` : `Pages (${pages.length}):`}
          </span>

          <div className="flex items-center gap-2">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                onClick={() => setActivePageIndex(idx)}
                className={`relative group cursor-pointer border-2 rounded-lg p-1 transition-all flex flex-col items-center bg-slate-50 ${
                  activePageIndex === idx
                    ? 'border-blue-600 ring-2 ring-blue-100 scale-105'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img
                  src={p.a4ComposedSrc || p.processedSrc || p.originalSrc}
                  alt={`Page ${idx + 1}`}
                  className="w-10 h-14 object-cover rounded shadow-xs"
                />
                <span className="text-[10px] font-bold text-slate-600 mt-1">P{idx + 1}</span>

                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(idx);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete page"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Page Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-blue-200"
          >
            <Plus className="w-3.5 h-3.5" />
            {lang === 'bn' ? '+ ফাইল আপলোড' : '+ Upload File'}
          </button>

          <button
            type="button"
            onClick={startCamera}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-200"
          >
            <Camera className="w-3.5 h-3.5" />
            {lang === 'bn' ? '+ ক্যামেরা স্ক্যান' : '+ Camera Scan'}
          </button>
        </div>
      </div>

      {/* Main Studio Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Editing Controls & Document Filters (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Filter Preset Selection (The core photocopy filters) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '১. ডকুমেন্ট স্ক্যান ফিল্টার' : '1. Document Filter Modes'}
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'MAGIC_COLOR',
                  name: 'Magic Color',
                  nameBn: 'ম্যাজিক কালার (উজ্জ্বল)',
                  desc: 'Contrast boosted color',
                },
                {
                  id: 'BW_PHOTOCOPY',
                  name: 'B&W Photocopy',
                  nameBn: 'ফটোকপি মোড (B&W)',
                  desc: 'Pure binary text',
                },
                {
                  id: 'GRAYSCALE',
                  name: 'Grayscale',
                  nameBn: 'গ্রেস্কেল (৮-বিট)',
                  desc: 'Clean gray tone',
                },
                {
                  id: 'SHADOW_CLEAN',
                  name: 'Shadow Clean',
                  nameBn: 'শ্যাডো রিমুভার',
                  desc: 'Removes camera shadow',
                },
                {
                  id: 'ORIGINAL',
                  name: 'Original',
                  nameBn: 'আসল ডকুমেন্ট',
                  desc: 'Unfiltered true colors',
                },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updateActivePage({ filterMode: f.id as any })}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    activePage?.filterMode === f.id
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold">{lang === 'bn' ? f.nameBn : f.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>

            {/* Threshold Slider for B&W Photocopy Mode */}
            {activePage?.filterMode === 'BW_PHOTOCOPY' && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span className="font-medium">
                    {lang === 'bn' ? 'ফটোকপি থ্রেশহোল্ড (কালির তীব্রতা):' : 'B&W Ink Threshold:'}
                  </span>
                  <span className="font-bold">{activePage.threshold || 128}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={activePage.threshold || 128}
                  onChange={(e) => updateActivePage({ threshold: Number(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
                <span className="text-[10px] text-slate-400">
                  {lang === 'bn'
                    ? 'হালকা লেখা বা ডার্ক ব্যাকগ্রাউন্ড পরিষ্কার করতে এডজাস্ট করুন'
                    : 'Adjust to reveal faint text or eliminate dark shadows'}
                </span>
              </div>
            )}
          </div>

          {/* 2. Rotation, Brightness & Contrast */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '২. রোটেশন ও আলো-ছায়া' : '2. Rotate & Light Adjustment'}
            </h2>

            {/* Rotate buttons */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">
                {lang === 'bn' ? 'রোটেশন ও সোজা করা' : 'Rotate & Straighten'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateActivePage({ rotation: ((activePage?.rotation || 0) - 90) % 360 })
                  }
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5 transform -scale-x-100" /> -90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateActivePage({ rotation: ((activePage?.rotation || 0) + 90) % 360 })
                  }
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +90°
                </button>
                <button
                  type="button"
                  onClick={() => updateActivePage({ rotation: 0 })}
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  {lang === 'bn' ? 'রিসেট' : '0°'}
                </button>
              </div>
            </div>

            {/* Brightness Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span className="flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  {lang === 'bn' ? 'উজ্জ্বলতা (Brightness):' : 'Brightness:'}
                </span>
                <span className="font-semibold">{activePage?.brightness || 0}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={activePage?.brightness || 0}
                onChange={(e) => updateActivePage({ brightness: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Contrast Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span className="flex items-center gap-1">
                  <ContrastIcon className="w-3.5 h-3.5 text-slate-600" />
                  {lang === 'bn' ? 'কনট্রাস্ট (Contrast):' : 'Contrast:'}
                </span>
                <span className="font-semibold">{activePage?.contrast || 0}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={activePage?.contrast || 0}
                onChange={(e) => updateActivePage({ contrast: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* 3. A4 Page Layout & Margins Configuration */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৩. পেপার সাইজ ও মার্জিন' : '3. Page Size & Margins'}
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'পেপার সাইজ' : 'Paper Size'}
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="A4">A4 (210 x 297 mm)</option>
                  <option value="LEGAL">Legal (8.5 x 14 in)</option>
                  <option value="LETTER">Letter (8.5 x 11 in)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'ওরিয়েন্টেশন' : 'Orientation'}
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="PORTRAIT">{lang === 'bn' ? 'লম্বালম্বি (Portrait)' : 'Portrait'}</option>
                  <option value="LANDSCAPE">{lang === 'bn' ? 'আড়াআড়ি (Landscape)' : 'Landscape'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'মার্জিন (Margin)' : 'Margins'}
                </label>
                <select
                  value={marginMm}
                  onChange={(e) => setMarginMm(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value={0}>{lang === 'bn' ? 'বর্ডারলেস (0 mm)' : 'None (0 mm)'}</option>
                  <option value={5}>{lang === 'bn' ? 'স্ট্যান্ডার্ড (5 mm)' : 'Narrow (5 mm)'}</option>
                  <option value={10}>{lang === 'bn' ? 'নরমাল (10 mm)' : 'Normal (10 mm)'}</option>
                  <option value={20}>{lang === 'bn' ? 'ওয়াইড (20 mm)' : 'Wide (20 mm)'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'ফিট মোড' : 'Fit Mode'}
                </label>
                <select
                  value={fitMode}
                  onChange={(e) => setFitMode(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="FIT_PAGE">{lang === 'bn' ? 'পেজে ফিট করুন' : 'Fit to Page'}</option>
                  <option value="FILL_PAGE">{lang === 'bn' ? 'পেজ ফিল করুন' : 'Fill Page'}</option>
                  <option value="ORIGINAL_SCALE">{lang === 'bn' ? 'আসল অনুপাত' : 'Original Scale'}</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleComposeA4}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FileCheck className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'A4 পেপার শিট প্রিভিউ তৈরি করুন' : 'Generate A4 Sheet Preview'}
            </button>
          </div>

          {/* 4. Customer Info & Bill */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৪. কাস্টমার ও বিলিং ইনফো' : '4. Customer & Billing'}
            </h2>
            <div>
              <label className="text-xs font-medium text-slate-600">
                {lang === 'bn' ? 'ডকুমেন্টের শিরোনাম' : 'Document Title'}
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500 font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'কাস্টমারের নাম' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'মোঃ রহিম' : 'Customer Name'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}
                </label>
                <input
                  type="text"
                  placeholder="017XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  {lang === 'bn' ? 'কপি' : 'Copies'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  {lang === 'bn' ? 'প্রতি পেজ' : 'Rate/Page'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={pricePerPage}
                  onChange={(e) => setPricePerPage(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  {lang === 'bn' ? 'মোট বিল' : 'Total'}
                </label>
                <div className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1">
                  ৳ {pages.length * copies * pricePerPage}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Preview & Export Deck (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Document Viewport */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            {/* View Mode Switcher Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {lang === 'bn'
                    ? `পৃষ্ঠা ${activePageIndex + 1} / ${pages.length}`
                    : `Page ${activePageIndex + 1} of ${pages.length}`}
                </span>
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 font-mono rounded">
                  {activePage?.filterMode}
                </span>
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('processed')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'processed' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'প্রসেসড প্রিভিউ' : 'Processed'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'split' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'তুলনা (Split View)' : 'Original vs Edited'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('a4sheet')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'a4sheet' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'A4 প্রিন্ট পেজ' : 'A4 Sheet'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleProcessServerPage}
                disabled={isProcessing || !activePage}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {lang === 'bn' ? 'শার্প ৩০০ DPI প্রসেস' : 'Render 300 DPI'}
              </button>
            </div>

            {/* Viewport Canvas or Split Visuals */}
            <div className="relative min-h-[460px] bg-slate-900/5 rounded-xl border border-slate-200 flex items-center justify-center p-4 overflow-hidden">
              {activePage ? (
                <>
                  {viewMode === 'split' ? (
                    <div className="grid grid-cols-2 gap-4 w-full max-h-[500px]">
                      {/* Left: Original */}
                      <div className="border border-slate-200 rounded-lg bg-white p-2 text-center shadow-xs overflow-hidden flex flex-col items-center">
                        <span className="text-[11px] font-semibold text-slate-500 mb-1 block">
                          {lang === 'bn' ? 'আসল স্ক্যান' : 'Original Raw Scan'}
                        </span>
                        <img
                          src={activePage.originalSrc}
                          alt="Original document"
                          className="max-h-[440px] max-w-full object-contain mx-auto rounded"
                        />
                      </div>
                      {/* Right: Processed */}
                      <div className="border border-blue-200 rounded-lg bg-white p-2 text-center shadow-xs overflow-hidden flex flex-col items-center">
                        <span className="text-[11px] font-semibold text-blue-600 mb-1 block">
                          {lang === 'bn' ? 'ফিল্টারড প্রিভিউ' : 'Processed Document'}
                        </span>
                        <canvas
                          ref={canvasRef}
                          role="img"
                          aria-label="Filtered A4 document preview"
                          className="max-h-[440px] max-w-full object-contain mx-auto rounded"
                        >
                          Filtered document preview
                        </canvas>
                      </div>
                    </div>
                  ) : viewMode === 'a4sheet' ? (
                    <div className="relative shadow-2xl rounded border border-slate-300 bg-white p-2 max-h-[500px] overflow-hidden flex items-center justify-center">
                      <img
                        src={activePage.a4ComposedSrc || activePage.processedSrc || activePage.originalSrc}
                        alt="A4 Composed Sheet"
                        className="max-h-[480px] max-w-full object-contain mx-auto"
                      />
                      <div className="absolute top-3 right-3 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-mono rounded">
                        {pageSize} • {orientation} • {marginMm}mm
                      </div>
                    </div>
                  ) : (
                    <div className="relative shadow-xl rounded overflow-hidden max-w-full max-h-[500px] bg-white p-1">
                      <canvas
                        ref={canvasRef}
                        role="img"
                        aria-label="Interactive A4 document canvas"
                        className="max-h-[480px] max-w-full object-contain mx-auto"
                      >
                        Interactive A4 document canvas
                      </canvas>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-8 space-y-2">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {lang === 'bn'
                      ? 'কোনো পৃষ্ঠা নেই। উপরে "+ ফাইল আপলোড" বাটনে ক্লিক করুন।'
                      : 'No document pages found. Upload a file or start camera scan.'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {pages.length > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'আগের পৃষ্ঠা' : 'Previous'}
                </button>

                <span className="text-xs font-medium text-slate-600">
                  {lang === 'bn'
                    ? `পৃষ্ঠা ${activePageIndex + 1} এর ${pages.length}`
                    : `Page ${activePageIndex + 1} of ${pages.length}`}
                </span>

                <button
                  type="button"
                  disabled={activePageIndex === pages.length - 1}
                  onClick={() => setActivePageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors"
                >
                  {lang === 'bn' ? 'পরের পৃষ্ঠা' : 'Next'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Export Deck & Direct Print Actions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'bn' ? 'প্রিন্ট ও ফাইল এক্সপোর্ট' : 'Print & File Export'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'bn'
                  ? '৩০০ DPI হাই-রেজোলিউশন ভেক্টর PDF এবং সরাসরি ব্রাউজার প্রিন্ট সাপোর্ট।'
                  : 'High-resolution multi-page PDF export and direct browser printing.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleDirectPrint}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs border border-slate-200"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                {lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Direct Print'}
              </button>

              <button
                type="button"
                onClick={handleDownloadSinglePage}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs border border-slate-300"
              >
                <Download className="w-4 h-4 text-slate-500" />
                {lang === 'bn' ? 'একক পেজ JPG' : 'Current Page JPG'}
              </button>

              <button
                type="button"
                onClick={handleExportMultiPagePdf}
                disabled={isExportingPdf || pages.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {lang === 'bn'
                  ? `সম্পূর্ণ PDF ডাউনলোড (${pages.length} পেজ)`
                  : `Export Vector PDF (${pages.length} Pages)`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Camera Scanner Modal */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'bn' ? 'লাইভ ক্যামেরা স্ক্যানার' : 'Live Camera Document Scanner'}
                </h3>
              </div>
              <button
                onClick={stopCamera}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-900 flex items-center justify-center min-h-[360px] relative">
              {cameraError ? (
                <div className="text-rose-400 text-sm text-center p-6">{cameraError}</div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="max-h-[400px] w-full object-contain rounded"
                  />
                  {/* Document Framing Reticle */}
                  <div className="absolute inset-8 border-2 border-dashed border-emerald-400/80 rounded pointer-events-none flex items-center justify-center">
                    <span className="bg-slate-900/70 text-emerald-300 text-xs px-3 py-1 rounded">
                      {lang === 'bn'
                        ? 'ডকুমেন্টটিকে ফ্রেমের ভেতর সোজা রাখুন'
                        : 'Align document inside the frame'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={captureCameraSnapshot}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm"
              >
                <Camera className="w-4 h-4" />
                {lang === 'bn' ? 'ছবি তুলুন (Capture)' : 'Capture Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Jobs Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'bn' ? 'দোকানের পূর্বের স্ক্যান রেকর্ড' : 'Saved Document Jobs'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={
                    lang === 'bn'
                      ? 'ডকুমেন্টের নাম, কাস্টমারের মোবাইল বা অর্ডার নম্বর দিয়ে খুঁজুন...'
                      : 'Search by title, customer mobile, or job code...'
                  }
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingSavedJobs ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {lang === 'bn' ? 'ডাটাবেজ থেকে তথ্য লোড হচ্ছে...' : 'Loading saved jobs...'}
                </div>
              ) : filteredSavedJobs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {lang === 'bn' ? 'কোনো রেকর্ড পাওয়া যায়নি।' : 'No saved jobs match your search.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredSavedJobs.map((job) => (
                    <div
                      key={job._id}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-14 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <FileText className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {job.title || 'A4 Scanned Document'}
                            </span>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              #{job.jobCode || job.jobNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {job.customerName} • {job.pages?.length || 1} pages •{' '}
                            {job.pageSettings?.pageSize || 'A4'} • ৳ {job.totalAmount || 10}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoadJob(job)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        {lang === 'bn' ? 'পুনরায় ওপেন করুন' : 'Re-open'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

