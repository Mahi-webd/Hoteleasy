import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { liveChannel } from "@/lib/realtime";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { GuestRequest, RequestStatus, RequestType } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};
const useAct = <A,>(fn: (a: A) => Promise<unknown>, success?: string | ((a: A) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => { qc.invalidateQueries({ queryKey: ["requests"] }); if (success) toast.success(typeof success === "function" ? success(a) : success); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useRequests = (sinceIso: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["requests", "list", hotel.id, sinceIso],
    queryFn: async () => unwrap(await supabase.from("guest_requests")
      .select("*, rooms(room_number), reservations(code, check_out, guests(first_name, last_name, phone))")
      .eq("hotel_id", hotel.id).or(`status.in.(new,acknowledged),created_at.gte.${sinceIso}`)
      .order("created_at", { ascending: false }).limit(300)) as GuestRequest[],
    refetchInterval: 15_000,
  });
};
/** Live updates; calls onNew for requests guests make while the page is open. */
export const useRequestsRealtime = (onNew?: (r: GuestRequest) => void) => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    const stop = liveChannel(`requests-${hotel.id}`, (c) => c
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_requests", filter: `hotel_id=eq.${hotel.id}` }, (p) => {
        qc.invalidateQueries({ queryKey: ["requests"] });
        if (p.eventType === "INSERT" && (p.new as GuestRequest).from_guest) onNew?.(p.new as GuestRequest);
      }));
    return () => { stop(); };
  }, [hotel.id, qc, onNew]);
};
export const useRequestTypes = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["requests", "types", hotel.id],
    queryFn: async () => unwrap(await supabase.from("request_types").select("*").eq("hotel_id", hotel.id).order("sort").order("label")) as RequestType[],
  });
};
export const useUpdateRequest = () =>
  useAct(async ({ id, status, reply }: { id: string; status: RequestStatus; reply?: string }) =>
    unwrap(await supabase.rpc("request_update", { _id: id, _status: status, _reply: reply ?? null })),
    (a) => ({ acknowledged: "Guest told it's on the way", done: "Marked done", cancelled: "Request cancelled", new: "Request reopened" })[a.status]);
export const useCreateRequest = () =>
  useAct(async (a: { reservationId: string; typeId: string; details?: string; wantedAt?: string | null }) =>
    unwrap(await supabase.rpc("request_create_staff", { _reservation_id: a.reservationId, _type_id: a.typeId, _details: a.details || null, _wanted_at: a.wantedAt || null })),
    "Request added");
export const useSaveRequestType = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async (t: Partial<RequestType>) => {
    const { id, hotel_id: _h, ...rest } = t; void _h;
    return id ? unwrap(await supabase.from("request_types").update(rest).eq("id", id)) : unwrap(await supabase.from("request_types").insert({ ...rest, hotel_id: hotel.id }));
  }, "Saved");
};
export const useDeleteRequestType = () =>
  useAct(async (id: string) => unwrap(await supabase.from("request_types").delete().eq("id", id)), "Removed");
export const useRoomLinks = (enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["requests", "links", hotel.id],
    enabled,
    queryFn: async () => unwrap(await supabase.from("room_links").select("room_id, token, rooms(room_number, room_types(name))").eq("hotel_id", hotel.id)) as unknown as
      { room_id: string; token: string; rooms: { room_number: string; room_types: { name: string } | null } | null }[],
  });
};
export const useResetRoomLink = () =>
  useAct(async (roomId: string) => unwrap(await supabase.rpc("room_link_reset", { _room_id: roomId })), "New QR code made; print and replace the old sticker");
export const useSaveGuestInfo = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => unwrap(await supabase.from("hotels").update({ guest_info: v.trim() || null }).eq("id", hotel.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast.success("Guest information saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const stayLink = async (reservationId: string) =>
  `${window.location.origin}/stay/${unwrap(await supabase.rpc("stay_link_key", { _reservation_id: reservationId })) as string}`;

// ---------------------------------------------------------------- public (guest) side
export interface PublicStay {
  hotel: { name: string; phone: string | null; timezone: string; checkout_time: string; guest_info: string | null };
  first_name: string; room: string | null; check_out: string; plan: string | null;
  types: { id: string; label: string; icon: string; ask_time: boolean; ask_details: boolean; department: string }[];
  requests: { id: string; label: string; details: string | null; wanted_at: string | null; status: RequestStatus; reply: string | null; created_at: string; done_at: string | null }[];
}
export const fetchPublicRoom = async (token: string) =>
  unwrap(await supabase.rpc("public_room", { _token: token })) as { hotel: string; phone: string | null; room: string; occupied: boolean } | null;
export const unlockRoom = async (token: string, lastName: string) =>
  unwrap(await supabase.rpc("public_room_unlock", { _token: token, _last_name: lastName })) as { key?: string; error?: string };
export const usePublicStay = (key: string) =>
  useQuery({
    queryKey: ["public", "stay", key],
    queryFn: async () => unwrap(await supabase.rpc("public_stay", { _key: key })) as PublicStay | null,
    refetchInterval: 15_000,
  });
export const sendGuestRequest = async (key: string, typeId: string, details: string | null, wantedAt: string | null) =>
  unwrap(await supabase.rpc("public_request", { _key: key, _type_id: typeId, _details: details, _wanted_at: wantedAt }));
export const cancelGuestRequest = async (key: string, id: string) =>
  unwrap(await supabase.rpc("public_request_cancel", { _key: key, _id: id }));
