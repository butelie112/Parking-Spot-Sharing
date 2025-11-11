# 🅿️ ParkEZ - Parking Spot Sharing PWA

**Milestone 1 Demo** - Login & Visual Grid Complete! ✅

A mobile-first Progressive Web App for finding and sharing parking spots. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## 🎯 Current Demo Features (Milestone 1)

✅ **Authentication** - Email OTP login with Supabase Auth  
✅ **Visual Grid** - Clean, responsive grid showing all parking spots  
✅ **Add Parking** - Owners can add their parking spots  
✅ **Status Management** - Change spot status (Available/Reserved/Occupied)  
✅ **Real-time Updates** - Automatic synchronization across all users  
✅ **Mobile-First Design** - Optimized for mobile devices
✅ **PWA Ready** - Installable Progressive Web App with offline capabilities
✅ **Booking System** - Users can request to book available parking spots
✅ **Owner Management** - Spot owners can accept/reject booking requests

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works great!)

### 1. Clone and Install

```bash
cd "Parking Spot Sharing"
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for your database to be ready (takes ~2 minutes)
3. Go to **Project Settings → API** and copy:
   - Project URL
   - Anon/Public Key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Database

1. In your Supabase dashboard, go to **SQL Editor**
2. First, run `supabase-booking-schema.sql` to create the main booking system
3. Then run `supabase-owner-info-schema.sql` to add owner information fields
4. Run `database_functions.sql` to create the payment processing functions
   - **Note**: If you get an error about "cannot change return type of existing function", the function will be automatically dropped and recreated
5. If you have existing users without profiles, run `supabase-fix-profiles.sql` to create missing profiles

### 5. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

### 6. Test PWA Features

#### Install the App (Mobile/Desktop)
1. **Mobile**: Open in Chrome/Safari → Tap "Add to Home Screen" when prompted
2. **Desktop**: Click the install icon in the address bar (Chrome) or use "Install Parkezz"
3. **Manual Install**: Look for the install prompt in the bottom-left corner

#### Test Offline Functionality
1. Install the PWA
2. Go offline (disable internet)
3. Open the installed app - it should work offline!
4. Reconnect to sync changes

#### PWA Features Included:
- ✅ **Install Prompt** - Automatic installation prompts
- ✅ **Offline Caching** - Core app works without internet
- ✅ **App Icons** - Proper icons for home screen/installation
- ✅ **Standalone Mode** - Opens without browser UI
- ✅ **Background Sync** - Changes sync when back online

---

## 📱 How to Use

### First Time Login
1. Enter your email address
2. Check your email for the OTP code
3. Enter the 6-digit code to login

### Add a Parking Spot
1. Click **"Add Spot"** button in the header
2. Enter a name for your spot (e.g., "Garage Level 2" or "Spot A1")
3. Click **Add**

### Manage Your Spots
- **Available** - Mark your spot as free to use
- **Reserved** - Someone has reserved this spot
- **Occupied** - Spot is currently in use
- **Delete** - Remove your spot permanently

### View Others' Spots
- All users can see all parking spots
- Green = Available, Amber = Reserved, Red = Occupied
- "Owner" badge shows your own spots

---

## 🏗️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email OTP)
- **Real-time**: Supabase Realtime
- **PWA**: next-pwa (Service Worker + Caching)
- **Icons**: Lucide React

---

## 📂 Project Structure

```
Parking Spot Sharing/
├── app/
│   ├── layout.tsx          # Root layout with AuthProvider
│   ├── page.tsx            # Main page (login/parking grid)
│   └── globals.css         # Global styles
├── components/
│   ├── AuthProvider.tsx    # Authentication context
│   ├── LoginForm.tsx       # Email OTP login form
│   └── ParkingGrid.tsx     # Main parking spots grid
├── lib/
│   └── supabase.ts         # Supabase client & types
├── supabase-schema.sql     # Database schema
└── package.json
```

---

## 🔒 Security Features

- ✅ Row Level Security (RLS) enabled
- ✅ Users can only modify their own spots
- ✅ Email OTP authentication (no passwords!)
- ✅ Automatic profile creation on signup
- ✅ Server-side validation with Supabase policies

---

## 🎨 Design Features

- Mobile-first responsive design
- Clean, modern UI with rounded corners and shadows
- Color-coded status indicators (green/amber/red)
- Smooth transitions and hover effects
- Real-time stats dashboard (Available/Reserved/Occupied counts)
- Empty state with helpful prompts

---

## 🚀 Deployment

### Vercel (Recommended for PWA)
```bash
npm run build
# Deploy to Vercel - PWA features work automatically
```

### Other Platforms
Ensure your hosting platform supports:
- HTTPS (required for PWA)
- Service Worker files
- Proper caching headers

### PWA Checklist for Production:
- ✅ HTTPS enabled
- ✅ Service worker registered
- ✅ Web App Manifest served
- ✅ Icons accessible
- ✅ No mixed content (HTTP/HTTPS)

---

## 🐛 Troubleshooting

### "Failed to send OTP"
- Make sure your Supabase project URL and Anon Key are correct
- Check that email auth is enabled in Supabase (Settings → Authentication → Email)

### Database errors
- Ensure you ran the `supabase-schema.sql` script in your Supabase SQL Editor
- Check that RLS is enabled on the tables

### Payment function errors
- **"cannot change return type of existing function"**: This happens when the function exists with a different return type. The `database_functions.sql` script automatically handles this by dropping the old function first. If you still get this error, manually run: `DROP FUNCTION IF EXISTS process_booking_payment(uuid, uuid, numeric);` then run the full script again.

### Spots not updating in real-time
- Check browser console for errors
- **Important**: Don't confuse "Realtime" with "Replication"!
  - **Realtime** (what we need) = Live updates via WebSocket - FREE & usually enabled by default
  - **Replication** (not needed) = Database replication to other regions - Early Access feature
- To verify Realtime: Go to **Settings** → **API** → Check that "Postgres Changes" is enabled under Realtime section
- See `TEST-REALTIME.md` for detailed troubleshooting

### PWA Installation Issues
- **"Install" button not showing**: Make sure you're using HTTPS and the app meets PWA criteria
- **Icons not loading**: Check that icon files exist in `/public/` and paths are correct
- **Service worker errors**: Check browser DevTools → Application → Service Workers
- **Offline not working**: Clear browser cache and reinstall the PWA
- **Not installable**: Use Lighthouse audit to check PWA compliance

### PWA Cache Issues (Development)
```bash
# Clear all PWA caches
npm run dev
# Then in browser: DevTools → Application → Storage → Clear Storage
```

---

## 📋 Original Full Spec

Stack: Next.js (App Router, TS) + Tailwind + shadcn/ui · Node/Next API Routes · Supabase (Postgres, Auth, Realtime, Storage) · Leaflet.js (map) · Zod · Resend (emails, optional)

Goal: A mobile-first PWA that lets users sign in, view a map/grid of parking spots, change spot status (Free/Reserved/Occupied) with simple time slots, and see a simulated wallet balance. Ship a demo in 2–3 milestones. This app will be feature for user to either add parking if he owns and if he wants to add parking and another feature will be to see and get or book that parking if available (this feature is for all and core feature of the app the other feature to add parking is optional)

1) Features (MVP scope)

Auth: Email OTP (Supabase Auth). Public landing page + protected app.

PWA: Installable app (manifest + service worker). Mobile-first UI.

Map & Grid: Leaflet.js map + list/grid toggle. Markers colored by status.

Spots: View spots, tap to open sheet: name, status, last updated, “Change status”.

Status Flow: Free → Reserved (pick duration 30/60/120m) → Occupied → back to Free.

Wallet (Simulated): Starts with demo balance per user; deduct small fee when reserving; show history list.

Realtime: When a spot changes, map/list update for all clients (Supabase Realtime).

Admin-lite: Minimal page to create/update spots (name, lat, lng). (Role check: user.is_admin boolean)

Email (optional): Send confirmation email on reservation (Resend).

Out of scope for MVP: Real payments, multi-tenant orgs, full admin CMS, complex pricing.

2) Pages & Routes

/ Landing (public): headline, how it works, CTA “Open App”.

/app (protected): map/list tabs, wallet chip, user menu.

/app/spots (default view component inside /app): Map + List toggle.

/app/wallet (sheet/panel or page): balance + simple transactions.

/app/admin (guarded): CRUD for spots.

API routes (Next.js route handlers):

POST /api/spots/upsert (admin)

POST /api/spots/status (change status)

GET /api/spots (list)

GET /api/wallet (get balance & txns)

POST /api/wallet/adjust (simulate charges/refunds)

3) UI/UX

Header: app title, wallet chip, profile menu (sign out).

Tabs: Map / List switch.

Map: Leaflet with OSM tiles; colored markers:

Free = green, Reserved = amber, Occupied = red.

Spot Sheet (Bottom drawer on mobile): name, coords, status, “Change status” (segmented control), reserve duration picker (30/60/120), confirm button.

Wallet Panel: balance, last 10 entries (type: debit/credit, amount, note, time).

Empty states & skeletons for lists/map while loading.

shadcn/ui components for Drawer/Sheet, Button, Select, Tabs, Toast.

4) Data Model (Supabase / Postgres)

Create with SQL or Prisma (if you prefer Prisma, include schema & client).

-- users are managed by Supabase Auth; we’ll extend via profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean default false,
  wallet_cents integer not null default 2000, -- $20.00 simulated
  created_at timestamptz default now()
);

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'free', -- 'free' | 'reserved' | 'occupied'
  reserved_until timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spots_status on spots(status);
create index if not exists idx_spots_geo on spots(lat, lng);

create table if not exists wallet_txn (
  id bigserial primary key,
  user_id uuid not null references auth.users(id),
  amount_cents integer not null, -- negative = debit, positive = credit
  reason text not null,          -- 'reserve' | 'release' | 'admin_adjust'
  spot_id uuid references spots(id),
  created_at timestamptz default now()
);


RLS (recommended):

profiles: user can select/update own row.

spots: read for all authenticated; writes only for admin OR via secured RPC/edge function that enforces rules.

wallet_txn: user can read their own; inserts via server route.

Realtime: enable on public.spots.

5) Security & Rules

Status changes only via server route with Zod validation:

Free → Reserved: check reserved_until > now; deduct small fee (e.g., $0.50).

Reserved → Occupied: allowed by reserver only; no extra charge.

Reserved/Occupied → Free: credit partial refund if returned early (simple rule).

Admin flag in profiles.is_admin for /app/admin access.

Rate limit status changes per user (basic in-memory or KV).

6) Tech & Libraries

Next.js (App Router, TS), React, Tailwind, shadcn/ui

Leaflet + OSM tiles (leaflet, react-leaflet)

Supabase JS (auth, DB, realtime)

Zod (input validation)

Lucide-react (icons)

next-pwa or custom SW (basic cache + install prompt)

Optional: Resend for emails (env: RESEND_API_KEY, EMAIL_FROM, EMAIL_TO_DEBUG)

7) Project Structure
/src
  /app
    /(public)
      page.tsx                # Landing
    /(protected)
      app/page.tsx            # App shell (tabs Map/List)
      app/wallet/page.tsx
      app/admin/page.tsx
    /api/spots/route.ts       # GET list, POST status change (split if preferred)
    /api/spots/upsert/route.ts
    /api/wallet/route.ts
    /api/wallet/adjust/route.ts
    manifest.webmanifest
    service-worker.js
  /components
    AppShell.tsx
    MapView.tsx
    SpotList.tsx
    SpotSheet.tsx
    WalletPanel.tsx
    AuthGate.tsx
  /lib
    supabaseClient.ts
    auth.ts
    validators.ts
    statusRules.ts
    format.ts
  /styles/globals.css

8) Implementation Notes

Auth flow: On mount, check supabase.auth.getSession(). If none, show simple sign-in (magic link / OTP) modal.

Map tiles: Use OSM (https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png).

Realtime: Subscribe to public:spots INSERT/UPDATE where status changes → update markers/list.

Status change route (POST /api/spots/status): body { spotId, action, durationMinutes? }

action: "reserve" | "occupy" | "free"

Server validates: current status, user rights, duration limit (max 2h), wallet deduction/credit, updates spots + inserts wallet_txn.

Wallet: Start each new user with 2000 cents. Deduct 50 cents on reserve; credit 25 cents if freed early.

Admin upsert: /app/admin has a simple form to create/edit spots (name, lat, lng). Use a draggable map to pick coords.

9) Environment Variables

Create .env.local & .env.example:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server only (route handlers)
RESEND_API_KEY=              # optional
EMAIL_FROM=                  # e.g., "MVP Parking <no-reply@ahmerz.com>"
EMAIL_TO_DEBUG=
NEXT_PUBLIC_APP_NAME="ParkEZ MVP"

10) Styling & UX

Mobile-first, PWA install banner (when eligible).

Toasts for success/failure on status changes.

Color tokens:

Free = emerald-500

Reserved = amber-500

Occupied = rose-500

Accessible: focus states, aria labels for map buttons, large tap targets.

11) PWA

Add manifest.webmanifest (name, icons 192/512, theme color).

Service worker: cache static assets + OSM tiles (sane TTL), fallback for offline list view.

Add “Add to Home Screen” instructions (one-time tooltip).

12) Seed & Demo

Seed 20 spots around a central coordinate (use random jitter).

Create one admin profile (your email), a normal user, and a few sample wallet txns.

Provide a Demo Login button that uses Supabase magic link to a test inbox or prints link in server logs (dev).

13) Acceptance Criteria

Sign-in works; first-time users get a profiles row with default wallet.

Map & list show the same spots; tapping a marker opens the sheet.

Status change logic enforced on server; wallet transactions recorded.

Realtime updates propagate in <2s across two browser sessions.

PWA passes installability; lighthouse PWA score green on mobile.

14) Commands

pnpm i

pnpm dev

pnpm build && pnpm start

15) Deliverables

Full Next.js codebase with typed API handlers and Zod validation.

Supabase SQL / migration script for the tables (or Prisma schema + migrate).

.env.example + README (setup, Supabase config, run, deploy).

Short Loom-ready script in README for demo walkthrough.

16) Nice-to-haves (if time permits)

Spot ownership (user who reserved can occupy/free).

Basic analytics: reserved minutes per day.

Email on reserve (Resend) to confirm slot/time.

RLS policies snippets in SQL and set to enabled.

17) Task List (for Cursor to follow)

Scaffold Next.js + Tailwind + shadcn/ui; add Leaflet & Supabase client.

Add PWA manifest + service worker; verify installable.

Implement auth gate + profiles bootstrap (wallet).

Implement spots UI (map/list) + sheet + status actions.

Create Supabase SQL for tables + optional RLS examples.

Implement API routes with Zod + server-side wallet/status rules.

Wire Supabase Realtime on spots.

Add Admin page to create/update spots.

Seed data; add .env.example & README with setup steps.

Do a quick pass for mobile polish, toasts, and empty states.

Please implement the full MVP per spec above.
Use clean, commented TypeScript; ship with a professional README and .env.example.