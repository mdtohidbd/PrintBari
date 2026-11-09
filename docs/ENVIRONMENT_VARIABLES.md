# DocuStudio SaaS — Environment Variables Documentation

Complete reference of all environment variables across backend and frontend services.

---

## 1. Backend Environment Variables (`backend/.env`)

| Variable | Type | Default | Required | Purpose & Description |
| :--- | :--- | :--- | :---: | :--- |
| `NODE_ENV` | String | `development` | Yes | Runtime environment: `development`, `production`, or `test`. |
| `PORT` | Number | `5000` | No | HTTP port the Express server listens on. |
| `HOST` | String | `localhost` | No | Host binding interface (`0.0.0.0` in Docker). |
| `MONGODB_URI` | String | *None* | **Yes** | MongoDB connection string (Replica set or Atlas cluster). |
| `CORS_ORIGIN` | String | `http://localhost:5173` | Yes | Whitelist of origins permitted to call the API (comma-separated). |
| `LOG_LEVEL` | String | `info` | No | Winston logger verbosity: `error`, `warn`, `info`, `http`, `debug`. |
| `JWT_ACCESS_SECRET` | String | *Default Dev Secret* | **Yes** | Cryptographic key (min 32 chars) for signing access JWTs (15 min). |
| `JWT_REFRESH_SECRET`| String | *Default Dev Secret* | **Yes** | Cryptographic key (min 32 chars) for signing refresh tokens (7 days).|
| `JWT_ACCESS_EXPIRY` | String | `15m` | No | Lifespan of access tokens before requiring silent refresh. |
| `JWT_REFRESH_EXPIRY`| String | `7d` | No | Lifespan of refresh tokens stored in database. |
| `BCRYPT_SALT_ROUNDS`| Number | `12` | No | Password hashing work factor (recommended 12 for production). |
| `PAYMENT_SECRET` | String | *Dev Salt* | **Yes** | HMAC SHA-256 secret for verifying payment gateway callbacks. |
| `BKASH_APP_KEY` | String | *Optional* | No | Official bKash merchant gateway application key. |
| `BKASH_APP_SECRET` | String | *Optional* | No | Official bKash merchant gateway secret. |
| `BKASH_USERNAME` | String | *Optional* | No | Merchant portal login ID for bKash token acquisition. |
| `BKASH_PASSWORD` | String | *Optional* | No | Merchant portal credentials for bKash. |
| `NAGAD_MERCHANT_ID` | String | *Optional* | No | Nagad PGW registered merchant ID. |
| `NAGAD_PUBLIC_KEY` | String | *Optional* | No | Nagad PGW public key for signature verification. |
| `NAGAD_PRIVATE_KEY`| String | *Optional* | No | Nagad merchant private key for signature signing. |
| `SSLCOMMERZ_STORE_ID`| String | *Optional* | No | SSLCommerz registered store ID. |
| `SSLCOMMERZ_STORE_PASSWORD` | String | *Optional* | No | SSLCommerz store secret password. |
| `SSLCOMMERZ_IS_SANDBOX` | Boolean | `true` | No | Toggle SSLCommerz live vs sandbox endpoint. |

---

## 2. Frontend Environment Variables (`frontend/.env`)

| Variable | Type | Default | Required | Purpose & Description |
| :--- | :--- | :--- | :---: | :--- |
| `VITE_API_BASE_URL` | String | `/api/v1` | No | Base path or URL pointing to the Backend REST API. |
| `VITE_APP_TITLE` | String | `DocuStudio SaaS` | No | Browser title and default page heading. |
| `VITE_ENABLE_ANALYTICS` | Boolean | `false` | No | Toggles client-side telemetry or error reporting. |

---

## 3. Production Security Checklist for Secrets

1. **Never commit `.env` files:** Ensure `.env` is listed in `.gitignore` at all times.
2. **Key Rotation Policy:** Rotate `JWT_ACCESS_SECRET` and `PAYMENT_SECRET` periodically or immediately upon credential compromise.
3. **Entropy:** Production keys should be generated using secure random bytes:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. **Environment Isolation:** Never use production MongoDB credentials or payment API keys in local development or test suites.

