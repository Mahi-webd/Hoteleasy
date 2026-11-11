# HotelEasy

Hotel management for Kenyan hotels and lodges. One account can run several hotels, and each hotel's
staff only see their own hotel's data.

## What works today

| Area | Status |
|---|---|
| Sign up, sign in, password reset | ✅ Live |
| Create a hotel (optionally with sample rooms), switch between hotels | ✅ Live |
| Team: invite staff by email with a role, change roles, remove people | ✅ Live |
| Rooms & room types: add / edit / delete, live status, per-floor board | ✅ Live |
| Guests: search, profiles, ID details, VIP, stay history | ✅ Live |
| Reservations: create / edit / extend, live availability, no double bookings | ✅ Live |
| Arrivals, in-house, departures lists; check-in, check-out, cancel, no-show | ✅ Live |
| Booking calendar (rooms × 14 days) | ✅ Live |
| Dashboard: occupancy, arrivals, departures, room revenue, 7-night forecast, activity | ✅ Live |
| Billing, housekeeping, maintenance, POS, staff scheduling, inventory, reports, etc. | 🟡 Demo screens (marked "demo"), next phases |

### Roles

| Role | Can do |
|---|---|
| Owner | Everything, including changing roles and removing staff |
| Manager | Everything except changing roles; can invite staff |
| Front desk | Guests, reservations, check-in/out, room status |
| Housekeeping | See rooms and bookings, change room status (no guest details) |
| Restaurant | Look up guests (POS comes later) |
| Accountant | Guests and money screens |

These rules are enforced in the database (Row Level Security), not just hidden in the UI.

## Setup

### 1. Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query**, paste the whole of
   `supabase/migrations/20261111000000_core_multi_hotel.sql`, and click **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to where the app is hosted
   (e.g. `https://your-app.lovable.app` or `http://localhost:8080`) and add the same address under
   **Redirect URLs**, plus `<that address>/reset-password`.
4. Optional: **Authentication → Providers → Email**. Leave "Confirm email" on for production. Turn it
   off while testing if you don't want to click email links.

### 2. The app

```sh
cp .env.example .env      # then fill in the two values from Project Settings → API
npm install
npm run dev               # http://localhost:8080
```

Open the app, create an account, and set up your hotel.

## Project layout

```
src/
  contexts/       AuthContext (session) and HotelContext (current hotel + role)
  hooks/useHotelQueries.ts   all database reads/writes (React Query)
  features/       live screens: dashboard, rooms, guests, reservations, settings
  components/     shared UI + the older demo screens still to be rebuilt
supabase/
  migrations/     database schema, security rules and functions
  tests/          SQL tests for security and booking rules (run on any Postgres 15+)
  legacy_migrations/  the old Lovable schema, kept for reference only
```

### Running the database tests

```sh
createdb he_test
psql -d he_test -f supabase/tests/00_local_supabase_stub.sql \
                -f supabase/migrations/20261111000000_core_multi_hotel.sql \
                -f supabase/tests/01_security_and_booking_tests.sql
```

Every check prints `PASS (blocked)`; any `FAIL` stops the script.

## Roadmap

1. ~~Foundation: login, roles, secure database~~
2. ~~Front desk: rooms, guests, reservations, check-in/out, dashboard~~
3. Money: guest folios, invoices with 16% VAT, payments (cash, card, M-Pesa via Daraja), receipts
4. Operations: housekeeping tasks linked to room status, maintenance tickets, POS charging to rooms
5. Reports, staff scheduling, inventory, channel managers (Booking.com etc.)
