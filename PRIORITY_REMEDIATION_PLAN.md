# DocuStudio SaaS — Priority Remediation Plan (Phase 15 Audit)

This remediation plan organizes all identified bugs, vulnerabilities, and gaps into an actionable, phased engineering roadmap. In accordance with strict audit rules, **all changes await stakeholder approval before execution.**

---

## 1. Remediation Timeline & Milestone Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 16: Core Authentication, Security & Deployment Blockers (P0 / P1)     │
│ Target: Sprint 1 (Immediate) | Estimated Effort: 2-3 Days                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 17: Database Integrity, Storage Architecture & Quotas (P1 / P2)        │
│ Target: Sprint 2 | Estimated Effort: 3-4 Days                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 18: UI/UX Consistency, Role Gating & State Management (P2 / P3)       │
│ Target: Sprint 3 | Estimated Effort: 2-3 Days                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 19: Notifications, WebSockets & Real-Time Communications (P3)         │
│ Target: Sprint 4 | Estimated Effort: 3-5 Days                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 16: Core Authentication, Security & Deployment Blockers (Sprint 1)

### Objectives:
Eliminate all P0 blockers preventing users from logging in, onboarding, or deploying via Docker.

| Task ID | Item / Remediation | Affected Files | Effort | Verification Criteria |
| :--- | :--- | :--- | :---: | :--- |
| **REM-01** | **Wire Frontend Login to Backend API**<br>Replace mock timeout in `LoginPage.tsx` with `apiClient.post('/auth/login')`. Save real JWT access/refresh tokens in `localStorage`, set current user and tenant in Zustand, and redirect to `/dashboard`. | `frontend/src/pages/LoginPage.tsx` | 3h | Submitting valid credentials authenticates with backend and loads live dashboard metrics without 401 error. |
| **REM-02** | **Wire Frontend Registration to Backend API**<br>Replace mock simulation in `RegisterPage.tsx` with `POST /auth/register-shop`. Handle field validation errors (duplicate subdomain), persist returned tokens, and initialize tenant context. | `frontend/src/pages/RegisterPage.tsx` | 3h | Submitting shop registration creates real tenant and owner in MongoDB; redirects to live dashboard. |
| **REM-03** | **Implement Client Route Protection (`ProtectedRoute`)**<br>Create a reusable `ProtectedRoute` component in `AppRoutes.tsx`. Verify token presence and validity before rendering `DashboardLayout`. Redirect unauthenticated visitors to `/login`. | `frontend/src/routes/AppRoutes.tsx`,<br>`frontend/src/components/common/ProtectedRoute.tsx` | 3h | Direct navigation to `/dashboard` or `/admin` in private browsing redirects immediately to `/login`. |
| **REM-04** | **Add Custom Nginx SPA Config to Frontend Docker**<br>Create `frontend/nginx.conf` with `try_files $uri $uri/ /index.html;`. Update `frontend/Dockerfile` to copy this configuration into `/etc/nginx/conf.d/default.conf`. | `frontend/Dockerfile`,<br>`frontend/nginx.conf` | 2h | Refreshing `/studio/passport` inside Docker container loads the React route instead of returning 404. |
| **REM-05** | **Fix CORS Configuration Conflict in Docker Compose**<br>Change `CORS_ORIGIN=*` in `docker-compose.yml` to specific client origin `http://localhost:5173` to comply with browser credentials security rules. | `docker-compose.yml` | 1h | Browser accepts cookies and Authorization headers without CORS block. |
| **REM-06** | **Super Admin Provisioning CLI Seed Utility**<br>Create `backend/src/scripts/seed-superadmin.ts` to provision or elevate a Super Admin user from environment variables (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`). | `backend/src/scripts/seed-superadmin.ts`,<br>`backend/package.json` | 2h | Running `npm run seed:admin` creates root Super Admin with role `SUPER_ADMIN`. |

---

## 3. Phase 17: Database Integrity, Storage Architecture & Quotas (Sprint 2)

### Objectives:
Protect database performance, enforce plan limits, and resolve data loss risks during disaster recovery.

| Task ID | Item / Remediation | Affected Files | Effort | Verification Criteria |
| :--- | :--- | :--- | :---: | :--- |
| **REM-07** | **Fix BSON Type Loss in Database Restore Utility**<br>Update `restore-db.ts` to use MongoDB BSON Extended JSON (`bson.EJSON`) so restored documents retain native `ObjectId` and `Date` types. | `backend/src/scripts/restore-db.ts`,<br>`backend/src/scripts/backup-db.ts` | 4h | Restored database passes Mongoose `User.findById()` and `Job.find({ createdAt: ... })` queries. |
| **REM-08** | **Offload Base64 Image Bloat to Disk / Object Storage**<br>Create a dedicated file storage service (`localStorageService.ts` or S3/MinIO driver) that saves raster buffers to disk with unique hashes and saves file paths/URIs in MongoDB instead of raw base64. | `backend/src/modules/passport/passport.service.ts`,<br>`backend/src/modules/document/document.service.ts`,<br>`backend/src/modules/idcard/idcard.service.ts` | 8h | Average `PassportJob` document size reduces from 5MB+ to <5KB. BSON 16MB limit risk eliminated. |
| **REM-09** | **Enforce Studio Quotas on Backend Processing**<br>Inject quota validation middleware in `/passport` and `/ocr` routes to check `monthlyPassportLayoutsUsed < limit` and `monthlyOcrPagesUsed < limit` before running Sharp/Tesseract. | `backend/src/modules/passport/passport.router.ts`,<br>`backend/src/modules/ocr/ocr.router.ts` | 4h | Exceeding monthly layout or OCR limit returns `HTTP 403 Forbidden` with upgrade prompt. |
| **REM-10** | **Implement Automated 24-Hour Zero-Retention Purge**<br>Add a scheduled background worker (using `node-cron` or interval task) that queries jobs older than `tenant.settings.autoPurgeHours` (default 24h) and unlinks/deletes their raster files. | `backend/src/server.ts`,<br>`backend/src/services/purgeWorker.ts` | 4h | Customer images older than 24 hours are automatically purged from disk and marked expired. |
| **REM-11** | **Add Compound Unique Constraints for JobCode & Phone**<br>Add `{ tenantId: 1, jobCode: 1 }` unique index on `Job` model and `{ tenantId: 1, phone: 1 }` partial unique index on `Customer` model where `{ isDeleted: false }`. | `backend/src/models/Job.model.ts`,<br>`backend/src/models/Customer.model.ts` | 3h | Concurrent orders with identical job codes or phone numbers are prevented at database level. |
| **REM-12** | **Test Environment Rate Limiter Bypass**<br>Update `rateLimiter.ts` to bypass or raise rate limits when `NODE_ENV === 'test'` or `x-test-bypass` header is supplied. | `backend/src/middleware/rateLimiter.ts` | 2h | Running all 12 test scripts back-to-back completes 100% without triggering HTTP 429. |

---

## 4. Phase 18: UI/UX Consistency, Role Gating & State Management (Sprint 3)

### Objectives:
Polish user experience, implement user logout, enforce RBAC in navigation, and optimize frontend bundles.

| Task ID | Item / Remediation | Affected Files | Effort | Verification Criteria |
| :--- | :--- | :--- | :---: | :--- |
| **REM-13** | **User Profile Dropdown & Logout Action**<br>Implement an interactive dropdown in `Header.tsx` displaying the authenticated user's name, role, shop info, and a "Sign Out" button that clears storage and redirects to `/login`. | `frontend/src/components/layout/Header.tsx` | 3h | Clicking "Sign Out" revokes session, clears `localStorage`, and navigates user to `/login`. |
| **REM-14** | **Role-Based Navigation Gating (RBAC in Sidebar)**<br>Filter navigation items in `Sidebar.tsx` based on `currentUser.role`. Hide "Super Admin" for all non-`SUPER_ADMIN` roles; hide "Shop Settings" for regular `STAFF`. | `frontend/src/components/layout/Sidebar.tsx` | 3h | Staff and Operator accounts do not see "Super Admin" or unauthorized settings links. |
| **REM-15** | **Hydrate Zustand State from `/auth/me` on Boot**<br>Remove hardcoded mock data in `useAppStore.ts`. Default `currentUser` and `currentTenant` to `null`. On initial app load, call `/api/v1/auth/me` to hydrate state. | `frontend/src/store/useAppStore.ts`,<br>`frontend/src/App.tsx` | 3h | Store accurately reflects the logged-in user and active shop context. |
| **REM-16** | **Frontend Code-Splitting & Bundle Optimization**<br>Convert studio pages (`PassportStudioPage`, `DocumentA4StudioPage`, `CvStudioPage`, etc.) to dynamic `React.lazy()` imports in `AppRoutes.tsx`. Configure Vite manual chunks for vendor libs. | `frontend/src/routes/AppRoutes.tsx`,<br>`frontend/vite.config.ts` | 3h | Vite production build warning resolved; main JS bundle size drops below 300 kB. |
| **REM-17** | **Standardize React Query Across All Studios**<br>Migrate manual `useState` / Axios logic in `JobsQueuePage` and `CustomersPage` to TanStack Query for automatic caching, refetching, and background invalidation. | `frontend/src/pages/JobsQueuePage.tsx`,<br>`frontend/src/pages/CustomersPage.tsx` | 4h | Work queue and customer directory benefit from instant cached transitions and query invalidation. |

---

## 5. Phase 19: Notifications & Real-Time Communications (Sprint 4)

### Objectives:
Implement real-time updates and customer communication features advertised on the platform.

| Task ID | Item / Remediation | Affected Files | Effort | Verification Criteria |
| :--- | :--- | :--- | :---: | :--- |
| **REM-18** | **Live WebSocket Kanban & Spooler Updates**<br>Integrate Socket.io or lightweight WebSockets on backend port. Emit events on job status transitions (`job:updated`) and print queue changes (`queue:updated`). Listen on frontend. | `backend/src/server.ts`,<br>`frontend/src/pages/JobsQueuePage.tsx`,<br>`frontend/src/pages/PrintSpoolerPage.tsx` | 6h | Status changes made on one counter terminal reflect instantaneously on all other operator screens. |
| **REM-19** | **Transactional Email Service for Password Resets**<br>Configure Nodemailer with SMTP transport in backend. Send actual password reset links when `POST /auth/forgot-password` is invoked. | `backend/src/services/emailService.ts`,<br>`backend/src/modules/auth/auth.service.ts` | 4h | User receives real password reset email with secure token link. |
| **REM-20** | **WhatsApp Customer Delivery Webhook / API Hook**<br>Add Twilio / Meta Cloud API integration to dispatch automated pickup links to customers when a job transitions to `COMPLETED`. | `backend/src/services/whatsappService.ts`,<br>`backend/src/modules/job/job.controller.ts` | 6h | Completing an order triggers customer notification payload with download link. |

---

## 6. Approval & Execution Sign-Off

This priority remediation plan provides a clear, risk-mitigated pathway to advance DocuStudio SaaS from its current feature-complete state into an enterprise-grade, production-hardened platform.

**Next Action:** Await user / stakeholder confirmation to begin executing **Phase 16 (Sprint 1)** remediation tasks.

