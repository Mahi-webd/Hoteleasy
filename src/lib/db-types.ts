// Types mirroring supabase/migrations/20261111000000_core_multi_hotel.sql

export type HotelRole =
  | "owner"
  | "manager"
  | "front_desk"
  | "housekeeping"
  | "restaurant"
  | "accountant";

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
