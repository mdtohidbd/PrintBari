# DocuStudio SaaS — UI/UX & Design Systems Audit (Phase 15)

**Audited By:** Senior Full-Stack Engineer & Product UX Auditor  
**Scope:** Design tokens, Layouts, Typography, Components, State Handling, Responsiveness, and Accessibility across all 20+ application screens.

---

## 1. Design System & Token Consistency

### Typography
- **Font Stack:** Standard system sans-serif (`font-sans` configured in Tailwind via Inter / system fallbacks).
- **Hierarchy:** Clear distinction across titles (`text-2xl font-extrabold`), section headers (`text-lg font-bold`), subtext (`text-xs text-slate-500`), and monospace identifiers (`font-mono text-xs`).
- **Issues Observed:**
  - Minor inconsistency in Studio headings: `PassportStudioPage.tsx` uses `text-xl font-bold text-slate-900`, whereas `OcrStudioPage.tsx` uses `text-2xl font-extrabold tracking-tight`.
  - Bengali typography: When viewing Bengali documents or templates in CV Builder / OCR, standard font fallback occurs; no dedicated webfont (e.g. `Noto Sans Bengali` or `Hind Siliguri`) is imported in `index.html` or `index.css`.

### Color Palette
- **Primary Brand Tokens:** Tailwind custom `brand` palette with blue-to-indigo gradients (`bg-brand-600`, `from-brand-600 to-indigo-500`).
- **Semantic Status Tokens:**
  - Success / Active: `emerald-500` / `emerald-600` (consistent across badges, health dots, toast alerts).
  - Warning / In Progress: `amber-500` / `amber-600`.
  - Danger / Urgent / Error: `rose-500` / `rose-600`.
  - Neutral / Muted: `slate-100` through `slate-900`.
- **Issues Observed:**
  - In `Header.tsx`, the notification dot uses `bg-brand-600` instead of a warning/alert color like `bg-rose-500`.

### Spacing & Grid System
- Standard 4px baseline (`p-4`, `p-6`, `gap-4`, `gap-6`, `space-y-6`).
- Max-width containers (`max-w-7xl mx-auto`) correctly constrain wide desktop viewports across Dashboard, Queue, Customers, and Studios.

---

## 2. Layout & Shell Consistency

### Public SaaS Shell (`PublicLayout.tsx`)
- Standard sticky navigation header (`Navbar.tsx`) with brand logo, nav links (Features, Pricing, About, FAQ, Contact), and Sign In / Start Free Trial CTA buttons.
- Sticky footer (`Footer.tsx`) with product columns, legal links, language toggle, and copyright notices.
- Consistent smooth-scroll to top via `ScrollToTop.tsx` on route changes.

### Dashboard OS Shell (`DashboardLayout.tsx`)
- Fixed sidebar (`Sidebar.tsx`) with collapsible toggle (`w-64` expanded, `w-20` icon-only collapsed).
- Top bar (`Header.tsx`) displays active shop business name, subscription plan badge, real-time backend API connection status pill, and notification bell.
- **Issues Observed:**
  1. **Missing User Dropdown / Logout:** The user pill in the top-right corner of `Header.tsx` is static text (`Shop Owner`, `owner@docustudio.io`). Clicking it does nothing; there is no profile modal, account settings link, or logout action.
  2. **Notification Bell Inaction:** Clicking the bell icon in `Header.tsx` does not trigger a dropdown or flyout panel.
  3. **Sidebar RBAC Leak:** The `Super Admin` link in `Sidebar.tsx` is visible to all authenticated accounts, including non-admin staff.

---

## 3. Responsive Behavior Audit (Mobile, Tablet, Desktop)

| Viewport Width | Tested Page | Findings & Quality Rating |
| :--- | :--- | :--- |
| **Mobile (< 640px)** | `HomePage.tsx` | **Excellent.** Hero stacks vertically, features wrap cleanly, mobile menu drawer functions properly. |
| **Mobile (< 640px)** | `LoginPage.tsx` / `RegisterPage.tsx` | **Good.** Left branding column hides automatically (`hidden lg:flex`), form fields scale to 100% width. |
| **Mobile (< 640px)** | `DashboardPage.tsx` | **Good.** KPI cards collapse from 4-column to 1-column grid. Quick Action buttons wrap cleanly. |
| **Mobile (< 640px)** | `JobsQueuePage.tsx` | **Acceptable.** Kanban/Queue table scrolls horizontally. Detail drawer covers screen as full modal. |
| **Mobile (< 640px)** | `PassportStudioPage.tsx` | **Suboptimal.** Precision crop boxes, canvas manipulation, and 8-up photo sheet previews are cramped on small screens. Recommended minimum width is tablet (768px+). |
| **Tablet (768px - 1024px)**| `IdCardStudioPage.tsx` | **Good.** Dual front/back card upload zones stack vertically; A4 composition canvas preview scales down cleanly. |
| **Desktop (> 1024px)** | All Pages | **Excellent.** High information density tailored for busy studio operators. |

---

## 4. Component Interaction & State Audit

### Button Behavior
- `Button.tsx` implements:
  - `isLoading` state displaying a circular `Spinner.tsx` and disabling clicks to prevent double submissions.
  - Consistent hover, active, and focus rings (`focus:ring-2 focus:ring-brand-500`).
  - Left and right icon support (`leftIcon`, `rightIcon`).
- Tested across forms: Button states correctly disable while awaiting promises.

### Form Validation
- Standardized on `react-hook-form` with `zodResolver`:
  - `LoginPage.tsx`: Validates subdomain length, email regex, password minimum length. Inline errors render in red text (`text-rose-600 text-xs`).
  - `RegisterPage.tsx`: Multi-step form (3 steps) with step validation via `trigger()`. Prevents advancing to Step 2 without valid shop name/subdomain.
  - `QuickOrderModal.tsx`: Requires customer phone and name, calculates live totals based on copies and subtotal.
  - `ContactPage.tsx`: Validates email, phone, and inquiry category.

### Modals & Drawers
- `Modal.tsx` implements:
  - Dark backdrop overlay (`bg-slate-900/50`).
  - Center alignment with max-width constraints (`max-w-md`, `max-w-lg`, `max-w-2xl`).
  - Escape key or backdrop click handlers.
  - Smooth scale/fade animation.
- Job Detail Drawer (`JobsQueuePage.tsx`): Slides in smoothly from the right side (`max-w-xl`), presenting the full activity log timeline.

### Loading States
- **Skeleton Loaders:** `DashboardPage.tsx` displays pulsating grid skeletons (`animate-pulse h-32 bg-slate-200`) while metrics are loading.
- **Spinner Overlays:** Studio image processing triggers centered backdrop spinners with status indicators ("Processing 300 DPI Raster...", "Composing Print Sheet...").

### Empty States
- **Well Implemented:**
  - `JobsQueuePage.tsx`: When no jobs match search/filter, renders an illustrated empty state with a "Create First Job" CTA button.
  - `CustomersPage.tsx`: Empty state prompts operator to intake walk-in customer.
  - `PrintSpoolerPage.tsx`: Empty queue displays "All print spoolers are idle. Send an order from any studio module."
- **Needs Improvement:**
  - `SuperAdminPage.tsx`: If user is not authorized or no records exist, renders a blank table without explanatory empty-state guidance.

### Error States
- `DashboardPage.tsx`: Renders an alert box with retry button if database metrics fetch fails.
- Studio image uploads: Handles oversized (>10MB) or unreadable image files with a dismissible error toast banner.

---

## 5. Accessibility (a11y) Audit

1. **Color Contrast:**
   - Text against background in main UI achieves WCAG AA compliance (slate-800 text on white background: 13.5:1 ratio).
   - Badge pills (`bg-emerald-50 text-emerald-700`) satisfy minimum 4.5:1 contrast.
2. **Keyboard Navigation:**
   - Interactive buttons and inputs have visible focus outlines (`focus:ring-2`).
   - Accordion in FAQ page responds to Enter and Space keys.
3. **Screen Reader Deficiencies:**
   - Canvas elements in `PassportStudioPage.tsx` and `DocumentA4StudioPage.tsx` lack `aria-label` or fallback descriptions.
   - Dynamic canvas manipulation sliders (brightness, contrast, tolerance) lack `aria-valuenow` and `aria-valuemin` attributes.
   - SVG icons rendered via `lucide-react` do not consistently declare `aria-hidden="true"`.

