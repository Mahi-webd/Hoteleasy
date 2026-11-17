// The free WhatsApp menu bot: no AI, answers only from HotelEasy's data.
//   1 Rooms & prices · 2 Check availability · 3 My booking · 4 Location & contact · 5 Talk to staff
// Guests can tap the menu, reply with a number, or type simple words (English or Swahili). Dates are read in
// common forms: 20/12, 20-12-2026, 2026-12-20, 20 Dec, Dec 20, 20 Desemba; "2 guests", "for 3", "3 nights".

export type MenuState = "avail" | "booking" | null;
export type Button = { id: string; title: string };
export type Reply =
  | { kind: "text"; body: string; state: MenuState; handoff?: string }
  | { kind: "buttons"; body: string; buttons: Button[]; state: MenuState; handoff?: string }
  | { kind: "menu"; body: string; state: MenuState; handoff?: string };

export const MENU = [
  { id: "rooms", title: "Rooms & prices", description: "Our rooms and prices per night" },
  { id: "avail", title: "Check availability", description: "Free rooms and price for your dates" },
  { id: "booking", title: "My booking", description: "Dates, room and total of your booking" },
  { id: "contact", title: "Location & contact", description: "Address, phone, check-in times" },
  { id: "staff", title: "Talk to staff", description: "A member of our team replies here" },
] as const;
type Choice = (typeof MENU)[number]["id"] | "menu";

const B = {
  menu: { id: "menu", title: "Menu" },
  avail: { id: "avail", title: "Check availability" },
  other: { id: "avail", title: "Other dates" },
  booking: { id: "booking", title: "My booking" },
  staff: { id: "staff", title: "Talk to staff" },
};

export interface Deps {
  hotel: () => Promise<Record<string, any> | null>;
  availability: (checkIn: string, checkOut: string, guests: number) => Promise<Record<string, any>[]>;
  myBookings: () => Promise<Record<string, any>[]>;
  lookup: (code: string, key: string) => Promise<Record<string, any>>;
  bookingLink: string | null;
  handoffMessage: string | null;
}

// ---------------------------------------------------------------- understanding the guest
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s/.\-]/gu, " ").replace(/\s+/g, " ").trim();
const has = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(t));

export const choiceOf = (raw: string): Choice | null => {
  const t = norm(raw);
  if (!t) return null;
  const n = t.match(/^([1-5])$/);
  if (n) return MENU[Number(n[1]) - 1].id;
  for (const m of MENU) if (t === norm(m.title)) return m.id;
  if (t === "menu" || t === "other dates") return t === "menu" ? "menu" : "avail";
  if (has(t, ["staff", "person", "human", "agent", "reception", "manager", "call me", "mtu", "mhudumu", "operator"])) return "staff";
  if (has(t, ["available", "availability", "vacan", "free room", "nafasi", "check dates", "book a room", "any room", "do you have"])) return "avail";
  if (has(t, ["my booking", "my reservation", "booking", "reservation", "nimebook", "booking yangu", "he-"])) return "booking";
  if (has(t, ["location", "address", "where", "direction", "contact", "phone", "email", "check in time", "check-in", "checkout", "check out", "wapi", "mahali", "anwani"])) return "contact";
  if (has(t, ["room", "rooms", "price", "prices", "rate", "rates", "cost", "how much", "bei", "chumba", "vyumba", "gharama"])) return "rooms";
  if (has(t, ["hi", "hello", "hey", "habari", "jambo", "mambo", "hujambo", "start", "help", "good morning", "good evening", "niaje", "sasa"])) return "menu";
  return null;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, machi: 3, apr: 4, april: 4, aprili: 4,
  may: 5, mei: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, julai: 7, aug: 8, august: 8, agosti: 8,
  sep: 9, sept: 9, september: 9, septemba: 9, oct: 10, october: 10, oktoba: 10, nov: 11, november: 11, novemba: 11,
  dec: 12, december: 12, desemba: 12, disemba: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const realDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Dates and guests from a message like "20/12 to 22/12 for 2" or "20 Dec, 3 nights, 2 adults". */
export const parseStay = (raw: string, today: string):
  { check_in: string; check_out: string; guests: number; guestsGuessed: boolean } | { error: "dates" | "past" | "order" } => {
  const t = raw.toLowerCase();
  const found: { at: number; len: number; y: number | null; m: number; d: number }[] = [];
  const add = (at: number, len: number, y: number | null, m: number, d: number) => {
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && !found.some((f) => at < f.at + f.len && f.at < at + len)) found.push({ at, len, y, m, d });
  };
  for (const x of t.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) add(x.index!, x[0].length, +x[1], +x[2], +x[3]);
  for (const x of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    const y = x[3] ? (x[3].length === 2 ? 2000 + +x[3] : +x[3]) : null;
    add(x.index!, x[0].length, y, +x[2], +x[1]);
  }
  for (const x of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_RE})\\.?(?:\\s+(20\\d{2}))?\\b`, "g")))
    add(x.index!, x[0].length, x[3] ? +x[3] : null, MONTHS[x[2]], +x[1]);
  for (const x of t.matchAll(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "g")))
    add(x.index!, x[0].length, x[3] ? +x[3] : null, MONTHS[x[1]], +x[2]);
  // "20th to 22nd Dec": a lone day before a full date takes that date's month
  const sorted = found.sort((a, b) => a.at - b.at);
  if (sorted.length === 1) {
    const lone = t.slice(0, sorted[0].at).match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|till|until|hadi|mpaka)\s*$/);
    if (lone) sorted.unshift({ at: lone.index!, len: lone[0].length, y: sorted[0].y, m: sorted[0].m, d: +lone[1] });
  }

  // English puts the number first ("2 nights"), Swahili after the word ("usiku 2", "watu 3")
  // (Swahili order checked first: in "usiku 2 watu 3" the 2 belongs to usiku, not to watu)
  const nightsM = t.match(/\b(?:usiku|siku)\s*(\d{1,2})\b/) ?? t.match(/\b(\d{1,2})\s*(?:nights?|usiku|siku)\b/);
  const guestsM = t.match(/\b(?:watu|wageni)\s*(\d{1,2})\b/) ?? t.match(/\b(\d{1,2})\s*(?:guests?|people|persons?|pax|adults?|watu|wageni)\b/)
    ?? t.match(/\bfor\s+(\d{1,2})\b(?!\s*(?:nights?|days?))/);
  const ty = +today.slice(0, 4);
  const pick = (f: { y: number | null; m: number; d: number }, after?: string) => {
    let y = f.y ?? ty;
    let s = iso(y, f.m, f.d);
    if (f.y == null && s < (after ?? today)) { y += 1; s = iso(y, f.m, f.d); }
    return realDate(y, f.m, f.d) ? s : null;
  };
  if (!sorted.length) return { error: "dates" };
  const ci = pick(sorted[0]);
  if (!ci) return { error: "dates" };
  let co: string | null;
  if (sorted[1]) co = pick(sorted[1], addDays(ci, 1));
  else if (nightsM && +nightsM[1] >= 1) co = addDays(ci, +nightsM[1]);
  else co = addDays(ci, 1);
  if (!co) return { error: "dates" };
  if (ci < today) return { error: "past" };
  if (co <= ci) return { error: "order" };
  const g = guestsM ? Math.min(20, Math.max(1, +guestsM[1])) : 2;
  return { check_in: ci, check_out: co, guests: g, guestsGuessed: !guestsM };
};

const CODE = /\b(HE-?[A-Z0-9]{6})\b/i;

// ---------------------------------------------------------------- writing the replies
const money = (n: unknown, cur: string) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  try { return new Intl.NumberFormat("en-KE", { style: "currency", currency: cur || "KES", maximumFractionDigits: 0 }).format(v); }
  catch { return `${cur} ${Math.round(v).toLocaleString("en")}`; }
};
const day = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STATUS: Record<string, string> = { confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Stay completed", cancelled: "Cancelled", no_show: "No-show" };
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const menuText = (name: string) =>
  `👋 Welcome to *${name}*! How can we help?\n\nTap *Menu* below, or reply with a number:\n1 Rooms & prices\n2 Check availability\n3 My booking\n4 Location & contact\n5 Talk to staff`;

const AVAIL_ASK = "📅 Send your dates and number of guests, for example:\n*20/12 to 22/12, 2 guests*\nor *20 Dec, 3 nights, 2 adults*";
const BOOKING_ASK = "🔎 Send your *booking code* and *last name*, for example:\n*HE-AB12CD Otieno*\n(The code is in your booking email.)";

export const menuReply = async (deps: Deps, state: MenuState, raw: string): Promise<Reply> => {
  const text = (raw ?? "").trim();
  const choice = choiceOf(text);
  const h = await deps.hotel();
  const name = String(h?.name ?? "our hotel");
  const cur = String(h?.currency ?? "KES");
  const today = String(h?.today ?? new Date().toISOString().slice(0, 10));
  const link = deps.bookingLink;

  // ---- availability: dates in the message (asked for, or written straight away)
  const stay = parseStay(text, today);
  const wantsAvail = state === "avail" || choice === "avail" || (!("error" in stay) && choice !== "booking" && !CODE.test(text));
  if (wantsAvail && !("error" in stay)) {
    if (!h) return { kind: "buttons", body: "Online availability isn't available right now. A member of our team will help you here.", buttons: [B.menu], state: null, handoff: "asked for availability (booking page off)" };
    let offers: Record<string, any>[] = [];
    try { offers = await deps.availability(stay.check_in, stay.check_out, stay.guests); }
    catch { return { kind: "buttons", body: "Sorry, I couldn't check availability just now. Please try again in a minute, or talk to our team.", buttons: [B.other, B.staff], state: "avail" }; }
    const nights = Math.round((Date.parse(stay.check_out) - Date.parse(stay.check_in)) / 86400000);
    const head = `📅 *${day(stay.check_in)} → ${day(stay.check_out)}*\n${nights} night${nights === 1 ? "" : "s"}, ${stay.guests} guest${stay.guests === 1 ? "" : "s"}${stay.guestsGuessed ? " (send another number to change)" : ""}`;
    const ok = offers.filter((o) => Number(o.available) > 0 && o.fits);
    const lines = offers.map((o) =>
      Number(o.available) > 0 && o.fits
        ? `✅ *${o.name}*: ${money(o.total, cur)} total${Number(o.available) <= 2 ? ` (only ${o.available} left)` : ""}`
        : `▫️ ${o.name}: ${!o.fits ? `sleeps fewer than ${stay.guests}` : o.restriction ? String(o.restriction) : "not available"}`);
    const body = ok.length
      ? `${head}\n\n${lines.join("\n")}${link ? `\n\nBook online: ${link}` : "\n\nTo book, tap Talk to staff."}`
      : `${head}\n\nSorry, nothing is free for these dates and guests.${lines.length ? `\n\n${lines.join("\n")}` : ""}\n\nTry other dates, or talk to our team.`;
    return { kind: "buttons", body: cut(body, 1000), buttons: [B.other, B.booking, B.staff], state: null };
  }
  if (state === "avail" && "error" in stay && choice == null) {
    const why = stay.error === "past" ? "That date has already passed." : stay.error === "order" ? "The check-out date must be after check-in." : "I couldn't read the dates.";
    return { kind: "buttons", body: `${why}\n\n${AVAIL_ASK}`, buttons: [B.menu, B.staff], state: "avail" };
  }

  // ---- booking: code + last name, or the guest's own number
  const code = text.match(CODE)?.[1];
  if (code || (state === "booking" && choice == null)) {
    if (!code) return { kind: "buttons", body: `I couldn't find a booking code in that.\n\n${BOOKING_ASK}`, buttons: [B.menu, B.staff], state: "booking" };
    const key = text.replace(CODE, " ").replace(/[^\p{L}@.\-'\s]/gu, " ").replace(/\s+/g, " ").trim().split(" ").pop() ?? "";
    if (!key) return { kind: "buttons", body: `Thanks! Now send the code with your *last name*, for example *${code.toUpperCase()} Otieno*.`, buttons: [B.menu, B.staff], state: "booking" };
    try {
      const b = await deps.lookup(code, key);
      return { kind: "buttons", body: cut(bookingText([b], cur, link), 1000), buttons: [B.menu, B.staff], state: null };
    } catch {
      return { kind: "buttons", body: "I couldn't find a booking with that code and last name. Please check both and send them again, or talk to our team.", buttons: [B.menu, B.staff], state: "booking" };
    }
  }

  switch (choice) {
    case "rooms": {
      const rooms = Array.isArray(h?.room_types) ? h!.room_types : [];
      if (!rooms.length) return { kind: "buttons", body: "Our team will tell you about rooms and prices.", buttons: [B.staff, B.menu], state: null };
      const list = rooms.map((r: Record<string, any>) => `🛏️ *${r.name}*, sleeps ${r.max_occupancy}: from ${money(r.rate, cur)} per night`).join("\n");
      return { kind: "buttons", body: cut(`*Our rooms*\n\n${list}\n\nPrices ${h?.prices_include_tax ? "include taxes" : "are before taxes"}.${link ? `\nPhotos and booking: ${link}` : ""}`, 1000), buttons: [B.avail, B.staff, B.menu], state: null };
    }
    case "avail":
      return { kind: "buttons", body: AVAIL_ASK, buttons: [B.menu, B.staff], state: "avail" };
    case "booking": {
      const mine = await deps.myBookings().catch(() => []);
      if (mine.length) return { kind: "buttons", body: cut(bookingText(mine, cur, link), 1000), buttons: [B.menu, B.staff], state: null };
      return { kind: "buttons", body: BOOKING_ASK, buttons: [B.menu, B.staff], state: "booking" };
    }
    case "contact": {
      const where = [h?.address, h?.city, h?.country].filter(Boolean).join(", ");
      const lines = [
        `📍 *${name}*${where ? `\n${where}` : ""}`,
        h?.phone ? `📞 ${h.phone}` : "", h?.email ? `✉️ ${h.email}` : "",
        `🕑 Check-in from ${h?.checkin_time ?? "14:00"}, check-out by ${h?.checkout_time ?? "10:00"}`,
        link ? `🌐 ${link}` : "",
        h?.policies ? `\n*House rules*\n${cut(String(h.policies), 350)}` : "",
      ].filter(Boolean);
      return { kind: "buttons", body: cut(lines.join("\n"), 1000), buttons: [B.avail, B.staff, B.menu], state: null };
    }
    case "staff":
      return { kind: "text", body: deps.handoffMessage || "Thank you! A member of our team will reply to you here shortly. 🙏", state: null, handoff: "guest asked for a person" };
    default:
      return { kind: "menu", body: menuText(name), state: null };
  }
};

const bookingText = (list: Record<string, any>[], cur: string, link: string | null) => {
  const parts = list.map((b) => [
    `🧾 *${b.code}*: ${STATUS[String(b.status)] ?? b.status}`,
    `${b.guest ? `${b.guest} · ` : ""}${b.room_type ?? "Room"}${b.room ? ` (room ${b.room})` : ""}`,
    `${day(String(b.check_in))} → ${day(String(b.check_out))}${b.nights ? `, ${b.nights} night${Number(b.nights) === 1 ? "" : "s"}` : ""}`,
    b.total != null ? `Total ${money(b.total, String(b.currency ?? cur))}` : "",
    b.can_cancel && b.cancel_by ? `Free cancellation until ${day(String(b.cancel_by))}` : "",
  ].filter(Boolean).join("\n"));
  return `${parts.join("\n\n")}${link ? `\n\nManage or check in online: ${link}?manage=1` : ""}`;
};
