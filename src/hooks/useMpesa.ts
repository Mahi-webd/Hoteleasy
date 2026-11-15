import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
};
const fn = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("mpesa", { body });
  if (error) {
    // the function answers JSON errors; show its message when there is one
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === "function" ? await ctx.json().then((b: { error?: string; message?: string }) => b.error ?? b.message).catch(() => null) : null;
    throw new Error(msg || "Could not reach the M-Pesa service. Check your internet and try again.");
  }
  return data as T;
};

export interface MpesaSettings {
  enabled: boolean; environment: "sandbox" | "production"; kind: "paybill" | "till"; shortcode: string | null; till_number: string | null;
  online_deposit: "none" | "first_night" | "full"; has_consumer_key: boolean; has_consumer_secret: boolean; has_passkey: boolean;
  ready: boolean; can_edit: boolean;
}
export interface MpesaSave {
  enabled: boolean; environment: string; kind: string; shortcode: string; till_number: string; online_deposit: string;
  consumer_key?: string; consumer_secret?: string; passkey?: string;
}

export const useMpesaSettings = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["mpesa", "settings", hotel.id],
    staleTime: 60_000,
    queryFn: () => rpc<MpesaSettings | null>("mpesa_settings_get", { _hotel_id: hotel.id }),
  });
};

export const useSaveMpesa = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: MpesaSave) => rpc<MpesaSettings>("mpesa_settings_save", {
      _hotel_id: hotel.id, _enabled: s.enabled, _environment: s.environment, _kind: s.kind, _shortcode: s.shortcode,
      _till_number: s.till_number, _online_deposit: s.online_deposit,
      _consumer_key: s.consumer_key || null, _consumer_secret: s.consumer_secret || null, _passkey: s.passkey || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mpesa"] }); toast.success("M-Pesa settings saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useTestMpesa = () => {
  const { hotel } = useCurrentHotel();
  return useMutation({
    mutationFn: () => fn<{ ok: boolean; message: string }>({ action: "test", hotel_id: hotel.id }),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export type PromptStatus = "new" | "sent" | "confirming" | "paid" | "failed" | "cancelled" | "expired";
export interface PromptState { id: string; token: string; phone: string; amount: number; status: PromptStatus; message?: string; receipt?: string | null; paid_amount?: number | null }

/** Send a pay prompt and follow it until Safaricom answers. */
export const useMpesaPrompt = (opts: { onPaid?: (p: PromptState) => void; invalidate?: string[] } = {}) => {
  const qc = useQueryClient();
  const [p, setP] = useState<PromptState | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(0);
  const lastCheck = useRef(0);
  const onPaid = useRef(opts.onPaid);
  onPaid.current = opts.onPaid;

  const send = async (create: () => Promise<{ id: string; token: string; phone: string; amount: number }>) => {
    setBusy(true);
    try {
      const r = await create();
      setP({ ...r, status: "new" });
      const res = await fn<{ status: PromptStatus; message?: string }>({ action: "push", id: r.id, token: r.token });
      started.current = Date.now(); lastCheck.current = Date.now();
      setP({ ...r, status: res.status, message: res.message });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // follow it: read our own record every 3 s; ask Safaricom after 25 s and then every 15 s
  useEffect(() => {
    if (!p || !["sent", "confirming"].includes(p.status)) return;
    const t = setInterval(async () => {
      const s = await rpc<{ status: PromptStatus; receipt: string | null; paid_amount: number | null; result_desc: string | null } | null>(
        "mpesa_status", { _id: p.id, _token: p.token }).catch(() => null);
      if (s && s.status !== "sent") {
        setP((x) => x && { ...x, status: s.status, receipt: s.receipt, paid_amount: s.paid_amount, message: s.result_desc ?? undefined });
        return;
      }
      const now = Date.now();
      if (now - started.current > 25_000 && now - lastCheck.current > 15_000) {
        lastCheck.current = now;
        const c = await fn<{ status: PromptStatus; message?: string }>({ action: "check", id: p.id, token: p.token }).catch(() => null);
        if (c && c.status !== "sent") setP((x) => x && (x.status === "paid" ? x : { ...x, status: c.status, message: c.message }));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [p]);

  useEffect(() => {
    if (p?.status !== "paid") return;
    (opts.invalidate ?? []).forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    onPaid.current?.(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.status]);

  const stop = async () => {
    if (p && ["new", "sent", "confirming"].includes(p.status)) await rpc("mpesa_cancel", { _id: p.id, _token: p.token }).catch(() => null);
    setP(null);
  };

  return { prompt: p, busy, send, stop, reset: () => setP(null) };
};

export const createFolioPrompt = (reservationId: string, phone: string, amount: number) =>
  rpc<{ id: string; token: string; phone: string; amount: number }>("mpesa_request_folio", { _reservation_id: reservationId, _phone: phone, _amount: amount });
export const createPosPrompt = (orderId: string, phone: string, amount: number) =>
  rpc<{ id: string; token: string; phone: string; amount: number }>("mpesa_request_pos", { _order_id: orderId, _phone: phone, _amount: amount });
export const createOnlinePrompt = (slug: string, code: string, name: string, phone: string) =>
  rpc<{ id: string; token: string; phone: string; amount: number }>("public_mpesa_request", { _slug: slug, _code: code, _email_or_last_name: name, _phone: phone });
