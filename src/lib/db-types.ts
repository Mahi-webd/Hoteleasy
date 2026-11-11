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
