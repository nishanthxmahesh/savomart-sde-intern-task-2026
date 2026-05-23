# Savomart — Loyalty Companion App

A customer-facing loyalty companion for Savomart shoppers — points, offers, store discovery, and support in one place. Built as the SDE Intern take-home challenge.

> **Status:** Phase 3 of 6 — offers browser with category filters, search, expiring-soon surfacing, and tier-locked offers. Bottom navigation now wired across pages. Working end-to-end locally. More phases land in subsequent commits.

## Quick start

You need **Python 3.11+** and **Node 18+**.

### Backend (FastAPI · SQLite · JWT)

```powershell
cd backend
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
./venv/Scripts/python.exe -m uvicorn main:app --reload
```

The API boots at `http://127.0.0.1:8000`. Open `/docs` for the OpenAPI explorer.

The database (`backend/savomart.db`) is created and seeded automatically on first run.

### Frontend (React · Vite · Tailwind)

```powershell
cd frontend
npm install
npm run dev
```

Frontend is at `http://localhost:5173`.

## Logging in (mock OTP)

Authentication uses mobile number + 6-digit OTP. There's no real SMS provider wired up — the OTP is **printed to the backend console** (and, in dev mode, also returned in the `send-otp` response for convenience).

**Seeded demo accounts:**

| Mobile        | Name          | Tier   | Points | Why                                |
| ------------- | ------------- | ------ | ------ | ---------------------------------- |
| 9999999999    | Aanya Sharma  | Gold   | 5400   | Top-tier — shows max-tier UI       |
| 8888888888    | Rahul Mehta   | Silver | 2750   | Mid-Silver — shows tier progress   |
| 7777777777    | Priya Iyer    | Bronze | 420    | Early Bronze — shows ramp UI       |

Any other 10-digit Indian number works too — it auto-creates a Bronze-tier shopper.

**Flow:**
1. Enter mobile → backend prints `[SAVOMART OTP] mobile=+91XXXXXXXXXX code=123456 …`
2. Enter OTP in the 6-digit grid (auto-submits on full fill)
3. Server validates, marks OTP used, issues a 7-day JWT, lands you on the dashboard

## Architecture (so far)

```
savomart-sde-intern-task-2026/
├── backend/                  FastAPI + SQLAlchemy + SQLite
│   ├── main.py               app factory, CORS, lifespan seed
│   ├── config.py             pydantic-settings (.env-driven)
│   ├── database.py           engine + session
│   ├── models.py             User · OTP · Coupon · Offer · Transaction · Ticket
│   ├── schemas.py            request/response models
│   ├── security.py           JWT issue/decode + get_current_user dep
│   ├── loyalty.py            tier thresholds + progress math
│   ├── seed.py               idempotent demo seed
│   └── routers/
│       ├── auth.py           /api/auth/send-otp · /verify-otp
│       ├── profile.py        /api/profile/me · /coupons · /transactions
│       └── offers.py         /api/offers (scope · category · expiring · search · eligibility)
├── frontend/                 React 19 + Vite + Tailwind v3
│   └── src/
│       ├── api/              axios client + auth/profile API
│       ├── hooks/            useAuth, useAsync, useCountUp
│       ├── components/       AppHeader, Logo, ProtectedRoute, Toast,
│       │                     PointsCard, TierBadge, CouponCard,
│       │                     TransactionRow, Skeleton
│       └── pages/            Login, Dashboard, Offers
└── README.md
```

## What ships in Phase 2

### Backend
- `GET /api/profile/me` → name, mobile, balance, tier, member-since, **next-tier**, **points-to-next-tier**, **progress %** (single source of truth in `loyalty.py`)
- `GET /api/profile/coupons` → active (unused, non-expired) coupons with `days_remaining` precomputed server-side
- `GET /api/profile/transactions?limit=10` → recent points activity

### Frontend dashboard
- **Animated points counter** — ease-out cubic count-up from 0 to balance in 1.2s (rAF-driven, cancels cleanly on unmount)
- **Tier badge** — Bronze (amber), Silver (slate), Gold (yellow with subtle glow shadow)
- **Tier progress bar** — yellow on purple, animates on first paint, swaps for "top tier" copy on Gold
- **Coupon cards** — dashed border + perforated edge effect (cutouts via offset circles), `Copy Code` with clipboard API + toast confirmation, red "expiring soon" badge under 3 days
- **Recent activity timeline** — earned (green up arrow) vs redeemed (red down arrow), relative timestamps ("2 days ago", "3 weeks ago")
- **Quick actions** — Offers / Stores / Help (routes wired in Phase 3–5)
- **Profile sidebar** on desktop, stacks under coupons on mobile
- **Skeleton loaders** on every async section — no blank states
- **Toast system** for clipboard + future error states

## What ships in Phase 3

### Backend
- `GET /api/offers` accepts `scope=sitewide|specific`, `category=<name>`, `expiring_soon=true`, `eligible_only=true`, and `q=<search>` — all combine
- Server pre-computes `days_remaining` and `is_eligible` so the client never has to do date math or tier comparisons
- Expired offers (`valid_until < now`) are filtered out unconditionally
- Returns a `categories` list pulled from active offers — UI doesn't need a separate request

### Seed data
18 hand-written offers across 14 categories — sitewide deals, store-specific (Indiranagar / Koramangala / Whitefield), tier-locked (Silver+, Gold+), and a couple deliberately expiring in 1–2 days to surface the "expiring soon" badge. Brand names are realistic for the Indian grocery context (Amul, Britannia, Tata Tea, Lay's, Haldiram's, etc.).

### Frontend offers page
- Scope chips: All · Sitewide · Store-only · Expiring soon · For me (eligible to my tier)
- Category chip strip from the server-returned list (horizontal scroll on mobile)
- Search input with 250 ms debounce, matches title/description/category
- Offer cards: emoji category icon, discount badge, scope tag (📍 store name or "All stores"), tier-required pill, expiring-soon clock badge under 3 days
- Tier-locked offers render at 70% opacity with a "Locked" pill — visible but clearly inaccessible (better than hiding them)
- Empty state with a reset-filters CTA
- Bottom navigation: Home / Offers / Stores / Help — slides under content, sticky, yellow underline on active tab

## Data model (current)

All six tables are created up front so later phases don't need migrations:

- **User** — id, name, mobile_number (unique), points_balance, tier (Bronze/Silver/Gold), created_at
- **OTPRecord** — mobile_number, otp_code, expires_at (5 min), is_used
- **PointsTransaction** — user_id, delta (±), description, created_at
- **Coupon** — user_id, code, discount_value, discount_type (percent/flat), description, expires_at, is_used, applicable_store_id
- **Offer** — title, description, discount_label, category, valid_from/until, store_scope (all/specific), store_id, tier_required
- **SupportTicket** — public_id, user_id, category, subject, description, status, source (form/chat), chat_transcript

Tier thresholds (centralized in `backend/loyalty.py`):

| Tier   | Range            |
| ------ | ---------------- |
| Bronze | 0 – 999          |
| Silver | 1,000 – 4,999    |
| Gold   | 5,000+           |

## Tech choices — short justifications

| Choice | Why |
| --- | --- |
| **FastAPI** | Async-friendly, Pydantic-validated, auto OpenAPI docs at `/docs`. Saves writing request/response validation. |
| **SQLite + SQLAlchemy** | Zero-setup local DB. Schema-first via SQLAlchemy 2.0 ORM. Migrating to Postgres later is a connection-string change. |
| **JWT (HS256, 7-day)** | Stateless, lives in localStorage, simple axios interceptor. No session store needed. |
| **Mock OTP via console** | Brief allows mock; printing to console + returning in dev response keeps the demo fast without a Twilio account. |
| **React + Vite** | Required. Vite for fast HMR. |
| **Tailwind v3 (not v4)** | v4's Lightning CSS pipeline isn't fully Windows-friendly yet; v3 is rock-solid + has 5 years of docs. |
| **react-router-dom** | Standard SPA routing, supports `state` for post-login redirect. |
| **axios** | Cleaner interceptors than fetch, especially for the 401 → logout flow. |

## Design decisions & trade-offs

- **Brand identity baked in as Tailwind tokens** — `savo-purple` (#782B90) and `savo-yellow` (#FFF200) are first-class colors plus purple-50/100/dark/light shades. No off-brand grays.
- **Tier progression centralized in one helper** — `loyalty.progress_to_next()` is the single source of truth. Changing thresholds is a 3-line edit, not a hunt across files.
- **`days_remaining` computed on the server** — frontend never has to do date math on coupon expiry; it just displays. Reduces room for tz bugs in JS.
- **Server-derived tier progress, client-computed display** — frontend just renders. The number won't drift between screens.
- **Animated points use rAF, not setInterval** — smoother, cancels cleanly on unmount, doesn't fight React renders.
- **OTP returned in `send-otp` response only in dev mode** — production builds won't see `dev_otp`.
- **Auto-create on first send-otp** — keeps signup and login the same single flow. Matches the brief's "authenticate" framing.
- **JWT in localStorage** — easy to ship; trade-off (XSS exposure) documented; would move to httpOnly cookies for production.
- **`useAsync` micro-hook instead of React Query** — RQ is overkill for a 5-screen app. Three lines of state + a `reload` callback covers every fetch we need.

## How I used AI tools

- **Claude (Anthropic)** — scaffolding pass, Tailwind config, OTP grid state machine (focus shift, paste, auto-submit), tier-progress math, animated points counter logic, README structure. Reviewed all generated code before committing; rejected a couple of over-abstracted patterns (e.g. a React Query setup) for simpler equivalents.
- Disclosed per phase as work continues.

## Coming next

Phase 3: offers browser with category filters and "expiring soon" surfacing. Phase 4: interactive store map (Leaflet + nearest-store via haversine). Phase 5: customer support page + ticket form. Phase 6: bottom nav + polish. Bonuses: AI chat agent (Claude API + Excel export) + deploy to Render/Vercel.

## Submission metadata

- Repo: `savomart-sde-intern-task-2026`
- Author: Nishanth Mahesh
- Video demo: _to be added before submission_
- Live URL: _to be added after deployment_
