import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { BookingSettings, GuestFeedback, PublicHotel, RoomType } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

// ---------------------------------------------------------------- staff
export const useBookingSettings = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["online", "settings", hotel.id],
    queryFn: async () => unwrap(await supabase.from("booking_settings").select("*").eq("hotel_id", hotel.id).maybeSingle()) as BookingSettings | null,
  });
};

export const useSaveBookingSettings = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<BookingSettings>) =>
      unwrap(await supabase.from("booking_settings").update(s).eq("hotel_id", hotel.id).select().single()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["online"] }); toast.success("Booking page saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useSaveRoomTypeOnline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Pick<RoomType, "id"> & Partial<RoomType>) =>
      unwrap(await supabase.from("room_types").update(rest).eq("id", id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roomTypes"] }); qc.invalidateQueries({ queryKey: ["online"] }); toast.success("Room type saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useFeedback = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["online", "feedback", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("guest_feedback")
        .select("*, reservations(code, check_in, check_out, guests(first_name, last_name, phone, email), rooms(room_number))")
        .eq("hotel_id", hotel.id).order("created_at", { ascending: false }).limit(300)) as GuestFeedback[],
  });
};

export const useUpdateFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: { id: string; response?: string | null; published?: boolean; shared_at?: string }) =>
      unwrap(await supabase.from("guest_feedback").update(rest).eq("id", id)),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["online", "feedback"] });
      if (v.response !== undefined) toast.success("Reply saved");
      else if (v.published !== undefined) toast.success(v.published ? "Shown on your booking page" : "Hidden from your booking page");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const getFeedbackLink = async (reservationId: string) =>
  `${window.location.origin}/feedback/${unwrap(await supabase.rpc("feedback_link", { _reservation_id: reservationId })) as string}`;

// ---------------------------------------------------------------- public (no sign-in)
export const usePublicHotel = (slug: string) =>
  useQuery({
    queryKey: ["public", "hotel", slug],
    queryFn: async () => unwrap(await supabase.rpc("public_hotel", { _slug: slug })) as PublicHotel | null,
    staleTime: 60_000,
  });

export interface Offer { room_type_id: string; name: string; available: number; fits: boolean; nights: number; rate: number; total: number; uniform?: boolean; seasons?: string[]; restriction?: string | null }

export const fetchAvailability = async (slug: string, checkIn: string, checkOut: string, guests: number) =>
  unwrap(await supabase.rpc("public_availability", { _slug: slug, _check_in: checkIn, _check_out: checkOut, _guests: guests })) as Offer[];

export interface BookingResult { code: string; room_type: string; check_in: string; check_out: string; nights: number; rate: number; total: number; currency: string; guest: string; email: string }

export const bookRoom = async (a: {
  slug: string; roomTypeId: string; checkIn: string; checkOut: string; adults: number; children: number;
  firstName: string; lastName: string; email: string; phone: string; nationality?: string; requests?: string; website?: string;
}) =>
  unwrap(await supabase.rpc("public_book", {
    _slug: a.slug, _room_type_id: a.roomTypeId, _check_in: a.checkIn, _check_out: a.checkOut, _adults: a.adults, _children: a.children,
    _first_name: a.firstName, _last_name: a.lastName, _email: a.email, _phone: a.phone, _nationality: a.nationality || null,
    _requests: a.requests || null, _website: a.website || null,
  })) as BookingResult;

export interface BookingLookup {
  code: string; status: string; room_type: string; check_in: string; check_out: string; nights: number; total: number; currency: string;
  guest: string; can_cancel: boolean; cancel_by: string | null;
}
export const lookupBooking = async (slug: string, code: string, key: string, cancel = false) =>
  unwrap(await supabase.rpc("public_booking", { _slug: slug, _code: code, _email_or_last_name: key, _cancel: cancel })) as BookingLookup;

export interface PublicFeedback { hotel: string; city: string | null; first_name: string; check_in: string; check_out: string; submitted: boolean; expired: boolean; has_restaurant: boolean }
export const usePublicFeedback = (token: string) =>
  useQuery({
    queryKey: ["public", "feedback", token],
    queryFn: async () => unwrap(await supabase.rpc("public_feedback", { _token: token })) as PublicFeedback | null,
  });

export const submitFeedback = async (token: string, f: {
  overall: number; cleanliness?: number; service?: number; comfort?: number; food?: number; value?: number; recommend?: number;
  comment?: string; consent?: boolean;
}) =>
  unwrap(await supabase.rpc("public_feedback_submit", {
    _token: token, _overall: f.overall, _cleanliness: f.cleanliness ?? null, _service: f.service ?? null, _comfort: f.comfort ?? null,
    _food: f.food ?? null, _value: f.value ?? null, _recommend: f.recommend ?? null, _comment: f.comment || null, _consent_publish: !!f.consent,
  }));

/** Kenyan numbers to the international form WhatsApp needs (07… → 2547…). */
export const waNumber = (phone?: string | null) => {
  const d = (phone ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("0") && d.length === 10) return `254${d.slice(1)}`;
  if (d.length === 9 && /^[17]/.test(d)) return `254${d}`;
  return d;
};

export interface OnlineBooking {
  id: string; code: string; status: string; check_in: string; check_out: string; nights: number; adults: number; children: number;
  total_amount: number; special_requests: string | null; created_at: string; room_id: string | null;
  guests: { first_name: string; last_name: string; phone: string | null; email: string | null; nationality: string | null } | null;
  room_types: { name: string } | null;
}
export const useOnlineBookings = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["online", "bookings", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("reservations")
        .select("id, code, status, check_in, check_out, nights, adults, children, total_amount, special_requests, created_at, room_id, guests(first_name, last_name, phone, email, nationality), room_types(name)")
        .eq("hotel_id", hotel.id).eq("source", "website").order("created_at", { ascending: false }).limit(100)) as unknown as OnlineBooking[],
  });
};

// ---------------------------------------------------------------- online check-in
export interface Companion { name: string; id_number?: string | null; child?: boolean }
export interface PrecheckForm {
  first_name: string; last_name: string; email: string | null; phone: string | null; nationality: string | null; residence: string | null;
  id_type: string | null; id_number: string | null; date_of_birth: string | null; address: string | null; arrival_time: string | null;
  purpose: string | null; coming_from: string | null; going_to: string | null; vehicle_reg: string | null; companions: Companion[] | null;
  requests: string | null; signed_name: string | null; marketing_ok: boolean | null;
}
export interface PublicPrecheck {
  state: "open" | "submitted" | "reviewed" | "arrived" | "closed";
  hotel: { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; checkin_time: string; checkout_time: string; house_rules: string | null; policies: string | null };
  code: string; check_in: string; check_out: string; nights: number; room_type: string; adults: number; children: number; submitted_at: string | null;
  form: PrecheckForm;
}
export const usePublicPrecheck = (token: string) =>
  useQuery({
    queryKey: ["public", "precheck", token],
    queryFn: async () => unwrap(await supabase.rpc("public_precheck", { _token: token })) as PublicPrecheck | null,
  });
export const submitPrecheck = async (token: string, d: Record<string, unknown>) =>
  unwrap(await supabase.rpc("public_precheck_submit", { _token: token, _d: d }));
export const findPrecheck = async (slug: string, code: string, key: string) =>
  unwrap(await supabase.rpc("public_precheck_find", { _slug: slug, _code: code, _email_or_last_name: key })) as string;

export interface Precheck extends Omit<PrecheckForm, "first_name" | "last_name"> {
  id: string; hotel_id: string; reservation_id: string; token: string; created_at: string; shared_at: string | null; submitted_at: string | null;
  first_name: string | null; last_name: string | null; signature: string | null; accepted_at: string | null; reviewed_at: string | null;
}
export interface Arrival {
  id: string; code: string; status: string; check_in: string; check_out: string; nights: number; adults: number; children: number;
  special_requests: string | null; room_id: string | null; room_type_id: string; total_amount: number; source: string;
  guests: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; nationality: string | null; id_type: string | null; id_number: string | null; is_vip: boolean } | null;
  rooms: { room_number: string } | null; room_types: { name: string } | null;
  prechecks: Precheck[] | Precheck | null;
}
export const precheckOf = (a: Arrival): Precheck | null => (Array.isArray(a.prechecks) ? a.prechecks[0] ?? null : a.prechecks);

export const useArrivalsPrecheck = (from: string, to: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["precheck", "arrivals", hotel.id, from, to],
    queryFn: async () =>
      unwrap(await supabase.from("reservations")
        .select("id, code, status, check_in, check_out, nights, adults, children, special_requests, room_id, room_type_id, total_amount, source, guests(id, first_name, last_name, phone, email, nationality, id_type, id_number, is_vip), rooms(room_number), room_types(name), prechecks(*)")
        .eq("hotel_id", hotel.id).in("status", ["confirmed", "checked_in"]).gte("check_in", from).lte("check_in", to)
        .order("check_in").limit(500)) as unknown as Arrival[],
  });
};
export const getPrecheckLink = async (reservationId: string) =>
  `${window.location.origin}/checkin/${unwrap(await supabase.rpc("precheck_link", { _reservation_id: reservationId })) as string}`;

export const useMarkPrecheckShared = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reservationId: string) =>
      unwrap(await supabase.from("prechecks").update({ shared_at: new Date().toISOString() }).eq("reservation_id", reservationId).is("shared_at", null)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["precheck"] }),
  });
};
export const useAcceptPrecheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc("precheck_accept", { _id: id })),
    onSuccess: () => {
      ["precheck", "reservations", "guests", "activity"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Details saved to the guest record");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const useSaveHouseRules = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: string) => unwrap(await supabase.from("hotels").update({ house_rules: rules.trim() || null }).eq("id", hotel.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("House rules saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
