import { apiClient } from './client';
import { ApiResponse } from '../types';

export interface CvPersonalInfo {
  fullName: string;
  jobTitle?: string;
  email: string;
  phone: string;
  address?: string;
  website?: string;
  linkedin?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  nationality?: string;
  religion?: string;
  maritalStatus?: string;
  fatherName?: string;
  motherName?: string;
}

export interface CvExperienceItem {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface CvEducationItem {
  degree: string;
  institution: string;
  passingYear?: string;
  result?: string;
  boardOrMajor?: string;
}

export interface CvProjectItem {
  title: string;
  link?: string;
  description?: string;
}

export interface CvReferenceItem {
  name: string;
  designation?: string;
  company?: string;
  phone?: string;
  email?: string;
}

export interface CvData {
  personalInfo: CvPersonalInfo;
  objective?: string;
  experience: CvExperienceItem[];
  education: CvEducationItem[];
  skills: string[];
  projects: CvProjectItem[];
  languages: Array<{ name: string; proficiency?: string }>;
  references: CvReferenceItem[];
  customSections?: Array<{ title: string; content: string }>;
}

export interface DocumentTemplateField {
  key: string;
  label: string;
  labelBn?: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export interface DocumentTemplateItem {
  _id: string;
  category: 'APPLICATION' | 'AGREEMENT' | 'CERTIFICATE' | 'BUSINESS' | 'LEGAL';
  title: string;
  titleBn: string;
  description: string;
  language: 'BN' | 'EN' | 'BILINGUAL';
  version: number;
  isSystemTemplate: boolean;
  fields: DocumentTemplateField[];
  contentTemplate: string;
}

export const cvApi = {
  // CV Builder Endpoints
  exportCvPdf: async (payload: {
    cvData: CvData;
    templateId?: string;
    theme?: { primaryColor?: string; fontFamily?: string };
    filename?: string;
  }): Promise<Blob> => {
    const res = await apiClient.post('/cv/export-pdf', payload, {
      responseType: 'blob',
    });
    return res.data;
  },

  saveCv: async (payload: {
    customerName?: string;
    customerPhone?: string;
    language?: 'BN' | 'EN';
    templateId?: string;
    theme?: { primaryColor?: string; fontFamily?: string };
    cvData: CvData;
    copies?: number;
    totalAmount?: number;
    notes?: string;
  }): Promise<ApiResponse<any>> => {
    return (apiClient.post('/cv/jobs', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  listCvJobs: async (): Promise<ApiResponse<any[]>> => {
    return (apiClient.get('/cv/jobs') as unknown) as Promise<ApiResponse<any[]>>;
  },

  getCvJob: async (jobId: string): Promise<ApiResponse<any>> => {
    return (apiClient.get(`/cv/jobs/${jobId}`) as unknown) as Promise<ApiResponse<any>>;
  },

  // Ready-Made Document Templates Endpoints
  listTemplates: async (category?: string): Promise<ApiResponse<DocumentTemplateItem[]>> => {
    const query = category ? `?category=${category}` : '';
    return (apiClient.get(`/cv/templates${query}`) as unknown) as Promise<ApiResponse<DocumentTemplateItem[]>>;
  },

  getTemplate: async (templateId: string): Promise<ApiResponse<DocumentTemplateItem>> => {
    return (apiClient.get(`/cv/templates/${templateId}`) as unknown) as Promise<ApiResponse<DocumentTemplateItem>>;
  },

  renderDocument: async (payload: {
    contentTemplate: string;
    values: Record<string, any>;
  }): Promise<ApiResponse<{ renderedContent: string }>> => {
    return (apiClient.post('/cv/render-document', payload) as unknown) as Promise<ApiResponse<{ renderedContent: string }>>;
  },

  exportDocPdf: async (payload: {
    renderedContent: string;
    title?: string;
    filename?: string;
  }): Promise<Blob> => {
    const res = await apiClient.post('/cv/export-doc-pdf', payload, {
      responseType: 'blob',
    });
    return res.data;
  },

  saveReadyDoc: async (payload: {
    templateId: string;
    templateTitle: string;
    customerName?: string;
    customerPhone?: string;
    filledValues: Record<string, any>;
    renderedContent: string;
    copies?: number;
    totalAmount?: number;
    notes?: string;
  }): Promise<ApiResponse<any>> => {
    return (apiClient.post('/cv/ready-docs', payload) as unknown) as Promise<ApiResponse<any>>;
  },

  listReadyDocs: async (): Promise<ApiResponse<any[]>> => {
    return (apiClient.get('/cv/ready-docs') as unknown) as Promise<ApiResponse<any[]>>;
  },
};

