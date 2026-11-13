import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { CalendarRow, EmailSettings, OutboxEmail, RateSeason, StayQuote } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};
const useAct = <A,>(fn: (a: A) => Promise<unknown>, keys: string[], success?: string | ((a: A) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => { keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); if (success) toast.success(typeof success === "function" ? success(a) : success); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

// ---------------------------------------------------------------- rates
export const useSeasons = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["rates", "seasons", hotel.id],
    queryFn: async () => unwrap(await supabase.from("rate_seasons").select("*, rate_season_prices(room_type_id, rate)")
      .eq("hotel_id", hotel.id).order("starts_on")) as RateSeason[],
  });
};
export const useRateCalendar = (from: string, days: number) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["rates", "calendar", hotel.id, from, days],
    queryFn: async () => unwrap(await supabase.rpc("rate_calendar", { _hotel_id: hotel.id, _from: from, _days: days })) as CalendarRow[],
  });
};
export const useStayQuote = (roomTypeId: string, checkIn: string, checkOut: string, enabled = true, companyId: string | null = null) =>
  useQuery({
    queryKey: ["rates", "quote", roomTypeId, checkIn, checkOut, companyId],
    enabled: enabled && !!roomTypeId && checkOut > checkIn,
    queryFn: async () => unwrap(await supabase.rpc("stay_quote", { _room_type_id: roomTypeId, _check_in: checkIn, _check_out: checkOut, _online: false, _company_id: companyId })) as StayQuote,
    staleTime: 30_000,
  });

export const useSaveSeason = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async ({ season, prices }: { season: Partial<RateSeason>; prices: { room_type_id: string; rate: number }[] }) => {
    const { id, rate_season_prices: _p, created_at: _c, hotel_id: _h, ...rest } = season;
    void _p; void _c; void _h;
    const row = (id
      ? unwrap(await supabase.from("rate_seasons").update(rest).eq("id", id).select().single())
      : unwrap(await supabase.from("rate_seasons").insert({ ...rest, hotel_id: hotel.id }).select().single())) as RateSeason;
    unwrap(await supabase.from("rate_season_prices").delete().eq("season_id", row.id));
    if (prices.length) unwrap(await supabase.from("rate_season_prices").insert(prices.map((p) => ({ ...p, season_id: row.id, hotel_id: hotel.id }))));
    return row;
  }, ["rates"], "Season saved");
};
export const useDeleteSeason = () =>
  useAct(async (id: string) => unwrap(await supabase.from("rate_seasons").delete().eq("id", id)), ["rates"], "Season deleted");
export const useToggleSeason = () =>
  useAct(async ({ id, active }: { id: string; active: boolean }) => unwrap(await supabase.from("rate_seasons").update({ active }).eq("id", id)), ["rates"],
    (a) => (a.active ? "Season switched on" : "Season switched off"));

// ---------------------------------------------------------------- emails
export const useEmailSettings = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["emails", "settings", hotel.id],
    queryFn: async () => unwrap(await supabase.from("email_settings").select("*").eq("hotel_id", hotel.id).maybeSingle()) as EmailSettings | null,
  });
};
export const useSaveEmailSettings = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async (s: Partial<EmailSettings>) => {
    const { hotel_id: _h, updated_at: _u, ...rest } = s; void _h; void _u;
    return unwrap(await supabase.from("email_settings").update(rest).eq("hotel_id", hotel.id));
  }, ["emails"], "Email settings saved");
};
export const useOutbox = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["emails", "outbox", hotel.id],
    queryFn: async () => unwrap(await supabase.from("email_outbox")
      .select("*, reservations(code, check_in, guests(first_name, last_name, email))")
      .eq("hotel_id", hotel.id).order("send_after", { ascending: false }).limit(200)) as OutboxEmail[],
    refetchInterval: 30_000,
  });
};
export const useSendTestEmail = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async (to: string) => unwrap(await supabase.rpc("email_send_test", { _hotel_id: hotel.id, _to: to })), ["emails"],
    "Test email queued; it should arrive within a few minutes");
};
export const useRetryEmail = () =>
  useAct(async (id: string) => unwrap(await supabase.rpc("email_retry", { _id: id })), ["emails"], "Email queued to send now");
export const fetchEmailPreview = async (reservationId: string, kind: string) =>
  unwrap(await supabase.rpc("email_preview", { _reservation_id: reservationId, _kind: kind })) as { subject?: string; html?: string; to?: string; skip?: string };
