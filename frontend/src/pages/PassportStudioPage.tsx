import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
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
  Scissors,
  User,
  Phone,
  Search,
  Sparkles,
  Shirt,
  ZoomIn,
  MoveVertical,
  MoveHorizontal,
  Languages,
} from 'lucide-react';
import { passportApi, PassportPreset } from '../api/passport.api';
import { SUIT_TEMPLATES, SuitTemplate } from '../utils/suitTemplates';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

// Predefined background swatches common in Bangladeshi & International studio specs
const BG_COLORS = [
  { name: 'Pure White (সাদা)', hex: '#FFFFFF', border: 'border-slate-300' },
  { name: 'Sky Blue (মালয়েশিয়া/বিডি)', hex: '#38BDF8', border: 'border-blue-400' },
  { name: 'Off-White / Grey (ইউরোপ/EU)', hex: '#F1F5F9', border: 'border-slate-300' },
  { name: 'Navy Blue (নেভি ব্লু)', hex: '#1E3A8A', border: 'border-blue-900' },
  { name: 'China Red (লাল)', hex: '#DC2626', border: 'border-red-600' },
];

export const PassportStudioPage: React.FC = () => {
  // Language mode: 'bn' (Bengali) | 'en' (English)
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Presets state
  const [presets, setPresets] = useState<PassportPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('bd_passport_40x50');
  const [loadingPresets, setLoadingPresets] = useState<boolean>(true);

  // Image editing state
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [processedSingleBase64, setProcessedSingleBase64] = useState<string | null>(null);
  const [sheetPreviewBase64, setSheetPreviewBase64] = useState<string | null>(null);

  // Photo adjustments
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF');
  const [bgTolerance, setBgTolerance] = useState<number>(30); // manual tolerance
  const [showBiometricGuide, setShowBiometricGuide] = useState<boolean>(true);

  // Virtual Attire / Suit Changer (Studiozly feature)
  const [selectedSuitId, setSelectedSuitId] = useState<string>('none');
  const [suitScale, setSuitScale] = useState<number>(100); // 80 - 140%
  const [suitOffsetY, setSuitOffsetY] = useState<number>(55); // % from top (collar placement)
  const [suitOffsetX, setSuitOffsetX] = useState<number>(50); // % from left

  // Print Sheet Options
  const [sheetLayout, setSheetLayout] = useState<'4x6' | 'A4'>('4x6');
  const [copies, setCopies] = useState<number>(8);

  // Customer & Billing Info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<number>(100);
  const [notes, setNotes] = useState<string>('');

  // Processing & UI Statuses
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isGeneratingSheet, setIsGeneratingSheet] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Saved Jobs Modal & Search
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');
  const [loadingSavedJobs, setLoadingSavedJobs] = useState<boolean>(false);

  // Canvases & Inputs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  // Load presets on mount
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        setLoadingPresets(true);
        const res = await passportApi.getPresets();
        if (res.data && res.data.length > 0) {
          setPresets(res.data);
          // Default to Bangladesh Passport if available
          const bd = res.data.find((p) => p.id === 'bd_passport_40x50');
          setSelectedPresetId(bd ? bd.id : res.data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load presets:', err);
        setPresets([
          {
            id: 'bd_passport_40x50',
            name: 'Bangladesh Passport / NID (40x50 mm)',
            country: 'Bangladesh',
            widthMm: 40,
            heightMm: 50,
            widthPx: 472,
            heightPx: 591,
            bgColor: '#FFFFFF',
            description: '40 x 50 mm standard MRP & e-Passport format.',
          },
          {
            id: 'stamp_20x25',
            name: 'Stamp Size Photo (20x25 mm)',
            country: 'Universal / Academic',
            widthMm: 20,
            heightMm: 25,
            widthPx: 236,
            heightPx: 295,
            bgColor: '#FFFFFF',
            description: 'Standard 20x25 mm stamp size for school, college, bank bio-data.',
          },
          {
            id: 'malaysia_visa_35x50',
            name: 'Malaysia Visa (35x50 mm - Sky Blue)',
            country: 'Malaysia',
            widthMm: 35,
            heightMm: 50,
            widthPx: 413,
            heightPx: 591,
            bgColor: '#38BDF8',
            description: 'Sky blue background. 35x50 mm for Malaysian student / work permit.',
          },
          {
            id: 'us_passport_2x2',
            name: 'US Passport / Visa (2x2 in)',
            country: 'United States',
            widthMm: 51,
            heightMm: 51,
            widthPx: 602,
            heightPx: 602,
            bgColor: '#FFFFFF',
            description: '2 x 2 inches square format with pure white background.',
          },
        ]);
      } finally {
        setLoadingPresets(false);
      }
    };
    fetchPresets();
  }, []);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || presets[0];
  const activeSuit = SUIT_TEMPLATES.find((s) => s.id === selectedSuitId);

  // When preset changes, automatically match suggested background color
  useEffect(() => {
    if (activePreset && activePreset.bgColor) {
      setBackgroundColor(activePreset.bgColor);
    }
  }, [activePreset]);

  // Handle Image File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setRawImageSrc(base64);
        setProcessedSingleBase64(base64);
        setSheetPreviewBase64(null);
        setStatusMessage({
          type: 'info',
          text: lang === 'bn' ? `ছবি "${file.name}" লোড হয়েছে।` : `Loaded "${file.name}".`,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample Demo Portrait
  const loadDemoPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clean background
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, 0, 600, 700);

      // Torso / Casual Shirt
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.ellipse(300, 600, 220, 150, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck
      ctx.fillStyle = '#FED7AA';
      ctx.fillRect(260, 360, 80, 80);

      // Head
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(300, 280, 110, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(300, 240, 115, Math.PI, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(260, 275, 8, 0, Math.PI * 2);
      ctx.arc(340, 275, 8, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(300, 310, 30, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();

      const demoUrl = canvas.toDataURL('image/jpeg', 0.95);
      setRawImageSrc(demoUrl);
      setProcessedSingleBase64(demoUrl);
      setSheetPreviewBase64(null);
      setStatusMessage({
        type: 'info',
        text: lang === 'bn' ? 'স্যাম্পল পাসপোর্ট ছবি লোড হয়েছে।' : 'Loaded sample studio portrait.',
      });
    }
  };

  // Render Canvas with portrait, color replacement, suit overlay, and biometric guidelines
  const renderInteractiveCanvas = useCallback(() => {
    if (!rawImageSrc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = rawImageSrc;
    img.onload = () => {
      const targetWidth = activePreset ? activePreset.widthPx : 472;
      const targetHeight = activePreset ? activePreset.heightPx : 591;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.clearRect(0, 0, targetWidth, targetHeight);

      // 1. Fill selected replacement background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 2. Draw Customer Image with transformations
      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;

      const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;

      ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
      ctx.restore();

      // 3. Simple Chroma / Edge Replacement for Light Backgrounds
      if (backgroundColor !== '#FFFFFF' && bgTolerance > 0) {
        try {
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imgData.data;
          const hex = backgroundColor.replace('#', '');
          const rBg = parseInt(hex.substring(0, 2), 16) || 255;
          const gBg = parseInt(hex.substring(2, 4), 16) || 255;
          const bBg = parseInt(hex.substring(4, 6), 16) || 255;

          const threshold = 255 - bgTolerance * 1.5;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > threshold && g > threshold && b > threshold) {
              data[i] = rBg;
              data[i + 1] = gBg;
              data[i + 2] = bBg;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // ignore canvas taint
        }
      }

      // 4. Render Virtual Suit / Attire Overlay if selected
      if (activeSuit && activeSuit.id !== 'none' && activeSuit.svg) {
        const suitImg = new Image();
        suitImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(activeSuit.svg)}`;
        suitImg.onload = () => {
          const suitW = targetWidth * (suitScale / 100);
          const suitH = suitW * 0.8; // Standard suit aspect ratio
          const suitX = (targetWidth * (suitOffsetX / 100)) - (suitW / 2);
          const suitY = targetHeight * (suitOffsetY / 100);

          ctx.drawImage(suitImg, suitX, suitY, suitW, suitH);

          // Draw biometric guides on top of everything if enabled
          drawBiometricGuides(ctx, targetWidth, targetHeight);
        };
      } else {
        // Draw biometric guides
        drawBiometricGuides(ctx, targetWidth, targetHeight);
      }
    };
  }, [
    rawImageSrc,
    activePreset,
    rotation,
    brightness,
    contrast,
    backgroundColor,
    bgTolerance,
    showBiometricGuide,
    activeSuit,
    suitScale,
    suitOffsetX,
    suitOffsetY,
  ]);

  const drawBiometricGuides = (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => {
    if (!showBiometricGuide) return;
    ctx.save();
    ctx.lineWidth = 1.5;

    // Vertical Center Axis (Blue Dashed)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(targetWidth / 2, 0);
    ctx.lineTo(targetWidth / 2, targetHeight);
    ctx.stroke();

    // Crown Top Line (Green)
    const crownY = targetHeight * 0.12;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, crownY);
    ctx.lineTo(targetWidth, crownY);
    ctx.stroke();

    // Eye Level Line (Amber)
    const eyeY = targetHeight * 0.42;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, eyeY);
    ctx.lineTo(targetWidth, eyeY);
    ctx.stroke();

    // Chin Line (Red)
    const chinY = targetHeight * 0.78;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.beginPath();
    ctx.moveTo(0, chinY);
    ctx.lineTo(targetWidth, chinY);
    ctx.stroke();

    ctx.restore();
  };

  useEffect(() => {
    renderInteractiveCanvas();
  }, [renderInteractiveCanvas]);

  // Execute Sharp Server Processing for true 300 DPI single image
  const handleProcessServerPhoto = async () => {
    if (!rawImageSrc) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'অনুগ্রহ করে প্রথমে একটি ছবি আপলোড করুন।' : 'Please upload an image first.',
      });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage(null);

      // Extract composited client image data (including suit overlay)
      let imageToProcess = rawImageSrc;
      if (canvasRef.current) {
        // Temporarily render without guides for pristine capture
        imageToProcess = canvasRef.current.toDataURL('image/jpeg', 0.98);
      }

      const res = await passportApi.processPhoto({
        imageBase64: imageToProcess,
        presetId: selectedPresetId,
        rotation,
        brightness,
        contrast,
        backgroundColor,
      });

      if (res.data?.base64) {
        setProcessedSingleBase64(res.data.base64);
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `সফলভাবে ৩০০ DPI রেজোলিউশনে ছবি প্রসেস সম্পন্ন হয়েছে!`
              : `Processed at true 300 DPI (${res.data.widthPx}x${res.data.heightPx}px)!`,
        });
      }
    } catch (err: any) {
      console.error('Server processing error:', err);
      if (canvasRef.current) {
        const fallbackData = canvasRef.current.toDataURL('image/jpeg', 0.95);
        setProcessedSingleBase64(fallbackData);
        setStatusMessage({
          type: 'info',
          text: lang === 'bn' ? 'ব্রাউজার ক্যানভাসে ছবি সফলভাবে রেন্ডার হয়েছে।' : 'Processed locally in browser canvas.',
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Multi-Photo Print Sheet (4x6 or A4 with Cut Guidelines)
  const handleGenerateSheet = async () => {
    const sourceImage = processedSingleBase64 || (canvasRef.current ? canvasRef.current.toDataURL('image/jpeg', 0.98) : rawImageSrc);
    if (!sourceImage) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'প্রিন্ট শিট তৈরি করতে কোনো ছবি নেই।' : 'No photo available to arrange print sheet.',
      });
      return;
    }

    try {
      setIsGeneratingSheet(true);
      setStatusMessage(null);

      const res = await passportApi.generateSheet({
        imageBase64: sourceImage,
        presetId: selectedPresetId,
        sheetLayout,
        copies: Number(copies),
      });

      if (res.data?.sheetBase64) {
        setSheetPreviewBase64(res.data.sheetBase64);
        setStatusMessage({
          type: 'success',
          text:
            lang === 'bn'
              ? `${copies} কপি ছবি ${sheetLayout === '4x6' ? '৪R ফটো পেপারে' : 'A4 পেপারে'} অটো কাটিং মার্কসহ সাজানো হয়েছে!`
              : `Arranged ${copies} copies on ${sheetLayout} sheet with cut marks.`,
        });
      }
    } catch (err: any) {
      console.error('Sheet generation error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to generate print sheet',
      });
    } finally {
      setIsGeneratingSheet(false);
    }
  };

  // Download Single Photo (300 DPI)
  const handleDownloadSingle = () => {
    const imgData = processedSingleBase64 || (canvasRef.current ? canvasRef.current.toDataURL('image/jpeg', 0.98) : null);
    if (!imgData) return;
    const a = document.createElement('a');
    a.href = imgData;
    a.download = `passport-${activePreset?.id || 'photo'}-300dpi.jpg`;
    a.click();
  };

  // Download Sheet Image (300 DPI)
  const handleDownloadSheetImage = () => {
    if (!sheetPreviewBase64) return;
    const a = document.createElement('a');
    a.href = sheetPreviewBase64;
    a.download = `passport-sheet-${sheetLayout}-${copies}-copies.jpg`;
    a.click();
  };

  // Export 300 DPI Vector PDF
  const handleExportPdf = async () => {
    if (!sheetPreviewBase64) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'অনুগ্রহ করে প্রথমে প্রিন্ট শিট তৈরি করুন।' : 'Generate print sheet first.',
      });
      return;
    }
    try {
      setIsExportingPdf(true);
      const blob = await passportApi.exportPdf({
        sheetBase64: sheetPreviewBase64,
        sheetLayout,
        filename: `passport-print-${sheetLayout}.pdf`,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `passport-print-${sheetLayout}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'success',
        text: lang === 'bn' ? '৩০০ DPI প্রিন্ট রেডি PDF ডাউনলোড সম্পন্ন হয়েছে!' : 'Downloaded 300 DPI vector PDF.',
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to generate PDF export' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Direct Browser Print (Studiozly feature)
  const handleDirectPrint = () => {
    if (!sheetPreviewBase64) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'প্রিন্ট করতে আগে লেআউট শিট তৈরি করুন।' : 'Generate layout sheet before printing.',
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>DocuStudio - Print Sheet (${sheetLayout})</title>
          <style>
            @page {
              size: ${sheetLayout === '4x6' ? '4in 6in landscape' : 'A4 portrait'};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #FFF;
            }
            img {
              width: 100vw;
              height: 100vh;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${sheetPreviewBase64}" onload="window.print();window.close();" />
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Save Job to MongoDB
  const handleSaveJob = async () => {
    if (!rawImageSrc) {
      setStatusMessage({
        type: 'error',
        text: lang === 'bn' ? 'কাস্টমারের ছবি আপলোড ও প্রসেস করুন।' : 'Upload and process an image first.',
      });
      return;
    }
    try {
      setIsSaving(true);
      const res = await passportApi.saveJob({
        customerName: customerName || (lang === 'bn' ? 'সাধারণ কাস্টমার' : 'Walk-in Customer'),
        customerPhone,
        presetId: selectedPresetId,
        copies,
        sheetLayout,
        originalImageBase64: rawImageSrc,
        processedImageBase64: processedSingleBase64 || undefined,
        sheetImageBase64: sheetPreviewBase64 || undefined,
        notes,
        unitPrice,
      });

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `অর্ডার #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} সফলভাবে দোকানে সেভ হয়েছে!`
            : `Job #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} stored in Shop Queue!`,
      });
    } catch (err: any) {
      console.error('Save job error:', err);
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save passport job' });
    } finally {
      setIsSaving(false);
    }
  };

  // Open Saved Jobs Modal
  const handleOpenSavedJobs = async () => {
    setShowSavedModal(true);
    try {
      setLoadingSavedJobs(true);
      const res = await passportApi.listJobs();
      setSavedJobs(res.data || []);
    } catch (err: any) {
      console.error('Failed to list saved jobs:', err);
    } finally {
      setLoadingSavedJobs(false);
    }
  };

  // Restore Saved Job
  const handleLoadJob = (job: any) => {
    if (job.presetId) setSelectedPresetId(job.presetId);
    if (job.copies) setCopies(job.copies);
    if (job.sheetLayout) setSheetLayout(job.sheetLayout);
    if (job.customerName) setCustomerName(job.customerName);
    if (job.customerPhone) setCustomerPhone(job.customerPhone);
    if (job.unitPrice) setUnitPrice(job.unitPrice);
    if (job.notes) setNotes(job.notes);

    const original = job.originalImageUrl || job.originalImage;
    const processed = job.processedImageUrl || job.processedImage;
    const sheet = job.sheetImageUrl || job.sheetImage;

    if (original) setRawImageSrc(original);
    if (processed) setProcessedSingleBase64(processed);
    if (sheet) setSheetPreviewBase64(sheet);

    setShowSavedModal(false);
    setStatusMessage({
      type: 'info',
      text:
        lang === 'bn'
          ? `পূর্বের অর্ডার #${job.jobCode || job.jobNumber} (${job.customerName || 'Customer'}) লোড হয়েছে।`
          : `Loaded saved Job #${job.jobCode || job.jobNumber}`,
    });
  };

  // Filter saved jobs by phone or name
  const filteredSavedJobs = savedJobs.filter((j) => {
    if (!savedSearchQuery) return true;
    const q = savedSearchQuery.toLowerCase();
    return (
      (j.customerName && j.customerName.toLowerCase().includes(q)) ||
      (j.customerPhone && j.customerPhone.includes(q)) ||
      (j.jobCode && j.jobCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Hidden print iframe for direct silent print */}
      <iframe ref={printFrameRef} className="hidden" title="print-frame" />

      {/* Page Header with Bilingual Switch */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'bn' ? 'পাসপোর্ট ফটো স্টুডিও' : 'Passport Photo Studio'}
            </h1>
            <Badge variant="passport" size="sm" dot>
              {lang === 'bn' ? '৩০০ DPI ইঞ্জিন' : '300 DPI Engine'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'bn'
              ? '৩ সেকেন্ডে কাস্টমারের পাসপোর্ট ছবি তৈরি, কোট/স্যুট পরিবর্তন, অটো কাটিং মার্ক এবং ৪R/A4 প্রিন্ট শিট।'
              : 'Professional passport photo processing, suit replacement, country presets, and multi-copy print sheet arrangement.'}
          </p>
        </div>

        {/* Action Buttons & Language Switch */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Bengali / English Language Toggle */}
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
            disabled={isSaving || !rawImageSrc}
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

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Controls & Presets (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Country & Preset Selector */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '১. সাইজ ও কান্ট্রি প্রিসেট' : '1. Document Preset'}
            </h2>

            {loadingPresets ? (
              <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 border bg-white text-slate-900 font-medium"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {activePreset && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">{lang === 'bn' ? 'দেশ / সাইজ:' : 'Category:'}</span>
                  <span className="font-semibold">{activePreset.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-700">{lang === 'bn' ? 'পরিমাপ (mm):' : 'Dimensions:'}</span>
                  <span>
                    {activePreset.widthMm} x {activePreset.heightMm} mm ({activePreset.widthPx}x{activePreset.heightPx} px @ 300 DPI)
                  </span>
                </div>
                <p className="text-slate-500 pt-1 italic">{activePreset.description}</p>
              </div>
            )}
          </div>

          {/* 2. Image Source & Upload */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '২. কাস্টমারের ছবি' : '2. Customer Photo'}
            </h2>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-dashed border-blue-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? 'ছবি আপলোড করুন' : 'Upload Photo'}
              </button>
              <button
                type="button"
                onClick={loadDemoPhoto}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                title="Load sample test portrait"
              >
                {lang === 'bn' ? 'স্যাম্পল' : 'Sample'}
              </button>
            </div>
          </div>

          {/* 3. Virtual Suit / Attire Changer (কোট / স্যুট পরিবর্তন) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-indigo-600" />
                {lang === 'bn' ? '৩. কোট / স্যুট পরিবর্তন (Attire)' : '3. Virtual Suit / Attire'}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">
                Studiozly
              </span>
            </h2>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">
                {lang === 'bn' ? 'ফরমাল পোশাক নির্বাচন করুন' : 'Select Formal Attire'}
              </label>
              <select
                value={selectedSuitId}
                onChange={(e) => setSelectedSuitId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-medium text-slate-800"
              >
                {SUIT_TEMPLATES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === 'bn' ? s.nameBn : s.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSuitId !== 'none' && (
              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 space-y-3">
                {/* Suit Scale */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <ZoomIn className="w-3 h-3 text-indigo-600" />
                      {lang === 'bn' ? 'স্যুটের সাইজ (Scale):' : 'Suit Size:'}
                    </span>
                    <span className="font-bold">{suitScale}%</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="140"
                    value={suitScale}
                    onChange={(e) => setSuitScale(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Vertical Offset (Collar alignment) */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <MoveVertical className="w-3 h-3 text-indigo-600" />
                      {lang === 'bn' ? 'কলার পজিশন (Vertical):' : 'Collar Position:'}
                    </span>
                    <span className="font-bold">{suitOffsetY}%</span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="75"
                    value={suitOffsetY}
                    onChange={(e) => setSuitOffsetY(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Horizontal Offset */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <MoveHorizontal className="w-3 h-3 text-indigo-600" />
                      {lang === 'bn' ? 'বামে / ডানে (Horizontal):' : 'Horizontal Axis:'}
                    </span>
                    <span className="font-bold">{suitOffsetX}%</span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="65"
                    value={suitOffsetX}
                    onChange={(e) => setSuitOffsetX(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Color, Background & Enhancements */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৪. ব্যাকগ্রাউন্ড ও কালার এডজাস্ট' : '4. Background & Adjustments'}
            </h2>

            {/* Background Color Swatches */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-2">
                {lang === 'bn' ? 'ব্যাকগ্রাউন্ড কালার নির্বাচন' : 'Background Color'}
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {BG_COLORS.map((bg) => (
                  <button
                    key={bg.hex}
                    type="button"
                    onClick={() => setBackgroundColor(bg.hex)}
                    style={{ backgroundColor: bg.hex }}
                    className={`w-7 h-7 rounded-full border-2 shadow-sm transition-transform ${bg.border} ${
                      backgroundColor.toUpperCase() === bg.hex.toUpperCase()
                        ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    title={bg.name}
                  />
                ))}
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-7 h-7 rounded-full border border-slate-300 cursor-pointer p-0 overflow-hidden"
                  title="Custom Color"
                />
              </div>
            </div>

            {/* Manual Replacement Tolerance Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{lang === 'bn' ? 'টলারেন্স (ম্যানুয়াল এডজাস্ট):' : 'Edge Tolerance:'}</span>
                <span className="font-semibold">{bgTolerance}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={bgTolerance}
                onChange={(e) => setBgTolerance(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Brightness & Contrast */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-500" /> {lang === 'bn' ? 'উজ্জ্বলতা' : 'Brightness'}
                  </span>
                  <span className="font-semibold">{brightness}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>{lang === 'bn' ? 'কনট্রাস্ট' : 'Contrast'}</span>
                  <span className="font-semibold">{contrast}</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Rotation Controls */}
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev - 90) % 360)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 rounded flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5 transform -scale-x-100" /> -90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 rounded flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" /> +90°
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(0)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 rounded"
                >
                  {lang === 'bn' ? 'রিসেট' : 'Reset'}
                </button>
              </div>
            </div>

            {/* Biometric Face Guide Toggle */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                {lang === 'bn' ? 'বায়োমেট্রিক ফেস গাইড' : 'Biometric Face Overlay'}
              </span>
              <button
                type="button"
                onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showBiometricGuide ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showBiometricGuide ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 5. Customer Info & Quick Order */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              {lang === 'bn' ? '৫. কাস্টমারের তথ্য ও বিল' : '5. Customer & Billing'}
            </h2>
            <div>
              <label className="text-xs font-medium text-slate-600">
                {lang === 'bn' ? 'কাস্টমারের নাম' : 'Customer Name'}
              </label>
              <input
                type="text"
                placeholder={lang === 'bn' ? 'মোঃ রহিম' : 'Walk-in Customer'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                {lang === 'bn' ? 'মোবাইল নম্বর (SMS / রসিদ)' : 'Mobile Phone'}
              </label>
              <input
                type="text"
                placeholder="01700000000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'মূল্য (টাকা)' : 'Price (BDT)'}
                </label>
                <input
                  type="number"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 mt-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'মোট বিল' : 'Total'}
                </label>
                <div className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1">
                  ৳ {unitPrice}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Canvas, Sheet Generator & Export (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Interactive Studio Canvas Preview */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Crop className="w-5 h-5 text-blue-600" />
                  {lang === 'bn' ? 'পাসপোর্ট ছবির লাইভ প্রিভিউ' : 'Passport Portrait Preview'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'রিয়েল-টাইম ক্যানভাস প্রিভিউ ও হেড এলাইনমেন্ট গাইড।'
                    : 'Real-time interactive canvas with biometric head alignment guides.'}
                </p>
              </div>

              <button
                onClick={handleProcessServerPhoto}
                disabled={isProcessing || !rawImageSrc}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                {lang === 'bn' ? '৩০০ DPI প্রসেস করুন' : 'Render 300 DPI Sharp'}
              </button>
            </div>

            {/* Canvas Viewport */}
            <div className="relative min-h-[380px] bg-slate-950/5 rounded-xl border border-slate-200 flex items-center justify-center p-4 overflow-hidden">
              {rawImageSrc ? (
                <div className="relative shadow-xl rounded overflow-hidden max-w-full max-h-[460px]">
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label="Interactive photo editing canvas with biometric guide overlays"
                    className="max-h-[440px] max-w-full object-contain mx-auto"
                  >
                    Interactive photo editing canvas
                  </canvas>
                </div>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {lang === 'bn' ? 'কোনো ছবি আপলোড করা হয়নি' : 'No Image Selected'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      {lang === 'bn'
                        ? 'কাস্টমারের ছবি আপলোড করুন অথবা বামের "স্যাম্পল" বাটনে ক্লিক করে ট্রাই করুন।'
                        : "Upload a customer photo or click 'Sample' to test editing."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Guide Legend */}
            {showBiometricGuide && rawImageSrc && (
              <div className="flex items-center justify-center gap-6 text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                  {lang === 'bn' ? 'মাথার শীর্ষ (Crown)' : 'Crown Top'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  {lang === 'bn' ? 'চোখের লেভেল (Eye Level)' : 'Eye Alignment'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                  {lang === 'bn' ? 'চিবুক (Chin Line)' : 'Chin Bottom'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-blue-500 inline-block" />
                  {lang === 'bn' ? 'সেন্টার লাইন' : 'Center Axis'}
                </span>
              </div>
            )}

            {/* Single Photo Export Action */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleDownloadSingle}
                disabled={!rawImageSrc}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                {lang === 'bn' ? 'একক ছবি ডাউনলোড (৩০০ DPI JPG)' : 'Download Single Photo (300 DPI)'}
              </button>
            </div>
          </div>

          {/* Print Sheet Arrangement Module */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  {lang === 'bn' ? 'প্রিন্ট শিট ও কাটিং গ্রিড' : 'Print Sheet & Cutting Grid'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? '৪R ফটো পেপার বা A4 পেপারে একাধিক কপি ছবি ও কাটার জন্য অটো হেয়ারলাইন মার্ক।'
                    : 'Tile multiple copies onto 4x6 photo paper or A4 sheet with precision hairline cut marks.'}
                </p>
              </div>

              {/* Layout & Copies Configuration */}
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                    {lang === 'bn' ? 'পেপার সাইজ' : 'Format'}
                  </label>
                  <select
                    value={sheetLayout}
                    onChange={(e) => setSheetLayout(e.target.value as any)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                  >
                    <option value="4x6">{lang === 'bn' ? '৪R ফটো পেপার (4x6")' : '4 x 6 Photo Paper'}</option>
                    <option value="A4">{lang === 'bn' ? 'A4 ফুল শিট' : 'A4 Full Sheet'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                    {lang === 'bn' ? 'কপি সংখ্যা' : 'Copies'}
                  </label>
                  <select
                    value={copies}
                    onChange={(e) => setCopies(Number(e.target.value))}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                  >
                    <option value={1}>১ কপি (1 copy)</option>
                    <option value={2}>২ কপি (2 copies)</option>
                    <option value={4}>৪ কপি (4 copies)</option>
                    <option value={6}>৬ কপি (6 copies)</option>
                    <option value={8}>৮ কপি - স্ট্যান্ডার্ড ৪R (8 copies)</option>
                    <option value={12}>১২ কপি (12 copies)</option>
                    <option value={16}>১৬ কপি - A4 সাইজ (16 copies)</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleGenerateSheet}
                    disabled={isGeneratingSheet || !rawImageSrc}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {isGeneratingSheet ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scissors className="w-3.5 h-3.5" />
                    )}
                    {lang === 'bn' ? 'লেআউট তৈরি করুন' : 'Generate Layout'}
                  </button>
                </div>
              </div>
            </div>

            {/* Print Sheet Visual Preview */}
            <div className="relative min-h-[300px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center p-4">
              {sheetPreviewBase64 ? (
                <div className="relative shadow-2xl rounded border border-slate-300 bg-white p-1">
                  <img
                    src={sheetPreviewBase64}
                    alt="Print Sheet Preview"
                    className="max-h-[380px] max-w-full object-contain mx-auto"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-mono rounded">
                    {sheetLayout} • {copies} copies • 300 DPI
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Printer className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500">
                    {lang === 'bn'
                      ? 'কাটিং মার্কসহ প্রিন্ট শিট তৈরি করতে উপরের "লেআউট তৈরি করুন" বাটনে ক্লিক করুন।'
                      : 'Click "Generate Layout" to arrange copies with cut marks.'}
                  </p>
                </div>
              )}
            </div>

            {/* Export & Direct Print Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 flex-wrap">
              <button
                onClick={handleDirectPrint}
                disabled={!sheetPreviewBase64}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                title="Direct Browser Print / সরাসরি প্রিন্ট"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                {lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Direct Print'}
              </button>

              <button
                onClick={handleDownloadSheetImage}
                disabled={!sheetPreviewBase64}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                {lang === 'bn' ? 'শিট ছবি (JPG)' : 'Sheet JPG (300 DPI)'}
              </button>

              <button
                onClick={handleExportPdf}
                disabled={!sheetPreviewBase64 || isExportingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                {lang === 'bn' ? 'প্রিন্ট-রেডি PDF' : 'Print-Ready PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Jobs Modal with Fast Search */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'bn' ? 'দোকানের পূর্বের কাজের তালিকা' : 'Saved Passport Jobs'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Quick Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'কাস্টমারের নাম, মোবাইল নম্বর বা অর্ডার নম্বর দিয়ে খুঁজুন...' : 'Search by customer name, mobile, or job code...'}
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingSavedJobs ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {lang === 'bn' ? 'দোকানের ডাটাবেজ থেকে তথ্য লোড হচ্ছে...' : 'Loading saved jobs...'}
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
                        {job.processedImageUrl || job.processedImage || job.originalImageUrl || job.originalImage ? (
                          <img
                            src={job.processedImageUrl || job.processedImage || job.originalImageUrl || job.originalImage}
                            alt="Job thumbnail"
                            className="w-12 h-12 rounded object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                            <User className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {job.customerName || (lang === 'bn' ? 'সাধারণ কাস্টমার' : 'Walk-in')}
                            </span>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              #{job.jobCode || job.jobNumber}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {job.customerPhone && (
                              <span className="font-mono text-slate-600 mr-2">📱 {job.customerPhone}</span>
                            )}
                            {job.presetName || job.presetId} • {job.copies || 8} copies ({job.sheetLayout || '4x6'}) • ৳{' '}
                            {job.unitPrice || 100}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLoadJob(job)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        {lang === 'bn' ? 'পুনরায় ওপেন ও এডিট' : 'Re-open & Edit'}
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
