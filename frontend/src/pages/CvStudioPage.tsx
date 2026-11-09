import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  Printer,
  Download,
  Save,
  FolderOpen,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  HelpCircle,
  Languages,
  Palette,
  Search,
  BookOpen,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Globe,
  Sliders,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  cvApi,
  CvData,
  DocumentTemplateItem,
} from '../api/cv.api';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';

const CV_COLORS = [
  { name: 'Navy Blue', hex: '#1E3A8A' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Royal Maroon', hex: '#881337' },
  { name: 'Deep Slate', hex: '#334155' },
  { name: 'Indigo Purple', hex: '#4F46E5' },
];

export const CvStudioPage: React.FC = () => {
  // Bilingual: 'bn' (Bengali) | 'en' (English)
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Main Mode: 'cv' (CV Builder) | 'readymade' (Ready-made Documents)
  const [activeTab, setActiveTab] = useState<'cv' | 'readymade'>('cv');

  // --- CV BUILDER STATE ---
  const [templateId, setTemplateId] = useState<'modern' | 'classic' | 'bangla' | 'minimal'>('modern');
  const [primaryColor, setPrimaryColor] = useState<string>('#1E3A8A');

  const [cvData, setCvData] = useState<CvData>({
    personalInfo: {
      fullName: 'Mohammad Tanvir Ahmed',
      jobTitle: 'Senior Operations Executive',
      email: 'tanvir.ahmed@example.com',
      phone: '+880 1712 345678',
      address: 'House #12, Road #4, Dhanmondi, Dhaka-1205',
      dateOfBirth: '14 October 1995',
      nationality: 'Bangladeshi',
      religion: 'Islam',
      maritalStatus: 'Unmarried',
      fatherName: 'Md. Rafiqul Islam',
      motherName: 'Rashida Begum',
    },
    objective:
      'Dedicated, result-oriented professional with over 3 years of experience in business documentation, administrative operations, and team coordination. Seeking to leverage skills in a reputable organization to achieve operational excellence.',
    experience: [
      {
        title: 'Senior Operations Executive',
        company: 'Prime Global Logistics Ltd.',
        location: 'Motijheel, Dhaka',
        startDate: 'Jan 2023',
        endDate: 'Present',
        current: true,
        description: 'Managed commercial documentation, cross-functional client communications, billing workflows, and operational reporting.',
      },
      {
        title: 'Junior Admin Officer',
        company: 'Apex Business Center',
        location: 'Dhanmondi, Dhaka',
        startDate: 'Jul 2021',
        endDate: 'Dec 2022',
        current: false,
        description: 'Assisted in official correspondence, office record keeping, vendor payments, and inventory management.',
      },
    ],
    education: [
      {
        degree: 'Bachelor of Business Administration (BBA)',
        institution: 'University of Dhaka',
        passingYear: '2021',
        result: 'CGPA: 3.65 / 4.00',
        boardOrMajor: 'Finance & Management',
      },
      {
        degree: 'Higher Secondary Certificate (HSC)',
        institution: 'Dhaka City College',
        passingYear: '2016',
        result: 'GPA: 5.00 / 5.00',
        boardOrMajor: 'Science',
      },
    ],
    skills: [
      'Microsoft Office (Word, Excel, PowerPoint)',
      'Document Formatting & Archiving',
      'Data Entry & Billing Operations',
      'Client Communications',
      'Team Leadership',
    ],
    projects: [
      {
        title: 'Automated Billing & Invoicing System',
        description: 'Streamlined invoice generation and customer record keeping reducing manual errors by 40%.',
      },
    ],
    languages: [
      { name: 'Bangla', proficiency: 'Native / Mother Tongue' },
      { name: 'English', proficiency: 'Professional Working Proficiency' },
    ],
    references: [
      {
        name: 'Dr. Shahabuddin Ahmed',
        designation: 'Professor, Dept. of Management',
        company: 'University of Dhaka',
        phone: '+880 1819 000000',
        email: 'prof.shahab@du.ac.bd',
      },
    ],
  });

  const [newSkillInput, setNewSkillInput] = useState<string>('');
  const [cvCopies, setCvCopies] = useState<number>(1);
  const [cvUnitPrice, setCvUnitPrice] = useState<number>(50); // 50 BDT typical

  // --- READY-MADE DOCUMENTS STATE ---
  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplateItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [renderedDocText, setRenderedDocText] = useState<string>('');
  const [docCopies, setDocCopies] = useState<number>(1);
  const [docUnitPrice, setDocUnitPrice] = useState<number>(20); // 20 BDT typical

  // UI & Loading States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Saved Jobs Modal
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [savedCvJobs, setSavedCvJobs] = useState<any[]>([]);
  const [savedReadyDocs, setSavedReadyDocs] = useState<any[]>([]);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');
  const [loadingSavedJobs, setLoadingSavedJobs] = useState<boolean>(false);

  // Load templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await cvApi.listTemplates();
        if (res.data && res.data.length > 0) {
          setTemplates(res.data);
          setSelectedTemplate(res.data[0]);
          initTemplateFields(res.data[0]);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };
    fetchTemplates();
  }, []);

  const initTemplateFields = (tpl: DocumentTemplateItem) => {
    const initialVals: Record<string, any> = {};
    tpl.fields.forEach((f) => {
      initialVals[f.key] = f.defaultValue || '';
    });
    setFieldValues(initialVals);
    renderDocumentText(tpl.contentTemplate, initialVals);
  };

  const renderDocumentText = (contentTemplate: string, vals: Record<string, any>) => {
    let result = contentTemplate;
    Object.keys(vals).forEach((k) => {
      const regex = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      result = result.replace(regex, vals[k] || `[${k}]`);
    });
    setRenderedDocText(result);
  };

  // Handle Field Change in Ready-Made Form
  const handleFieldChange = (key: string, val: any) => {
    const updated = { ...fieldValues, [key]: val };
    setFieldValues(updated);
    if (selectedTemplate) {
      renderDocumentText(selectedTemplate.contentTemplate, updated);
    }
  };

  // Select Different Template
  const handleSelectTemplate = (tpl: DocumentTemplateItem) => {
    setSelectedTemplate(tpl);
    initTemplateFields(tpl);
  };

  // Add Skill Tag
  const handleAddSkill = () => {
    if (newSkillInput.trim()) {
      setCvData((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkillInput.trim()],
      }));
      setNewSkillInput('');
    }
  };

  // Remove Skill Tag
  const handleRemoveSkill = (index: number) => {
    setCvData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, idx) => idx !== index),
    }));
  };

  // Add Experience Entry
  const handleAddExperience = () => {
    setCvData((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          title: 'Job Designation',
          company: 'Company Name',
          startDate: '2022',
          endDate: 'Present',
          current: true,
          description: 'Key job responsibilities and achievements.',
        },
      ],
    }));
  };

  // Remove Experience Entry
  const handleRemoveExperience = (idx: number) => {
    setCvData((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== idx),
    }));
  };

  // Add Education Entry
  const handleAddEducation = () => {
    setCvData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          degree: 'Degree Name',
          institution: 'College / University Name',
          passingYear: '2022',
          result: 'CGPA / Grade',
        },
      ],
    }));
  };

  // Remove Education Entry
  const handleRemoveEducation = (idx: number) => {
    setCvData((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));
  };

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  // Export CV Vector PDF
  const handleExportCvPdf = async () => {
    try {
      setIsExportingPdf(true);
      const blob = await cvApi.exportCvPdf({
        cvData,
        templateId,
        theme: { primaryColor },
        filename: `${cvData.personalInfo.fullName.replace(/\s+/g, '-').toLowerCase()}-cv.pdf`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cvData.personalInfo.fullName.replace(/\s+/g, '-').toLowerCase()}-cv.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'success',
        text: lang === 'bn' ? '৩০০ DPI ভেক্টর CV PDF ডাউনলোড সম্পন্ন হয়েছে!' : 'Downloaded professional CV PDF.',
      });
    } catch (err: any) {
      console.error('CV PDF error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to generate CV PDF' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save CV Job
  const handleSaveCvJob = async () => {
    try {
      setIsSaving(true);
      const res = await cvApi.saveCv({
        customerName: cvData.personalInfo.fullName,
        customerPhone: cvData.personalInfo.phone,
        templateId,
        theme: { primaryColor },
        cvData,
        copies: cvCopies,
        totalAmount: cvCopies * cvUnitPrice,
      });

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `সিভি জব #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} দোকানে সেভ হয়েছে!`
            : `CV Job #${res.data?.jobCode || res.data?.jobNumber || 'Saved'} stored in Shop Queue!`,
      });
    } catch (err: any) {
      console.error('Save CV error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save CV job' });
    } finally {
      setIsSaving(false);
    }
  };

  // Export Ready-Made Document PDF
  const handleExportDocPdf = async () => {
    if (!renderedDocText || !selectedTemplate) return;
    try {
      setIsExportingPdf(true);
      const blob = await cvApi.exportDocPdf({
        renderedContent: renderedDocText,
        title: selectedTemplate.title,
        filename: `${selectedTemplate.title.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage({
        type: 'success',
        text: lang === 'bn' ? 'অফিসিয়াল ডকুমেন্ট PDF ডাউনলোড সম্পন্ন হয়েছে!' : 'Downloaded official document PDF.',
      });
    } catch (err: any) {
      console.error('Doc PDF error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to generate document PDF' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Save Ready-Made Document Job
  const handleSaveReadyDoc = async () => {
    if (!selectedTemplate || !renderedDocText) return;
    try {
      setIsSaving(true);
      const customerName = fieldValues.applicantName || fieldValues.tenantName || fieldValues.employeeName || 'Walk-in Customer';
      const customerPhone = fieldValues.applicantPhone || 'N/A';

      const res = await cvApi.saveReadyDoc({
        templateId: selectedTemplate._id,
        templateTitle: selectedTemplate.title,
        customerName,
        customerPhone,
        filledValues: fieldValues,
        renderedContent: renderedDocText,
        copies: docCopies,
        totalAmount: docCopies * docUnitPrice,
      });

      setStatusMessage({
        type: 'success',
        text:
          lang === 'bn'
            ? `ডকুমেন্ট #${res.data?.jobCode || 'Saved'} দোকানে সংরক্ষণ হয়েছে!`
            : `Document #${res.data?.jobCode || 'Saved'} stored in Shop Queue!`,
      });
    } catch (err: any) {
      console.error('Save Ready Doc error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save document record' });
    } finally {
      setIsSaving(false);
    }
  };

  // Open Saved History Modal
  const handleOpenSavedJobs = async () => {
    setShowSavedModal(true);
    try {
      setLoadingSavedJobs(true);
      if (activeTab === 'cv') {
        const res = await cvApi.listCvJobs();
        setSavedCvJobs(res.data || []);
      } else {
        const res = await cvApi.listReadyDocs();
        setSavedReadyDocs(res.data || []);
      }
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoadingSavedJobs(false);
    }
  };

  // Restore Saved CV
  const handleLoadCvJob = (job: any) => {
    if (job.cvData) setCvData(job.cvData);
    if (job.templateId) setTemplateId(job.templateId);
    if (job.theme?.primaryColor) setPrimaryColor(job.theme.primaryColor);
    setShowSavedModal(false);
    setStatusMessage({
      type: 'info',
      text: lang === 'bn' ? `পূর্বের সিভি #${job.jobCode} লোড হয়েছে।` : `Loaded saved CV #${job.jobCode}`,
    });
  };

  // Filter templates by category
  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {lang === 'bn' ? 'সিভি ও রেডিমেড ডকুমেন্টস মেকার' : 'CV Builder & Ready-made Documents'}
            </h1>
            <Badge variant="cv" size="sm" dot>
              {lang === 'bn' ? 'A4 ফরম্যাট' : 'A4 Vector Engine'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'bn'
              ? 'চাকরির প্রফেশনাল সিভি, বিয়ের বা চাকরির বায়োডাটা এবং বাড়ি ভাড়ার চুক্তিপত্র ও দরখাস্ত তৈরির আধুনিক প্ল্যাটফর্ম।'
              : 'Professional resume builder with multiple styles, localized Bengali Bio-data, and ready-made legal agreement templates.'}
          </p>
        </div>

        {/* Action Controls */}
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
            onClick={activeTab === 'cv' ? handleSaveCvJob : handleSaveReadyDoc}
            disabled={isSaving}
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            {lang === 'bn' ? 'দোকানে সেভ করুন' : 'Save to Queue'}
          </Button>
        </div>
      </div>

      {/* Main Mode Navigation Bar (CV Builder vs Ready-Made Docs) */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('cv')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'cv'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {lang === 'bn' ? '১. প্রফেশনাল সিভি মেকার (CV Builder)' : '1. Professional CV Builder'}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('readymade')}
          className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${
            activeTab === 'readymade'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          {lang === 'bn' ? '২. রেডিমেড চুক্তিপত্র ও দরখাস্ত (Ready-made Documents)' : '2. Ready-Made Document Templates'}
        </button>
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

      {/* ========================================================= */}
      {/* TAB 1: CV BUILDER MODULE                                  */}
      {/* ========================================================= */}
      {activeTab === 'cv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: CV Input Fields & Sections (5 cols) */}
          <div className="lg:col-span-5 space-y-5 print:hidden">
            {/* Template & Color Selection */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? 'টেমপ্লেট ও কালার থিম' : 'Templates & Color Theme'}
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'modern', name: 'Modern Executive', nameBn: 'মডার্ন এক্সিকিউটিভ' },
                  { id: 'classic', name: 'Classic Corporate', nameBn: 'ক্লাসিক ফরমাল' },
                  { id: 'bangla', name: 'Bangla Bio-data', nameBn: 'বাংলা বায়োডাটা' },
                  { id: 'minimal', name: 'Minimal Tech', nameBn: 'মিনিমাল ক্লিন' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id as any)}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-bold text-center transition-all ${
                      templateId === t.id
                        ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {lang === 'bn' ? t.nameBn : t.name}
                  </button>
                ))}
              </div>

              {/* Color Swatches */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  {lang === 'bn' ? 'থিম কালার:' : 'Accent Color:'}
                </span>
                <div className="flex items-center gap-2">
                  {CV_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setPrimaryColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        primaryColor === c.hex ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-105'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Section 1: Personal Information */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? '১. ব্যক্তিগত তথ্য (Personal Info)' : '1. Personal Information'}
              </h2>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'পুরো নাম' : 'Full Name'}</label>
                <input
                  type="text"
                  value={cvData.personalInfo.fullName}
                  onChange={(e) =>
                    setCvData({
                      ...cvData,
                      personalInfo: { ...cvData.personalInfo, fullName: e.target.value },
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded p-2 mt-1 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'পদবী / পেশা' : 'Job Title'}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.jobTitle || ''}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, jobTitle: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone'}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.phone}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, phone: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-2 mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email'}</label>
                <input
                  type="email"
                  value={cvData.personalInfo.email}
                  onChange={(e) =>
                    setCvData({
                      ...cvData,
                      personalInfo: { ...cvData.personalInfo, email: e.target.value },
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded p-2 mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Address'}</label>
                <input
                  type="text"
                  value={cvData.personalInfo.address || ''}
                  onChange={(e) =>
                    setCvData({
                      ...cvData,
                      personalInfo: { ...cvData.personalInfo, address: e.target.value },
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded p-2 mt-1"
                />
              </div>

              {/* Bio-data Extra fields (Father, Mother, DOB) */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'পিতার নাম' : "Father's Name"}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.fatherName || ''}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, fatherName: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'মাতার নাম' : "Mother's Name"}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.motherName || ''}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, motherName: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'জন্মতারিখ' : 'Date of Birth'}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.dateOfBirth || ''}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, dateOfBirth: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">{lang === 'bn' ? 'বৈবাহিক অবস্থা' : 'Marital Status'}</label>
                  <input
                    type="text"
                    value={cvData.personalInfo.maritalStatus || ''}
                    onChange={(e) =>
                      setCvData({
                        ...cvData,
                        personalInfo: { ...cvData.personalInfo, maritalStatus: e.target.value },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded p-1.5 mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Career Objective */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? '২. ক্যারিয়ার অবজেক্টিভ (Objective)' : '2. Career Objective'}
              </h2>
              <textarea
                rows={3}
                value={cvData.objective || ''}
                onChange={(e) => setCvData({ ...cvData, objective: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-blue-500"
              />
            </div>

            {/* Section 3: Work Experience */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  {lang === 'bn' ? '৩. কাজের অভিজ্ঞতা (Experience)' : '3. Work Experience'}
                </h2>
                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {lang === 'bn' ? 'যোগ করুন' : 'Add'}
                </button>
              </div>

              {cvData.experience.map((exp, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveExperience(idx)}
                    className="absolute top-2 right-2 text-rose-500 hover:text-rose-700"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Designation"
                      value={exp.title}
                      onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx].title = e.target.value;
                        setCvData({ ...cvData, experience: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Company"
                      value={exp.company}
                      onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx].company = e.target.value;
                        setCvData({ ...cvData, experience: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Jan 2022"
                      value={exp.startDate}
                      onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx].startDate = e.target.value;
                        setCvData({ ...cvData, experience: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Present / End Date"
                      value={exp.endDate}
                      onChange={(e) => {
                        const updated = [...cvData.experience];
                        updated[idx].endDate = e.target.value;
                        setCvData({ ...cvData, experience: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Section 4: Education */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  {lang === 'bn' ? '৪. শিক্ষাগত যোগ্যতা (Education)' : '4. Education'}
                </h2>
                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {lang === 'bn' ? 'যোগ করুন' : 'Add'}
                </button>
              </div>

              {cvData.education.map((edu, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveEducation(idx)}
                    className="absolute top-2 right-2 text-rose-500 hover:text-rose-700"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Degree (e.g. BBA / HSC)"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = [...cvData.education];
                        updated[idx].degree = e.target.value;
                        setCvData({ ...cvData, education: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Passing Year"
                      value={edu.passingYear || ''}
                      onChange={(e) => {
                        const updated = [...cvData.education];
                        updated[idx].passingYear = e.target.value;
                        setCvData({ ...cvData, education: updated });
                      }}
                      className="text-xs border border-slate-300 rounded p-1.5"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="College / University Name"
                    value={edu.institution}
                    onChange={(e) => {
                      const updated = [...cvData.education];
                      updated[idx].institution = e.target.value;
                      setCvData({ ...cvData, education: updated });
                    }}
                    className="w-full text-xs border border-slate-300 rounded p-1.5"
                  />
                </div>
              ))}
            </div>

            {/* Section 5: Skills */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? '৫. দক্ষতা ও পারদর্শিতা (Skills)' : '5. Skills'}
              </h2>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'নতুন দক্ষতা লিখুন...' : 'Add a skill...'}
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  className="flex-1 text-xs border border-slate-300 rounded p-2"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold"
                >
                  {lang === 'bn' ? 'যোগ' : 'Add'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {cvData.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 text-xs rounded-full border border-slate-200 font-medium"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(idx)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Live A4 CV Preview Deck (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-2 print:hidden">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  {lang === 'bn' ? 'A4 সাইজ সিভি লাইভ প্রিভিউ' : 'Live A4 CV Preview'}
                </h2>
                <span className="text-[11px] text-slate-500 font-mono">300 DPI High Resolution Layout</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'প্রিন্ট' : 'Print'}
                </button>

                <button
                  type="button"
                  onClick={handleExportCvPdf}
                  disabled={isExportingPdf}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {isExportingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {lang === 'bn' ? 'PDF ডাউনলোড' : 'Export PDF'}
                </button>
              </div>
            </div>

            {/* Live Visual A4 CV Paper Simulation */}
            <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none">
              <div
                className="a4-print-sheet print-avoid-break bg-white shadow-2xl rounded border border-slate-300 w-[595px] min-h-[842px] p-8 text-slate-800 text-xs space-y-4 select-text print:shadow-none print:border-none print:w-full print:p-8"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {/* CV Header */}
                <div className="p-6 rounded-lg text-white" style={{ backgroundColor: primaryColor }}>
                  <h1 className="text-xl font-bold tracking-tight uppercase">
                    {cvData.personalInfo.fullName || 'FULL NAME'}
                  </h1>
                  {cvData.personalInfo.jobTitle && (
                    <p className="text-xs font-medium text-slate-200 mt-1">{cvData.personalInfo.jobTitle}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300 mt-3 pt-2 border-t border-white/20">
                    {cvData.personalInfo.phone && <span>📱 {cvData.personalInfo.phone}</span>}
                    {cvData.personalInfo.email && <span>✉️ {cvData.personalInfo.email}</span>}
                    {cvData.personalInfo.address && <span>📍 {cvData.personalInfo.address}</span>}
                  </div>
                </div>

                {/* Objective */}
                {cvData.objective && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                      {templateId === 'bangla' ? 'ক্যারিয়ার উদ্দেশ্য' : 'Career Objective'}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-2">{cvData.objective}</p>
                  </div>
                )}

                {/* Experience */}
                {cvData.experience.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                      {templateId === 'bangla' ? 'কাজের অভিজ্ঞতা' : 'Work Experience'}
                    </h3>
                    <div className="space-y-3 mt-2">
                      {cvData.experience.map((exp, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between items-baseline font-bold text-slate-900 text-xs">
                            <span>{exp.title}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold" style={{ color: primaryColor }}>
                            {exp.company}
                          </p>
                          {exp.description && (
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {cvData.education.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                      {templateId === 'bangla' ? 'শিক্ষাগত যোগ্যতা' : 'Education & Qualifications'}
                    </h3>
                    <div className="space-y-2.5 mt-2">
                      {cvData.education.map((edu, idx) => (
                        <div key={idx} className="flex justify-between items-baseline">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">{edu.degree}</span>
                            <p className="text-[11px] text-slate-600">{edu.institution}</p>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {edu.passingYear && <div>{edu.passingYear}</div>}
                            {edu.result && <div className="font-semibold text-slate-700">{edu.result}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {cvData.skills.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                      {templateId === 'bangla' ? 'দক্ষতা সমূহ' : 'Skills & Competencies'}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cvData.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-800">
                          • {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bio-data Attributes */}
                {(cvData.personalInfo.fatherName || cvData.personalInfo.dateOfBirth) && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2" style={{ color: primaryColor, borderColor: primaryColor }}>
                      {templateId === 'bangla' ? 'ব্যক্তিগত পরিচিতি' : 'Personal Details'}
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-[11px] text-slate-600">
                      {cvData.personalInfo.fatherName && <div><span className="font-semibold text-slate-800">Father's Name:</span> {cvData.personalInfo.fatherName}</div>}
                      {cvData.personalInfo.motherName && <div><span className="font-semibold text-slate-800">Mother's Name:</span> {cvData.personalInfo.motherName}</div>}
                      {cvData.personalInfo.dateOfBirth && <div><span className="font-semibold text-slate-800">Date of Birth:</span> {cvData.personalInfo.dateOfBirth}</div>}
                      {cvData.personalInfo.nationality && <div><span className="font-semibold text-slate-800">Nationality:</span> {cvData.personalInfo.nationality}</div>}
                      {cvData.personalInfo.maritalStatus && <div><span className="font-semibold text-slate-800">Marital Status:</span> {cvData.personalInfo.maritalStatus}</div>}
                      {cvData.personalInfo.religion && <div><span className="font-semibold text-slate-800">Religion:</span> {cvData.personalInfo.religion}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: READY-MADE DOCUMENTS MODULE                        */}
      {/* ========================================================= */}
      {activeTab === 'readymade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Category & Dynamic Template Form (5 cols) */}
          <div className="lg:col-span-5 space-y-5 print:hidden">
            {/* Template Selector Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                {lang === 'bn' ? 'রেডিমেড টেমপ্লেট নির্বাচন' : 'Select Document Template'}
              </h2>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['', 'APPLICATION', 'AGREEMENT', 'CERTIFICATE'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat === ''
                      ? lang === 'bn'
                        ? 'সব টেমপ্লেট'
                        : 'All'
                      : cat === 'APPLICATION'
                      ? lang === 'bn'
                        ? 'দরখাস্ত'
                        : 'Application'
                      : cat === 'AGREEMENT'
                      ? lang === 'bn'
                        ? 'চুক্তিপত্র'
                        : 'Agreement'
                      : lang === 'bn'
                      ? 'সনদপত্র'
                      : 'Certificate'}
                  </button>
                ))}
              </div>

              {/* Template dropdown list */}
              <select
                value={selectedTemplate?._id || ''}
                onChange={(e) => {
                  const tpl = templates.find((t) => t._id === e.target.value);
                  if (tpl) handleSelectTemplate(tpl);
                }}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-bold text-slate-800"
              >
                {filteredTemplates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {lang === 'bn' ? t.titleBn : t.title}
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded border border-slate-100">
                  {selectedTemplate.description}
                </p>
              )}
            </div>

            {/* Dynamic Fillable Form Fields */}
            {selectedTemplate && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  {lang === 'bn' ? 'তথ্য পূরণ করুন (Fill Details)' : 'Fill Required Details'}
                </h2>

                <div className="space-y-3">
                  {selectedTemplate.fields.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        {lang === 'bn' && f.labelBn ? f.labelBn : f.label}
                        {f.required && <span className="text-rose-500 ml-1">*</span>}
                      </label>

                      {f.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={fieldValues[f.key] || ''}
                          placeholder={f.placeholder}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          value={fieldValues[f.key] || ''}
                          placeholder={f.placeholder}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-blue-500 font-medium"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Live Formatted Document Preview (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-2 print:hidden">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  {selectedTemplate?.title || 'Document Preview'}
                </h2>
                <span className="text-[11px] text-slate-500 font-mono">Official A4 Ready-to-Print Format</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'সরাসরি প্রিন্ট' : 'Direct Print'}
                </button>

                <button
                  type="button"
                  onClick={handleExportDocPdf}
                  disabled={isExportingPdf || !renderedDocText}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {isExportingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {lang === 'bn' ? 'PDF ডাউনলোড' : 'Export PDF'}
                </button>
              </div>
            </div>

            {/* Official Paper Render Simulation */}
            <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 overflow-x-auto flex justify-center print:bg-white print:p-0 print:border-none">
              <div
                id="printable-cv-sheet"
                className="a4-print-sheet print-avoid-break bg-white shadow-2xl rounded border border-slate-300 w-[595px] min-h-[842px] p-12 text-slate-900 text-xs leading-relaxed space-y-6 select-text print:shadow-none print:border-none print:w-full print:p-8"
              >
                <div className="text-center pb-4 border-b border-slate-200">
                  <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
                    {selectedTemplate ? selectedTemplate.title : 'OFFICIAL DOCUMENT'}
                  </h1>
                </div>

                <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-6">
                  {renderedDocText}
                </div>
              </div>
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
                  {lang === 'bn' ? 'পূর্বের সংরক্ষিত রেকর্ড' : 'Saved Records'}
                </h3>
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingSavedJobs ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading records...</div>
              ) : activeTab === 'cv' ? (
                savedCvJobs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No saved CV records found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {savedCvJobs.map((j) => (
                      <div key={j._id} className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg">
                        <div>
                          <span className="font-semibold text-sm text-slate-900">{j.customerName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 ml-2">
                            #{j.jobCode}
                          </span>
                          <p className="text-xs text-slate-500">
                            {j.templateId} template • ৳ {j.totalAmount} • {new Date(j.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleLoadCvJob(j)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                          {lang === 'bn' ? 'পুনরায় ওপেন' : 'Re-open'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : savedReadyDocs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No saved document records found.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {savedReadyDocs.map((j) => (
                    <div key={j._id} className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg">
                      <div>
                        <span className="font-semibold text-sm text-slate-900">{j.templateTitle}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 ml-2">
                          #{j.jobCode}
                        </span>
                        <p className="text-xs text-slate-500">
                          {j.customerName} • ৳ {j.totalAmount} • {new Date(j.createdAt).toLocaleDateString()}
                        </p>
                      </div>
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

