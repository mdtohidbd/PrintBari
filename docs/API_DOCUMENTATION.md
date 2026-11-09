# DocuStudio SaaS — Complete REST API Documentation

Base URL: `https://app.docustudio.io/api/v1` (or `http://localhost:5000/api/v1`)

---

## 1. Authentication & Tenant Onboarding (`/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register-shop` | Registers a new shop tenant with owner and creates 14-day trial. | No |
| `POST` | `/auth/login` | Authenticates shop owner, staff, or super admin; returns JWTs. | No |
| `POST` | `/auth/refresh` | Silently refreshes access token using valid refresh token. | No |
| `POST` | `/auth/logout` | Revokes active refresh token from database. | No |
| `POST` | `/auth/forgot-password` | Initiates password reset flow with token. | No |
| `POST` | `/auth/reset-password` | Resets password with valid verification token. | No |

---

## 2. Shop Dashboard & Business Management (`/dashboard`, `/tenants`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :---: |
| `GET` | `/dashboard/metrics` | Retrieves live revenue, pending/completed jobs, and storage usage. | All Staff |
| `GET` | `/tenants/me` | Retrieves authenticated shop profile, working hours, and settings. | All Staff |
| `PUT` | `/tenants/me` | Updates shop profile, business hours, and invoice settings. | Owner / Manager |
| `GET` | `/tenants/staff` | Lists all staff members registered to the shop. | Owner / Manager |
| `POST` | `/tenants/staff` | Onboards a new staff member with assigned role. | Owner / Manager |
| `PUT` | `/tenants/staff/:id` | Updates staff member role, phone, or name. | Owner / Manager |
| `PATCH`| `/tenants/staff/:id/status` | Toggles staff member active/suspended state. | Owner / Manager |

---

## 3. Customer CRM & File Library (`/customers`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :---: |
| `GET` | `/customers` | Lists and searches shop customers with pagination. | All Staff |
| `POST` | `/customers` | Creates a new customer profile. | All Staff |
| `GET` | `/customers/:id` | Retrieves full customer profile, order history, and notes. | All Staff |
| `PUT` | `/customers/:id` | Updates customer details and contact information. | All Staff |
| `DELETE`| `/customers/:id` | Soft-deletes customer record. | Owner / Manager |
| `POST` | `/customers/:id/files` | Stores a processed image/document in customer file library. | All Staff |
| `GET` | `/customers/:id/files` | Retrieves reusable files for a customer. | All Staff |

---

## 4. Job Management & Kanban Queue (`/jobs`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :---: |
| `GET` | `/jobs` | Queries jobs with status, search, and date filters. | All Staff |
| `POST` | `/jobs` | Creates a new order/job linked to shop and customer. | All Staff |
| `GET` | `/jobs/:jobId` | Retrieves job detail, price breakdown, and file versions. | All Staff |
| `PATCH`| `/jobs/:jobId/status` | Transitions job status (New -> Processing -> Review -> Approved -> Printing -> Completed). | All Staff |
| `POST` | `/jobs/:jobId/duplicate` | Duplicates an existing job with a new unique code. | All Staff |
| `POST` | `/jobs/:jobId/files` | Attaches a newly processed or updated file version. | All Staff |

---

## 5. Photo Studio Modules (`/passport`, `/document`, `/idcard`, `/cv`, `/ocr`)

### Passport Photo Studio (`/passport`)
- `GET /passport/presets` — Retrieves standard dimensions (US, UK/EU, India, BD 40x50mm, Stamp).
- `POST /passport/process` — Crops, rotates, removes/replaces background, adjusts brightness/contrast.
- `POST /passport/sheet` — Generates 300 DPI A4 or 4x6" arranged print layout with cut guides.
- `POST /passport/export-pdf` — Generates vector PDF print sheet.
- `POST /passport/jobs` — Saves processed job to MongoDB.
- `GET /passport/jobs` & `GET /passport/jobs/:jobId` — Reopens and edits saved passport orders.

### Document A4 Processing (`/document`)
- `POST /document/process-page` — Clean document mode, B&W photocopy threshold, grayscale, deskew.
- `POST /document/compose-a4` — Generates exact 300 DPI A4 composition.
- `POST /document/export-pdf` — Bundles multi-page documents into a vectorized PDF.
- `POST /document/jobs` — Saves multi-page document job.

### ID Card A4 Processing (`/idcard`)
- `GET /idcard/presets` — Smart NID, Old NID, Driving License, Student Card presets.
- `POST /idcard/process-side` — Processes front/back card images.
- `POST /idcard/compose-sheet` — Composes side-by-side or multi-copy A4 sheet.
- `POST /idcard/export-pdf` — Exports 300 DPI vector PDF.

### CV Builder & Ready Documents (`/cv`)
- `GET /cv/templates` — Retrieves document templates (Applications, Certificates, Agreements).
- `POST /cv/render-document` — Injects variables into template markdown/HTML.
- `POST /cv/export-pdf` — Renders CV to vector PDF.

### OCR & Handwriting Recognition (`/ocr`)
- `POST /ocr/preprocess` — High-contrast thresholding for handwriting.
- `POST /ocr/extract` — Extracts text with confidence ratings (Bangla and English).
- `POST /ocr/export-docx` — Generates editable Microsoft Word (`.docx`) file.
- `POST /ocr/export-pdf` — Generates searchable PDF.

---

## 6. Hardware Print Queue & Spooler (`/printers`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :---: |
| `GET` | `/printers` | Lists connected studio printers and ink levels. | All Staff |
| `GET` | `/printers/queue` | Retrieves live spooler queue. | All Staff |
| `POST` | `/printers/queue` | Enqueues a job with duplicate submission protection. | All Staff |
| `PUT` | `/printers/queue/reorder` | Changes job priority (moves up/down in queue). | All Staff |
| `PATCH`| `/printers/queue/:id` | Adjusts copies, paper size, orientation, and color mode. | All Staff |
| `POST` | `/printers/queue/:id/start` | Transitions job status to `PRINTING`. | All Staff |
| `POST` | `/printers/queue/:id/complete`| Records completed print in archive. | All Staff |
| `DELETE`| `/printers/queue/:id` | Removes job from active queue. | All Staff |
| `GET` | `/printers/history` | Retrieves historical print audit archive. | All Staff |
| `POST` | `/printers/export-pdf` | Generates downloadable print-ready vector PDF. | All Staff |

---

## 7. SaaS Subscriptions & Billing (`/subscription`)

| Method | Endpoint | Description | Roles |
| :--- | :--- | :--- | :---: |
| `GET` | `/subscription/plans` | Retrieves public/authenticated plans matrix. | Public |
| `GET` | `/subscription/my-status` | Returns trial countdown, active plan, and storage meters. | Authenticated |
| `POST` | `/subscription/checkout` | Initiates payment with bKash, Nagad, or SSLCommerz (idempotent). | Owner |
| `POST` | `/subscription/verify-payment`| Server-side HMAC-SHA256 signature verification & activation. | Gateway / Owner |
| `GET` | `/subscription/history` | Retrieves past payment ledger and invoices. | Authenticated |
| `GET` | `/subscription/invoices/:id/pdf`| Downloads official 300 DPI vector PDF tax invoice. | Authenticated |

---

## 8. Super Admin Command Center (`/superadmin`)

Protected exclusively by `authenticate` + `authorizeRoles('SUPER_ADMIN')`:

- `GET /superadmin/dashboard` — Platform overview, MRR, active/trial shops, storage usage, activity feed.
- `GET /superadmin/shops` — Paginated directory of all shops with search and status filters.
- `GET /superadmin/shops/:id` — Full shop profile, owner details, staff count, job volume.
- `POST /superadmin/shops/:id/suspend` — Suspends shop with mandatory reason.
- `POST /superadmin/shops/:id/activate` — Re-activates shop.
- `PUT /superadmin/shops/:id/subscription` — Direct plan and quota override.
- `GET /superadmin/plans` — Lists all plans.
- `POST /superadmin/plans` — Creates custom plan tier.
- `PUT /superadmin/plans/:planKey` — Updates plan limits and pricing.
- `DELETE /superadmin/plans/:planKey` — Archives inactive plan.
- `GET /superadmin/transactions` & `GET /superadmin/invoices` — Platform financial ledger.
- `GET /superadmin/settings` & `PUT /superadmin/settings/:key` — Global platform variables.
- `GET /superadmin/audit-logs` — Centralized security audit trail.

