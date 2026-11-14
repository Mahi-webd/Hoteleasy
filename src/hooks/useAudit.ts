import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { BusinessDay, DayChecks, DayReport } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};
const KEYS = ["audit", "alerts", "reservations", "folio", "balances", "activity"];

export const useDayChecks = (day: string | null) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["audit", "checks", hotel.id, day],
    enabled: !!day,
    queryFn: async () => unwrap(await supabase.rpc("day_checks", { _hotel_id: hotel.id, _day: day! })) as DayChecks,
  });
};
export const useDayReport = (day: string | null) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["audit", "report", hotel.id, day],
    enabled: !!day,
    queryFn: async () => unwrap(await supabase.rpc("day_report", { _hotel_id: hotel.id, _day: day! })) as DayReport,
  });
};
export const useClosedDays = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["audit", "days", hotel.id],
    queryFn: async () => unwrap(await supabase.from("business_days").select("*").eq("hotel_id", hotel.id).order("day", { ascending: false }).limit(60)) as BusinessDay[],
  });
};
const useAct = <A,>(fn: (a: A) => Promise<unknown>, success: string | ((a: A) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success(typeof success === "function" ? success(a) : success); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const useCloseDay = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async ({ day, notes }: { day: string; notes?: string }) =>
    unwrap(await supabase.rpc("day_close", { _hotel_id: hotel.id, _day: day, _notes: notes || null })), "Day closed and locked");
};
export const useReopenDay = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async ({ day, reason }: { day: string; reason: string }) =>
    unwrap(await supabase.rpc("day_reopen", { _hotel_id: hotel.id, _day: day, _reason: reason })), "Day reopened");
};
