# PrintBari — Digital Studio, Photocopy & Document Operations Platform

A modern, multi-tenant cloud SaaS platform designed specifically for photocopy kiosks, digital photo studios, cyber cafés, and document processing centers. (Formerly DocuStudio).

---

## 🏛️ System Architecture Overview

- **Monorepo Architecture:** Clean modular design using npm workspaces (`frontend/` and `backend/`).
- **Frontend App:** React 18 with TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Zustand, and Lucide icons.
- **Backend API:** Node.js, Express.js with TypeScript, Mongoose ODM, Winston logging, and Zod environment/request validation.
- **Database Engine:** MongoDB 8.x with connection pooling, automatic reconnection, and multi-tenant schema readiness (`tenant_id` context).
- **Quality & Safety:** Centralized error handling (`AppError`), unified API envelopes, async wrappers, and CORS/Helmet security configurations.

---

## 📁 Repository Structure

```
.
├── backend/                  # Express + TypeScript + Mongoose Backend API
│   ├── src/
│   │   ├── config/           # Database, environment, and logger configurations
│   │   ├── errors/           # Custom AppError classes
│   │   ├── middleware/       # Error handling, request logging, tenant context, Zod validation
│   │   ├── modules/
│   │   │   └── health/       # Health check controller, router, and service
│   │   ├── utils/            # Async handler, standard API response helper
│   │   ├── app.ts            # Express application factory
│   │   └── server.ts         # Server bootstrap and graceful shutdown
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/                 # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── api/              # Axios client with tenant headers & API services
│   │   ├── components/
│   │   │   ├── common/       # Button, Input, Card, Badge, Modal, Spinner
│   │   │   └── layout/       # Header, Sidebar, DashboardLayout
│   │   ├── hooks/            # TanStack Query custom hooks
│   │   ├── pages/            # DashboardPage, HomePage, NotFoundPage
│   │   ├── routes/           # AppRoutes configuration
│   │   ├── store/            # Zustand global state (tenant, sidebar)
│   │   ├── types/            # Shared interfaces and TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml        # Multi-container orchestration (Mongo, Backend, Frontend)
├── package.json              # Monorepo root with unified scripts
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js (v18.0.0 or higher, tested on v22 & v25)
- npm (v9.0.0 or higher)
- MongoDB (Running locally on `localhost:27017` or MongoDB Atlas URI)

### 1. Installation
Install all root, backend, and frontend dependencies in one command:
```bash
npm install
```

### 2. Environment Configuration
Backend `.env`:
```env
NODE_ENV=development
PORT=5000
HOST=localhost
MONGODB_URI=mongodb://localhost:27017/docustudio_saas
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

Frontend `.env`:
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME="DocuStudio SaaS"
```

### 3. Running in Development Mode
Run both backend and frontend concurrently:
```bash
npm run dev
```
Or individually:
```bash
npm run dev -w backend   # Starts Express on http://localhost:5000
npm run dev -w frontend  # Starts Vite on http://localhost:5173
```

### 4. Verifying Health Status
Open your browser or run curl:
- **API Health Check:** `http://localhost:5000/api/v1/health`
- **Frontend Dashboard:** `http://localhost:5173/dashboard`

---

## 🔒 Security & Standards
- Never commit production secrets or real `.env` files.
- Centralized error handler captures all operational and unexpected errors, preventing server crashes.
- All requests are tagged with `x-tenant-id` to enforce shop-level isolation.

