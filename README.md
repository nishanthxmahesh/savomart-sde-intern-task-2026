# Savomart — Loyalty Companion App

A customer-facing loyalty companion for Savomart shoppers — points, offers, store discovery, support tickets — plus a full **admin panel** with bulk Excel customer import and an AI chat agent. Built for the SDE Intern take-home challenge.

---

## Submission

| | |
|---|---|
| **Author** | Nishanth Mahesh |
| **Live frontend (Vercel)** | <https://savomart-loyalty.vercel.app/> |
| **Live backend (Render)** | <https://savomart-api-q4vb.onrender.com> |
| **Video demo (Google Drive)** | _To be added — see commit history for updated link_ |
| **Repository** | <https://github.com/nishanthxmahesh/savomart-sde-intern-task-2026> |

> **Heads-up on the deployed demo:** Render's free tier sleeps after 15 min idle — the first request takes ~30s to wake the backend. After that it's snappy. Data persists across restarts via Neon Postgres (see [Tech & library choices](#tech--library-choices)).

---

## Table of contents

1. [Setup — run locally end-to-end](#setup--run-locally-end-to-end)
2. [How to log in / test the app](#how-to-log-in--test-the-app)
3. [Features built](#features-built)
4. [Data model & schema](#data-model--schema)
5. [Tech & library choices](#tech--library-choices)
6. [Design decisions & trade-offs](#design-decisions--trade-offs)
7. [Known issues & what I'd improve](#known-issues--what-id-improve)
8. [How I used AI tools](#how-i-used-ai-tools)
9. [Architecture (file tree)](#architecture-file-tree)

---

## Setup — run locally end-to-end

**Prerequisites:** Python **3.11+**, Node **18+**, npm.

### 1. Backend (FastAPI · SQLite locally / Postgres in prod · JWT) — port 8000

```powershell
cd backend
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
copy .env.example .env                       # default values work for local dev
./venv/Scripts/python.exe -m uvicorn main:app --reload
```

The API boots at <http://127.0.0.1:8000>. Open `/docs` for the OpenAPI explorer.

The SQLite database (`backend/savomart.db`) is **created and seeded automatically** on first run — 3 demo customers, 2 admins, 18 offers, sample coupons, sample transactions.

> **Locally** you get SQLite for zero-setup dev. **On the deployed backend** the same code reads a `DATABASE_URL` env var and runs against Neon Postgres instead, so admin-created customers and Excel imports survive redeploys. Switching back and forth is a connection-string change — see [backend/database.py](backend/database.py).

### 2. Frontend (React 19 · Vite · Tailwind v3) — port 5173

```powershell
cd frontend
npm install
npm run dev
```

Visit <http://localhost:5173>.

### 3. Verify it works

| Check | Expected |
|---|---|
| <http://127.0.0.1:8000/health> | `{"status": "ok", ...}` |
| Login with mobile `9999999999` | Yellow OTP card appears with a 6-digit code; "Auto-fill" logs you in |
| <http://localhost:5173/admin/login> | Admin login screen |

---

## How to log in / test the app

### Mock OTP behavior

There's **no real SMS provider** — `POST /api/auth/send-otp` generates a random 6-digit code, stores it in the `otp_records` table, **prints it to the backend console**, **and** returns it in the response under `dev_otp` so the UI can render it as a yellow "Demo OTP" card with an "Auto-fill" button. This lets reviewers log in without watching server logs.

Codes expire in 5 minutes. Re-requesting an OTP invalidates the previous one.

### Demo customer accounts

These three are seeded on first run. Any other 10-digit mobile is **rejected with a "Please register at Savomart" screen** — see "registration flow" below.

| Mobile | Name | Tier | Points | What it shows |
|---|---|---|---|---|
| `9999999999` | Aanya Sharma | Gold | 5,400 | Max-tier UI (no progress bar, "top tier" copy) |
| `8888888888` | Rahul Mehta | Silver | 2,750 | Mid-tier progress bar to Gold |
| `7777777777` | Priya Iyer | Bronze | 420 | Early-Bronze ramp UI |

The login screen lists all three as tappable cards — tap one to auto-fill the mobile and request the OTP in one go.

### Admin accounts (separate auth namespace)

Different JWT secret, 8-hour expiry. A leaked customer token can never authenticate `/api/admin/*` (verified with curl).

Open <http://localhost:5173/admin/login>:

| Email | Password | Role | Scope |
|---|---|---|---|
| `admin@savomart.in` | `Admin@123` | superadmin | Everything |
| `manager.indiranagar@savomart.in` | `Store@123` | store_manager | Indiranagar offers + sitewide read-only |

### Three ways a customer enters the system

Self-signup is disabled by design — a Savomart customer is enrolled by ops, not at the login screen.

1. **Seeded** — the 3 demo customers above are inserted on first DB creation.
2. **Admin → Customers → "+ Enroll customer"** — one-at-a-time form with optional initial points + tier.
3. **Admin → Customers → "⬆ Import Excel"** (superadmin only) — bulk-enroll via .xlsx upload that **also awards loyalty points** from a purchase ledger. See the next section.

### Bulk Excel customer import

Admin → Customers → ⬆ Import Excel.

**Columns** (case-insensitive, only `name` + `mobile` required):

```
name | mobile | amount_spent | coupon_code | description
```

**Loyalty rules engine** (canonical implementation in [backend/customer_import.py](backend/customer_import.py)):

- Every **₹10 spent = 1 point** (floor division)
- `coupon_code` column marks the user's matching active coupon as used
- Unknown mobile → **auto-create a Bronze customer** with the provided name
- Tier is recomputed from the new balance (Bronze 0–999, Silver 1,000–4,999, Gold 5,000+)
- Every import writes one row to the audit log (filename, totals, error count, admin id)

The modal exposes a **⬇ Download sample template** button that returns a brand-styled .xlsx with the headers + 3 example rows.

After upload, the UI shows 5 stat tiles (rows · new users · updated · points awarded · coupons used) and a per-row table — including a "NEW" tag next to auto-created users.

### AI chat agent ("Savo")

Floating purple chat bubble on the Support page → conversational ticket creation backed by **Groq's Llama-3.3-70B-versatile** (~250 tokens/sec). Savo collects name · contact · category · description, signals readiness with a `<ticket_ready>{...}</ticket_ready>` block, and the frontend strips that block before rendering, then POSTs to `/api/support/ticket` with `source="chat"` + the full transcript. Every ticket — form OR chat — also appends a row to `backend/exports/support_tickets.xlsx`.

Requires `GROQ_API_KEY` in `backend/.env`. Without it, the endpoint returns a friendly "AI assistant not enabled" bubble — the form path always works.

---

## Features built

**Customer app:**
- 📱 Mobile OTP login (mock SMS — printed to console + shown in-app)
- 🏠 Dashboard — animated points counter, tier badge, tier progress bar to next tier, active coupons strip with copy-code + "expiring soon" badges, recent activity timeline
- 🎁 Offers — scope chips (All · Sitewide · Store · Expiring · For me), category strip, debounced search, tier-locked offers rendered at 70% opacity with a "Locked" pill
- 🗺 Stores — interactive Leaflet map, sidebar list synced with map, **Find My Nearest Store** with haversine distance + pulsing CSS ring on the nearest marker
- 🆘 Support — contact card, ticket form with live character counter, "My tickets" tab with status badges
- 🤖 Savo, the AI chat agent — floating bubble on the support page

**Admin panel** (`/admin`):
- Dashboard with 4 stat cards + recent signups + recent tickets
- Offers — full CRUD, duplicate, status pills, store-manager scope enforcement
- Coupons — issue single + **bulk-issue from comma/newline mobile list** (returns issued count + missing-mobile report)
- Points — adjust with mandatory reason + audit, bulk-adjust via `mobile,delta,reason` CSV paste, full ledger with source filter chips
- Tickets — list with filters, role-scoped to assignee, detail page with chat transcript + internal notes + status dropdown
- **Customers** — search, full detail (transactions + coupons + tickets), tier change, deactivate/reactivate, **⬆ Excel bulk import (the loyalty rules engine described above)**
- Analytics — 5 Recharts visualisations (bar/pie/line)
- **Audit log** — every mutating admin action writes a row to `admin_audit_logs` for compliance

**Operations & polish:**
- Mobile-first responsive — 375 / 768 / 1024 breakpoints, BottomNav on phones, desktop nav from lg+
- Skeleton loaders on every async section — no blank states
- Global toast for loud failures (network, 5xx, timeouts); validation 4xx kept inline
- Protected routes via `<ProtectedRoute>` + axios 401 interceptor → automatic logout + post-login redirect
- PWA manifest (Savomart standalone), brand theme, apple-touch icons

---

## Data model & schema

All tables are created up-front via SQLAlchemy 2.0 ORM on app startup — no migrations needed for this scope.

| Table | Columns (excerpt) | Notes |
|---|---|---|
| `users` | id · name · mobile_number (unique, indexed) · points_balance · tier · is_active · last_login_at · created_at | Customer record. `is_active=false` blocks login. |
| `otp_records` | id · mobile_number · otp_code · expires_at · is_used · created_at | 5-min mock OTP. Issuing a new code marks prior ones used. |
| `points_transactions` | id · user_id (FK) · delta (±) · description · source · admin_id (FK) · created_at | Ledger. `source` enum: `purchase` / `redemption` / `admin_adjustment` / `bonus`. |
| `coupons` | id · user_id (FK) · code · discount_value · discount_type · description · expires_at · is_used · applicable_store_id | `days_remaining` is computed server-side per request. |
| `offers` | id · title · description · discount_label · category · valid_from / valid_until · store_scope · store_id · tier_required | `expired` is filtered out by default in `/api/offers`. |
| `support_tickets` | id · public_id (`SAVO-XXXX`) · user_id · category · subject · description · status · source · chat_transcript · assigned_to_admin_id · internal_notes · response_sent · resolved_at · created_at | `source` is `form` or `chat`. |
| `admin_users` | id · email (unique) · password_hash (bcrypt) · role (`superadmin` / `store_manager`) · store_scope · is_active · last_login_at | Separate auth namespace from customers. |
| `admin_audit_logs` | id · admin_id · action · target_type · target_id · details (JSON) · created_at | Append-only. Never returned via API. |

**Tier thresholds** (single source of truth in [backend/loyalty.py](backend/loyalty.py)):

| Tier | Points range |
|---|---|
| Bronze | 0 – 999 |
| Silver | 1,000 – 4,999 |
| Gold | 5,000+ |

Changing thresholds is a 3-line edit; `tier_for_balance()` and `progress_to_next()` are used by every screen that displays tier info.

---

## Tech & library choices

| Choice | Why |
|---|---|
| **FastAPI** | Async-friendly, Pydantic-validated request/response, auto OpenAPI docs at `/docs`. Saved a lot of boilerplate vs Flask + marshmallow. |
| **SQLite (local) + Postgres on Neon (prod), SQLAlchemy 2.0** | Same ORM, two backends — picked at startup based on whether `DATABASE_URL` is set. SQLite means zero-setup dev; Neon is a free, scale-to-zero serverless Postgres so the deployed demo persists customers/imports across restarts without me having to pay for a database. |
| **JWT (HS256, 7-day customer · 8-hour admin)** | Stateless, lives in localStorage, simple axios interceptor. Separate secrets for the two namespaces means a leaked customer token can never authenticate admin endpoints (and vice versa — verified with curl). |
| **Mock OTP via console + dev_otp** | Brief allows mock. Returning the OTP in the response means the demo URL works without server log access — critical for a reviewer trying the app on their phone. |
| **openpyxl** | Pure Python, no system deps. Used for both the support-ticket export and the customer Excel import. |
| **Groq + Llama-3.3-70B-versatile** | ~250 tokens/sec keeps Savo's replies under 1s. Generous free tier so reviewers can try the chat without me paying per call. Provider-agnostic prompt — swapping to Claude/GPT-4o is a 10-line edit. |
| **React 19 + Vite + Tailwind v3** | Required stack. Tailwind v3 (not v4) because v4's Lightning CSS pipeline isn't fully Windows-friendly yet. |
| **react-router-dom** | Standard SPA routing, plus `location.state` carries the `from` path for post-login redirects. |
| **axios** | Cleaner interceptors than fetch — especially for the 401 → auto-logout flow. |
| **Leaflet + OpenStreetMap** | Free, no API key, custom divIcon markers avoid the Vite default-asset-path issue. |
| **Recharts** | Composable, accessible, brand-color tokens just work. |
| **bcrypt** | Admin passwords. Salted, slow by design. |
| **python-multipart** | Required for FastAPI file upload (the Excel import endpoint). |

---

## Design decisions & trade-offs

- **Brand tokens in Tailwind config** — `savo-purple` (#782B90) and `savo-yellow` (#FFF200) are first-class colors with `purple-50/100/dark/light` shades. No off-brand greys anywhere.
- **Tier progression centralized** — `loyalty.progress_to_next()` is the single source of truth. The frontend renders whatever the server returns; tier UI never drifts between screens.
- **`days_remaining` computed server-side** — the client never does date math on coupon expiry, eliminating timezone bugs in JS.
- **Animated points use requestAnimationFrame, not setInterval** — smoother, cancels cleanly on unmount, doesn't fight React renders.
- **Self-signup disabled, registration via admin only** — matches a real loyalty program's enrollment flow (cashier creates the account at the store). The login page surfaces a clear "register at Savomart" screen for unknown mobiles instead of silently creating a stub user.
- **Excel import as the loyalty rules engine** — a single .xlsx file can simultaneously create new customers, award points from purchases, AND redeem coupons. One round trip, full per-row audit, atomic commit.
- **JWT in localStorage** — easy to ship and avoids cookie-domain complexity for the take-home. Trade-off (XSS exposure) documented; production should move to httpOnly cookies.
- **SQLite locally, Neon Postgres in production** — the [backend/database.py](backend/database.py) bootstrap reads `DATABASE_URL` at startup; if set, it switches to Postgres (with `pool_pre_ping` + 5-min recycle to absorb Neon's idle disconnects) and rewrites legacy `postgres://` URLs to `postgresql://`. If unset, it falls back to a local SQLite file. Same SQLAlchemy 2.0 models work against both — I didn't have to change a single ORM line to migrate.
- **`useAsync` micro-hook instead of React Query** — React Query is overkill for this size; three lines of `useState` + a `reload` callback covers every fetch I needed.
- **Bundled PR-style commits per phase** — kept the git log readable as a story rather than micro-commits.

---

## Known issues & what I'd improve

**With more time, in priority order:**

1. **Real SMS via Twilio or MSG91** to replace the mock OTP. The auth router is already structured to swap providers behind a single `send_sms()` call.
3. **HttpOnly cookies instead of localStorage** for the JWT, with CSRF tokens. Lower XSS exposure.
4. **Database migrations (Alembic)** — right now schema changes mean dropping `savomart.db`. Fine for greenfield, painful once there's real data.
5. **Rate limiting on `/api/auth/send-otp`** to prevent OTP spam. Per-IP and per-mobile, sliding-window.
6. **Tests** — the brief deprioritized them; with another day I'd add pytest for the loyalty math, the Excel-import rules engine, and the auth namespace separation.
7. **Render cold start** — the free tier sleeps after 15min. Workaround: a cron-pinger every 10 min, or pay $7/mo for always-on.
8. **Stores upstream contract isn't documented** — `_normalize()` defensively accepts several payload shapes (list, `{data: [...]}`, `{stores: [...]}`, lat/lng vs latitude/longitude). A real integration would need a contract test against the live API.
9. **OTP `dev_otp` exposed in production** — currently always returned for the demo. Once real SMS is wired, this should be gated behind `ENVIRONMENT != "production"` again.
10. **Admin "store_manager" scope** is mostly enforced server-side, but a few admin endpoints assume superadmin-only via a router-level dependency rather than a row-level check. A more sophisticated permission system (e.g. casbin) would catch edge cases.

**Smaller polish items I'd tighten:**
- OTP-input numeric keypad on iOS already works; could add SMS auto-fill via `autocomplete="one-time-code"` (already set) once we have real SMS.
- Skeleton loader heights are hand-tuned; a `ContentLoader`-style component would scale better.
- The chat drawer on tablet (768–1024px) could split-screen rather than slide-up.

---

## How I used AI tools

I used **Claude (Anthropic), via Claude Code** as a pair-programming partner throughout. Specifically:

- **Scaffolding pass** — initial FastAPI router + SQLAlchemy model skeletons.
- **Component logic** — the OTP grid focus/paste/auto-submit state machine, the haversine helper, the animated points counter (rAF + ease-out cubic), the tier-progress math.
- **Tailwind config** — extending the brand palette into design tokens.
- **Excel import rules engine** — the loyalty math, the per-row error reporting, the template-builder helper.
- **README structure** — this document's outline.

**Where I overrode the AI:**
- Rejected a React Query setup in favor of a tiny `useAsync` hook (RQ was overkill for 5 customer screens).
- Rejected a Firebase Phone Auth path mid-implementation when I hit the Blaze-plan billing wall — reverted to mock OTP for the demo.
- Rewrote a handful of error messages to be more user-friendly than the model's first drafts.
- Hand-wrote the loyalty thresholds, the Bangalore store fallback list, and the Savo system prompt.

Every AI-generated change was reviewed before commit. Where the model proposed dead code or over-abstraction, I deleted it.

---

## Architecture (file tree)

```
savomart-sde-intern-task-2026/
├── backend/                       FastAPI + SQLAlchemy + (SQLite local / Postgres prod)
│   ├── main.py                    app factory, CORS, lifespan seed
│   ├── config.py                  pydantic-settings (.env-driven)
│   ├── database.py                engine + session
│   ├── models.py                  User · OTPRecord · Coupon · Offer · Transaction · Ticket · AdminUser · AdminAuditLog
│   ├── schemas.py                 every request/response Pydantic model
│   ├── security.py                customer JWT + get_current_user
│   ├── admin_security.py          admin JWT (separate secret) + role gates
│   ├── loyalty.py                 tier thresholds + progress math (single source of truth)
│   ├── audit.py                   admin audit-log helper
│   ├── customer_import.py         Excel import rules engine
│   ├── excel_export.py            openpyxl writer for support_tickets.xlsx
│   ├── seed.py                    idempotent demo seed
│   └── routers/
│       ├── auth.py                /api/auth/send-otp · /verify-otp
│       ├── profile.py             /api/profile/{me, coupons, transactions}
│       ├── offers.py              /api/offers (scope · category · expiring · search · eligibility)
│       ├── stores.py              /api/stores (live-API proxy + 5-min cache + fallback)
│       ├── support.py             /api/support/{info, ticket, my-tickets, chat}
│       └── admin_*.py             8 admin routers — auth, dashboard, offers, coupons, points, tickets, users, analytics
├── frontend/                      React 19 + Vite + Tailwind v3
│   └── src/
│       ├── api/                   axios clients (customer + admin) + auth/admin/etc. helpers
│       ├── hooks/                 useAuth · useAdminAuth · useAsync · useCountUp · useDebounced
│       ├── components/            AppHeader, BottomNav, Logo, ProtectedRoute, Toast, Skeleton, Tier/Coupon/Points/Tx widgets
│       ├── pages/                 Login, Dashboard, Offers, Stores, Support
│       └── admin/
│           ├── pages/             AdminDashboard, AdminOffers, AdminCoupons, AdminPoints, AdminTickets, AdminUsers, AdminAnalytics, AdminLogin
│           └── AdminUI.jsx        shared admin primitives (DataTable, Modal, Field, ConfirmDialog, …)
├── render.yaml                    Render Blueprint (backend deploy)
├── frontend/vercel.json           Vercel SPA rewrites + security headers
└── README.md
```

---

## Submission metadata (for the reviewer's convenience)

- **Author:** Nishanth Mahesh
- **Live frontend (Vercel):** <https://savomart-loyalty.vercel.app/>
- **Live backend (Render):** <https://savomart-api-q4vb.onrender.com>
- **Video demo (Google Drive):** _To be added — see commit history for updated link_
- **Repository:** <https://github.com/nishanthxmahesh/savomart-sde-intern-task-2026>
