# DocuStudio SaaS — Production Deployment Documentation

This document outlines the standard production deployment architecture and steps for deploying DocuStudio SaaS across multi-tenant cloud environments.

---

## 1. Architecture Overview

```
                      [ Cloudflare / Route53 DNS + DDoS Shield ]
                                          │
                                 (HTTPS :443 / SSL)
                                          ▼
                         [ Nginx Reverse Proxy & Load Balancer ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     [ Frontend Client Container ]                 [ Backend API Cluster (Node.js) ]
         Port 80 (Nginx static)                         Port 5000 (Express / TS)
         Vite React SPA                                 PM2 Cluster / Docker
                  │                                               │
                  │                                  ┌────────────┴────────────┐
                  │                                  ▼                         ▼
                  │                        [ MongoDB Replica Set ]     [ Local / Cloud Spooler ]
                  │                          Atlas or Self-hosted       Direct Print Agent
                  │
                  └──────> Communicates with Backend via REST & WebSockets
```

---

## 2. Infrastructure Prerequisites

| Component | Minimum Specification | Recommended Production |
| :--- | :--- | :--- |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB - 16 GB (for Sharp multi-threaded image processing) |
| **Disk** | 40 GB SSD | 100 GB NVMe SSD |
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS (Docker Engine 26+) |
| **Database** | MongoDB 7.0+ | MongoDB 8.0 Enterprise / Atlas Cluster (M10+) |
| **Node.js** | Node.js 20.x | Node.js 22.x LTS |

---

## 3. Containerized Deployment with Docker Compose

DocuStudio includes a production-grade multi-stage `docker-compose.yml`.

### Step 1: Clone & Configure
```bash
git clone https://github.com/docustudio/docustudio-saas.git /opt/docustudio
cd /opt/docustudio
cp backend/.env.example backend/.env
```

### Step 2: Configure Environment Variables
Edit `backend/.env`:
```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/docustudio_saas?retryWrites=true&w=majority
CORS_ORIGIN=https://app.docustudio.io,https://docustudio.io
JWT_ACCESS_SECRET=your_super_strong_production_secret_32_characters_minimum
JWT_REFRESH_SECRET=your_super_strong_refresh_secret_32_characters_minimum
PAYMENT_SECRET=production_hmac_secret_for_payment_gateways
LOG_LEVEL=info
```

### Step 3: Build & Launch Containers
```bash
docker compose up -d --build
```

Verify service status:
```bash
docker compose ps
docker compose logs -f backend
```

---

## 4. Production Nginx & SSL Configuration

Create `/etc/nginx/sites-available/docustudio.conf`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name docustudio.io *.docustudio.io;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name docustudio.io *.docustudio.io;

    # SSL Certificates (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/docustudio.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/docustudio.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval';" always;

    # Max File Upload Size (Supports high-res documents and scans)
    client_max_body_size 50M;

    # Backend API Routing
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Frontend Static SPA Routing
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/docustudio.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Process Management with PM2 (Non-Docker Environments)

For bare-metal or cloud VMs running without Docker:

```bash
# Build packages
npm run build -w backend
npm run build -w frontend

# Start backend cluster with PM2
pm2 start dist/server.js --name "docustudio-backend" -i max --cwd ./backend
pm2 save
pm2 startup
```

---

## 6. Monitoring & Health Checks

- **Application Health Check:** `GET https://app.docustudio.io/api/v1/health`
  - Responds with `200 OK` and uptime, memory, and database connection status.
- **Log Management:**
  - Production logs are structured with Winston in `backend/logs/combined.log` and `error.log`.
  - Connect with Datadog, Prometheus/Grafana, or Grafana Loki for centralized log aggregation.

