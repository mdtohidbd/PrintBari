> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `backend\.env` (Domain: **Config/Infrastructure**)

### 🔴 Config/Infrastructure Gotchas
- **Low cohesion detected in Domain Cluster 3**: Cluster 3 (31 nodes) has a very low cohesion score (0.05). This suggests the community is a "spaghetti" module containing unrelated logic that should be separated into cleaner domain boundaries.

### 📐 Config/Infrastructure Conventions & Fixes
- **[what-changed] 🟢 Edited backend/.env.example (54 changes, 66min)**: Active editing session on backend/.env.example.
54 content changes over 66 minutes.
- **[discovery] 7 potentially unused files detected**: These files are not imported by any other file in the codebase and may be dead code:
  • auth.validation.ts
  • tenant.validation.ts
  • security-test.ts
  • server.ts
  • usehealth.ts
  • useappstore.ts
  • vite.config.ts

Consider verifying if they are entry points, dynamically required, or can be safely removed.
- **[problem-fix] problem-fix in .gitignore**: File updated (external): .gitignore

Content summary (40 lines):
# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
dist/
build/
coverage/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.env
!.env.example

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor & OS files
.DS_Store
Thumbs.db
.idea/
*.swp
*.swo

# Internal Agent & Workspace Memory
AGENT.md
CLAUDE.md
.agent-mem/
.brainsync/

