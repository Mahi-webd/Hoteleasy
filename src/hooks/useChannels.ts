import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { ChannelEvent, ChannelKind, ChannelLink } from "@/lib/db-types";

export const CHANNELS: Record<ChannelKind, string> = { booking_com: "Booking.com", airbnb: "Airbnb", expedia: "Expedia", vrbo: "Vrbo", other: "Other site" };
export const feedUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical/${token}.ics`;

const from = (t: string) => supabase.from(t as never) as unknown as ReturnType<typeof supabase.from>;
const invoke = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("ical", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((b: { error?: string; message?: string }) => b.message ?? b.error).catch(() => null) : null;
    throw new Error(msg || "Could not reach the calendar service");
  }
  return data as T;
};

export const useChannelLinks = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["channels", hotel.id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await from("channel_links").select("*, rooms(room_number, room_types(name))").eq("hotel_id", hotel.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as ChannelLink[];
    },
  });
};

export const useChannelEvents = (linkId: string | null) =>
  useQuery({
    queryKey: ["channels", "events", linkId],
    enabled: !!linkId,
    queryFn: async () => {
      const { data, error } = await from("channel_events").select("*, reservations(code, status, room_id)")
        .eq("link_id", linkId!).neq("status", "past").order("check_in");
      if (error) throw error;
      return (data ?? []) as unknown as ChannelEvent[];
    },
  });

export interface LinkDraft { id?: string; channel: ChannelKind; name: string; room_id: string; import_url: string; import_blocks: boolean; enabled: boolean }

export const useSaveLink = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: LinkDraft) => {
      const { data, error } = await supabase.rpc("channel_link_save" as never, {
        _hotel_id: hotel.id, _id: d.id ?? null, _channel: d.channel, _name: d.name, _room_id: d.room_id,
        _import_url: d.import_url, _import_blocks: d.import_blocks, _enabled: d.enabled,
      } as never);
      if (error) throw error;
      return data as unknown as ChannelLink;
    },
    onSuccess: (l, d) => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success(d.id ? "Calendar link saved" : "Calendar link added");
      // read the site's calendar straight away
      if (l?.import_url && l.enabled) invoke({ action: "sync", link_id: l.id }).then(() => qc.invalidateQueries({ queryKey: ["channels"] })).catch(() => null);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useDeleteLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("channel_link_delete" as never, { _id: id } as never);
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: (n) => {
      ["channels", "reservations", "calendar"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(n ? `Link removed. ${n} upcoming imported booking${n === 1 ? "" : "s"} cancelled.` : "Link removed");
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

interface SyncResult { ok: boolean; message: string; added?: number; conflicts?: number }
export const useSyncLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoke<SyncResult>({ action: "sync", link_id: id }),
    onSuccess: (r) => {
      ["channels", "reservations", "calendar", "activity", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (!r.ok) toast.error(r.message);
      else if (r.conflicts) toast.error(`Synced: ${r.message}`);
      else toast.success(`Synced: ${r.message}`);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

/** While anyone has HotelEasy open, read this hotel's calendars that weren't read for 10 minutes. */
export const useBackgroundCalendarSync = (enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const run = () => invoke<{ synced: number }>({ action: "sync_due", hotel_id: hotel.id })
      .then((r) => { if (!stop && r?.synced) ["channels", "reservations", "calendar"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); })
      .catch(() => null);
    const first = setTimeout(run, 15_000);
    const t = setInterval(run, 10 * 60_000);
    return () => { stop = true; clearTimeout(first); clearInterval(t); };
  }, [enabled, hotel.id, qc]);
};
