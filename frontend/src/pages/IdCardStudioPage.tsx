import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard,
  Upload,
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
  Languages,
  Sparkles,
  Scissors,
  ShieldCheck,
  SplitSquareVertical,
  SlidersHorizontal,
  Contrast as ContrastIcon,
  Maximize2,
  Grid,
} from 'lucide-react';
import {
  idCardApi,
  IdCardPreset,
  IdCardType,
  CardArrangement,
} from '../api/idcard.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

interface SideState {
  originalSrc: string | null;
  processedSrc: string | null;
  rotation: number;
  brightness: number;
  contrast: number;
  filterMode: 'ORIGINAL' | 'MAGIC_COLOR' | 'BW_PHOTOCOPY' | 'GRAYSCALE';
  threshold: number;
}

export const IdCardStudioPage: React.FC = () => {
  // Bilingual toggle: 'bn' (Bengali) | 'en' (English)
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Presets
  const [presets, setPresets] = useState<IdCardPreset[]>([]);
  const [selectedCardType, setSelectedCardType] = useState<IdCardType>('SMART_NID');
  const [customWidthMm, setCustomWidthMm] = useState<number>(85.6);
  const [customHeightMm, setCustomHeightMm] = useState<number>(54);

  // Front Side State
  const [front, setFront] = useState<SideState>({
    originalSrc: null,
    processedSrc: null,
    rotation: 0,
    brightness: 5,
    contrast: 15,
    filterMode: 'MAGIC_COLOR',
    threshold: 128,
  });

  // Back Side State
  const [back, setBack] = useState<SideState>({
    originalSrc: null,
    processedSrc: null,
    rotation: 0,
    brightness: 5,
    contrast: 15,
    filterMode: 'MAGIC_COLOR',
    threshold: 128,
  });

  // Active side editing tab: 'front' | 'back'
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Layout & A4 Arrangement Settings
  const [arrangement, setArrangement] = useState<CardArrangement>('SIDE_BY_SIDE');
  const [copies, setCopies] = useState<number>(1); // 1, 2, 4, 8
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [marginMm, setMarginMm] = useState<number>(15);
  const [gapMm, setGapMm] = useState<number>(10);
  const [showCutMarks, setShowCutMarks] = useState<boolean>(true);

  // Viewport mode: 'composed' (full A4 sheet) | 'side' (editing active card)
  const [viewMode, setViewMode] = useState<'composed' | 'side'>('composed');
  const [composedSheetBase64, setComposedSheetBase64] = useState<string | null>(null);

  // Customer & Billing Info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<number>(10); // 10 BDT per ID Card copy
  const [notes, setNotes] = useState<string>('');

  // Processing & UI States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Saved Jobs Modal
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');
  const [loadingSavedJobs, setLoadingSavedJobs] = useState<boolean>(false);

  // Refs
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load presets on mount
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await idCardApi.getPresets();
        if (res.data && res.data.length > 0) {
          setPresets(res.data);
        }
      } catch (err: any) {
        console.error('Failed to load ID presets:', err);
      }
    };
    fetchPresets();
    loadDemoSmartCard();
  }, []);

  const activePreset = presets.find((p) => p.id === selectedCardType) || {
    id: 'SMART_NID',
    name: 'Bangladesh Smart NID Card (CR-80 Standard)',
    nameBn: 'স্মার্ট জাতীয় পরিচয়পত্র (Smart NID)',
    widthMm: 85.6,
    heightMm: 54,
    widthPx: 1011,
    heightPx: 638,
    description: 'Standard 85.6 x 54 mm smart card format.',
  };

  // Generate Sample Smart NID Card (Front & Back)
  const loadDemoSmartCard = () => {
    // 1. Generate Front Side
    const fCanvas = document.createElement('canvas');
    fCanvas.width = 1011;
    fCanvas.height = 638;
    const fCtx = fCanvas.getContext('2d');
    if (fCtx) {
      // Smart Card Gradient BG
      const grad = fCtx.createLinearGradient(0, 0, 1011, 638);
      grad.addColorStop(0, '#E0F2FE');
      grad.addColorStop(1, '#BAE6FD');
      fCtx.fillStyle = grad;
      fCtx.fillRect(0, 0, 1011, 638);

      // Card Header
      fCtx.fillStyle = '#065F46';
      fCtx.fillRect(0, 0, 1011, 85);
      fCtx.fillStyle = '#FFFFFF';
      fCtx.font = 'bold 30px sans-serif';
      fCtx.fillText('গণপ্রজাতন্ত্রী বাংলাদেশ সরকার', 300, 55);

      // Gold Chip simulation
      fCtx.fillStyle = '#F59E0B';
      fCtx.fillRect(100, 140, 140, 110);
      fCtx.strokeStyle = '#B45309';
      fCtx.strokeRect(100, 140, 140, 110);

      // Photo Portrait
      fCtx.fillStyle = '#1E293B';
      fCtx.fillRect(100, 290, 220, 280);
      fCtx.fillStyle = '#FED7AA';
      fCtx.beginPath();
      fCtx.arc(210, 390, 70, 0, Math.PI * 2);
      fCtx.fill();

      // Cardholder Text Fields
      fCtx.fillStyle = '#0F172A';
      fCtx.font = 'bold 26px sans-serif';
      fCtx.fillText('NAME: TAHMID HASAN', 380, 200);
      fCtx.font = '22px sans-serif';
      fCtx.fillStyle = '#334155';
      fCtx.fillText('পিতা: মোহাম্মদ রফিকুল ইসলাম', 380, 250);
      fCtx.fillText('মাতা: রাশিদা বেগম', 380, 300);
      fCtx.fillText('Date of Birth: 14 Oct 1995', 380, 350);

      // NID Number in Red Box
      fCtx.fillStyle = '#DC2626';
      fCtx.font = 'bold 32px monospace';
      fCtx.fillText('NID NO: 735 918 4201', 380, 430);

      const frontUrl = fCanvas.toDataURL('image/jpeg', 0.95);
      setFront((prev) => ({ ...prev, originalSrc: frontUrl, processedSrc: frontUrl }));
    }

    // 2. Generate Back Side
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 1011;
    bCanvas.height = 638;
    const bCtx = bCanvas.getContext('2d');
    if (bCtx) {
      const grad = bCtx.createLinearGradient(0, 0, 1011, 638);
      grad.addColorStop(0, '#F1F5F9');
      grad.addColorStop(1, '#E2E8F0');
      bCtx.fillStyle = grad;
      bCtx.fillRect(0, 0, 1011, 638);

      // Address & Blood Group
      bCtx.fillStyle = '#0F172A';
      bCtx.font = 'bold 22px sans-serif';
      bCtx.fillText('ঠিকানা: বাসা/হোল্ডিং: ১২, রোড: ৪, ধানমন্ডি, ঢাকা-১২০৫', 80, 120);
      bCtx.fillText('রক্তের গ্রুপ / Blood Group: B(+ve)', 80, 180);
      bCtx.fillText('প্রদানের তারিখ: ১২/০২/২০২০', 80, 240);

      // Barcode / QR Simulation
      bCtx.fillStyle = '#000000';
      bCtx.fillRect(80, 320, 850, 120);
      bCtx.fillStyle = '#FFFFFF';
      for (let b = 0; b < 60; b++) {
        bCtx.fillRect(90 + b * 14, 320, b % 3 === 0 ? 3 : 7, 120);
      }

      // Machine Readable Zone (MRZ lines)
      bCtx.fillStyle = '#1E293B';
      bCtx.font = '22px monospace';
      bCtx.fillText('I<BGD7359184201<<<<<<<<<<<<<<<', 80, 520);
      bCtx.fillText('9510145M3002120BGD<<<<<<<<<<<4', 80, 560);

      const backUrl = bCanvas.toDataURL('image/jpeg', 0.95);
      setBack((prev) => ({ ...prev, originalSrc: backUrl, processedSrc: backUrl }));
    }
  };

  // Upload Front Side
  const handleFrontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFront((prev) => ({ ...prev, originalSrc: base64, processedSrc: base64 }));
        setComposedSheetBase64(null);
        setStatusMessage({
          type: 'info',
          text: lang === 'bn' ? 'সামনের অংশ আপলোড হয়েছে।' : 'Uploaded front side.',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload Back Side
  const handleBackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setBack((prev) => ({ ...prev, originalSrc: base64, processedSrc: base64 }));
        setComposedSheetBase64(null);
        setStatusMessage({
          type: 'info',
          text: lang === 'bn' ? 'পেছনের অংশ আপলোড হয়েছে।' : 'Uploaded back side.',
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const currentSideState = activeSide === 'front' ? front : back;
  const updateCurrentSide = (updates: Partial<SideState>) => {
    if (activeSide === 'front') {
      setFront((prev) => ({ ...prev, ...updates }));
    } else {
      setBack((prev) => ({ ...prev, ...updates }));
    }
  };

  // Render Client Canvas Preview for Active Side
  const renderSideCanvas = useCallback(() => {
    if (!currentSideState.originalSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentSideState.originalSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((currentSideState.rotation * Math.PI) / 180);

      let filterString = `brightness(${100 + currentSideState.brightness}%) contrast(${100 + currentSideState.contrast}%)`;
      if (currentSideState.filterMode === 'GRAYSCALE') {
        filterString += ' grayscale(100%)';
      } else if (currentSideState.filterMode === 'MAGIC_COLOR') {
        filterString += ' saturate(115%)';
      }
      ctx.filter = filterString;

      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      ctx.restore();

      // B&W Photocopy mode binary thresholding
      if (currentSideState.filterMode === 'BW_PHOTOCOPY') {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const thresh = currentSideState.threshold || 128;
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const v = gray >= thresh ? 255 : 0;
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
  }, [currentSideState]);

  useEffect(() => {
    renderSideCanvas();
  }, [renderSideCanvas]);

  // Execute Sharp Server Processing for Active Side
  const handleProcessActiveSide = async () => {
    if (!currentSideState.originalSrc) return;
    try {
      setIsProcessing(true);
      setStatusMessage(null);

      const targetWidthMm = selectedCardType === 'CUSTOM' ? customWidthMm : activePreset.widthMm;
      const targetHeightMm = selectedCardType === 'CUSTOM' ? customHeightMm : activePreset.heightMm;

      const res = await idCardApi.processSide({
        imageBase64: currentSideState.originalSrc,
        widthMm: targetWidthMm,
        heightMm: targetHeightMm,
        rotation: currentSideState.rotation,
        brightness: currentSideState.brightness,
        contrast: currentSideState.contrast,
        filterMode: currentSideState.filterMode,
        threshold: currentSideState.threshold,
      });

      if (res.data?.base64) {
        updateCurrentSide({ processedSrc: res.data.base64 });
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `${activeSide === 'front' ? 'সামনের' : 'পেছনের'} অংশ সফলভাবে ৩০০ DPI প্রসেস হয়েছে!`
              : `Processed ${activeSide} side at 300 DPI!`,
        });
      }
    } catch (err: any) {
      console.error('Process card side error:', err);
      if (canvasRef.current) {
        const localData = canvasRef.current.toDataURL('image/jpeg', 0.95);
        updateCurrentSide({ processedSrc: localData });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Composed A4 Sheet (Front + Back Duplex Layout with Cut Lines)
  const handleComposeSheet = async () => {
    const frontSource = front.processedSrc || front.originalSrc;
    if (!frontSource) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'অনুগ্রহ করে প্রথমে সামনের অংশ আপলোড করুন।' : 'Front side image is required.',
      });
      return;
    }

    try {
      setIsComposing(true);
      setStatusMessage(null);

      const targetWidthMm = selectedCardType === 'CUSTOM' ? customWidthMm : activePreset.widthMm;
      const targetHeightMm = selectedCardType === 'CUSTOM' ? customHeightMm : activePreset.heightMm;

      const backSource = back.processedSrc || back.originalSrc || undefined;

      const res = await idCardApi.composeSheet({
        frontImageBase64: frontSource,
        backImageBase64: backSource,
        cardType: selectedCardType,
        widthMm: targetWidthMm,
        heightMm: targetHeightMm,
        arrangement,
        copies: Number(copies),
        orientation,
        marginMm,
        gapMm,
        showCutMarks,
      });

      if (res.data?.base64) {
        setComposedSheetBase64(res.data.base64);
        setViewMode('composed');
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `A4 পেপারে ${copies} কপি কার্ড কাটিং মার্কসহ সাজানো হয়েছে!`
              : `Arranged ${copies} copies on A4 with cut guidelines.`,
        });
      }
    } catch (err: any) {
      console.error('Compose ID card error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to compose ID card A4 layout' });
    } finally {
      setIsComposing(false);
    }
  };

  // Download Composed A4 Sheet Image (300 DPI)
  const handleDownloadSheetImage = () => {
    if (!composedSheetBase64) return;
    const a = document.createElement('a');
    a.href = composedSheetBase64;
    a.download = `id-card-${selectedCardType.toLowerCase()}-${copies}-copies-300dpi.jpg`;
    a.click();
  };

  // Export 300 DPI Vector PDF
  const handleExportPdf = async () => {
    if (!composedSheetBase64) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'আগে A4 শিট লেআউট তৈরি করুন।' : 'Generate sheet layout first.',
      });
      return;
    }
    try {
      setIsExportingPdf(true);
      const blob = await idCardApi.exportPdf({
        sheetBase64: composedSheetBase64,
        orientation,
        filename: `id-card-${selectedCardType.toLowerCase()}-a4.pdf`,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `id-card-${selectedCardType.toLowerCase()}-a4.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'success',
        text: lang === 'bn' ? 'প্রিন্ট-রেডি ভেক্টর PDF ডাউনলোড হয়েছে!' : 'Downloaded vector PDF.',
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to generate PDF' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    if (!composedSheetBase64) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'প্রিন্ট করতে আগে লেআউট শিট তৈরি করুন।' : 'Generate layout before printing.',
      });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>DocuStudio - ID Card A4 Print</title>
          <style>
            @page {
              size: A4 ${orientation.toLowerCase()};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #FFF;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            img {
              max-width: 100vw;
              max-height: 100vh;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${composedSheetBase64}" onload="window.print();window.close();" />
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Save ID Card Job to MongoDB with Audit Log
  const handleSaveJob = async () => {
    const frontSource = front.processedSrc || front.originalSrc;
    if (!frontSource) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'সামনের অংশ দিয়ে জব সংরক্ষণ করুন।' : 'Front side image required.',
      });
      return;
    }

    try {
      setIsSaving(true);
      const targetWidthMm = selectedCardType === 'CUSTOM' ? customWidthMm : activePreset.widthMm;
      const targetHeightMm = selectedCardType === 'CUSTOM' ? customHeightMm : activePreset.heightMm;

      const res = await idCardApi.saveJob({
        customerName: customerName || (lang === 'bn' ? 'সাধারণ কাস্টমার' : 'Walk-in Customer'),
        customerPhone,
        cardType: selectedCardType,
        cardTitle: activePreset.name,
        cardDimensionsMm: { width: targetWidthMm, height: targetHeightMm },
        frontImage: {
          originalUrl: front.originalSrc,
          processedUrl: front.processedSrc || front.originalSrc,
          rotation: front.rotation,
          brightness: front.brightness,
          contrast: front.contrast,
          filterMode: front.filterMode,
        },
        backImage: back.originalSrc
          ? {
              originalUrl: back.originalSrc,
              processedUrl: back.processedSrc || back.originalSrc,
              rotation: back.rotation,
              brightness: back.brightness,
              contrast: back.contrast,
              filterMode: back.filterMode,
            }
          : undefined,
        layoutSettings: {
          arrangement,
          copies,
          orientation,
          marginMm,
          gapMm,
          showCutMarks,
        },
        sheetImageUrl: composedSheetBase64 || undefined,
        copies,
        totalAmount: copies * unitPrice,
        notes,
      });

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `আইডি কার্ড অর্ডার #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} দোকানে সেভ হয়েছে!`
            : `Job #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} stored in Shop Queue!`,
      });
    } catch (err: any) {
      console.error('Save ID card job error:', err);
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
      const res = await idCardApi.listJobs();
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
    if (job.cardType) setSelectedCardType(job.cardType);
    if (job.copies) setCopies(job.copies);
    if (job.notes) setNotes(job.notes);

    if (job.frontImage) {
      setFront((prev) => ({
        ...prev,
        originalSrc: job.frontImage.originalUrl || job.frontImage.processedUrl || null,
        processedSrc: job.frontImage.processedUrl || null,
        rotation: job.frontImage.rotation || 0,
        brightness: job.frontImage.brightness || 0,
        contrast: job.frontImage.contrast || 0,
        filterMode: job.frontImage.filterMode || 'MAGIC_COLOR',
      }));
    }

    if (job.backImage && job.backImage.originalUrl) {
      setBack((prev) => ({
        ...prev,
        originalSrc: job.backImage.originalUrl || job.backImage.processedUrl || null,
        processedSrc: job.backImage.processedUrl || null,
        rotation: job.backImage.rotation || 0,
        brightness: job.backImage.brightness || 0,
        contrast: job.backImage.contrast || 0,
        filterMode: job.backImage.filterMode || 'MAGIC_COLOR',
      }));
    }

    if (job.layoutSettings) {
      if (job.layoutSettings.arrangement) setArrangement(job.layoutSettings.arrangement);
      if (job.layoutSettings.orientation) setOrientation(job.layoutSettings.orientation);
      if (typeof job.layoutSettings.marginMm === 'number') setMarginMm(job.layoutSettings.marginMm);
      if (typeof job.layoutSettings.gapMm === 'number') setGapMm(job.layoutSettings.gapMm);
      if (typeof job.layoutSettings.showCutMarks === 'boolean') setShowCutMarks(job.layoutSettings.showCutMarks);
    }

    if (job.sheetImageUrl) {
      setComposedSheetBase64(job.sheetImageUrl);
      setViewMode('composed');
    }

    setShowSavedModal(false);
    setStatusMessage({
      type: 'info',
      text:
        lang === 'bn'
          ? `পূর্বের অর্ডার #${job.jobCode || job.jobNumber} লোড হয়েছে।`
          : `Loaded saved job #${job.jobCode || job.jobNumber}`,
    });
  };

  const filteredSavedJobs = savedJobs.filter((j) => {
    if (!savedSearchQuery) return true;
    const q = savedSearchQuery.toLowerCase();
    return (
      (j.cardTitle && j.cardTitle.toLowerCase().includes(q)) ||
      (j.customerName && j.customerName.toLowerCase().includes(q)) ||
      (j.customerPhone && j.customerPhone.includes(q)) ||
      (j.jobCode && j.jobCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'bn' ? 'আইডি কার্ড ও এনআইডি A4 প্রসেসিং' : 'ID Card & NID A4 Studio'}
            </h1>
            <Badge variant="idcard" size="sm" dot>
              {lang === 'bn' ? 'ডুপ্লেক্স A4 প্রিন্ট' : 'Duplex A4 Layout'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'bn'
              ? 'স্মার্ট NID ও আইডি কার্ডের উভয়পিঠ পাশাপাশি রেখে নিখুঁত সাইজে A4 পেপারে প্রিন্ট শিট তৈরি করুন।'
              : 'Process front and back sides of Smart NIDs, Driving Licenses and ID Cards with A4 cutting guides.'}
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
            disabled={isSaving || !front.originalSrc}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            {lang === 'bn' ? 'দোকানে সেভ করুন' : 'Save to Queue'}
          </Button>
        </div>
      </div>

      {/* Security Banner: PII Protection */}
      <div className="bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            {lang === 'bn'
              ? 'নিরাপত্তা বার্তা: জাতীয় পরিচয়পত্র অত্যন্ত সংবেদনশীল ব্যক্তিগত তথ্য। এটি সংরক্ষিত টেন্যান্ট আইসোলেশন ও অডিট ট্র্যাকিং সহ পরিচালিত হচ্ছে।'
              : 'Security & PII Protection: Identity documents are strictly isolated within your private shop database with audit tracking.'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800">
          SECURE STORAGE
        </span>
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

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Controls & Presets (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Card Preset Selection */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '১. কার্ডের ধরন ও প্রিসেট' : '1. Card Type & Dimensions'}
            </h2>

            <select
              value={selectedCardType}
              onChange={(e) => setSelectedCardType(e.target.value as any)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white font-medium text-slate-900"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {lang === 'bn' ? p.nameBn : p.name} ({p.widthMm}x{p.heightMm}mm)
                </option>
              ))}
            </select>

            {selectedCardType === 'CUSTOM' ? (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    {lang === 'bn' ? 'প্রস্থ (Width mm)' : 'Width (mm)'}
                  </label>
                  <input
                    type="number"
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-1 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    {lang === 'bn' ? 'উচ্চতা (Height mm)' : 'Height (mm)'}
                  </label>
                  <input
                    type="number"
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-1 font-bold"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">{lang === 'bn' ? 'আদর্শ মাপ:' : 'Exact Specs:'}</span>
                  <span className="font-bold text-slate-900">
                    {activePreset.widthMm} x {activePreset.heightMm} mm ({activePreset.widthPx}x{activePreset.heightPx} px @ 300 DPI)
                  </span>
                </div>
                <p className="text-slate-500 pt-0.5 italic">{activePreset.description}</p>
              </div>
            )}
          </div>

          {/* 2. Image Source: Front & Back Upload Selectors */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? '২. কার্ড আপলোড (সামনে ও পেছনে)' : '2. Front & Back Upload'}
              </span>
              <button
                type="button"
                onClick={loadDemoSmartCard}
                className="text-[11px] font-bold text-blue-600 hover:underline"
              >
                {lang === 'bn' ? 'স্যাম্পল NID' : 'Sample NID'}
              </button>
            </h2>

            <input
              type="file"
              ref={frontInputRef}
              onChange={handleFrontUpload}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <input
              type="file"
              ref={backInputRef}
              onChange={handleBackUpload}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {/* Front & Back Tabs / Upload Cards */}
            <div className="grid grid-cols-2 gap-2">
              {/* Front Card Tile */}
              <div
                onClick={() => {
                  setActiveSide('front');
                  setViewMode('side');
                }}
                className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                  activeSide === 'front'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">
                    {lang === 'bn' ? '১ম পাশ (Front)' : 'Front Side'}
                  </span>
                  {front.originalSrc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>

                <div className="h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden mb-2">
                  {front.processedSrc || front.originalSrc ? (
                    <img
                      src={front.processedSrc || front.originalSrc!}
                      alt="Front"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <CreditCard className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    frontInputRef.current?.click();
                  }}
                  className="w-full py-1 text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
                >
                  {front.originalSrc ? (lang === 'bn' ? 'পরিবর্তন' : 'Replace') : (lang === 'bn' ? 'আপলোড' : 'Upload')}
                </button>
              </div>

              {/* Back Card Tile */}
              <div
                onClick={() => {
                  setActiveSide('back');
                  setViewMode('side');
                }}
                className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                  activeSide === 'back'
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800">
                    {lang === 'bn' ? '২য় পাশ (Back)' : 'Back Side'}
                  </span>
                  {back.originalSrc && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>

                <div className="h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden mb-2">
                  {back.processedSrc || back.originalSrc ? (
                    <img
                      src={back.processedSrc || back.originalSrc!}
                      alt="Back"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <CreditCard className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    backInputRef.current?.click();
                  }}
                  className="w-full py-1 text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
                >
                  {back.originalSrc ? (lang === 'bn' ? 'পরিবর্তন' : 'Replace') : (lang === 'bn' ? 'আপলোড' : 'Upload')}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Editing Controls for Active Side */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                {lang === 'bn'
                  ? `৩. ফিল্টার ও আলো (${activeSide === 'front' ? 'সামনের' : 'পেছনের'})`
                  : `3. Filters (${activeSide.toUpperCase()})`}
              </h2>
            </div>

            {/* Filter Modes */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'MAGIC_COLOR', name: 'Magic Color', nameBn: 'ম্যাজিক কালার' },
                { id: 'BW_PHOTOCOPY', name: 'B&W Copy', nameBn: 'ফটোকপি মোড' },
                { id: 'GRAYSCALE', name: 'Grayscale', nameBn: 'গ্রেস্কেল' },
                { id: 'ORIGINAL', name: 'Original', nameBn: 'আসল' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updateCurrentSide({ filterMode: f.id as any })}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all text-center ${
                    currentSideState.filterMode === f.id
                      ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {lang === 'bn' ? f.nameBn : f.name}
                </button>
              ))}
            </div>

            {/* Threshold Slider for B&W Mode */}
            {currentSideState.filterMode === 'BW_PHOTOCOPY' && (
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{lang === 'bn' ? 'থ্রেশহোল্ড (কালির তীব্রতা):' : 'B&W Threshold:'}</span>
                  <span className="font-bold">{currentSideState.threshold}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={currentSideState.threshold}
                  onChange={(e) => updateCurrentSide({ threshold: Number(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            )}

            {/* Brightness & Contrast */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>{lang === 'bn' ? 'উজ্জ্বলতা' : 'Brightness'}</span>
                  <span className="font-semibold">{currentSideState.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={currentSideState.brightness}
                  onChange={(e) => updateCurrentSide({ brightness: Number(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>{lang === 'bn' ? 'কনট্রাস্ট' : 'Contrast'}</span>
                  <span className="font-semibold">{currentSideState.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={currentSideState.contrast}
                  onChange={(e) => updateCurrentSide({ contrast: Number(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Rotation Controls */}
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentSide({ rotation: (currentSideState.rotation - 90) % 360 })
                  }
                  className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded flex items-center justify-center gap-1"
                >
                  <RotateCw className="w-3 h-3 transform -scale-x-100" /> -90°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentSide({ rotation: (currentSideState.rotation + 90) % 360 })
                  }
                  className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded flex items-center justify-center gap-1"
                >
                  <RotateCw className="w-3 h-3" /> +90°
                </button>
                <button
                  type="button"
                  onClick={() => updateCurrentSide({ rotation: 0 })}
                  className="py-1 px-3 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded"
                >
                  {lang === 'bn' ? 'রিসেট' : '0°'}
                </button>
              </div>
            </div>
          </div>

          {/* 4. A4 Sheet Layout & Duplex Settings */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Grid className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৪. A4 লেআউট ও কাটিং গাইড' : '4. A4 Sheet Layout & Marks'}
            </h2>

            {/* Arrangement Mode */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                {lang === 'bn' ? 'সাজানোর ধরণ (Arrangement):' : 'Arrangement:'}
              </label>
              <select
                value={arrangement}
                onChange={(e) => setArrangement(e.target.value as any)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium text-slate-800"
              >
                <option value="SIDE_BY_SIDE">
                  {lang === 'bn' ? 'উভয়পিঠ পাশাপাশি (Side by Side)' : 'Side by Side (Front & Back)'}
                </option>
                <option value="STACKED">
                  {lang === 'bn' ? 'উপরে ও নিচে (Stacked Top & Bottom)' : 'Stacked (Top & Bottom)'}
                </option>
                <option value="GRID">
                  {lang === 'bn' ? 'গ্রিড লেআউট (Grid Multi-Card)' : 'Grid Layout'}
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'কপি সংখ্যা' : 'Copies'}
                </label>
                <select
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value={1}>১ সেট (1 Pair)</option>
                  <option value={2}>২ সেট (2 Pairs)</option>
                  <option value={4}>৪ সেট (4 Pairs)</option>
                  <option value={8}>৮ কপি গ্রিড (8 Cards)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  {lang === 'bn' ? 'কাটিং মার্ক' : 'Cut Marks'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowCutMarks(!showCutMarks)}
                  className={`w-full py-2 px-2 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                    showCutMarks
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  {showCutMarks ? (lang === 'bn' ? 'সক্রিয় (Active)' : 'Enabled') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Disabled')}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleComposeSheet}
              disabled={isComposing || !front.originalSrc}
              className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              {isComposing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Grid className="w-3.5 h-3.5" />}
              {lang === 'bn' ? 'A4 প্রিন্ট শিট তৈরি করুন' : 'Generate A4 Sheet'}
            </button>
          </div>

          {/* 5. Customer & Billing */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৫. কাস্টমার ও বিলিং' : '5. Customer & Billing'}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'কাস্টমারের নাম' : 'Name'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'মোঃ রহিম' : 'Walk-in'}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1"
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
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'প্রতি কপি মূল্য (৳)' : 'Rate / Copy (৳)'}
                </label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'মোট বিল' : 'Total'}
                </label>
                <div className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1">
                  ৳ {copies * unitPrice}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Viewport & Export Deck (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Viewport */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  {viewMode === 'composed'
                    ? lang === 'bn'
                      ? 'A4 প্রিন্ট শিট প্রিভিউ (কাটিং মার্কসহ)'
                      : 'A4 Print Sheet Preview (with Cut Guidelines)'
                    : lang === 'bn'
                    ? `${activeSide === 'front' ? 'সামনের' : 'পেছনের'} পাশের লাইভ এডিটর`
                    : `Editing ${activeSide.toUpperCase()} Side`}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'প্রিন্ট করার পর কাঁচি দিয়ে সহজে কাটার জন্য অটো ডটেড কাটিং মার্ক দেওয়া হয়েছে।'
                    : 'Precision scissor and trimmer registration cut lines included.'}
                </p>
              </div>

              {/* View Mode Toggle Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('composed')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'composed'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'A4 শিট প্রিভিউ' : 'A4 Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('side')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    viewMode === 'side'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'কার্ড প্রিভিউ' : 'Card Preview'}
                </button>
              </div>
            </div>

            {/* Viewport Render Display */}
            <div className="relative min-h-[460px] bg-slate-900/5 rounded-xl border border-slate-200 flex items-center justify-center p-4 overflow-hidden">
              {viewMode === 'composed' ? (
                composedSheetBase64 ? (
                  <div className="relative shadow-2xl rounded border border-slate-300 bg-white p-2 max-h-[500px] overflow-hidden flex items-center justify-center">
                    <img
                      src={composedSheetBase64}
                      alt="A4 ID Card Sheet"
                      className="max-h-[480px] max-w-full object-contain mx-auto"
                    />
                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-mono rounded">
                      A4 • {copies} copies • 300 DPI
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-2">
                    <Grid className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500">
                      {lang === 'bn'
                        ? 'বামপাশের "A4 প্রিন্ট শিট তৈরি করুন" বাটনে ক্লিক করে লেআউট দেখুন।'
                        : 'Click "Generate A4 Sheet" to preview layout with cut marks.'}
                    </p>
                  </div>
                )
              ) : currentSideState.originalSrc ? (
                <div className="relative shadow-xl rounded overflow-hidden max-w-full max-h-[460px] bg-white p-1">
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label="Interactive ID Card front and back preview canvas"
                    className="max-h-[440px] max-w-full object-contain mx-auto"
                  >
                    Interactive ID Card preview canvas
                  </canvas>
                </div>
              ) : (
                <div className="text-center p-8 space-y-2">
                  <CreditCard className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {lang === 'bn'
                      ? 'কার্ডের ছবি আপলোড করুন অথবা স্যাম্পল NID লোড করুন।'
                      : 'Upload card photo or load sample NID.'}
                  </p>
                </div>
              )}
            </div>

            {viewMode === 'side' && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleProcessActiveSide}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 flex items-center gap-1.5 transition-colors"
                >
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {lang === 'bn'
                    ? `${activeSide === 'front' ? 'সামনের' : 'পেছনের'} পাশ ৩০০ DPI শার্প প্রসেস করুন`
                    : `Process ${activeSide.toUpperCase()} at 300 DPI`}
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
                  : 'High-resolution PDF export and direct browser printing.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleDirectPrint}
                disabled={!composedSheetBase64}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs border border-slate-200 disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                {lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Direct Print'}
              </button>

              <button
                type="button"
                onClick={handleDownloadSheetImage}
                disabled={!composedSheetBase64}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs border border-slate-300 disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-slate-500" />
                {lang === 'bn' ? 'শিট ছবি (JPG)' : 'A4 Sheet JPG'}
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf || !composedSheetBase64}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {lang === 'bn' ? 'প্রিন্ট-রেডি ভেক্টর PDF' : 'Export Vector PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Jobs Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'bn' ? 'দোকানের পূর্বের আইডি কার্ড রেকর্ড' : 'Saved ID Card Jobs'}
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
                      ? 'কার্ডের নাম, কাস্টমারের মোবাইল বা অর্ডার নম্বর দিয়ে খুঁজুন...'
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
                        <div className="w-12 h-10 bg-indigo-50 border border-indigo-200 rounded flex items-center justify-center text-indigo-600 shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {job.cardTitle || job.cardType}
                            </span>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              #{job.jobCode || job.jobNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {job.customerName} • {job.copies || 1} copies • ৳ {job.totalAmount || 10}
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

