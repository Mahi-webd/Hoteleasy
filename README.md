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
| Rates & seasons: weekend, holiday and high/low season prices (a % change or fixed prices per room type), minimum stays and no-arrival days; each night priced on its own for front desk and the booking page; rate & availability calendar | ✅ Live |
| Guest emails: booking confirmation, pre-arrival (with the online check-in link), thank-you with the review link, and cancellation, sent automatically through Resend; email log with previews and retry; test emails | ✅ Live (needs the one-time email setup below) |
| Meal plans & packages: bed & breakfast, half board, full board or packages (e.g. safari with game drives), priced per adult/child per night and per stay, limited to room types if needed; meals posted to the bill night by night as food; plan choice on the booking page and at the desk; daily meal counts for the kitchen; at the restaurant POS a bill can be marked as a guest's board meal so food is covered up to the plan's allowance per person (drinks and extras still charged, no double-counted revenue) | ✅ Live |
| Company accounts (city ledger): companies with KRA PIN, negotiated rates (fixed per room type or % off), credit limits and payment terms; bookings billed to the company (room only or everything) with LPO number; at check-out the company's share moves to its account and the invoice is addressed to the company; payments, credit notes, ageing (current / 30 / 60 / 90 / 90+), printable statements, ageing CSV | ✅ Live |
| Guest requests: printable QR code per room; guests confirm their last name and ask for towels, cleaning, repairs, wake-up calls, taxis, late check-out or room service from their phone, with live status and replies; requests go to housekeeping, maintenance, front desk or the restaurant (repairs open a maintenance ticket); staff board with sound alerts; "good to know" info for guests; links stop working at check-out | ✅ Live |
| Owner overview & alerts: every hotel you own or manage on one page (occupancy tonight, arrivals/departures, revenue today and month to date vs last month, collected, owed, bills due, next 7 nights); live alerts by job (overstays, no-shows, rooms not ready, unanswered guest requests, open bills and cash shifts, low stock, guest and company debts, overdue bills, payroll and statutory deadlines, leave requests, failed emails) in a header bell and on the dashboard | ✅ Live |
| Night audit & day close: checks before closing (arrivals not checked in, guests past check-out, missing room nights, open bills and cash shifts), one-click no-show, close the day to lock its payments, charges and bills, printable daily manager's report (occupancy, ADR, RevPAR, revenue, money taken by method, guest and company balances, cash shifts, notes), reopen the latest day with a reason, alert when yesterday is not closed | ✅ Live |
| Roles & permissions: the owner makes custom roles (name, job type, description) and ticks what each can do in a grid of 23 areas × view / create / edit / delete plus special rights (void payments, close/reopen the day, approve with PIN, see balances…), 66 permissions in all (separate rights for check-in, check-out, changing the room rate, refunds, POS discounts and spreadsheet downloads); copy a built-in role as a starting point; give roles in Settings & Team or when inviting; checked by the database, not just hidden on screen; "Who can do this?" lists everyone who has a permission; new permissions from updates are flagged until the owner reviews them; the 8 built-in roles work as before | ✅ Live |
| M-Pesa prompts (STK push): each hotel enters its own paybill or till and Daraja keys (test or live); staff send a pay prompt to the guest's phone from a bill or a POS order, the guest enters their PIN and the payment posts itself with the M-Pesa receipt (once, even if Safaricom calls twice; still recorded if staff stopped waiting); cancelled or timed-out prompts are shown; online guests can pay the first night or the whole stay from their booking; keys can't be read back by anyone | ✅ Live |
| Booking.com & Airbnb calendar sync (iCal), both ways, one room per link: our calendar closes the room on the sites (our bookings, bookings from other sites, nights the room type is full); the sites' bookings arrive as reservations on that room (source shown, "add name & price" hint), date changes and cancellations follow, double bookings are flagged and kept without a room, Airbnb's echoed "Not available" blocks are skipped; read every 10 minutes, on "Sync now", and whenever someone has HotelEasy open | ✅ Live |
| Ask HotelEasy (help assistant): a Help button on every screen with 23 written guides (search, links to the right screen) and an assistant powered by Claude that answers "how do I…" questions from those guides, knows the person's role and permissions (tells them when a manager is needed), links to screens, works in English and Swahili; 👍/👎 feedback; owners and managers can see what the team asks; limits per person and per hotel; without an API key the guides still work | ✅ Live |
| Guest website (`/book/<your-hotel>`): full-screen hero photo, welcome story, up to 3 feature blocks (restaurant, pool, things to do), rooms carousel with photo galleries and details, booking in a "Plan your stay" section, photo gallery with lightbox, guest reviews, contact footer, Enquire/Book buttons always on screen and a full-screen menu; cream and navy look shared by online check-in, feedback and guest-stay pages; moving water waves, photo slideshow, scroll animations; managed in **Online → Website**: colour theme (4 ready-made or your own colours), heading letters, logo, slideshow photos and tagline, sections on/off and order, experiences, offers & packages (hidden after their end date), gallery, moving words, social links, notice bar, page title and description. Photos are **uploaded from the phone or computer** (shrunk in the browser, stored in Supabase Storage in the hotel's own folder; only owners and managers can upload) or pasted as links. `VITE_HOME_HOTEL` makes one hotel's website open at `/`; in development `/` and `/book/demo` show a sample hotel (try `?theme=safari&font=marcellus`) | ✅ Live (needs the `guest_site`, `guest_site_settings` and `site_photos` database updates) |

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

Owners can also make **custom roles** (Roles & permissions).

**Adding a page or button later (for developers).** The permission list lives in one place, the `permission_catalog` table:
1. In the page's migration, add its permissions, e.g. `insert into public.permission_catalog (key, module, module_label, action, label, sort, default_roles) values ('spa.view','spa','Spa','view','See spa bookings',700,array['owner','manager','front_desk'])`. `default_roles` decides which built-in roles get it; the owner always does; custom roles get it only when the owner ticks it, and the Roles page shows it as **New** until the owner marks it seen.
2. Protect the tables and functions with the 3-argument check, e.g. `has_hotel_role(hotel_id, array['owner','manager']::hotel_role[], 'spa.edit')`. Built-in roles use the role list, custom roles their ticks. A 2-argument check is for built-in roles only.
3. In the app use `allowed("spa.edit")` for buttons and `perm: "spa.view"` for the sidebar item.
4. `npm run check:perms` (also runs before every build) fails if the app or SQL names a permission that isn't in the list.

These rules are enforced in the database (Row Level Security), not just hidden in the UI.

## Still to do

- [ ] **Guest website**: run `supabase/migrations/20261117140000_guest_site.sql`, `20261117160000_guest_site_settings.sql` and `20261117190000_site_photos.sql` (photo uploads) in the SQL Editor, in that order. Until then the booking page uses the new look with the main photo only, and Online → Website asks for the update.
- [ ] **Website addresses**: run `supabase/migrations/20261117210000_site_addresses.sql` after the three guest-site updates.

### Many hotels, one live system (guest websites)

Every hotel's website is `/book/<page-address>`, filled from that hotel's data only. For going live:
- **Changing a page address is safe**: the old address keeps working and sends guests to the new one; another hotel can never take it.
- **Reserved words** (admin, api, demo, login, …) can't be page addresses; new hotels skip them automatically.
- **Own web address**: a hotel enters its domain in Online → Setup; add the domain to the Vercel project and point DNS there (A `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`). Visiting it opens that hotel's website; `/login` still opens the staff app. Add the domain to Supabase → Authentication → URL configuration so password-reset links work there.
- **Hotel subdomains** (optional): set `VITE_SITE_ROOT_DOMAIN` and add a wildcard domain `*.yourdomain` in Vercel; `<page-address>.yourdomain` opens that hotel's website.
- **Single-hotel installs**: `VITE_HOME_HOTEL=<page-address>` opens that hotel's website at `/`.
- Guest pages never go blank: a lost connection shows *Try again*, an unknown or switched-off page says so, and a crash shows a calm error page instead of a white screen.

- [ ] **M-Pesa Edge Function**: deploy `mpesa` once (see "M-Pesa prompts" below). Until then the M-Pesa settings save but prompts can't be sent.
- [ ] **Calendar sync Edge Function**: deploy `ical` once (see "Booking.com & Airbnb calendar sync" below). Optional: the 10-minute schedule.
- [ ] **Help assistant**: add the `ANTHROPIC_API_KEY` secret and deploy `assistant` (see "Help assistant" below). The guides work without it.
- [ ] **Email sending setup**: waiting for the domain. Do steps 1–4 of "Sending guest emails" below, *then* switch emails on per hotel. Until then keep "Send guest emails" off in every hotel.

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
   12. `20261114100000_seasonal_rates.sql`
   13. `20261114110000_emails.sql`
   14. `20261114140000_companies.sql`
   15. `20261114200000_rate_plans.sql`
   16. `20261114220000_board_pos.sql`
   17. `20261115090000_guest_requests.sql`
   18. `20261115120000_alerts.sql`
   19. `20261115150000_night_audit.sql`
   20. `20261116090000_roles.sql`
   21. `20261116120000_roles_more.sql`
   22. `20261116150000_mpesa.sql`
   23. `20261116180000_channels.sql`
   24. `20261117090000_assistant.sql`
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

### 3. M-Pesa prompts (one time, for the whole platform)

1. **Edge Function**: Supabase → **Edge Functions → Deploy a new function → Via editor**, name it `mpesa`,
   paste `supabase/functions/mpesa/index.ts`, deploy, then turn **Verify JWT** off in its settings
   (Safaricom calls it without a login; it checks its own tokens). CLI: `supabase functions deploy mpesa --no-verify-jwt`.
   No secrets are needed: each hotel's keys are saved in the app.
2. **Each hotel**, under **Settings & Team → M-Pesa prompts**:
   - *Trying it*: create a free account at developer.safaricom.co.ke, create an app with **Lipa na M-Pesa Sandbox**,
     copy its Consumer Key and Secret, choose **Test**, click "Fill in the test paybill and passkey", save,
     **Test the keys**, switch on. Sandbox prompts go to Safaricom's test phones/simulator, no real money.
   - *Going live*: the hotel applies to Safaricom for **Lipa na M-Pesa Online (STK push)** on its paybill or till
     (via the Daraja "Go Live" process). Safaricom gives a live app and a **passkey**. Enter them, choose **Live**.
     For a till, enter the store (head office) number as the shortcode and the till number guests pay to.

### 4. Booking.com & Airbnb calendar sync (one time, for the whole platform)

1. **Edge Function**: deploy `supabase/functions/ical/index.ts` as `ical` (same way as `mpesa`) with **Verify JWT** off
   (Booking.com and Airbnb read the room calendars without a login). CLI: `supabase functions deploy ical --no-verify-jwt`.
2. Calendars are read whenever someone has HotelEasy open (every 10 minutes) and with **Sync now**. To also read
   them at night: add a `CRON_SECRET` secret to the `ical` function, enable `pg_cron` and `pg_net`, put the secret
   into `supabase/channel_cron.sql` and run it.
3. Each hotel: **Booking.com & Airbnb → Add calendar link** for each room it sells on a site (the page has the steps).
   Booking.com only offers calendar sync when each room is its own room type (1 unit). Hotels selling many rooms of
   one type on Booking.com need a real channel manager connection (Booking.com Connectivity partner), a later phase.

### 5. Help assistant "Ask HotelEasy" (one time, for the whole platform)

1. Create an API key at console.anthropic.com (add a payment method; usage is billed per question, a fraction of a US cent each with Claude Haiku 5.5).
2. Supabase → Edge Functions → Secrets: `ANTHROPIC_API_KEY` = the key. Optional `ASSISTANT_MODEL` (default `claude-haiku-5-5`).
3. Deploy `supabase/functions/assistant/` as `assistant` (both files: `index.ts` and `guide.ts`), with **Verify JWT ON**.
   CLI: `supabase functions deploy assistant`.
4. **Keeping it up to date:** the guides are `src/help/articles/*.md`. After changing a guide (or adding a screen), run
   `npm run build:help` and redeploy `assistant`. The build fails if you forget (`prebuild` checks it).

### 6. Sending guest emails (one time, for the whole platform)

Emails are queued in the database and sent by a small Supabase Edge Function through [Resend](https://resend.com).

1. **Resend**: create an account, add and verify the domain you'll send from (e.g. `hoteleasy.co.ke`;
   Resend shows the DNS records to add), and create an API key.
2. **Edge Function**: in Supabase go to **Edge Functions → Deploy a new function → Via editor**, name it
   `send-emails`, paste `supabase/functions/send-emails/index.ts`, and deploy. Then open the function's
   settings and turn **Verify JWT** off (the function checks its own secret instead).
   With the Supabase CLI instead: `supabase functions deploy send-emails --no-verify-jwt`.
3. **Secrets** (Edge Functions → Secrets): `RESEND_API_KEY` = your key, `EMAIL_FROM` = an address on the
   verified domain (e.g. `bookings@hoteleasy.co.ke`), `CRON_SECRET` = a long random string.
4. **Schedule**: Database → Extensions → enable `pg_cron` and `pg_net`; put your `CRON_SECRET` into
   `supabase/email_cron.sql` and run it in the SQL Editor.
5. In the app, each hotel switches emails on under **Online booking & reviews → Guest emails** and can
   send itself a test. Every hotel sends from the same address with its own name, and guests' replies go
   to the hotel's own email.

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
13. ~~Seasonal rates & booking emails~~ (next: SMS/WhatsApp messages, rate plans such as B&B vs half board)
14. ~~Corporate accounts~~ (next: emailing statements, company booking portal)
15. ~~Meal plans & packages~~, including board meals at the POS
16. ~~Guest requests & concierge~~
17. ~~Owner overview & alerts~~ (next: daily summary email once email sending is set up)
18. ~~Night audit & day close~~ (next: email the manager's report to the owner once email sending is set up)
19. ~~Roles & permissions~~
20. ~~M-Pesa STK push~~ (next: M-Pesa refunds/reversals, C2B confirmation for payments made straight to the paybill)
21. ~~Booking.com & Airbnb calendar sync (iCal)~~ (next: full channel manager API for multi-unit room types and rates)
22. ~~Help assistant~~ (next: a page for owners with the questions staff ask most)
23. Group bookings, KRA eTIMS
