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
| Guest bills: automatic room nights, extras, discounts, voids with reasons | ✅ Live |
| Payments: cash, M-Pesa (code checked, duplicates blocked), card, bank; deposits & refunds | ✅ Live |
| Check-out with settlement, early departure billing, company accounts (balance owing) | ✅ Live |
| Tax invoices: sequential numbers, VAT 16% + optional tourism levy, KRA PIN, Paybill; print / PDF | ✅ Live |
| Daily cash-up by payment method and staff member; open bills and refunds due | ✅ Live |
| Housekeeping: auto cleaning tasks at check-out, urgent when a guest is arriving, start/done from a phone, daily service, assignment | ✅ Live |
| Maintenance: anyone reports problems, room out of service until fixed, technician role, assignment, notes and repair cost | ✅ Live |
| Restaurant & bar POS: 4 outlets (restaurant, bar, room service, pool bar), tables, menu with options, split / move / discount / service charge, cash · M-Pesa · card · charge to room, receipts | ✅ Live |
| Kitchen & bar screen (live tickets, timers) plus printable kitchen tickets | ✅ Live |
| POS controls: manager PIN for voids, comps and discounts; shifts with float and Z report; sales report | ✅ Live |
| Reports: occupancy, ADR, RevPAR, revenue by department and outlet, VAT & levy by month, payments by method, booking sources, room types, nationalities, balances owing; any date range vs the previous period; CSV export and print | ✅ Live |
| Inventory: stores (main, kitchen, bar, housekeeping), stock items with reorder levels and average cost, suppliers, purchase orders with manager approval, goods received, transfers, issues to departments, waste, returns, stock counts with manager approval, full stock history | ✅ Live |
| Recipes on menu items: sending an order to the kitchen/bar takes ingredients from the outlet's store; food & drinks cost %, menu margins, waste and purchases report | ✅ Live |
| Online booking page (`/book/<your-hotel>`): live availability and prices, booking without signing in, booking lookup and free cancellation window, "Book now" button for your website | ✅ Live |
| Guest feedback: private link per stay after check-out (share by WhatsApp, email or copy), star ratings and recommend score, manager replies, chosen reviews shown on the booking page | ✅ Live |
| Expenses & profit: expenses and supplier bills (paid or to pay, claimable VAT, monthly repeats, void with reason), bills from goods received, monthly budgets and revenue targets, profit & loss with budget vs actual, VAT estimate, bills to pay | ✅ Live |
| Staff & rota: staff list (with or without app logins, pay rates private), shift types, weekly rota with drafts and publish, copy week, no double-booking or shifts on leave, leave requests and approval, clock in/out (self or by front desk), late and absent tracking, hours & pay report for payroll | ✅ Live |
| Payroll: monthly payroll from pay rates and the time clock, PAYE (with personal relief), NSSF tiers I and II, SHIF, housing levy and NITA, overtime, bonuses and advances; approve, then mark paid to post wages and statutory bills to Expenses; printable payslips; PAYE, NSSF, SHIF, housing levy and M-Pesa/bank payment CSVs; dated tax-rate tables the owner can update when the law changes | ✅ Live |
| My shifts (every staff login): clock in/out, own rota, who's working today, ask for leave, own approved payslips | ✅ Live |
| Online check-in: every confirmed booking gets a private link (WhatsApp, email or copy); guests fill in the guest register (ID/passport, nationality, arrival time, other guests, car) and sign the registration card on their phone; front desk reviews, accepts onto the guest record and checks in; printable A4 registration card (signed, or blank for walk-ins); house rules; "Check in online" from the booking page | ✅ Live |
| Digital concierge, quick actions, task automation | 🟡 Demo screens (marked "demo"), next phases |

### Roles

| Role | Can do |
|---|---|
| Owner | Everything, including changing roles and removing staff |
| Manager | Everything except changing roles; can invite staff |
| Front desk | Guests, reservations, check-in/out, room status |
| Housekeeping | Cleaning tasks, room status, report problems (no guest details or money) |
| Restaurant | POS, kitchen & bar screen, open/close own shift, charge checked-in guests' rooms, record kitchen/bar waste |
| Maintenance | Repair tickets; no guest details or money |
| Accountant | Guests, money screens, reports, stock costs, expenses and profit & loss (budgets and voiding are for owners/managers) |
| Storekeeper | Inventory: receiving, purchase orders, transfers, issues, waste and counts (no guest details or money screens) |

These rules are enforced in the database (Row Level Security), not just hidden in the UI.

## Setup

### 1. Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query** and run each file in `supabase/migrations/` in order
   (paste the whole file, click **Run**):
   1. `20261111000000_core_multi_hotel.sql`
   2. `20261111120000_billing.sql`
   3. `20261111140000_operations.sql`
   4. `20261111160000_pos.sql`
   5. `20261111180000_reports.sql`
   6. `20261112100000_inventory.sql`
   7. `20261112160000_online_booking.sql`
   8. `20261112200000_expenses.sql`
   9. `20261113100000_staff_rota.sql`
   10. `20261113140000_payroll.sql`
   11. `20261113200000_precheckin.sql`
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
for f in supabase/tests/00_local_supabase_stub.sql supabase/migrations/*.sql supabase/tests/0[1-9]_*.sql; do
  psql -q -d he_test -v ON_ERROR_STOP=1 -f "$f" || break    # one session per file
done
```

Every check prints `PASS (blocked)`; any `FAIL` stops the script.

## Roadmap

1. ~~Foundation: login, roles, secure database~~
2. ~~Front desk: rooms, guests, reservations, check-in/out, dashboard~~
3. ~~Money: guest folios, invoices with VAT, payments, cash-up~~ (M-Pesa STK push via Daraja still to come)
4. ~~Operations: housekeeping tasks linked to room status, maintenance tickets~~ 
5. ~~Restaurant & bar POS (phase 1)~~ (next: stock & recipes, coursing, offline mode, eTIMS)
6. ~~Reports~~
7. ~~Inventory & stock~~ (next: modifier recipes, batch/expiry tracking, supplier invoices & payments)
8. ~~Online booking & guest feedback~~ (next: online deposits by M-Pesa, booking emails, seasonal rates)
9. ~~Expenses & profit~~ (next: partial bill payments, petty cash, attachments)
10. ~~Staff scheduling & attendance~~ (next: shift swaps)
11. ~~Payroll & payslips~~
12. ~~Online pre-check-in~~ (next: ID photo upload, eTIMS)
13. M-Pesa STK push, seasonal rates, channel managers (Booking.com etc.)
