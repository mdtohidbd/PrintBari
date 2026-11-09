import PDFDocument from 'pdfkit';
import mongoose from 'mongoose';
import {
  Document as DocxDocument,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from 'docx';
import { CvJob, ICvJob, ICvData } from '../../models/CvJob.model';
import { CvTemplateModel, ICvTemplate } from '../../models/CvTemplate.model';
import {
  DocumentTemplate,
  IDocumentTemplate,
  ReadyDocumentJob,
  IReadyDocumentJob,
  TemplateCategory,
} from '../../models/DocumentTemplate.model';
import { Job } from '../../models/Job.model';
import { Tenant } from '../../models/Tenant.model';
import { BadRequestError, NotFoundError } from '../../errors';
import { configCache } from '../../utils/configCache';
import { FontManager } from '../../utils/fontManager';

export const INITIAL_SYSTEM_TEMPLATES = [
  {
    category: 'APPLICATION' as TemplateCategory,
    title: 'General Job Application Letter',
    titleBn: 'চাকরির আবেদনপত্র (জেনারেল দরখাস্ত)',
    description: 'Standard formal job application letter for private companies and institutions.',
    language: 'BN' as const,
    version: 1,
    isSystemTemplate: true,
    fields: [
      { key: 'applicationDate', label: 'Date', labelBn: 'তারিখ', type: 'date' as const, defaultValue: new Date().toISOString().slice(0, 10), required: true },
      { key: 'recipientDesignation', label: 'Recipient Title', labelBn: 'বরাবর (পদবী)', type: 'text' as const, defaultValue: 'ব্যবস্থাপনা পরিচালক / মানবসম্পদ বিভাগ', required: true },
      { key: 'companyName', label: 'Company / Organization', labelBn: 'প্রতিষ্ঠানের নাম', type: 'text' as const, placeholder: 'উদা: এবিসি এন্টারপ্রাইজ', required: true },
      { key: 'companyAddress', label: 'Company Address', labelBn: 'প্রতিষ্ঠানের ঠিকানা', type: 'text' as const, placeholder: 'উদা: ধানমন্ডি, ঢাকা-১২০৫', required: true },
      { key: 'postTitle', label: 'Applied Post Name', labelBn: 'আবেদিত পদের নাম', type: 'text' as const, placeholder: 'উদা: অ্যাকাউন্ট্যান্ট / অফিস সহকারী', required: true },
      { key: 'applicantName', label: 'Applicant Name', labelBn: 'আবেদনকারীর নাম', type: 'text' as const, required: true },
      { key: 'applicantPhone', label: 'Mobile Number', labelBn: 'মোবাইল নম্বর', type: 'text' as const, required: true },
      { key: 'applicantAddress', label: 'Present Address', labelBn: 'বর্তমান ঠিকানা', type: 'textarea' as const, required: true },
    ],
    contentTemplate: `বরাবর,
{{recipientDesignation}}
{{companyName}}
{{companyAddress}}

বিষয়: {{postTitle}} পদে নিয়োগের জন্য আবেদন।

মহোদয়,
বিনীত নিবেদন এই যে, বিগত [তারিখ] তারিখে আপনার প্রতিষ্ঠানে প্রকাশিত বিজ্ঞপ্তির মাধ্যমে আমি জানতে পারলাম যে আপনার প্রতিষ্ঠানে "{{postTitle}}" পদে লোক নিয়োগ করা হবে। আমি উক্ত পদের একজন আগ্রহী প্রার্থী হিসেবে আমার শিক্ষাগত যোগ্যতা ও জীবনবৃত্তান্ত (CV) আপনার সদয় বিবেচনার জন্য পেশ করছি।

আমার শিক্ষাগত যোগ্যতা এবং পেশাগত দক্ষতা আপনার প্রতিষ্ঠানের উল্লিখিত পদের দায়িত্ব সুষ্ঠুভাবে সম্পাদনে সহায়ক হবে বলে আমি দৃঢ়ভাবে বিশ্বাস করি।

অতএব, বিনীত প্রার্থনা এই যে, আমার শিক্ষাগত যোগ্যতা ও জীবনবৃত্তান্ত পর্যালোচনা করে আমাকে উক্ত পদে নিয়োগ দানে আপনার সদয় মর্জি হয়।

বিনীত নিবেদক,
{{applicantName}}
মোবাইল: {{applicantPhone}}
ঠিকানা: {{applicantAddress}}
তারিখ: {{applicationDate}}`,
  },
  {
    category: 'AGREEMENT' as TemplateCategory,
    title: 'House Rent Agreement',
    titleBn: 'বাড়ি ভাড়ার চুক্তিপত্র (House Rent Agreement)',
    description: 'Formal tenancy agreement contract between landlord and tenant in Bangladesh.',
    language: 'BN' as const,
    version: 1,
    isSystemTemplate: true,
    fields: [
      { key: 'agreementDate', label: 'Agreement Date', labelBn: 'চুক্তির তারিখ', type: 'date' as const, defaultValue: new Date().toISOString().slice(0, 10), required: true },
      { key: 'landlordName', label: 'Landlord Name (মালিক)', labelBn: 'বাড়ির মালিকের নাম', type: 'text' as const, required: true },
      { key: 'landlordNid', label: 'Landlord NID', labelBn: 'মালিকের NID নম্বর', type: 'text' as const, required: true },
      { key: 'tenantName', label: 'Tenant Name (ভাড়াটিয়া)', labelBn: 'ভাড়াটিয়ার নাম', type: 'text' as const, required: true },
      { key: 'tenantNid', label: 'Tenant NID', labelBn: 'ভাড়াটিয়ার NID নম্বর', type: 'text' as const, required: true },
      { key: 'houseAddress', label: 'Rented House Address', labelBn: 'ভাড়াকৃত বাসার ঠিকানা', type: 'textarea' as const, required: true },
      { key: 'monthlyRent', label: 'Monthly Rent (BDT)', labelBn: 'মাসিক ভাড়া (টাকা)', type: 'number' as const, defaultValue: '12000', required: true },
      { key: 'advanceDeposit', label: 'Security Deposit (BDT)', labelBn: 'অগ্রিম জামানত (টাকা)', type: 'number' as const, defaultValue: '24000', required: true },
      { key: 'tenancyDuration', label: 'Tenancy Duration', labelBn: 'চুক্তির মেয়াদ', type: 'text' as const, defaultValue: '১ (এক) বছর', required: true },
    ],
    contentTemplate: `বিসমিল্লাহির রাহমানির রাহিম
বাড়ি ভাড়ার দ্বিপাক্ষিক চুক্তিপত্র

১ম পক্ষ (মালিক):
নাম: {{landlordName}}, জাতীয় পরিচয়পত্র নম্বর: {{landlordNid}}।

২য় পক্ষ (ভাড়াটিয়া):
নাম: {{tenantName}}, জাতীয় পরিচয়পত্র নম্বর: {{tenantNid}}।

ভাড়াকৃত সম্পত্তির বিবরণ: {{houseAddress}}।

শর্তাবলী:
১. এই চুক্তিপত্রের মেয়াদ আগামী {{agreementDate}} তারিখ হইতে পরবর্তী {{tenancyDuration}} পর্যন্ত বলবৎ থাকিবে।
২. মাসিক ভাড়া বাবদ প্রতি মাসে সর্বমোট {{monthlyRent}}/- (টাকা) ধার্য করা হইল, যাহা পরবর্তী মাসের ১০ তারিখের মধ্যে ২য় পক্ষ ১ম পক্ষকে পরিশোধ করিতে বাধ্য থাকিবেন।
৩. ২য় পক্ষ ১ম পক্ষকে অগ্রিম জামানত বাবদ {{advanceDeposit}}/- (টাকা) প্রদান করিলেন, যাহা চুক্তি সমাপ্তিকালে কোনো দেনা না থাকিলে ফেরতযোগ্য।
৪. ২য় পক্ষ ভাড়াকৃত বাসাকে কেবল আবাসিক কাজে ব্যবহার করিবেন এবং কোনো অসামাজিক বা অবৈধ কাজ করিবেন না।
৫. বিদ্যুৎ, গ্যাস ও পানির বিল প্রতি মাসে বিল প্রাপ্তির পর ভাড়ার সাথে বা যথানিয়মে পরিশোধ করিতে হইবে।

উভয় পক্ষ স্বেচ্ছায়, সজ্ঞানে অত্র চুক্তিপত্রে নিজ নিজ স্বাক্ষর প্রদান করিলেন।

১ম পক্ষের স্বাক্ষর (মালিক): _______________________
২য় পক্ষের স্বাক্ষর (ভাড়াটিয়া): _______________________
তারিখ: {{agreementDate}}`,
  },
  {
    category: 'CERTIFICATE' as TemplateCategory,
    title: 'Experience Certificate',
    titleBn: 'অভিজ্ঞতার সনদপত্র (Work Experience Certificate)',
    description: 'Official employee work experience clearance certificate.',
    language: 'EN' as const,
    version: 1,
    isSystemTemplate: true,
    fields: [
      { key: 'issueDate', label: 'Issue Date', labelBn: 'ইস্যু তারিখ', type: 'date' as const, defaultValue: new Date().toISOString().slice(0, 10), required: true },
      { key: 'employeeName', label: 'Employee Name', labelBn: 'কর্মচারীর নাম', type: 'text' as const, required: true },
      { key: 'designation', label: 'Designation / Role', labelBn: 'পদবী', type: 'text' as const, defaultValue: 'Senior Executive', required: true },
      { key: 'department', label: 'Department', labelBn: 'বিভাগ', type: 'text' as const, defaultValue: 'Operations & Accounts' },
      { key: 'startDate', label: 'Employment Start Date', labelBn: 'যোগদানের তারিখ', type: 'date' as const, required: true },
      { key: 'endDate', label: 'Employment End Date', labelBn: 'শেষ কর্মদিবস', type: 'date' as const, required: true },
      { key: 'companyName', label: 'Company Name', labelBn: 'কোম্পানির নাম', type: 'text' as const, required: true },
      { key: 'authorizerName', label: 'Authorizer Name', labelBn: 'অনুমোদনকারীর নাম', type: 'text' as const, defaultValue: 'Managing Director' },
    ],
    contentTemplate: `TO WHOM IT MAY CONCERN

Date: {{issueDate}}

This is to certify that Mr./Ms. {{employeeName}} was employed with {{companyName}} as a {{designation}} in the {{department}} from {{startDate}} to {{endDate}}.

During their tenure with us, we found them to be sincere, hardworking, dedicated, and professionally competent. Their conduct and character were exemplary throughout their service period.

We have no objections to their seeking employment elsewhere and wish them all the success in their future professional endeavors.

Sincerely,

_________________________
{{authorizerName}}
{{companyName}}`,
  },
];

export class CvService {
  /**
   * Initialize default system templates if not present in database
   */
  public async ensureSystemTemplates(): Promise<void> {
    for (const tpl of INITIAL_SYSTEM_TEMPLATES) {
      const exists = await DocumentTemplate.findOne({
        title: tpl.title,
        isSystemTemplate: true,
      });
      if (!exists) {
        await DocumentTemplate.create(tpl);
      }
    }
  }

  /**
   * Render Template text by substituting {{variable}} placeholders
   */
  public renderTemplate(contentTemplate: string, values: Record<string, any>): string {
    return contentTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return values[key] !== undefined && values[key] !== null ? String(values[key]) : `[${key}]`;
    });
  }

  /**
   * Construct professional 300 DPI vector PDF for CV with multi-font Unicode Bangla & English handling
   */
  public generateCvPdf(
    cvData: ICvData,
    templateId: string = 'modern',
    theme: { primaryColor?: string; fontFamily?: string } = {}
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Standard A4: 595.28 x 841.89 pt
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36, // 0.5 inch margins
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const { hasBengaliSupport } = FontManager.setupDocumentFonts(doc as any);
      const isBengali = FontManager.isBengaliText(JSON.stringify(cvData));
      const regularFont = isBengali && hasBengaliSupport ? 'Bengali' : 'Helvetica';
      const boldFont = isBengali && hasBengaliSupport ? 'Bengali' : 'Helvetica-Bold';

      const primary = theme.primaryColor || '#1E3A8A';
      const p = cvData.personalInfo;

      // Header Banner (Modern Style)
      doc.rect(36, 36, 523.28, 70).fill(primary);

      doc.fillColor('#FFFFFF').fontSize(22).font(boldFont);
      doc.text(p.fullName || 'FULL NAME', 50, 48, { width: 495 });

      if (p.jobTitle) {
        doc.fontSize(11).font(regularFont).fillColor('#E2E8F0');
        doc.text(p.jobTitle, 50, 75, { width: 495 });
      }

      // Contact bar directly beneath header
      doc.fillColor('#334155').fontSize(9).font(regularFont);
      const contactLine = [p.phone, p.email, p.address].filter(Boolean).join('  |  ');
      doc.text(contactLine, 36, 115, { width: 523.28, align: 'center' });

      doc.moveTo(36, 130).lineTo(559.28, 130).strokeColor('#CBD5E1').lineWidth(1).stroke();

      let currentY = 145;

      // Helper function for Section Titles
      const drawSectionHeader = (title: string) => {
        doc.fillColor(primary).fontSize(12).font(boldFont);
        doc.text(title.toUpperCase(), 36, currentY);
        currentY += 16;
        doc.moveTo(36, currentY).lineTo(559.28, currentY).strokeColor(primary).lineWidth(1.5).stroke();
        currentY += 8;
      };

      // 1. Career Objective / Summary
      if (cvData.objective) {
        drawSectionHeader('Career Objective');
        doc.fillColor('#1E293B').fontSize(9.5).font(regularFont);
        doc.text(cvData.objective, 36, currentY, { width: 523.28, lineGap: 3 });
        currentY += doc.heightOfString(cvData.objective, { width: 523.28 }) + 14;
      }

      // 2. Work Experience
      if (Array.isArray(cvData.experience) && cvData.experience.length > 0) {
        drawSectionHeader('Work Experience');
        for (const exp of cvData.experience) {
          doc.fillColor('#0F172A').fontSize(10.5).font(boldFont);
          doc.text(exp.title || 'Role', 36, currentY);

          const dateStr = [exp.startDate, exp.current ? 'Present' : exp.endDate].filter(Boolean).join(' - ');
          doc.fillColor('#64748B').fontSize(9).font(regularFont);
          doc.text(dateStr, 36, currentY, { align: 'right', width: 523.28 });

          currentY += 14;
          doc.fillColor(primary).fontSize(9.5).font(boldFont);
          doc.text(exp.company || '', 36, currentY);
          currentY += 12;

          if (exp.description) {
            doc.fillColor('#334155').fontSize(9).font(regularFont);
            doc.text(exp.description, 36, currentY, { width: 523.28, lineGap: 2 });
            currentY += doc.heightOfString(exp.description, { width: 523.28 }) + 6;
          }
          currentY += 6;
        }
        currentY += 6;
      }

      // 3. Education
      if (Array.isArray(cvData.education) && cvData.education.length > 0) {
        drawSectionHeader('Education & Qualifications');
        for (const edu of cvData.education) {
          doc.fillColor('#0F172A').fontSize(10).font(boldFont);
          doc.text(edu.degree || 'Degree', 36, currentY);

          if (edu.passingYear) {
            doc.fillColor('#64748B').fontSize(9).font(regularFont);
            doc.text(`Year: ${edu.passingYear}`, 36, currentY, { align: 'right', width: 523.28 });
          }
          currentY += 13;

          doc.fillColor('#334155').fontSize(9).font(regularFont);
          const eduDetail = [edu.institution, edu.result ? `Result: ${edu.result}` : ''].filter(Boolean).join('  •  ');
          doc.text(eduDetail, 36, currentY);
          currentY += 15;
        }
        currentY += 6;
      }

      // 4. Skills (Badges / Tags)
      if (Array.isArray(cvData.skills) && cvData.skills.length > 0) {
        drawSectionHeader('Skills & Competencies');
        doc.fillColor('#1E293B').fontSize(9).font(regularFont);
        const skillText = cvData.skills.join('   •   ');
        doc.text(skillText, 36, currentY, { width: 523.28, lineGap: 3 });
        currentY += doc.heightOfString(skillText, { width: 523.28 }) + 14;
      }

      // 5. Personal Details / Bio-Data Attributes
      if (p.fatherName || p.dateOfBirth || p.nationality || p.maritalStatus) {
        drawSectionHeader('Personal Details');
        doc.fillColor('#334155').fontSize(9).font(regularFont);
        const bioDetails = [
          p.fatherName ? `Father's Name: ${p.fatherName}` : '',
          p.motherName ? `Mother's Name: ${p.motherName}` : '',
          p.dateOfBirth ? `Date of Birth: ${p.dateOfBirth}` : '',
          p.nationality ? `Nationality: ${p.nationality}` : '',
          p.maritalStatus ? `Marital Status: ${p.maritalStatus}` : '',
          p.religion ? `Religion: ${p.religion}` : '',
        ].filter(Boolean);

        for (const b of bioDetails) {
          doc.text(b, 36, currentY);
          currentY += 12;
        }
      }

      doc.end();
    });
  }

  /**
   * Construct professional Microsoft Word (.docx) document for CV
   */
  public async generateCvDocx(
    cvData: ICvData,
    templateId: string = 'modern',
    theme: { primaryColor?: string } = {}
  ): Promise<Buffer> {
    const primary = (theme.primaryColor || '#1E3A8A').replace('#', '');
    const p = cvData.personalInfo;

    const children: Paragraph[] = [];

    // Header Title (Name)
    children.push(
      new Paragraph({
        text: (p.fullName || 'FULL NAME').toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 60 },
      })
    );

    if (p.jobTitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: p.jobTitle,
              italics: true,
              size: 24,
              color: primary,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        })
      );
    }

    // Contact details bar
    const contactParts = [p.phone, p.email, p.address].filter(Boolean);
    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: contactParts.join('  |  '),
              size: 19,
              color: '555555',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 250 },
        })
      );
    }

    // Helper for Section Headings
    const addSection = (headingText: string) => {
      children.push(
        new Paragraph({
          text: headingText.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        })
      );
    };

    // 1. Objective / Summary
    if (cvData.objective) {
      addSection('Career Objective');
      children.push(
        new Paragraph({
          children: [new TextRun({ text: cvData.objective, size: 21 })],
          spacing: { after: 160 },
        })
      );
    }

    // 2. Experience
    if (Array.isArray(cvData.experience) && cvData.experience.length > 0) {
      addSection('Work Experience');
      for (const exp of cvData.experience) {
        const dateStr = [exp.startDate, exp.current ? 'Present' : exp.endDate].filter(Boolean).join(' - ');
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: exp.title || '', bold: true, size: 22 }),
              new TextRun({ text: exp.company ? `  —  ${exp.company}` : '', color: primary, size: 21 }),
              new TextRun({ text: dateStr ? `  (${dateStr})` : '', italics: true, color: '666666', size: 20 }),
            ],
            spacing: { before: 60, after: 40 },
          })
        );
        if (exp.description) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: exp.description, size: 20 })],
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          );
        }
      }
    }

    // 3. Education
    if (Array.isArray(cvData.education) && cvData.education.length > 0) {
      addSection('Education & Qualifications');
      for (const edu of cvData.education) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: edu.degree || '', bold: true, size: 21 }),
              new TextRun({ text: edu.institution ? `  •  ${edu.institution}` : '', size: 20 }),
              new TextRun({ text: edu.passingYear ? `  (${edu.passingYear})` : '', italics: true, color: '666666', size: 19 }),
              new TextRun({ text: edu.result ? `  •  Result: ${edu.result}` : '', size: 20 }),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }

    // 4. Skills
    if (Array.isArray(cvData.skills) && cvData.skills.length > 0) {
      addSection('Skills & Competencies');
      children.push(
        new Paragraph({
          children: [new TextRun({ text: cvData.skills.join('  •  '), size: 21 })],
          spacing: { after: 120 },
        })
      );
    }

    // 5. Personal Details
    if (p.fatherName || p.dateOfBirth || p.nationality || p.maritalStatus) {
      addSection('Personal Details');
      const bioFields = [
        p.fatherName ? `Father's Name: ${p.fatherName}` : '',
        p.motherName ? `Mother's Name: ${p.motherName}` : '',
        p.dateOfBirth ? `Date of Birth: ${p.dateOfBirth}` : '',
        p.nationality ? `Nationality: ${p.nationality}` : '',
        p.maritalStatus ? `Marital Status: ${p.maritalStatus}` : '',
        p.religion ? `Religion: ${p.religion}` : '',
      ].filter(Boolean);

      for (const field of bioFields) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: field, size: 20 })],
            spacing: { after: 30 },
          })
        );
      }
    }

    const docx = new DocxDocument({
      title: `${p.fullName || 'Curriculum Vitae'} - Resume`,
      description: 'Generated by DocuStudio Professional CV Builder Engine',
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(docx);
  }

  /**
   * Construct 300 DPI vector PDF for Ready-Made Document
   */
  public generateReadyDocPdf(renderedContent: string, title: string = 'Official Document'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 54, // 0.75 inch formal margins
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Title
      doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold');
      doc.text(title.toUpperCase(), 54, 54, { align: 'center', width: 487.28 });
      doc.moveTo(150, 78).lineTo(445, 78).strokeColor('#94A3B8').lineWidth(1).stroke();

      // Content Body
      doc.fillColor('#1E293B').fontSize(10.5).font('Helvetica');
      doc.text(renderedContent, 54, 100, {
        width: 487.28,
        lineGap: 4,
        align: 'left',
      });

      doc.end();
    });
  }

  /**
   * Save CV Job into MongoDB & Shop Work Queue
   */
  public async saveCvJob(tenantId: string | mongoose.Types.ObjectId, data: any): Promise<ICvJob> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const jobCode = `CV-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const copies = Number(data.copies) || 1;
    const totalAmount = data.totalAmount || (copies * 50);

    const cvJob = await CvJob.create({
      tenantId: tId,
      jobCode,
      customerName: data.customerName || data.cvData?.personalInfo?.fullName || 'Walk-in Customer',
      customerPhone: data.customerPhone || data.cvData?.personalInfo?.phone || 'N/A',
      language: data.language || 'EN',
      templateId: data.templateId || 'modern',
      theme: data.theme || { primaryColor: '#1E3A8A', fontFamily: 'Inter' },
      cvData: data.cvData,
      copies,
      totalAmount,
      notes: data.notes,
      status: 'SAVED',
    });

    // Also register in central Shop Queue
    await Job.create({
      tenantId: tId,
      jobCode,
      customerName: cvJob.customerName,
      customerPhone: cvJob.customerPhone,
      serviceType: 'CV_BUILDER',
      status: 'PRINT_READY',
      priority: 'NORMAL',
      copies,
      paperType: 'A4 80/100 GSM Bond Paper',
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: 'PAID',
      notes: `CV Compose & Print (${data.templateId || 'modern'} template)`,
    });

    // Increment tenant quota
    await Tenant.findByIdAndUpdate(tId, {
      $inc: { 'quotas.monthlyCvCreated': copies },
    });

    return cvJob;
  }

  /**
   * List saved CV jobs for tenant
   */
  public async listCvJobs(tenantId: string | mongoose.Types.ObjectId): Promise<ICvJob[]> {
    const jobs = await CvJob.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return jobs as unknown as ICvJob[];
  }

  /**
   * Get specific CV Job
   */
  public async getCvJobById(tenantId: string | mongoose.Types.ObjectId, jobId: string): Promise<ICvJob> {
    const job = await CvJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!job) {
      throw new NotFoundError('CV job not found or does not belong to this shop');
    }
    return job as unknown as ICvJob;
  }

  /**
   * List Templates (System + Tenant Custom)
   */
  public async listTemplates(
    tenantId: string | mongoose.Types.ObjectId,
    category?: TemplateCategory
  ): Promise<IDocumentTemplate[]> {
    const query: any = {
      $or: [{ isSystemTemplate: true }, { tenantId: new mongoose.Types.ObjectId(tenantId) }],
    };
    if (category) {
      query.category = category;
    }
    const templates = await DocumentTemplate.find(query).sort({ category: 1, title: 1 }).lean();
    return templates as unknown as IDocumentTemplate[];
  }

  /**
   * Get single template
   */
  public async getTemplateById(templateId: string): Promise<IDocumentTemplate> {
    const tpl = await DocumentTemplate.findById(templateId).lean();
    if (!tpl) {
      throw new NotFoundError('Document template not found');
    }
    return tpl as unknown as IDocumentTemplate;
  }

  /**
   * Save Ready-Made Document Job to MongoDB
   */
  public async saveReadyDocumentJob(
    tenantId: string | mongoose.Types.ObjectId,
    data: any
  ): Promise<IReadyDocumentJob> {
    const tId = new mongoose.Types.ObjectId(tenantId);
    const jobCode = `RMD-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const copies = Number(data.copies) || 1;
    const totalAmount = data.totalAmount || (copies * 20);

    const readyDoc = await ReadyDocumentJob.create({
      tenantId: tId,
      jobCode,
      templateId: new mongoose.Types.ObjectId(data.templateId),
      templateTitle: data.templateTitle || 'Official Document',
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      filledValues: data.filledValues || {},
      renderedContent: data.renderedContent,
      copies,
      totalAmount,
      notes: data.notes,
      status: 'SAVED',
    });

    // Also register in central Shop Queue
    await Job.create({
      tenantId: tId,
      jobCode,
      customerName: readyDoc.customerName,
      customerPhone: readyDoc.customerPhone,
      serviceType: 'PHOTOCOPY_PRINT',
      status: 'PRINT_READY',
      priority: 'NORMAL',
      copies,
      paperType: 'A4 Stamp / Bond Paper',
      totalAmount,
      paidAmount: totalAmount,
      paymentStatus: 'PAID',
      notes: `Ready-made Document (${data.templateTitle || 'Document'})`,
    });

    return readyDoc;
  }

  /**
   * List saved ready-made document jobs
   */
  public async listReadyDocJobs(tenantId: string | mongoose.Types.ObjectId): Promise<IReadyDocumentJob[]> {
    const jobs = await ReadyDocumentJob.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return jobs as unknown as IReadyDocumentJob[];
  }
  /**
   * Seed default CV templates if collection is empty
   */
  public async seedDefaultCvTemplates(): Promise<void> {
    const count = await CvTemplateModel.countDocuments({ isSystem: true });
    if (count === 0) {
      await CvTemplateModel.insertMany([
        {
          templateKey: 'MODERN_EXECUTIVE',
          name: 'Modern Executive Resume',
          nameBn: 'মডার্ন এক্সিকিউটিভ সিভি',
          category: 'MODERN',
          description: 'Contemporary two-column layout with bold header and skill meters',
          supportedColors: ['#1E3A8A', '#059669', '#881337', '#334155', '#4F46E5'],
          version: 1,
          isSystem: true,
          isActive: true,
        },
        {
          templateKey: 'CLASSIC_ELEGANT',
          name: 'Classic Elegant Resume',
          nameBn: 'ক্লাসিক ফরমাল সিভি',
          category: 'CLASSIC',
          description: 'Traditional formal serif typography layout ideal for academia and corporate roles',
          supportedColors: ['#334155', '#1E3A8A', '#0F172A'],
          version: 1,
          isSystem: true,
          isActive: true,
        },
        {
          templateKey: 'PROFESSIONAL_TECH',
          name: 'Professional Tech & Engineering',
          nameBn: 'প্রফেশনাল টেকনিক্যাল সিভি',
          category: 'PROFESSIONAL',
          description: 'High-density technical resume highlighting programming, projects, and certifications',
          supportedColors: ['#059669', '#2563EB', '#4F46E5'],
          version: 1,
          isSystem: true,
          isActive: true,
        },
        {
          templateKey: 'EXECUTIVE_BOARD',
          name: 'Executive Board Resume',
          nameBn: 'এক্সিকিউটিভ বোর্ড সিভি',
          category: 'EXECUTIVE',
          description: 'High-level C-suite and director curriculum vitae format',
          supportedColors: ['#0F172A', '#1E3A8A', '#334155'],
          version: 1,
          isSystem: true,
          isActive: true,
        },
        {
          templateKey: 'BANGLADESH_BIODATA',
          name: 'Bangladeshi Bio-data & Matrimonial',
          nameBn: 'জীবনবৃত্তান্ত ও বায়োডাটা (বাংলা)',
          category: 'BIODATA',
          description: 'Standard localized biodata format for Bangladeshi job applications and matrimonial matching',
          supportedColors: ['#1E3A8A', '#059669', '#881337'],
          version: 1,
          isSystem: true,
          isActive: true,
        },
      ]);
    }
  }

  /**
   * List active CV templates
   */
  public async listCvTemplates(category?: string): Promise<ICvTemplate[]> {
    const cacheKey = category ? `cv_templates:${category}` : 'cv_templates:all';
    const cached = configCache.get<ICvTemplate[]>(cacheKey);
    if (cached) return cached;

    await this.seedDefaultCvTemplates();

    const query: any = { isActive: true };
    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }

    const templates = await CvTemplateModel.find(query).sort({ category: 1, version: -1 }).lean();
    configCache.set(cacheKey, templates as any, 5 * 60 * 1000);
    return templates as unknown as ICvTemplate[];
  }
}

export const cvService = new CvService();

