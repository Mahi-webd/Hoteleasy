export const APP_URL = "https://hoteleasy.vercel.app";

/** The scroll story: one chapter per part of the building. */
export const chapters = [
  {
    id: "front",
    eyebrow: "Front office",
    title: "Every arrival, departure and balance — before the guest reaches the desk.",
    body: "A live room calendar, today's arrivals with what they owe, and check-in or check-out in a few clicks. Group and company bookings keep their own folios.",
    shot: "02_arrivals",
    alt: "Today's arrivals in HotelEasy",
  },
  {
    id: "pay",
    eyebrow: "Payments",
    title: "M-Pesa that posts itself.",
    body: "Send an STK push to the guest's phone. They enter their PIN, and the payment lands on the right folio — with VAT and tourism levy already broken out. No codes copied from SMS.",
    shot: "05_mpesa_paid",
    alt: "An M-Pesa payment confirmed on a folio",
  },
  {
    id: "fnb",
    eyebrow: "Restaurant & kitchen",
    title: "Orders go to the kitchen. Bills go to the room.",
    body: "A table map for waiters, a kitchen screen that replaces paper tickets, and charge-to-room so nothing eaten goes unbilled.",
    shot: "08_kitchen",
    alt: "The kitchen display screen",
  },
  {
    id: "rooms",
    eyebrow: "Rooms & housekeeping",
    title: "One room board, shared by the desk and the corridor.",
    body: "Housekeepers mark rooms clean on their phones; the front desk only sells rooms that are ready. Maintenance requests are tracked until they are done.",
    shot: "15_housekeeping_desk",
    alt: "The housekeeping board",
  },
  {
    id: "owner",
    eyebrow: "The owner's view",
    title: "The whole property, every morning, from anywhere.",
    body: "Night audit closes the day and locks it. Revenue, occupancy, average rate and payments by method are waiting for you — for one hotel or all of them.",
    shot: "11_owner",
    alt: "The owner dashboard",
  },
] as const;

export const problems = [
  ["Rooms sold twice", "once on Booking.com, once at the desk"],
  ["Cash and M-Pesa that never reconcile", "at the end of every shift"],
  ["Kitchen tickets that go missing", "and drinks that never reach the bill"],
  ["Discounts nobody approved", "and refunds nobody can trace"],
] as const;

export const modules = [
  { title: "Booking.com & Airbnb", body: "Calendars sync both ways on a schedule, so a room booked anywhere is blocked everywhere.", shot: "09_channels", tone: "bg-mist", span: "md:col-span-4" },
  { title: "Your own booking page", body: "Live availability and rates, paid by M-Pesa. No commission.", shot: "18_booking_phone", tone: "bg-sand", span: "md:col-span-2", phone: true },
  { title: "Night audit", body: "Posts room charges, catches no-shows and locks the business day.", shot: "10_audit", tone: "bg-sage", span: "md:col-span-2" },
  { title: "Roles & permissions", body: "Build your own roles and tick exactly what each can view, create, edit, discount or refund.", shot: "13_roles", tone: "bg-clay", span: "md:col-span-2" },
  { title: "Help assistant", body: "Staff ask “how do I check out a guest?” and get the steps for their role.", shot: "14_help", tone: "bg-mist", span: "md:col-span-2" },
  { title: "Reports & export", body: "Revenue, occupancy, VAT and levy by day — exported to Excel for your accountant.", shot: "12_reports", tone: "bg-sand", span: "md:col-span-6", wide: true },
] as const;

export const roles = [
  ["Owners", "Revenue, occupancy and cash for every property each morning — without a single phone call."],
  ["Managers", "Approve discounts and refunds with a PIN, run the night audit, keep every shift accountable."],
  ["Front desk", "Fast check-ins, M-Pesa in seconds, and always a clear view of which rooms are ready."],
  ["Waiters & kitchen", "Orders sent straight to the kitchen screen and charged to the room. No lost tickets."],
  ["Housekeeping", "Today's rooms on their phone, in order of priority, with one tap to mark each done."],
  ["Accountants", "Folios with VAT and tourism levy, payments by method, reports ready to export."],
] as const;

export const plans = [
  {
    name: "Starter",
    for: "Guest houses and small hotels, up to 15 rooms",
    monthly: 4900,
    features: ["Front desk & room calendar", "Folios with VAT & levy", "M-Pesa STK push", "Housekeeping on mobile", "Your own booking page", "Help assistant"],
  },
  {
    name: "Growth",
    for: "Hotels with a restaurant, up to 60 rooms",
    monthly: 9900,
    featured: true,
    features: ["Everything in Starter", "Restaurant POS & kitchen screen", "Booking.com & Airbnb sync", "Night audit & owner reports", "Custom roles & manager PIN", "Inventory & maintenance"],
  },
  {
    name: "Group",
    for: "Several properties, or more than 60 rooms",
    monthly: 0,
    features: ["Everything in Growth", "Unlimited properties", "One dashboard across hotels", "Priority support", "On-site setup and training"],
  },
] as const;

export const faqs = [
  ["Do I need new computers or to install anything?", "No. HotelEasy runs in the browser on the phones, tablets and PCs you already have. Your data is kept in the cloud and backed up."],
  ["How does M-Pesa work?", "You connect your own Paybill or Till through Safaricom Daraja. The guest gets a payment prompt on their phone and the money goes straight to your account — HotelEasy never holds it."],
  ["Will it stop double bookings from Booking.com and Airbnb?", "Yes. HotelEasy reads each channel's calendar on a schedule and publishes yours back, so a room booked in one place is blocked in the others."],
  ["Can I run more than one hotel?", "Yes. Each property has its own rooms, staff and reports, and owners see one dashboard across all of them."],
  ["Can I control what each person can do?", "Completely. Use the built-in roles or create your own, and choose which pages and buttons each role can use. Discounts, refunds and voids need a manager PIN."],
  ["How long does it take staff to learn?", "Most staff are working on their first day. The built-in assistant answers “how do I…” questions on every page."],
  ["Are VAT and tourism levy handled?", "Yes. Every folio and bill breaks out VAT and levy, and the reports total them for your returns."],
] as const;
