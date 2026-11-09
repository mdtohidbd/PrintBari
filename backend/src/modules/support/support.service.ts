import mongoose from 'mongoose';
import {
  SupportTicket,
  SupportArticle,
  ISupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../models/SupportTicket.model';
import { User } from '../../models/User.model';
import { Tenant } from '../../models/Tenant.model';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors';

export class SupportService {
  private async resolveTenantId(tenantId: string | mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
    if (tenantId instanceof mongoose.Types.ObjectId) return tenantId;
    if (mongoose.Types.ObjectId.isValid(tenantId)) return new mongoose.Types.ObjectId(tenantId);
    const tenant = await Tenant.findOne({ subdomain: tenantId }).select('_id');
    return tenant ? (tenant._id as mongoose.Types.ObjectId) : new mongoose.Types.ObjectId();
  }

  /**
   * Create a new customer support ticket
   */
  public async createTicket(
    tenantId: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string; role: string },
    data: {
      subject: string;
      category: TicketCategory;
      priority?: TicketPriority;
      initialMessage: string;
      attachments?: Array<{ name: string; url: string; bytes?: number }>;
    }
  ): Promise<ISupportTicket> {
    const tId = await this.resolveTenantId(tenantId);
    const uId = new mongoose.Types.ObjectId(user.id);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketCode = `TICK-${dateStr}-${randomSuffix}`;

    const ticket = await SupportTicket.create({
      ticketCode,
      tenantId: tId,
      creatorId: uId,
      subject: data.subject.trim(),
      category: data.category,
      priority: data.priority || 'MEDIUM',
      status: 'OPEN',
      messages: [
        {
          senderId: uId,
          senderRole: user.role,
          senderName: user.fullName,
          message: data.initialMessage.trim(),
          isInternalNote: false,
          attachments: data.attachments || [],
          createdAt: now,
        },
      ],
      history: [
        {
          action: 'TICKET_CREATED',
          actorId: uId,
          actorName: user.fullName,
          details: `Ticket opened with priority ${data.priority || 'MEDIUM'} in category ${data.category}`,
          timestamp: now,
        },
      ],
    });

    return ticket;
  }

  /**
   * List tickets with strict tenant isolation (or cross-tenant if SUPER_ADMIN)
   */
  public async listTickets(
    tenantId: string | mongoose.Types.ObjectId,
    userRole: string,
    query: {
      status?: string;
      category?: string;
      priority?: string;
      page?: number;
      limit?: number;
      search?: string;
    }
  ) {
    const filter: Record<string, any> = {};

    // Privacy & Tenant Isolation: Non-superadmin users only see tickets from their own shop
    if (userRole !== 'SUPER_ADMIN') {
      filter.tenantId = await this.resolveTenantId(tenantId);
    } else if (query.search && mongoose.Types.ObjectId.isValid(query.search)) {
      filter.tenantId = new mongoose.Types.ObjectId(query.search);
    }

    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 15));
    const skip = (page - 1) * limit;

    const [tickets, totalCount] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tenantId', 'name subdomain')
        .populate('creatorId', 'fullName email')
        .populate('assignedTo', 'fullName email')
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    // Privacy scrub: Ensure internal notes are completely stripped for non-superadmin
    const sanitizedTickets = tickets.map((t) => {
      if (userRole !== 'SUPER_ADMIN') {
        return {
          ...t,
          messages: t.messages.filter((m) => !m.isInternalNote),
        };
      }
      return t;
    });

    return {
      tickets: sanitizedTickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Get ticket by ID with privacy guard on internal notes
   */
  public async getTicketById(
    tenantId: string | mongoose.Types.ObjectId,
    userRole: string,
    ticketId: string
  ) {
    const filter: Record<string, any> = { _id: ticketId };
    if (userRole !== 'SUPER_ADMIN') {
      filter.tenantId = await this.resolveTenantId(tenantId);
    }

    const ticket = await SupportTicket.findOne(filter)
      .populate('tenantId', 'name subdomain businessId')
      .populate('creatorId', 'fullName email phone')
      .populate('assignedTo', 'fullName email')
      .populate('messages.senderId', 'fullName email role')
      .lean();

    if (!ticket) {
      throw new NotFoundError('Support ticket not found or unauthorized');
    }

    // Privacy scrub: If not Super Admin, hide all internal agent notes
    if (userRole !== 'SUPER_ADMIN') {
      ticket.messages = ticket.messages.filter((m) => !m.isInternalNote);
    }

    return ticket;
  }

  /**
   * Add a reply or internal note to a ticket
   */
  public async addReply(
    tenantId: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string; role: string },
    ticketId: string,
    data: {
      message: string;
      isInternalNote?: boolean;
      attachments?: Array<{ name: string; url: string; bytes?: number }>;
    }
  ) {
    const filter: Record<string, any> = { _id: ticketId };
    if (user.role !== 'SUPER_ADMIN') {
      filter.tenantId = await this.resolveTenantId(tenantId);
    }

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) {
      throw new NotFoundError('Support ticket not found or unauthorized');
    }

    // Prevent non-superadmins from adding hidden internal notes
    const isInternalNote = Boolean(data.isInternalNote && user.role === 'SUPER_ADMIN');

    const now = new Date();
    const uId = new mongoose.Types.ObjectId(user.id);

    ticket.messages.push({
      senderId: uId,
      senderRole: user.role,
      senderName: user.fullName,
      message: data.message.trim(),
      isInternalNote,
      attachments: data.attachments || [],
      createdAt: now,
    });

    // Update status based on who replied
    if (user.role === 'SUPER_ADMIN') {
      if (!isInternalNote && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        ticket.status = 'WAITING_FOR_CUSTOMER';
      }
    } else {
      if (ticket.status === 'WAITING_FOR_CUSTOMER') {
        ticket.status = 'IN_PROGRESS';
      }
    }

    ticket.history.push({
      action: isInternalNote ? 'INTERNAL_NOTE_ADDED' : 'TICKET_REPLIED',
      actorId: uId,
      actorName: user.fullName,
      details: isInternalNote
        ? 'Internal administrative note logged'
        : `Reply submitted by ${user.role}`,
      timestamp: now,
    });

    await ticket.save();

    return this.getTicketById(tenantId, user.role, ticketId);
  }

  /**
   * Update ticket status (e.g. RESOLVED, CLOSED)
   */
  public async updateTicketStatus(
    tenantId: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string; role: string },
    ticketId: string,
    status: TicketStatus
  ) {
    const filter: Record<string, any> = { _id: ticketId };
    if (user.role !== 'SUPER_ADMIN') {
      filter.tenantId = await this.resolveTenantId(tenantId);
    }

    const ticket = await SupportTicket.findOne(filter);
    if (!ticket) {
      throw new NotFoundError('Support ticket not found or unauthorized');
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    const now = new Date();

    if (status === 'RESOLVED') {
      ticket.resolvedAt = now;
    } else if (status === 'CLOSED') {
      ticket.closedAt = now;
    }

    ticket.history.push({
      action: 'STATUS_CHANGED',
      actorId: new mongoose.Types.ObjectId(user.id),
      actorName: user.fullName,
      details: `Status transitioned from ${oldStatus} to ${status}`,
      timestamp: now,
    });

    await ticket.save();
    return this.getTicketById(tenantId, user.role, ticketId);
  }

  /**
   * Assign ticket to a support engineer (Super Admin only)
   */
  public async assignTicket(
    user: { id: string; fullName: string; role: string },
    ticketId: string,
    assigneeId: string
  ) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Super Admin can assign support tickets');
    }

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Support ticket not found');
    }

    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      throw new NotFoundError('Target assignee user not found');
    }

    ticket.assignedTo = assignee._id as any;
    ticket.history.push({
      action: 'TICKET_ASSIGNED',
      actorId: new mongoose.Types.ObjectId(user.id),
      actorName: user.fullName,
      details: `Assigned to ${assignee.fullName} (${assignee.email})`,
      timestamp: new Date(),
    });

    await ticket.save();
    return ticket;
  }

  /**
   * Search knowledge base / help center articles
   */
  public async getHelpArticles(category?: string, query?: string) {
    const filter: Record<string, any> = { isPublished: true };

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
      ];
    }

    let articles = await SupportArticle.find(filter).sort({ helpfulCount: -1 }).lean();

    // Seed default knowledge base if fewer than 10 articles exist
    if (articles.length < 10 && !query) {
      await this.seedInitialArticles();
      articles = await SupportArticle.find(filter).sort({ helpfulCount: -1 }).lean();
    }

    return articles;
  }

  /**
   * Seed default Knowledge Base articles for photo studio and print operators
   */
  public async seedInitialArticles() {
    const defaultArticles = [
      {
        articleId: 'ART-001',
        title: 'Configuring Epson L805 & L850 for 300 DPI Borderless Photo Printing',
        slug: 'epson-l805-300dpi-photo-setup',
        category: 'PRINTER_HARDWARE',
        summary: 'Step-by-step driver setup, paper thickness adjustment, and color profiling for 4R and A4 passport photo sheets.',
        contentMarkdown:
          '### Epson L805 Setup Guide\n1. Ensure Epson Photo+ driver is installed.\n2. In DocuStudio Print Spooler, select **Ultra Glossy** or **Premium Glossy** paper.\n3. Verify print resolution is set to **High (300 DPI)**.\n4. Enable zero-margin borderless expansion in driver preferences.',
        helpfulCount: 42,
        tags: ['epson', 'passport', 'printing', 'hardware'],
        isPublished: true,
      },
      {
        articleId: 'ART-002',
        title: 'Smart NID Card Dual-Sided Composition and Alignment Guide',
        slug: 'smart-nid-dual-sided-alignment',
        category: 'STUDIO_ENGINE',
        summary: 'How to crop, align, and print National ID front and back sides on a single CR-80 card or A4 paper sheet.',
        contentMarkdown:
          '### Smart NID Alignment\n- Upload the front and back scans into the ID Card Studio.\n- Toggle the auto-align guide to match the 85.6mm x 53.98mm ISO standard.\n- Click **Compose Sheet** to position 4 duplicates on an A4 sheet for customer handover.',
        helpfulCount: 38,
        tags: ['nid', 'smart-card', 'studio', 'alignment'],
        isPublished: true,
      },
      {
        articleId: 'ART-003',
        title: 'Managing Subscription Plans and bKash / Nagad Payment Invoices',
        slug: 'subscription-billing-bkash-invoices',
        category: 'BILLING',
        summary: 'Understanding monthly vs annual billing cycles, payment verification via bKash, and downloading PDF tax invoices.',
        contentMarkdown:
          '### Billing & Invoices\n- Go to **Subscription & Billing** from the navigation menu.\n- Select your desired plan tier (STARTER, PROFESSIONAL, or ENTERPRISE).\n- Complete verification via automated bKash or credit card.\n- Download signed PDF invoices directly from the invoice history table.',
        helpfulCount: 29,
        tags: ['billing', 'bkash', 'invoices', 'plans'],
        isPublished: true,
      },
      {
        articleId: 'ART-004',
        title: 'Installing the Local Desktop Bridge for Direct Spooler Printing',
        slug: 'installing-local-desktop-bridge',
        category: 'PRINTER_HARDWARE',
        summary: 'How to run the lightweight local Windows printing agent on port 8989 to bypass browser print dialogs.',
        contentMarkdown:
          '### Desktop Bridge\n- Download and run the `docustudio-agent.exe` service.\n- The agent listens locally on `http://127.0.0.1:8989`.\n- When active, the Print Spooler indicator will turn green (Connected).\n- Jobs sent to print will route directly to the USB or network printer without opening browser print modals.',
        helpfulCount: 56,
        tags: ['agent', 'bridge', 'spooler', 'hardware'],
        isPublished: true,
      },
      {
        articleId: 'ART-005',
        title: 'Account Setup and Studio Subdomain Configuration',
        slug: 'account-setup-subdomain-guide',
        category: 'ACCOUNT',
        summary: 'How to claim your unique shop subdomain, verify owner email, and configure initial security credentials.',
        contentMarkdown:
          '### Account Setup Guide\n1. Complete registration with business name and chosen subdomain (`yourshop.docustudio.app`).\n2. Verify owner email address via the 6-digit confirmation code.\n3. Configure Two-Factor Authentication (2FA) in Settings for owner security.',
        helpfulCount: 34,
        tags: ['account', 'setup', 'subdomain', 'security'],
        isPublished: true,
      },
      {
        articleId: 'ART-006',
        title: 'Shop Configuration: Working Hours, Taxes, and Auto-Purge Rules',
        slug: 'shop-configuration-taxes-purge',
        category: 'ACCOUNT',
        summary: 'Setting weekly operating hours, VAT tax rate percentage, currency formatting, and zero-retention privacy timers.',
        contentMarkdown:
          '### Shop Configuration\n- Navigate to **Settings > Shop Profile**.\n- Define opening/closing hours per weekday.\n- Set invoice prefix (e.g. `INV-`) and standard VAT rate.\n- Select customer document auto-purge window (default: 24 hours for zero-retention privacy).',
        helpfulCount: 28,
        tags: ['settings', 'config', 'vat', 'purge'],
        isPublished: true,
      },
      {
        articleId: 'ART-007',
        title: 'Staff Management: Roles, Permissions, and Counter Workstations',
        slug: 'staff-management-roles-permissions',
        category: 'ACCOUNT',
        summary: 'Inviting shop staff members, assigning roles (Manager, Operator, Reviewer, Printer), and managing active sessions.',
        contentMarkdown:
          '### Staff Management\n- Go to **Staff Management** and click **Invite Staff**.\n- Choose role: **Manager** (full shop operations), **Operator** (job creation & editing), **Reviewer** (QA check), or **Printer** (spooler access only).\n- Staff receive email credentials and can work simultaneously from different counter PCs.',
        helpfulCount: 45,
        tags: ['staff', 'rbac', 'permissions', 'users'],
        isPublished: true,
      },
      {
        articleId: 'ART-008',
        title: 'Passport Photo Studio: Country Presets, Auto-Crop, and Background Removal',
        slug: 'passport-photo-studio-presets-guide',
        category: 'STUDIO_ENGINE',
        summary: 'Automated 35x45mm Schengen, 2x2 inch US Visa, and Bangladesh e-Passport rendering with 4R/A4 grid layouts.',
        contentMarkdown:
          '### Passport Photo Studio\n1. Upload or capture customer portrait using the studio webcam/camera.\n2. Select destination preset (e.g., *Bangladesh e-Passport 40x50mm*, *US Visa 2x2 inch*).\n3. Click **Auto Remove Background** to produce clean white/light blue backdrop.\n4. Click **Generate Print Sheet** to pack 8 or 16 photos onto 4R glossy paper.',
        helpfulCount: 67,
        tags: ['passport', 'photo', 'crop', 'background-removal'],
        isPublished: true,
      },
      {
        articleId: 'ART-009',
        title: 'Document Processing & Bengali/English A4 OCR Text Extraction',
        slug: 'document-processing-ocr-extraction',
        category: 'STUDIO_ENGINE',
        summary: 'Scanning certificates, auto-deskewing degraded paper copies, and extracting editable Unicode Bengali text via OCR.',
        contentMarkdown:
          '### Document & OCR Studio\n- Upload scanned document or multi-page PDF.\n- Apply auto-contrast, thresholding, and perspective deskew.\n- Click **Run OCR** selecting English or Bengali script.\n- Export extracted text to Word (DOCX) or searchable PDF.',
        helpfulCount: 39,
        tags: ['document', 'ocr', 'bengali', 'scan'],
        isPublished: true,
      },
      {
        articleId: 'ART-010',
        title: 'CV Builder: Professional Job Application Templates and One-Click Print',
        slug: 'cv-builder-templates-printing',
        category: 'STUDIO_ENGINE',
        summary: 'Drafting structured resumes, modern dual-column CVs, and instant high-quality A4 printing for walk-in job seekers.',
        contentMarkdown:
          '### CV Builder Guide\n- Select template: Modern, Minimalist, Academic, or Executive.\n- Enter personal details, career objective, educational qualifications, and work experience.\n- Click **Generate Preview** to render live PDF.\n- Route directly to printer spooler or export signed digital PDF.',
        helpfulCount: 51,
        tags: ['cv', 'resume', 'builder', 'jobs'],
        isPublished: true,
      },
      {
        articleId: 'ART-011',
        title: 'Troubleshooting Common Printing Hardware & Driver Errors',
        slug: 'troubleshooting-hardware-printer-errors',
        category: 'BUG_REPORT',
        summary: 'Diagnosing printer offline states, color cast corrections, paper feed jams, and browser dialog suppression.',
        contentMarkdown:
          '### Troubleshooting Hardware\n- **Printer Offline:** Verify USB connection and ensure Desktop Bridge (`docustudio-agent.exe`) is active.\n- **Color Inaccuracy:** Run print head cleaning and verify driver color profile is set to sRGB.\n- **Spooler Timeout:** Clear Windows print queue (`spoolsv.exe`) and restart DocuStudio spooler service.',
        helpfulCount: 73,
        tags: ['troubleshooting', 'errors', 'hardware', 'diagnostics'],
        isPublished: true,
      },
    ];

    for (const art of defaultArticles) {
      await SupportArticle.updateOne({ articleId: art.articleId }, { $set: art }, { upsert: true });
    }
  }
}

export const supportService = new SupportService();
