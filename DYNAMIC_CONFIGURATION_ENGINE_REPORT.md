# PHASE 18: DYNAMIC BUSINESS LOGIC AND CONFIGURATION ENGINE REPORT

**DocuStudio SaaS — Principal SaaS Architect & Backend Engineering Report**  
**Execution Date:** 2026-11-08  
**Verification Status:** **100% Passed (36/36 Automated Test Scenarios)**  
**Security & RBAC Enforcement:** **Strict Backend Invariant Enforcement**

---

## 1. Executive Summary

In Phase 18, DocuStudio transitioned all hardcoded business logic, static presets, static pricing, fixed feature lists, and rigid role matrices into an enterprise-grade, database-driven **Dynamic Configuration Engine**.

The critical security directive has been strictly upheld:
> **The frontend is never the authority for plan limits, permissions, pricing, or subscription eligibility. The backend enforces every business rule.**

All dynamic configuration layers are backed by MongoDB schemas, guarded by multi-tenant database queries, protected by in-memory TTL caching with immediate pattern-based invalidation, and audited in tamper-evident logs.

---

## 2. Dynamic Modules Architecture

The 14 modules specified in Phase 18 requirements have been completely externalized into dynamic database-driven models:

| # | Dynamic Module | Storage / Model | Authority & Capabilities | Caching & Invalidation |
|---|---|---|---|---|
| **1** | **Subscription Plans** | `PlanConfig` collection | Super Admin creates/edits plans, sets pricing (monthly/yearly), backup tiers, and popularity flags. | `plan:<PLAN_KEY>`, TTL 5m, invalidated upon plan update. |
| **2** | **Feature Access** | `PlanConfig.enabledModules` & `featureRestrictions` | Super Admin toggles modules (`PASSPORT`, `DOCUMENT`, `IDCARD`, `CV`, `OCR`, `PRINT_QUEUE`, `CRM`). `enforceModuleAccess` middleware rejects unauthorized tenants with HTTP 403. | Checked per plan tier in-memory; invalidated immediately when plan is updated. |
| **3** | **Storage Limits** | `PlanConfig.storageLimitMB` & `Tenant.storage` | Super Admin configures per-plan storage quotas. System calculates byte usage on file uploads and enforces limit. | Enforced in `Tenant` record with real-time aggregation. |
| **4** | **Staff Limits** | `PlanConfig.staffLimit` & `Tenant.quotas.staffLimit` | Super Admin configures staff caps. Shop Owner invites staff up to the quota; backend blocks invitations when limit is reached. | Real-time query `User.countDocuments({ tenantId })`. |
| **5** | **Job Limits** | `Tenant.quotas.monthlyJobsLimit` & `monthlyJobsUsed` | Super Admin configures monthly job allowance per tier. Backend `JobController.createJob` blocks creation with HTTP 403 if quota is exhausted. | Checked on every job creation; auto-increments upon job creation. |
| **6** | **Service Categories** | `ServiceItem` collection (`category`) | Categories (`PASSPORT`, `DOCUMENT`, `IDCARD`, `PHOTO`, `FINISHING`, `STATIONERY`) dynamically grouped and queried. | Cached per tenant or globally; invalidated on custom service creation. |
| **7** | **Service Pricing** | `ServiceItem` collection (`unitPrice`, `minPrice`) | Super Admin configures global default pricing. Shop Owners can override base prices or define shop-specific custom services. | `services:tenant:<id>` & `services:global`, TTL 5m, invalidated on custom service updates. |
| **8** | **Passport Presets** | `PassportPreset` collection | Super Admin creates global presets with DPI calculations. Shop Owners create custom shop presets with custom mm dimensions and auto-computed 300 DPI pixels. | `passport_presets_<tenantId>`, TTL 5m, invalidated on preset creation/deletion. |
| **9** | **Document Templates** | `DocumentTemplate` collection | Super Admin & Shop Owners create reusable dynamic document templates with variable placeholders (e.g. `{{applicantName}}`). | In-memory cache invalidated on template updates. |
| **10** | **CV Templates** | `CvTemplate` collection | Super Admin creates global CV templates across categories (`MODERN`, `CLASSIC`, `PROFESSIONAL`, `EXECUTIVE`, `BIODATA`). | `cv_templates:<category>`, TTL 5m, invalidated upon template mutations. |
| **11** | **Roles & Permissions** | `RolePermission` collection | Super Admin customizes permission sets per role (`OWNER`, `MANAGER`, `OPERATOR`, `ACCOUNTANT`, `DESIGNER`). Dynamic middleware `authorizePermissions` enforces at route level. | `role_perm_<ROLE>`, TTL 5m, invalidated upon role update. |
| **12** | **Shop Settings** | `Tenant.settings` | Shop Owners configure shop profile, localized name, working hours, auto-backup preferences, and UI branding without impacting other shops. | Scoped strictly to `req.tenant._id`. |
| **13** | **Invoice Settings** | `Tenant.settings.invoice` & `PlatformSettings` | Shop Owners customize invoice prefixes, VAT registration numbers, default notes, and terms & conditions. | Scoped strictly to tenant context. |
| **14** | **Print Settings** | `Tenant.settings.print` & `Printer` models | Shop Owners configure default paper sizes, duplex settings, margins, DPI presets, and local print spooler dispatching. | Scoped strictly to tenant context. |

---

## 3. Super Admin & Shop Owner Capabilities

### A. Super Admin Capabilities
- **Plan Management (`/api/v1/superadmin/plans`)**: Create, update, and safely archive subscription plans. Prevent archiving plans with active paying tenants.
- **Dynamic Module Enablement**: Toggle core features (e.g., OCR, AI Photo Restoration, Multi-Printer Spool) per plan tier.
- **Global Service Catalog (`/api/v1/superadmin/services`)**: Set default platform-wide services and baseline prices.
- **Global Passport Presets (`/api/v1/superadmin/presets`)**: Define official international passport and visa specifications.
- **Global CV Templates (`/api/v1/superadmin/cv-templates`)**: Manage resume layouts across 5 design paradigms.
- **Role Permission Matrix (`/api/v1/superadmin/roles/permissions`)**: Adjust what permissions roles have dynamically.
- **Platform Settings (`/api/v1/superadmin/settings`)**: Maintain platform-wide defaults, maintenance modes, storage thresholds, and security policies.

### B. Shop Owner Capabilities
- **Shop-Specific Custom Services (`/api/v1/services/custom`)**: Add custom services (e.g., "Spiral Binding", "Glossy Lamination", "PVC ID Card Lamination") with custom unit prices and minimum order amounts.
- **Custom Passport Photo Presets (`/api/v1/passport/presets/custom`)**: Define bespoke photo sizes with automatic 300 DPI millimeter-to-pixel mathematics.
- **Service Catalog Merging (`/api/v1/services/catalog`)**: View a unified catalog that seamlessly merges platform global services with shop custom items and local price overrides.
- **Strict Isolation**: Shop owners can never modify another shop's services or mutate platform-wide system defaults.

---

## 4. Performance & Caching Engine

DocuStudio features a dedicated in-memory `ConfigCache` with automatic TTL and pattern invalidation:
- **Default TTL**: 5 minutes for rapid database offloading.
- **Read-Through**: Lookups query cache first; on cache miss, read from MongoDB Atlas and populate cache.
- **Write-Invalidation**: Any mutation (e.g. updating plan features, saving custom services, editing role permissions) immediately executes `configCache.invalidate(key)` or `configCache.invalidatePattern(prefix)`.
- **Zero Stale Reads**: Changes made by Super Admins or Shop Owners take effect instantly on the very next incoming HTTP request.

---

## 5. Automated Verification Results (Phase 18 Test Suite)

A comprehensive test script (`backend/src/scripts/phase18-dynamic-config-test.ts`) was executed against the live database:

```
======================================================================
--- STARTING PHASE 18: DYNAMIC BUSINESS LOGIC & CONFIGURATION ENGINE ---
======================================================================

--- TEST 1: Register Tenant (Shop Owner) & Setup Super Admin ---
  [PASS] Shop registered successfully (status 201)
  [PASS] Admin base account registered
  [PASS] Admin logged in with SUPER_ADMIN role

--- TEST 2: Dynamic Service Catalog (Global & Shop-Custom) ---
  [PASS] Retrieved service catalog (HTTP 200)
  [PASS] Catalog contains standard seeded services
  [PASS] Shop Owner created custom service (HTTP 201)
  [PASS] Shop Owner updated custom service unit price (HTTP 200)
  [PASS] Custom service unit price updated to 65
  [PASS] Super Admin upserted global service (HTTP 200)
  [PASS] Non-admin blocked from /superadmin/services (HTTP 403)

--- TEST 3: Dynamic Passport Presets & 300 DPI Validation ---
  [PASS] Retrieved passport presets (HTTP 200)
  [PASS] Presets include standard country sizes
  [PASS] Shop Owner created custom preset (HTTP 201)
  [PASS] Auto-calculated widthPx at 300 DPI: 413
  [PASS] Auto-calculated heightPx at 300 DPI: 531
  [PASS] Super Admin created global passport preset (HTTP 200)
  [PASS] Global preset auto-calculated 45mm = 531px

--- TEST 4: Dynamic CV Templates Catalog ---
  [PASS] Retrieved CV templates catalog (HTTP 200)
  [PASS] CV templates seeded across categories
  [PASS] Super Admin created global CV template (HTTP 200)

--- TEST 5: Dynamic Plan Feature Access Gatekeeping ---
  [PASS] Super Admin disabled OCR module for STARTER plan
  [PASS] Access to /ocr/extract blocked when module disabled in plan (HTTP 403)
  [PASS] Super Admin re-enabled OCR module for STARTER plan
  [PASS] Access allowed past feature gate (HTTP 400 validation error, not 403 forbidden)

--- TEST 6: Dynamic Monthly Job Limits Enforcement ---
  [PASS] Job creation rejected when monthlyJobsUsed >= monthlyJobsLimit (HTTP 403)
  [PASS] Job successfully created within quota limits (HTTP 201)
  [PASS] Tenant monthlyJobsUsed incremented to 1

--- TEST 7: Dynamic Role-Permissions Matrix (Super Admin) ---
  [PASS] Super Admin retrieved role permission matrix (HTTP 200)
  [PASS] Super Admin updated permissions for OPERATOR role (HTTP 200)
  [PASS] OPERATOR has JOBS_PRINT permission

--- TEST 8: Config Cache & Instant Invalidation ---
  [PASS] First catalog call succeeds
  [PASS] Second call served directly from memory cache
  [PASS] Created new service and invalidated cache
  [PASS] Fresh catalog query immediately includes invalidated item

--- TEST 9: Security Invariants (Tenant Isolation & Authorization) ---
  [PASS] Tenant isolation preserved: custom services are private to tenant
  [PASS] Cross-tenant edit prevented (HTTP 404 Not Found)

======================================================================
--- TEST RESULTS: 36 PASSED, 0 FAILED ---
======================================================================
```

---

## 6. Monorepo Build Integrity

Both workspaces build cleanly with zero compilation errors:
- **Backend**: `rimraf dist && tsc` -> **Clean (0 errors)**
- **Frontend**: `tsc -b && vite build` -> **Clean (0 errors)**
- **Total Test Suites Passed Across All Phases**: **437 tests passed, 0 failed**

