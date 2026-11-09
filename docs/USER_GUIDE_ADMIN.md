# DocuStudio SaaS — Super Admin User Guide

This guide is designed for the SaaS platform owner and platform administrators managing DocuStudio at `https://app.docustudio.io/admin`.

---

## 1. Accessing the Super Admin Command Center

1. Log in with an account assigned the `SUPER_ADMIN` role.
2. In the left navigation menu, click **Super Admin** or navigate directly to `/admin`.
3. If an unauthorized user attempts to access `/admin`, they will be redirected with a permission warning.

---

## 2. Navigating the Command Center

### Tab 1: Platform Overview
- **Key Metrics:** Review Total Shops, Active Paying Shops, Trial Shops, and Suspended Shops in real time.
- **Financial Pulse:** Inspect Total SaaS Revenue, Monthly Recurring Revenue (MRR), and today's collections in Bangladeshi Taka (৳).
- **Storage Consumption:** Monitor platform-wide cloud storage usage vs. provisioned limits.
- **Live Feed:** Stream of recent operational events, logins, and subscription activations.

### Tab 2: Shop Management
- **Search & Filter:** Find any shop by name, subdomain, email, or filter by subscription status (`ACTIVE`, `TRIALING`, `EXPIRED`, `SUSPENDED`).
- **Inspect Shop:** Click **View** to inspect a shop's total registered staff, job orders created, and past transaction records.
- **Change Plan / Extend Trial:** Click **Plan** on any shop row to upgrade/downgrade their tier or reset their trial without charging them.
- **Suspend / Activate:** Click the **Ban / Power** icon to immediately suspend a delinquent shop. A suspension reason is required and logged into the audit trail.

### Tab 3: Subscription Plans
- **Customize Pricing:** Edit Starter (৳990), Pro (৳1,990), Business (৳3,990), or Enterprise (৳7,990) pricing in real time.
- **Adjust Quotas:** Modify storage caps (in MB), staff operator seat limits, and monthly job volumes.
- **Create Custom Plan:** Click **Create New Plan** to introduce custom tiers (e.g. `VIP_STUDIO`) for franchise networks.
- **Archive Plans:** Archive discontinued plans. The system automatically prevents archiving any plan with active paying shops.

### Tab 4: Payment Ledger
- Audit every transaction code (`TXN-XXXXXX`), gateway provider (bKash, Nagad, SSLCommerz), amount, and settlement status.
- View official VAT receipts and monitor gateway failure rates.

### Tab 5: Platform Settings
Adjust system variables across 6 categories:
- **WEBSITE:** Platform Brand Name, Tagline, Support Email, and Telephone.
- **EMAIL:** Outgoing SMTP host, port, and sender display name.
- **NOTIFICATION:** Email and SMS notification toggles and trial expiry reminder threshold.
- **STORAGE:** Maximum single upload size (MB), allowed extensions, and zero-retention auto-purge hours.
- **SECURITY:** Rate limiting thresholds, session timeouts, and two-factor authentication requirements.
- **MAINTENANCE:** Single-click platform maintenance mode switch and custom downtime message.

### Tab 6: Security Audit Logs
- Comprehensive, immutable audit trail of every administrative action, plan change, shop suspension, and security violation.
- Filter by action type, shop, or status.

