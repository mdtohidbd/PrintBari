# DocuStudio SaaS — Bug & Architectural Gap Report (Phase 15 Audit)

This report details every bug, vulnerability, and architectural gap identified during the comprehensive Phase 15 audit. Each finding includes file references, evidence, severity rating, and recommended correction.

---

## Severity Classification
- **P0 — Critical / Blocker:** Core feature non-functional, security bypass, or data corruption in production.
- **P1 — High:** Significant vulnerability, deployment failure, architectural risk, or data loss potential.
- **P2 — Medium:** Incomplete business logic, missing validation, concurrency edge case, or state inconsistency.
- **P3 — Low / Polish:** Cosmetic defect, missing notification feature, or minor UX enhancement.

---

## 1. Critical & Blocker Findings (P0)

### BUG-01: Frontend Login Form Uses Mock Timeout and Fake Token
- **Severity:** `P0 - Blocker`
- **Affected File:** `frontend/src/pages/LoginPage.tsx` (Lines 44–50)
- **Evidence:**
  ```typescript
  const onSubmit = async (data: LoginFormData) => {
    // Pure frontend simulation for Phase 2
    await new Promise((resolve) => setTimeout(resolve, 600));
    localStorage.setItem('tenant_id', data.subdomain);
    localStorage.setItem('token', 'mock-demo-jwt-token');
    navigate('/dashboard');
  };
  ```
- **Impact:** Real users cannot log in with valid credentials. The frontend saves a fake token (`mock-demo-jwt-token`). Subsequent authenticated API calls to `/dashboard/metrics`, `/jobs`, `/settings` fail with `HTTP 401 Unauthorized`.
- **Recommended Correction:** Call `authApi.login({ email: data.email, password: data.password, subdomain: data.subdomain })`, save returned JWT access and refresh tokens to `localStorage`, and update `currentUser` and `currentTenant` in `useAppStore`.

---

### BUG-02: Frontend Registration Form Uses Mock Simulation
- **Severity:** `P0 - Blocker`
- **Affected File:** `frontend/src/pages/RegisterPage.tsx` (Lines 80–85)
- **Evidence:**
  ```typescript
  const onSubmit = async (data: RegisterFormData) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    localStorage.setItem('tenant_id', data.subdomain);
    localStorage.setItem('token', 'mock-new-shop-token');
    navigate('/dashboard');
  };
  ```
- **Impact:** New shop owners cannot register their shops on the platform via the UI. No shop or owner records are created in MongoDB.
- **Recommended Correction:** Call `POST /api/v1/auth/register-shop` with full payload (`shopName`, `subdomain`, `ownerName`, `email`, `phone`, `password`, `plan`), handle server errors (e.g. subdomain conflict), and persist returned tokens.

---

### BUG-03: Missing Client-Side Route Protection (Auth Guards)
- **Severity:** `P0 - Blocker`
- **Affected File:** `frontend/src/routes/AppRoutes.tsx` (Lines 51–71)
- **Evidence:**
  ```tsx
  <Route element={<DashboardLayout />}>
    <Route path="/studio/passport" element={<PassportStudioPage />} />
    <Route path="/queue" element={<JobsQueuePage />} />
    <Route path="/admin" element={<SuperAdminPage />} />
  </Route>
  ```
- **Impact:** Any unauthenticated visitor navigating directly to `http://localhost:5173/dashboard` or `/admin` is shown the full application interface without being redirected to `/login`.
- **Recommended Correction:** Create a `ProtectedRoute` wrapper checking `localStorage.getItem('token')` and store authentication state. Redirect unauthenticated visitors to `/login`.

---

## 2. High Severity Findings (P1)

### BUG-04: Missing Nginx SPA Route Fallback in Production Dockerfile
- **Severity:** `P1 - High`
- **Affected File:** `frontend/Dockerfile` (Lines 10–16)
- **Evidence:**
  ```dockerfile
  FROM nginx:alpine AS runner
  COPY --from=builder /app/dist /usr/share/nginx/html
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```
- **Impact:** Default Nginx web server returns `HTTP 404 Not Found` whenever a user directly refreshes or accesses a deep route like `/studio/passport`, `/dashboard`, or `/queue`.
- **Recommended Correction:** Add a custom `nginx.conf` file containing `try_files $uri $uri/ /index.html;` and copy it into `/etc/nginx/conf.d/default.conf`.

---

### BUG-05: CORS Origin Wildcard with Credentials Conflict in Docker Compose
- **Severity:** `P1 - High`
- **Affected File:** `docker-compose.yml` (Line 26) & `backend/src/app.ts` (Line 34)
- **Evidence:**
  `docker-compose.yml`: `CORS_ORIGIN=*`  
  `backend/src/app.ts`: `cors({ credentials: true, origin: env.CORS_ORIGIN === '*' ? true : ... })`
- **Impact:** According to W3C CORS specifications, browsers reject cross-origin XMLHttpRequests/fetch having `credentials: 'include'` when `Access-Control-Allow-Origin` is configured with wildcard `*`.
- **Recommended Correction:** Set explicit frontend URL (e.g. `http://localhost:5173` or domain name) in `CORS_ORIGIN`.

---

### BUG-06: Base64 Image Bloat in MongoDB Documents (16MB BSON Limit Risk)
- **Severity:** `P1 - High`
- **Affected Files:**
  - `backend/src/models/PassportJob.model.ts` (Lines 111–122)
  - `backend/src/models/DocumentJob.model.ts` (Lines 18–35)
  - `backend/src/models/IdCardJob.model.ts` (Lines 35–45)
- **Evidence:** High-resolution 300 DPI rasters (`originalImageUrl`, `processedImageUrl`, `sheetImageUrl`) store multi-megabyte base64 strings directly in MongoDB document fields.
- **Impact:** Storing 5MB+ base64 strings inside documents causes memory pressure, degrades query latency, inflates backups, and risks exceeding MongoDB's 16MB document cap.
- **Recommended Correction:** Stream processed rasters to an object store (S3, Cloudflare R2, MinIO, or local filesystem with Express static serve) and persist only the URI reference string in MongoDB.

---

### BUG-07: Type Loss on Database Restore Utility
- **Severity:** `P1 - High`
- **Affected File:** `backend/src/scripts/restore-db.ts` (Line 27)
- **Evidence:**
  ```typescript
  const jsonStr = zlib.gunzipSync(compressed).toString('utf-8');
  const payload = JSON.parse(jsonStr);
  ```
- **Impact:** Standard `JSON.parse` deserializes `_id` and date fields into plain strings instead of MongoDB `ObjectId` and `Date` types. Restored documents fail Mongoose `findById` queries and timestamp operations.
- **Recommended Correction:** Use MongoDB BSON Extended JSON (`bson.EJSON.parse()` / `bson.EJSON.stringify()`) to preserve data types during backup and restore.

---

### BUG-08: Missing Initial Super Admin Seed / Bootstrap Utility
- **Severity:** `P1 - High`
- **Affected Files:** `backend/src/modules/superadmin/superadmin.service.ts`
- **Evidence:** Tests had to manually mutate MongoDB (`await User.updateOne({ email }, { $set: { role: 'SUPER_ADMIN' } })`) because there is no registration endpoint, CLI command, or environment variable for provisioning the root super admin.
- **Impact:** In a clean production deployment, no user can log into the Super Admin panel without direct database terminal access.
- **Recommended Correction:** Add an automatic bootstrap script or CLI command (`npm run seed:admin`) that provisions a Super Admin account from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `.env`.

---

## 3. Medium Severity Findings (P2)

### BUG-09: Ambiguous User Login Query When Subdomain Is Omitted
- **Severity:** `P2 - Medium`
- **Affected File:** `backend/src/modules/auth/auth.service.ts` (Lines 177–185)
- **Evidence:**
  ```typescript
  const query: any = { email: cleanEmail, isActive: true };
  if (tenant) { query.tenantId = tenant._id; }
  const user = await User.findOne(query).select('+passwordHash');
  ```
- **Impact:** Because user emails are only unique per tenant (`{ tenantId: 1, email: 1 }`), if the same email is added as staff across two different shops, logging in without specifying a subdomain will arbitrarily authenticate against whichever record MongoDB returns first.
- **Recommended Correction:** Require `subdomain` during login or detect multiple matching accounts and prompt the user to select which shop they wish to access.

---

### BUG-10: Missing Studio Quota Consumption Enforcement on Backend
- **Severity:** `P2 - Medium`
- **Affected Files:**
  - `backend/src/modules/passport/passport.service.ts`
  - `backend/src/modules/ocr/ocr.service.ts`
- **Evidence:** `tenant.quotas.monthlyPassportLayoutsLimit` and `monthlyOcrPagesLimit` exist on the `Tenant` model, but processing endpoints do not check whether the shop has exceeded its limit.
- **Impact:** Tenants can consume unlimited passport print layouts and OCR extractions beyond their paid plan without being throttled.
- **Recommended Correction:** Inject quota check middleware before passport and OCR processing. Throw `HTTP 403 Forbidden` if usage limit is reached.

---

### BUG-11: Missing Scheduled Cron Job for 24-Hour Zero-Retention Purge
- **Severity:** `P2 - Medium`
- **Affected File:** `backend/src/server.ts`
- **Evidence:** `Tenant.settings.autoPurgeHours` defaults to `24`, but there is no scheduled background task to query and purge expired customer photos and document jobs.
- **Impact:** Sensitive customer documents and photos remain stored indefinitely in the database, violating the advertised Zero-Retention Privacy guarantee.
- **Recommended Correction:** Schedule a recurring job (via `node-cron` or background timer) to delete job files older than `autoPurgeHours`.

---

### BUG-12: Job Code Concurrency Collision Risk
- **Severity:** `P2 - Medium`
- **Affected File:** `backend/src/modules/job/job.controller.ts` (Line 167)
- **Evidence:**
  ```typescript
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const jobCode = `JOB-${Date.now().toString().slice(-4)}${randomSuffix}`;
  ```
- **Impact:** `slice(-4)` cycles every 10 seconds. With only 900 random suffixes, concurrent orders during rush counter hours can collide. MongoDB index on `jobCode` is non-unique.
- **Recommended Correction:** Add compound unique index `{ tenantId: 1, jobCode: 1 }` and generate job codes using high-entropy alphanumeric nanoid or sequential counters (`JOB-2026-00001`).

---

### BUG-13: Missing Database-Level Unique Constraint for Customer Phone
- **Severity:** `P2 - Medium`
- **Affected File:** `backend/src/models/Customer.model.ts` (Line 108)
- **Evidence:** `CustomerSchema.index({ tenantId: 1, phone: 1 })` lacks `{ unique: true }`.
- **Impact:** Rapid concurrent intake requests can bypass application-level checks and insert duplicate customer records.
- **Recommended Correction:** Create a partial unique index: `CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } })`.

---

### BUG-14: Auth Rate Limiter Blocks Automated Integration Test Runs
- **Severity:** `P2 - Medium`
- **Affected File:** `backend/src/middleware/rateLimiter.ts` (Lines 10–25)
- **Evidence:** Running test suites sequentially triggers `HTTP 429 TOO_MANY_REQUESTS: 'Too many authentication attempts from this IP, please try again in 15 minutes'`.
- **Impact:** Prevents automated CI/CD and integration test execution from completing on developer machines or test pipelines.
- **Recommended Correction:** Skip or raise the rate limit when `NODE_ENV === 'test'` or when a dedicated test bypass header is supplied.

---

### BUG-15: Hardcoded Mock Initial State in Zustand Store
- **Severity:** `P2 - Medium`
- **Affected File:** `frontend/src/store/useAppStore.ts` (Lines 26–39)
- **Evidence:**
  ```typescript
  currentTenant: {
    id: 'demo-shop-001',
    name: 'Metro Digital Studio & Xerox Point',
    subdomain: 'metro-studio',
    currency: 'USD',
    plan: 'PROFESSIONAL',
  },
  currentUser: {
    id: 'user-001',
    fullName: 'Shop Owner',
    email: 'owner@docustudio.io',
    role: 'OWNER',
  }
  ```
- **Impact:** Fresh browser sessions load with fake mock user and tenant context even when no real session exists.
- **Recommended Correction:** Default `currentTenant` and `currentUser` to `null` and hydrate them from `/api/v1/auth/me` on startup.

---

### BUG-16: Missing User Logout and Profile Dropdown in UI
- **Severity:** `P2 - Medium`
- **Affected File:** `frontend/src/components/layout/Header.tsx` (Lines 55–64)
- **Evidence:** The user profile pill in the header is static text with no dropdown menu, settings link, or logout button.
- **Impact:** Authenticated operators have no way to log out or switch accounts from the UI without clearing browser storage.
- **Recommended Correction:** Implement a dropdown menu with "Account Settings" and "Sign Out" actions that clear `localStorage` and call `/auth/logout`.

---

## 4. Low Severity Findings & Product Polish (P3)

### GAP-17: Unimplemented Real-Time WebSockets
- **Severity:** `P3 - Polish`
- **Affected Files:** Marketing pages claim "Live WebSocket Kanban Queue", but `JobsQueuePage.tsx` uses manual refresh.
- **Recommended Correction:** Add Socket.io or lightweight WebSocket server in `backend/src/server.ts` to broadcast job status updates to connected studio clients.

---

### GAP-18: Unimplemented Transactional Email and WhatsApp Notifications
- **Severity:** `P3 - Polish`
- **Affected Files:** `Header.tsx` (Static notification bell), `Tenant.settings.whatsappNotificationsEnabled`
- **Recommended Correction:** Integrate Nodemailer/Resend for password resets and Twilio/Meta API for customer WhatsApp pickup notices.

---

### GAP-19: Tesseract OCR Silent Timeout Fallback to Hardcoded Text
- **Severity:** `P3 - Polish`
- **Affected File:** `backend/src/modules/ocr/ocr.service.ts` (Lines 137–146)
- **Evidence:** When Tesseract takes longer than 8 seconds, it returns a hardcoded mock letter without informing the operator that extraction failed.
- **Recommended Correction:** Return an explicit warning flag `{ fallbackUsed: true }` in the API response so the UI displays an alert to the operator.

---

### GAP-20: Client-Side Canvas Chroma Tinting vs True AI Background Removal
- **Severity:** `P3 - Polish`
- **Affected File:** `frontend/src/pages/PassportStudioPage.tsx` (Lines 288–310)
- **Evidence:** Background replacement uses client-side RGB luminance thresholding, which only works cleanly on near-white studio backgrounds.
- **Recommended Correction:** Integrate a server-side segmentation model (such as ONNX / Rembg or WebGL MediaPipe selfie segmentation) for complex backgrounds.

---

### GAP-21: Large Frontend Vite Bundle Size Warning (>945 kB)
- **Severity:** `P3 - Polish`
- **Affected File:** `frontend/vite.config.ts`
- **Evidence:** Vite production build outputs a single JavaScript chunk of `945.22 kB` (exceeding Vite's 500 kB threshold).
- **Recommended Correction:** Implement dynamic `React.lazy()` imports for studio pages and configure `rollupOptions.output.manualChunks` for vendor libraries (lucide, react, tanstack).

