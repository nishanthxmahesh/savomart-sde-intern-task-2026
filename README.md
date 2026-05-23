# Savomart — Loyalty Companion App

A customer-facing loyalty companion for Savomart shoppers — points, offers, store discovery, and support in one place. Built as the SDE Intern take-home challenge.

> **Status:** Complete + AI chat-agent bonus shipped. Deployment is the only remaining piece.

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
│       ├── offers.py         /api/offers (scope · category · expiring · search · eligibility)
│       ├── stores.py         /api/stores (live-API proxy + 5-min cache + fallback)
│       └── support.py        /api/support/info · /ticket · /my-tickets · /chat (Groq · Llama 3.3 70B)
├── backend/excel_export.py   openpyxl append helper for support_tickets.xlsx
├── frontend/                 React 19 + Vite + Tailwind v3
│   └── src/
│       ├── api/              axios client + auth/profile API
│       ├── hooks/            useAuth, useAsync, useCountUp
│       ├── components/       AppHeader, Logo, ProtectedRoute, Toast,
│       │                     PointsCard, TierBadge, CouponCard,
│       │                     TransactionRow, Skeleton
│       └── pages/            Login, Dashboard, Offers, Stores, Support
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

## What ships in Phase 4

### Backend
- `GET /api/stores` proxies the live Savomart stores API at
  `https://internal-service.savomart.in/bridge/api/store/list?is_operational=True`
  with the `X-cron-token` header. **The token never reaches the browser.**
- 5-minute in-memory cache (`stores_cache_ttl_seconds`), so the upstream
  doesn't get hammered on every page load. `?refresh=true` bypasses it.
- **Fallback path** — if the upstream errors, times out, or returns an
  unparseable shape, the endpoint silently serves 8 hand-curated Bangalore
  stores. The response shape is identical (`source: "live"` vs
  `"fallback"`), so the map never sees an error.
- `_normalize()` accepts several plausible upstream payload variations
  (list, `{data: [...]}`, `{stores: [...]}`, lat/lng vs latitude/longitude,
  etc.) — defensive parsing because the upstream contract isn't documented.
- Returns `source` and `fetched_at` so the UI can surface a tiny
  "offline catalogue" hint when running on the fallback set.

### Frontend stores page
- **Interactive map** — Leaflet + OpenStreetMap tiles. Custom purple
  divIcon markers (no broken default asset paths under Vite).
- **Sidebar list synced with map** — clicking a list item flies the map
  to that store with a smooth 0.8s animation and pops its popup.
- **Find My Nearest Store** — browser geolocation (one-shot), haversine
  distance to every store (formula in `utils/haversine.js`, written from
  scratch), sorts the list ascending, badges the nearest with a yellow
  "Nearest" pill and a pulsing CSS ring around its marker. User position
  rendered as a yellow-fill purple-stroke circle.
- **Search/filter** — single input matches across name + address + area +
  city, real React state, filters both the list and the markers shown.
- **Mobile view toggle** — Map / List switch on narrow screens; on lg+
  the sidebar (340px) and map render side-by-side.
- **Skeleton loaders** while fetching; map is never empty — fallback
  ensures the page always renders something useful.
- Popup includes name, address, hours, phone (`tel:` link), and a
  Google Maps directions deep link.

## What ships in Phase 5

### Backend
- `GET /api/support/info` — phone (`1800-202-2026`), email (`support@savomart.in`), hours (Mon–Sat 9am–7pm IST), `response_time_hours`, and the canonical category list (server is the source of truth for these — the form populates its dropdown from this response)
- `POST /api/support/ticket` — JWT-protected; user is auto-attached from the token, so the body only needs `category`, `subject`, `description`. Server validates: category must be in the canonical list, subject 3–200 chars, description 20–4000 chars. Ticket gets a public id of the form `SAVO-XXXX` (4 hex chars, unique-indexed). Returns the ticket + a personalized message + the response-time SLA.
- `GET /api/support/my-tickets` — JWT-protected; returns the caller's own tickets, descending by `created_at`. Other users' tickets are never visible.
- Validation behavior verified with curl: short description → 422, bad category → 422, missing auth → 401.

### Frontend support page
- **Contact card** with three tappable cells: 📞 toll-free (`tel:` link, branded purple), ✉ email (`mailto:` link), 🕒 hours
- **Tabs** — "New ticket" / "My tickets · N" (count shown once loaded)
- **Ticket form:**
  - Auto-populated read-only Name + Mobile fields rendered as disabled inputs from the JWT user — visible confirmation that "we know who you are"
  - Category `<select>` populated from `/api/support/info`
  - Subject input (max 200 chars)
  - Description textarea with **live character counter** showing `N/20 min` — color states: gray (empty), red (under min), emerald (met). Inline helper text explains why we need the minimum.
  - Submit button disabled until all fields valid; spinner during request
- **Success screen** with an animated checkmark (CSS keyframes: emerald disc bursts in, white tick stroke draws over 0.4s, ring-shadow pulse fades out), the `SAVO-XXXX` ticket id in a chip, category + response-time summary, and CTAs to view tickets or submit another.
- **My Tickets list** — each ticket shows public id (purple-on-purple-50 chip), status badge, category tag, subject, truncated description, and relative time. Status badges:
  - **Open** → amber `bg-amber-50 text-amber-800` with amber dot
  - **In progress** → sky `bg-sky-50 text-sky-800` with sky dot
  - **Resolved** → emerald `bg-emerald-50 text-emerald-800` with emerald dot
- Empty state on the My Tickets tab routes back to the form.

## What ships in Phase 6 (nav + polish)

- **BottomNav** (mobile/tablet, hidden on lg+) — Home / Offers / Stores / Support. 60px tall, sticky, brand purple icon+label when active with a yellow underline indicator. Respects `safe-area-inset-bottom` for notched phones.
- **AppHeader** (all screens) — Savomart wordmark links Home; desktop nav links between pages on lg+ (so once you're past 1024px the bottom nav goes away and the header takes over); a non-functional notification bell with a yellow dot ("coming soon" tooltip); and a clickable initials avatar that opens a small account menu with the user's name + mobile and a Log out action. Menu closes on outside-click or Escape.
- **Protected routes** — every page except `/login` is wrapped in `<ProtectedRoute>`. axios response interceptor intercepts every `401`: clears the local token, fires a registered `onUnauthorized` callback that wipes React auth state, and the next render of `<ProtectedRoute>` redirects to `/login` with a `state.from` so the post-login flow returns the user to where they were trying to go. Verified: bogus / missing token returns 401 on `/profile/me`, `/stores`, `/support/*`.
- **Global error toast** — the axios interceptor now also flags "loud" failures (network errors, timeouts, 408/429/5xx) and dispatches a toast through a registered `onUnexpectedError` handler. Validation 4xx errors and the auth endpoints are excluded — those keep their inline error rendering. Identical messages are debounced (5s window) so a hung backend doesn't spam.
- **Skeleton loaders** — every async section has a shimmer skeleton: Dashboard (points card, coupons strip, transactions, profile sidebar), Offers (card list), Stores (sidebar list + full-height map), Support (contact card + tickets list). No blank screens, ever.
- **Logout** — explicit `navigate('/login', { replace: true })` after `logout()` so users who tap the menu item land cleanly on the login page, no flicker.
- **Responsive breakpoints**:
  - **375px (phone)** — single column everywhere, BottomNav at the bottom, Stores page has a Map/List view toggle (side-by-side doesn't fit)
  - **768px (tablet)** — Stores page reveals the sidebar alongside the map (per spec); Offers list goes two-column
  - **1024px+ (laptop)** — desktop nav appears in the header, BottomNav disappears, Dashboard becomes 2/3 + 1/3 grid (main column + sidebar)

## Bonus — AI chat agent ("Savo") + Excel export

A second way to raise a ticket: chat with **Savo**, our AI support agent, who collects the four required fields conversationally and creates the ticket automatically.

### How it works
- **Floating chat button** (bottom-right) on the Support page opens a slide-up drawer on mobile / right-side panel on desktop (md+). Branded purple FAB with a small yellow pulse dot.
- **`POST /api/support/chat`** (JWT-protected) takes a `messages: [{role, content}]` history and forwards it to **Groq's Llama-3.3-70B-versatile** with our Savo system prompt. The server prepends a *Customer context* block (name, mobile, tier, points balance) so Savo can greet by name and avoid re-asking what we already know.
- When Savo has gathered all four pieces (name · contact · category · description), it ends its reply with a `<ticket_ready>{…}</ticket_ready>` block.
- The frontend strips that block from the rendered bubble, parses the JSON (with a code-fence fallback in case the model wraps it), validates the category against the canonical list, and posts to `/api/support/ticket` with `source="chat"` plus the full conversation transcript.
- The freshly-created ticket appears as a green success card inside the chat, with the `SAVO-XXXX` id.

### Excel export (openpyxl)
Every created ticket — form OR chat — appends a row to `backend/exports/support_tickets.xlsx`. Columns: Ticket ID · Timestamp (UTC) · User ID · Mobile · Name · Category · Subject · Description · Source · Status. Header row is brand-styled (purple fill, yellow bold text) with frozen panes and sensible column widths. File is created on first ticket. Writes are thread-locked (single-process dev/demo); for multi-worker production we'd queue these. Failures are logged but never break the API response.

### To enable Savo locally
1. Get a free key at [console.groq.com](https://console.groq.com)
2. Add to `backend/.env`: `GROQ_API_KEY=gsk_…`
3. Restart the backend
4. Open the Support page, tap the floating chat bubble, say "hi"

Without a key, `/api/support/chat` returns a 503 with a clear message; the floating button still works but the form path is unaffected.

### Why Groq (vs Anthropic / OpenAI)
Groq's inference is fast enough that the conversation feels responsive — Llama-3.3-70B at ~250 tokens/sec keeps round-trips under a second on typical turns. They also offer a generous free tier for evaluators to actually try the demo without paying. The system prompt is provider-agnostic, so swapping to Claude or GPT-4o is a 10-line edit in `routers/support.py`.

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
