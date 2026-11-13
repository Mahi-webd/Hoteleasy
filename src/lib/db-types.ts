// Types mirroring supabase/migrations/20261111000000_core_multi_hotel.sql

export type HotelRole =
  | "owner"
  | "manager"
  | "front_desk"
  | "housekeeping"
  | "restaurant"
  | "accountant"
  | "maintenance"
  | "storekeeper";

export type RoomStatus =
  | "available"
  | "occupied"
  | "dirty"
  | "cleaning"
  | "maintenance"
  | "out_of_order";

export type ReservationStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type BookingSource =
  | "walk_in"
  | "phone"
  | "email"
  | "website"
  | "booking_com"
  | "expedia"
  | "airbnb"
  | "agent"
  | "other";

export interface Hotel {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  vat_rate: number;
  checkin_time: string;
  checkout_time: string;
  created_at: string;
  kra_pin: string | null;
  prices_include_vat: boolean;
  tourism_levy_rate: number;
  invoice_prefix: string;
  next_invoice_number: number;
  house_rules?: string | null;
  mpesa_paybill: string | null;
  mpesa_account: string | null;
  mpesa_till: string | null;
  bank_details: string | null;
  invoice_footer: string | null;
}

export interface Membership {
  id: string;
  hotel_id: string;
  role: HotelRole;
  hotels: Hotel;
}

export interface TeamMember {
  member_id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: HotelRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  hotel_id: string;
  email: string;
  role: HotelRole;
  accepted_at: string | null;
  created_at: string;
}

export interface RoomType {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  base_rate: number;
  max_occupancy: number;
  amenities: string[];
  photo_url?: string | null;
  online_bookable?: boolean;
  online_rate?: number | null;
}

export interface Room {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type_id: string;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  room_types?: Pick<RoomType, "id" | "name" | "base_rate" | "max_occupancy"> | null;
}

export interface Guest {
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  id_type: string | null;
  id_number: string | null;
  nationality: string | null;
  address: string | null;
  date_of_birth: string | null;
  is_vip: boolean;
  notes: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  hotel_id: string;
  code: string;
  guest_id: string;
  room_type_id: string;
  room_id: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: ReservationStatus;
  source: BookingSource;
  rate_per_night: number;
  nights: number;
  total_amount: number;
  special_requests: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  guests?: Pick<Guest, "id" | "first_name" | "last_name" | "phone" | "email" | "is_vip"> | null;
  rooms?: Pick<Room, "id" | "room_number" | "status"> | null;
  room_types?: Pick<RoomType, "id" | "name"> | null;
}

export interface ActivityItem {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}

export type ChargeKind =
  | "room" | "food" | "drinks" | "laundry" | "minibar" | "transport" | "spa" | "conference" | "service" | "other" | "discount";

export type PaymentMethod = "cash" | "mpesa" | "card" | "bank_transfer" | "cheque" | "other";

export interface FolioCharge {
  id: string;
  hotel_id: string;
  reservation_id: string;
  kind: ChargeKind;
  description: string;
  stay_date: string | null;
  quantity: number;
  unit_price: number;
  net_amount: number;
  vat_amount: number;
  levy_amount: number;
  amount: number;
  posted_by: string | null;
  posted_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface Payment {
  id: string;
  hotel_id: string;
  reservation_id: string;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  payer_phone: string | null;
  notes: string | null;
  received_by: string | null;
  received_at: string;
  voided_at: string | null;
  void_reason: string | null;
  reservations?: Pick<Reservation, "id" | "code"> & { guests?: Pick<Guest, "first_name" | "last_name"> | null; rooms?: Pick<Room, "room_number"> | null };
}

export interface Balance {
  reservation_id: string;
  charges_total: number;
  payments_total: number;
  balance: number;
}

export interface InvoiceLine {
  kind: ChargeKind;
  description: string;
  date: string;
  quantity: number;
  unit_price: number;
  net: number;
  vat: number;
  levy: number;
  amount: number;
}

export interface Invoice {
  id: string;
  hotel_id: string;
  reservation_id: string;
  number: string;
  issued_at: string;
  hotel: {
    name: string; address: string | null; city: string | null; country: string; phone: string | null; email: string | null;
    kra_pin: string | null; currency: string; mpesa_paybill: string | null; mpesa_account: string | null; mpesa_till: string | null;
    bank_details: string | null; footer: string | null; vat_rate: number; levy_rate: number;
  };
  guest: { name: string; phone: string | null; email: string | null; id_type: string | null; id_number: string | null; address: string | null };
  stay: { code: string; room: string | null; check_in: string; check_out: string; nights: number; adults: number; children: number };
  lines: InvoiceLine[];
  net_total: number;
  vat_total: number;
  levy_total: number;
  total: number;
  superseded_at: string | null;
}

export type Priority = "low" | "normal" | "high" | "urgent";
export type HkTaskType = "checkout_clean" | "stayover_clean" | "deep_clean" | "turndown" | "inspection";
export type HkStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface HkTask {
  id: string;
  hotel_id: string;
  room_id: string;
  task_type: HkTaskType;
  status: HkStatus;
  priority: Priority;
  due_date: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  updated_at: string;
  rooms?: Pick<Room, "id" | "room_number" | "status" | "floor"> & { room_types?: { name: string } | null };
}

export type MtCategory =
  | "plumbing" | "electrical" | "air_con" | "furniture" | "appliance" | "internet_tv" | "locks_keys" | "painting" | "pest" | "other";
export type MtStatus = "open" | "in_progress" | "on_hold" | "resolved" | "cancelled";

export interface MtTicket {
  id: string;
  hotel_id: string;
  number: number;
  room_id: string | null;
  location: string | null;
  title: string;
  description: string | null;
  category: MtCategory;
  priority: Priority;
  status: MtStatus;
  blocks_room: boolean;
  assigned_to: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  cost: number | null;
  rooms?: Pick<Room, "id" | "room_number" | "status"> | null;
}

// ------------------------------------------------------------------ POS
export type OutletKind = "restaurant" | "bar" | "room_service" | "pool_bar" | "cafe" | "other";
export type PosStation = "kitchen" | "bar" | "none";
export type TaxCategory = "standard" | "zero_rated" | "exempt";
export type PosOrderType = "dine_in" | "takeaway" | "room_service";
export type PosOrderStatus = "open" | "paid" | "void";
export type PosItemStatus = "new" | "sent" | "preparing" | "ready" | "served" | "void";
export type PosPaymentMethod = "cash" | "mpesa" | "card" | "room" | "other";

export interface PosOutlet { id: string; hotel_id: string; name: string; kind: OutletKind; service_charge_rate: number; active: boolean; sort: number; stock_location_id?: string | null }
export interface PosTable { id: string; hotel_id: string; outlet_id: string; name: string; seats: number; active: boolean; sort: number }
export interface MenuCategory { id: string; hotel_id: string; name: string; station: PosStation; sort: number }
export interface MenuItem {
  id: string; hotel_id: string; category_id: string; name: string; description: string | null; price: number;
  tax_category: TaxCategory; item_code: string | null; station: PosStation | null; charge_kind: ChargeKind;
  outlet_ids: string[]; available: boolean; active: boolean; sort: number;
  menu_item_modifier_groups?: { group_id: string; sort: number }[];
}
export interface ModifierOption { id: string; group_id: string; name: string; price_delta: number; sort: number }
export interface ModifierGroup { id: string; hotel_id: string; name: string; min_choices: number; max_choices: number; sort: number; modifier_options: ModifierOption[] }

export interface PosOrderItem {
  id: string; order_id: string; hotel_id: string; menu_item_id: string | null; name: string; unit_price: number; quantity: number;
  modifiers: { id?: string; group: string; name: string; price_delta: number }[]; notes: string | null; station: PosStation;
  tax_category: TaxCategory; charge_kind: ChargeKind; status: PosItemStatus; comped: boolean; comp_reason: string | null;
  void_reason: string | null; approved_by: string | null; added_by: string | null; added_at: string; sent_at: string | null;
  ready_at: string | null; served_at: string | null; gross: number;
}
export interface PosPayment {
  id: string; order_id: string; shift_id: string | null; method: PosPaymentMethod; amount: number; tendered: number | null;
  change_given: number | null; reference: string | null; reservation_id: string | null; received_by: string | null;
  received_at: string; voided_at: string | null;
}
export interface PosOrder {
  id: string; hotel_id: string; outlet_id: string; number: number; order_type: PosOrderType; table_id: string | null;
  reservation_id: string | null; label: string | null; guests: number; status: PosOrderStatus; waiter_id: string | null;
  discount_kind: "percent" | "amount" | null; discount_value: number; discount_reason: string | null; service_charge_rate: number;
  items_gross: number; discount_amount: number; net_amount: number; vat_amount: number; levy_amount: number; service_charge: number;
  total: number; paid_total: number; notes: string | null; opened_at: string; closed_at: string | null; void_reason: string | null;
  pos_order_items?: PosOrderItem[]; pos_payments?: PosPayment[];
  pos_tables?: { name: string } | null; pos_outlets?: { name: string; kind: OutletKind } | null;
  reservations?: { id: string; code: string; rooms?: { room_number: string } | null; guests?: { first_name: string; last_name: string } | null } | null;
}
export interface PosShift {
  id: string; hotel_id: string; user_id: string; opened_at: string; opening_float: number; closed_at: string | null;
  counted_cash: number | null; expected_cash: number | null; variance: number | null; z_report: ShiftReport | null; notes: string | null;
}
export interface ShiftReport {
  opening_float: number; by_method: Partial<Record<PosPaymentMethod, number>>; payments: number; bills: number;
  expected_cash: number; voided_payments: number; counted_cash?: number; variance?: number; opened_at: string; closed_at?: string;
}

// ---------------------------------------------------------------- inventory
export type StockLocationKind = "main" | "kitchen" | "bar" | "housekeeping" | "other";
export type PoStatus = "draft" | "approved" | "partly_received" | "received" | "cancelled";
export type StockMoveKind = "opening" | "receive" | "transfer_out" | "transfer_in" | "issue" | "waste" | "sale" | "adjust" | "return";

export interface StockLocation { id: string; hotel_id: string; name: string; kind: StockLocationKind; active: boolean; sort: number }
export interface Supplier {
  id: string; hotel_id: string; name: string; contact_name: string | null; phone: string | null; email: string | null;
  kra_pin: string | null; payment_terms: string | null; notes: string | null; active: boolean;
}
export interface StockItem {
  id: string; hotel_id: string; name: string; sku: string | null; category: string; unit: string;
  reorder_level: number; reorder_qty: number; avg_cost: number; last_cost: number | null;
  preferred_supplier_id: string | null; active: boolean; notes: string | null;
}
export interface StockLevel { item_id: string; location_id: string; hotel_id: string; qty: number }
export interface PoLine { id: string; po_id: string; item_id: string; qty: number; unit_cost: number; qty_received: number }
export interface PurchaseOrder {
  id: string; hotel_id: string; number: number; supplier_id: string; location_id: string; status: PoStatus;
  expected_on: string | null; notes: string | null; created_by: string | null; approved_by: string | null; approved_at: string | null;
  created_at: string; purchase_order_lines: PoLine[];
}
export interface StockMovement {
  id: string; item_id: string; location_id: string; kind: StockMoveKind; qty: number; unit_cost: number; value: number;
  batch_id: string; reference: string | null; note: string | null; department: string | null; supplier_id: string | null;
  po_id: string | null; created_by: string | null; created_at: string;
}
export interface StockCountLine { count_id: string; item_id: string; expected: number | null; counted: number | null; unit_cost: number | null }
export interface StockCount {
  id: string; number: number; location_id: string; status: "open" | "posted" | "cancelled"; note: string | null;
  created_at: string; posted_at: string | null; variance_value: number | null; stock_count_lines?: StockCountLine[];
}
export interface Recipe { menu_item_id: string; stock_item_id: string; hotel_id: string; qty: number }
export interface CostReport {
  outlets: { outlet: string; kind: string; sales: number; cost: number; lines_without_recipe: number; lines: number }[];
  items: { item: string; kind: string; qty: number; sales: number; cost: number; price: number | null; portion_cost: number; has_recipe: boolean }[];
  comps: number;
  movements: { location: string; kind: StockMoveKind; value: number; lines: number }[];
  purchases: { supplier: string; value: number; deliveries: number }[];
  stock_value: { location: string; value: number; items: number }[];
}

// ---------------------------------------------------------------- online booking & feedback
export interface BookingSettings {
  hotel_id: string; enabled: boolean; slug: string; headline: string | null; description: string | null; photo_url: string | null;
  policies: string | null; payment_instructions: string | null; whatsapp: string | null; free_cancel_days: number | null;
  min_nights: number; max_nights: number; max_advance_days: number; same_day_cutoff: string; show_reviews: boolean;
}
export interface GuestFeedback {
  id: string; hotel_id: string; reservation_id: string; token: string; created_at: string; expires_at: string; shared_at: string | null;
  submitted_at: string | null; overall: number | null; cleanliness: number | null; service: number | null; comfort: number | null;
  food: number | null; value: number | null; recommend: number | null; comment: string | null; public_name: string | null;
  consent_publish: boolean; published: boolean; response: string | null; responded_at: string | null;
  reservations?: { code: string; check_in: string; check_out: string; guests?: { first_name: string; last_name: string; phone: string | null; email: string | null } | null;
    rooms?: { room_number: string } | null } | null;
}
export interface PublicRoomType { id: string; name: string; description: string | null; max_occupancy: number; amenities: string[]; photo_url: string | null; rate: number }
export interface PublicHotel {
  name: string; city: string | null; address: string | null; country: string; phone: string | null; email: string | null; currency: string;
  checkin_time: string; checkout_time: string; prices_include_tax: boolean; tax_rate: number; today: string;
  headline: string | null; description: string | null; photo_url: string | null; policies: string | null; payment_instructions: string | null;
  whatsapp: string | null; free_cancel_days: number | null; min_nights: number; max_nights: number; max_advance_days: number;
  room_types: PublicRoomType[];
  reviews: { count: number; average: number | null; recent: { name: string; overall: number; comment: string | null; month: string; response: string | null }[] } | null;
}

// ---------------------------------------------------------------- expenses & P&L
export type ExpenseGroup = "cost_of_sales" | "payroll" | "utilities" | "repairs" | "marketing" | "admin" | "other" | "stock";
export type ExpenseMethod = "cash" | "mpesa" | "bank_transfer" | "card" | "cheque" | "other";
export interface ExpenseCategory { id: string; hotel_id: string; name: string; grp: ExpenseGroup; active: boolean; sort: number }
export interface Expense {
  id: string; hotel_id: string; number: number; spent_on: string; category_id: string; supplier_id: string | null; payee: string | null;
  description: string; amount: number; vat_amount: number; net_amount: number; reference: string | null; due_on: string | null;
  paid_on: string | null; paid_method: ExpenseMethod | null; paid_reference: string | null; recurring: boolean; receipt_batch: string | null;
  status: "unpaid" | "paid" | "void"; void_reason: string | null; created_at: string;
}
export interface Budget { id: string; hotel_id: string; month: string; category_id: string | null; revenue_grp: "rooms" | "fnb" | "other" | null; amount: number }
export interface PnlLine { month: string; section: "revenue" | "cost_of_sales" | "expenses"; line: string; category_id: string | null; category: string | null; actual: number; budget: number | null }
export interface PnlReport {
  from: string; to: string; lines: PnlLine[];
  vat: { output: number; levy: number; input: number };
  paid_out: { method: ExpenseMethod; amount: number; count: number }[];
  payables: { total: number; count: number; overdue: number; due_7: number; later: number };
}

// ---------------------------------------------------------------- staff & rota
export type Employment = "permanent" | "contract" | "casual";
export type LeaveKind = "annual" | "sick" | "maternity" | "paternity" | "compassionate" | "unpaid" | "off";
export interface Staff {
  id: string; hotel_id: string; full_name: string; department: string; job_title: string | null; phone: string | null;
  employment: Employment; user_id: string | null; active: boolean; started_on: string | null; notes: string | null;
}
export interface StaffPay {
  staff_id: string; hotel_id: string; pay_type: "monthly" | "daily" | "hourly"; rate: number;
  statutory?: boolean; house_allowance?: number; other_allowance?: number; kra_pin?: string | null; nssf_no?: string | null; sha_no?: string | null;
  id_no?: string | null; pay_method?: "mpesa" | "bank" | "cash"; pay_account?: string | null; bank_name?: string | null;
}
export interface ShiftTemplate { id: string; hotel_id: string; name: string; starts: string; ends: string; break_minutes: number; color: string; sort: number }
export interface Shift {
  id: string; hotel_id: string; staff_id: string; starts_at: string; ends_at: string; break_minutes: number; template_id: string | null;
  department: string | null; note: string | null; published: boolean;
}
export interface LeaveRequest {
  id: string; hotel_id: string; staff_id: string; kind: LeaveKind; from_date: string; to_date: string;
  status: "requested" | "approved" | "refused" | "cancelled"; note: string | null; decided_at: string | null; created_at: string;
}
export interface TimeEntry {
  id: string; hotel_id: string; staff_id: string; shift_id: string | null; clock_in: string; clock_out: string | null;
  source: "self" | "supervisor"; note: string | null; edited_by: string | null;
}
export interface HoursRow {
  staff_id: string; name: string; department: string; employment: Employment; shifts: number; scheduled_hours: number; worked_days: number;
  worked_hours: number; open: number; late: number; absent: number; leave_days: number; sick_days: number; overtime_hours: number;
  pay_type: StaffPay["pay_type"] | null; rate: number | null; pay_estimate: number | null;
}

// ---------------------------------------------------------------- payroll
export interface PayeBand { upto: number | null; rate: number }
export interface PayrollRates {
  id: string; hotel_id: string; effective_from: string; paye_bands: PayeBand[]; personal_relief: number; nssf_rate: number; nssf_lel: number; nssf_uel: number;
  shif_rate: number; shif_min: number; ahl_rate: number; ahl_employer_rate: number; nita_per_employee: number; overtime_multiplier: number; hours_per_month: number; note: string | null;
}
export interface PayrollRun { id: string; hotel_id: string; month: string; status: "draft" | "approved" | "paid"; rates_id: string; approved_at: string | null; paid_on: string | null; created_at: string }
export interface Payslip {
  id: string; run_id: string; hotel_id: string; staff_id: string; full_name: string; department: string | null; job_title: string | null;
  kra_pin: string | null; nssf_no: string | null; sha_no: string | null; id_no: string | null; pay_type: string; rate: number; pay_method: string | null; pay_account: string | null;
  statutory: boolean; days_worked: number; hours_worked: number; overtime_hours: number; bonus: number; advances: number; other_deductions: number; note: string | null;
  basic: number; house_allowance: number; other_allowance: number; overtime_pay: number; gross: number; nssf_tier1: number; nssf_tier2: number; shif: number; ahl: number;
  taxable: number; tax_before_relief: number; personal_relief: number; paye: number; net: number; employer_nssf: number; employer_ahl: number; nita: number;
}
