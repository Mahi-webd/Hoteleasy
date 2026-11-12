import { format, formatDistanceToNow, parseISO } from "date-fns";
import type { BookingSource, ChargeKind, HkStatus, HkTaskType, HotelRole, MtCategory, MtStatus, OutletKind, PaymentMethod, PosItemStatus, PosPaymentMethod, Priority, ReservationStatus, RoomStatus } from "./db-types";

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
  storekeeper: "Storekeeper",
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
  if (msg.includes("NO_SHIFT:")) return "Open your cash shift first (POS → Shift).";
  if (msg.includes("pos_orders_one_open_per_table")) return "That table already has an open bill.";
  if (msg.includes("expenses_one_bill_per_receipt")) return "There is already a bill for this delivery.";
  if (msg.includes("expenses_check2")) return "Give a reason for voiding this expense.";
  if (msg.includes("expenses_check1")) return "Choose how and when it was paid.";
  if (msg.includes("expenses_check")) return "Check the amounts: VAT can't be more than the total.";
  if (msg.includes("expense_categories_hotel_id_name_key")) return "A category with that name already exists.";
  if (msg.includes("budgets_cat") || msg.includes("budgets_rev")) return "There is already a budget for that month.";
  if (msg.includes("booking_settings_slug_key")) return "That page address is already used by another hotel. Choose another.";
  if (msg.includes("booking_settings_slug_check")) return "The page address can only use lowercase letters, numbers and dashes (3 to 48 characters).";
  if (msg.includes("photo_url_check")) return "Photo links must start with https://";
  if (msg.includes("stock_items_name")) return "A stock item with that name already exists.";
  if (msg.includes("suppliers_hotel_id_name_key")) return "A supplier with that name already exists.";
  if (msg.includes("stock_locations_hotel_id_name_key")) return "A store with that name already exists.";
  if (msg.includes("purchase_order_lines_po_id_item_id_key")) return "That item is already on the order; change its quantity instead.";
  if (msg.includes("stock_counts_one_open")) return "A count is already open for this store.";
  if (msg.includes("menu_item_recipes_pkey")) return "That ingredient is already in the recipe.";
  if (msg.includes("violates foreign key") && msg.includes("stock_items")) return "This item has history (orders, recipes or movements). Hide it instead.";
  if (msg.includes("row-level security")) return "You don't have permission to do that.";
  if (msg.includes("Failed to fetch")) return "Can't reach the server. Check your internet connection.";
  return msg;
};

export const OUTLET_KINDS: Record<OutletKind, string> = {
  restaurant: "Restaurant", bar: "Bar", room_service: "Room service", pool_bar: "Pool bar", cafe: "Café", other: "Other",
};
export const POS_METHODS: Record<PosPaymentMethod, string> = {
  cash: "Cash", mpesa: "M-Pesa", card: "Card", room: "Charged to room", other: "Other",
};
export const ITEM_STATUS: Record<PosItemStatus, { label: string; className: string }> = {
  new: { label: "Not sent", className: "bg-slate-100 text-slate-700 border-slate-200" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800 border-blue-200" },
  preparing: { label: "Preparing", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  ready: { label: "Ready", className: "bg-green-100 text-green-800 border-green-200" },
  served: { label: "Served", className: "bg-slate-100 text-slate-600 border-slate-200" },
  void: { label: "Void", className: "bg-red-50 text-red-700 border-red-200" },
};
/** Minutes since an ISO time, for kitchen timers. */
export const minutesSince = (iso: string | null | undefined, now = Date.now()) =>
  iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0;

// ---------------------------------------------------------------- inventory
export const LOCATION_KINDS: Record<import("./db-types").StockLocationKind, string> = {
  main: "Main store", kitchen: "Kitchen", bar: "Bar", housekeeping: "Housekeeping", other: "Other",
};
export const PO_STATUS: Record<import("./db-types").PoStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  approved: { label: "Approved", className: "bg-blue-50 text-blue-700 border-blue-200" },
  partly_received: { label: "Part received", className: "bg-amber-50 text-amber-800 border-amber-200" },
  received: { label: "Received", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-50 text-slate-500 border-slate-200 line-through" },
};
export const MOVE_KINDS: Record<import("./db-types").StockMoveKind, string> = {
  opening: "Opening stock", receive: "Received", transfer_out: "Sent to store", transfer_in: "Received from store",
  issue: "Issued", waste: "Waste", sale: "Sold (recipe)", adjust: "Count adjustment", return: "Returned to supplier",
};
export const STOCK_UNITS = ["pcs", "kg", "g", "l", "ml", "btl", "can", "crate", "pkt", "box", "roll", "tray", "bunch"];
export const formatQty = (n: number | null | undefined, unit?: string) =>
  n == null ? "—" : `${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

// ---------------------------------------------------------------- expenses
export const EXPENSE_GROUPS: Record<import("./db-types").ExpenseGroup, string> = {
  cost_of_sales: "Cost of sales", payroll: "Staff costs", utilities: "Utilities", repairs: "Repairs & supplies",
  marketing: "Marketing", admin: "Rent & admin", other: "Other", stock: "Stock purchases (inventory)",
};
export const EXPENSE_METHODS: Record<import("./db-types").ExpenseMethod, string> = {
  cash: "Cash", mpesa: "M-Pesa", bank_transfer: "Bank transfer", card: "Card", cheque: "Cheque", other: "Other",
};
