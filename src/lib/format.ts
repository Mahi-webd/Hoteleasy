import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { BookingSource, ChargeKind, HkStatus, HkTaskType, HotelRole, MtCategory, MtStatus, PaymentMethod, Priority, ReservationStatus, RoomStatus } from "./db-types";

export const formatMoney = (amount: number | null | undefined, currency = "KES") =>
  `${currency} ${Number(amount ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

/** Today's date (YYYY-MM-DD) in the hotel's time zone. */
export const todayIn = (timeZone = "Africa/Nairobi") =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const addDays = (isoDate: string, days: number) => {
  const d = parseISO(isoDate);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
};

export const nightsBetween = (from: string, to: string) =>
  Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);

export const formatDate = (iso: string | null | undefined) => (iso ? format(parseISO(iso), "d MMM yyyy") : "—");
export const formatShortDate = (iso: string | null | undefined) => (iso ? format(parseISO(iso), "d MMM") : "—");
export const timeAgo = (iso: string) => formatDistanceToNow(parseISO(iso), { addSuffix: true });

export const ROLE_LABELS: Record<HotelRole, string> = {
  owner: "Owner",
  manager: "Manager",
  front_desk: "Front desk",
  housekeeping: "Housekeeping",
  restaurant: "Restaurant",
  accountant: "Accountant",
  maintenance: "Maintenance",
};

export const PRIORITY: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200" },
  normal: { label: "Normal", className: "bg-blue-50 text-blue-700 border-blue-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200" },
  urgent: { label: "Urgent", className: "bg-red-600 text-white border-red-600" },
};

export const HK_TYPES: Record<HkTaskType, string> = {
  checkout_clean: "Check-out clean",
  stayover_clean: "Daily service",
  deep_clean: "Deep clean",
  turndown: "Turndown",
  inspection: "Inspection",
};

export const HK_STATUS: Record<HkStatus, { label: string; className: string }> = {
  pending: { label: "To do", className: "bg-amber-100 text-amber-800 border-amber-200" },
  in_progress: { label: "Cleaning", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  done: { label: "Done", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const MT_CATEGORIES: Record<MtCategory, string> = {
  plumbing: "Plumbing / water",
  electrical: "Electrical / lights",
  air_con: "Air con / fan",
  furniture: "Furniture / fittings",
  appliance: "Appliance (TV, fridge, kettle)",
  internet_tv: "WiFi / DSTV",
  locks_keys: "Locks / keys / safe",
  painting: "Walls / painting",
  pest: "Pests",
  other: "Other",
};

export const MT_STATUS: Record<MtStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-50 text-red-700 border-red-200" },
  in_progress: { label: "Being fixed", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  on_hold: { label: "On hold", className: "bg-slate-100 text-slate-700 border-slate-300" },
  resolved: { label: "Fixed", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const ROOM_STATUS: Record<RoomStatus, { label: string; className: string; dot: string }> = {
  available: { label: "Available", className: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  occupied: { label: "Occupied", className: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  dirty: { label: "Dirty", className: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  cleaning: { label: "Cleaning", className: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  maintenance: { label: "Maintenance", className: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  out_of_order: { label: "Out of order", className: "bg-slate-200 text-slate-700 border-slate-300", dot: "bg-slate-500" },
};

export const RES_STATUS: Record<ReservationStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 border-blue-200" },
  checked_in: { label: "In house", className: "bg-green-100 text-green-800 border-green-200" },
  checked_out: { label: "Checked out", className: "bg-slate-100 text-slate-700 border-slate-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  no_show: { label: "No-show", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

export const SOURCE_LABELS: Record<BookingSource, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  email: "Email",
  website: "Website",
  booking_com: "Booking.com",
  expedia: "Expedia",
  airbnb: "Airbnb",
  agent: "Travel agent",
  other: "Other",
};

export const CHARGE_KINDS: Record<ChargeKind, string> = {
  room: "Room",
  food: "Food",
  drinks: "Drinks / bar",
  laundry: "Laundry",
  minibar: "Minibar",
  transport: "Transport",
  spa: "Spa",
  conference: "Conference / hall",
  service: "Other service",
  other: "Other",
  discount: "Discount",
};

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
  card: "Card",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

/** 2 decimal places, for bills and invoices. */
export const formatMoney2 = (amount: number | null | undefined, currency = "KES") =>
  `${currency} ${Number(amount ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const guestName = (g?: { first_name: string; last_name: string } | null) =>
  g ? `${g.first_name} ${g.last_name}`.trim() : "Unknown guest";

/** Turn Supabase/Postgres errors into something a receptionist can read. */
export const friendlyError = (err: unknown): string => {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (msg.includes("reservations_no_overlap")) return "That room is already booked for some of those nights.";
  if (msg.includes("reservations_dates_ck")) return "Check-out must be after check-in.";
  if (msg.includes("rooms_hotel_id_room_number_key")) return "A room with that number already exists.";
  if (msg.includes("room_types_hotel_id_name_key")) return "A room type with that name already exists.";
  if (msg.includes("hotel_invitations_pending_uq")) return "That email already has a pending invitation.";
  if (msg.includes("violates foreign key") && msg.includes("room_types"))
    return "This room type is still used by rooms or reservations.";
  if (msg.includes("violates foreign key") && msg.includes("guests"))
    return "This guest has reservations and can't be deleted.";
  if (msg.includes("BALANCE_DUE:")) return msg.replace(/^.*BALANCE_DUE:\s*/, "") + ". Take payment or choose \u201ccheck out with balance owing\u201d.";
  if (msg.includes("payments_mpesa_once")) return "That M-Pesa code has already been recorded.";
  if (msg.includes("payments_mpesa_code")) return "M-Pesa codes are 10 letters/numbers, e.g. TK45ABC1XY.";
  if (msg.includes("folio_charges_discount_sign")) return "Prices must be positive (use the Discount type to reduce a bill).";
  if (msg.includes("row-level security")) return "You don't have permission to do that.";
  if (msg.includes("Failed to fetch")) return "Can't reach the server. Check your internet connection.";
  return msg;
};
