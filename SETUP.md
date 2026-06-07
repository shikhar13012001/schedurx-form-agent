# ScheduRX — Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database (Supabase recommended)
- Supabase project (for auth)

---

## 1. Clone and install

```bash
git clone <repo>
cd schedurx
pnpm install
```

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# App URL (used for Razorpay callbacks + invite emails)
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Optional integrations
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"

CALCOM_API_URL="https://api.cal.com"
CALCOM_API_KEY=""

# Cron security (set to a random secret string)
CRON_SECRET=""

# Voice agent (optional)
AGENT_API_KEY=""
AGENT_WEBHOOK_URL=""
```

---

## 3. Database setup

```bash
# Push schema to database
pnpm exec prisma db push

# Generate Prisma client
pnpm exec prisma generate

# Seed demo data (optional)
pnpm db:seed
```

---

## 4. Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 5. First-time onboarding

1. Go to `/login` and sign up with your email via Supabase Auth.
2. You will be redirected to `/onboarding` — complete the 3-step wizard:
   - **Step 1:** Clinic name and details
   - **Step 2:** Your doctor profile (optional if you're admin-only)
   - **Step 3:** Integration keys (can be skipped and configured later in Settings)
3. You'll land on the dashboard.

---

## 6. Patient intake form

The public booking form is at:

```
/<clinicId>/<patientPhone>
```

Share this URL with patients (e.g. via WhatsApp or your website). You can also pre-select a doctor:

```
/<clinicId>/<patientPhone>?doctor=<doctorId>
```

---

## 7. Doctor microsite

Each doctor gets a public microsite at:

```
/doctor/<micrositeSlug>
```

Configure the `micrositeSlug` in Settings → Doctor profile.

---

## 8. WhatsApp reminders (cron)

Call the reminder cron endpoint every 5 minutes:

```
POST /api/reminders/send
Authorization: Bearer <CRON_SECRET>
```

### Railway cron setup

In your Railway service, add a cron job:

```
*/5 * * * * curl -X POST https://your-domain.com/api/reminders/send -H "Authorization: Bearer $CRON_SECRET"
```

---

## 9. Deploy to Railway

```bash
railway login
railway link
railway up
```

Or connect your GitHub repo to Railway and it will auto-deploy on push.

Set all environment variables in the Railway dashboard under your service's **Variables** tab.

---

## 10. Production checklist

- [ ] `DATABASE_URL` and `DIRECT_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `NEXT_PUBLIC_APP_URL` set to your production domain
- [ ] Supabase email confirmation enabled (or magic-link only)
- [ ] Razorpay credentials set (for payments)
- [ ] Twilio credentials set (for WhatsApp reminders)
- [ ] `CRON_SECRET` set and cron job configured
- [ ] `prisma db push` run against production database
- [ ] Health endpoint responding: `GET /api/health`
