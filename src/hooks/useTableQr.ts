// Table QR: diners call the waiter from the QR code on their table; staff answer on a live table map.
// Everything goes through database functions that check the hotel, the licence and the plan.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { liveChannel } from "@/lib/realtime";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";

export type TableCallKind = "waiter" | "bill" | "other";
export type TableCallStatus = "open" | "on_way" | "done" | "cancelled";
export type PayMethod = "cash" | "card" | "mpesa";
export interface TableCall {
  id: string; kind: TableCallKind; pay_method: PayMethod | null; note: string | null; status: TableCallStatus;
  created_at: string; acknowledged_at: string | null; done_at: string | null;
  /** staff board only: who tapped "On my way" */
  by_id?: string | null; by_name?: string | null;
}
export interface OrderLine { menu_item_id: string; name: string; price: number; qty: number; notes: string | null }
export type TableOrderStatus = "pending" | "confirmed" | "rejected" | "cancelled";
export interface TableOrder {
  id: string; lines: OrderLine[]; note: string | null; total: number; status: TableOrderStatus; reason: string | null;
  created_at: string; decided_at: string | null;
}
export interface TableBill {
  number: number; items_gross: number; discount: number; service_charge: number; total: number; paid: number; due: number; unsent: boolean;
  lines: BillLine[];
}
export type ItemStatus = "new" | "sent" | "preparing" | "ready" | "served";
export interface BillLine {
  id?: string; name: string; qty: number; amount: number; comped: boolean;
  /** progress, from the kitchen/bar screen and the waiter (missing before the kitchen-status update) */
  status?: ItemStatus; station?: "kitchen" | "bar" | "none"; sent_at?: string | null; ready_at?: string | null; served_at?: string | null;
}
export interface BoardBill { id?: string; number: number; total: number; paid: number }
/** The food side of a table: its open bill and bills already paid that still have dishes coming. */
export interface BoardKitchen {
  order_ids: string[]; waiting: number; preparing: number; ready_since: string | null;
  ready: { id: string; name: string; qty: number; station: string }[];
}
export interface BoardTable {
  id: string; name: string; seats: number; enabled: boolean; token: string | null; call: TableCall | null;
  order?: TableOrder | null; bill?: BoardBill | null; kitchen?: BoardKitchen | null;
}
export interface BoardOutlet { id: string; name: string; enabled: boolean; order_enabled?: boolean; pay_enabled?: boolean; tables: BoardTable[] }
export interface PublicMenuItem { id: string; name: string; description: string | null; price: number; available: boolean; self_order?: boolean }
export interface PublicTable {
  off?: boolean; hotel: string; currency: string; outlet: string; table: string;
  menu: { category: string; items: PublicMenuItem[] }[];
  call: TableCall | null;
  can_order?: boolean; can_pay?: boolean; order?: TableOrder | null; bill?: TableBill | null;
  /** every dish and drink still coming (also after the bill is paid) */
  food?: BillLine[];
}
export interface TableQrReport {
  calls: number; answered: number; avg_response_s: number | null; avg_done_s: number | null; slow: number;
  by_kind: { kind: TableCallKind; calls: number; avg_response_s: number | null }[];
  by_outlet: { outlet: string; calls: number; avg_response_s: number | null }[];
  by_staff: { name: string; calls: number; avg_response_s: number | null }[];
}

export const CALL_LABEL: Record<TableCallKind, string> = { waiter: "Waiter", bill: "Bill", other: "Request" };
export const PAY_LABEL: Record<PayMethod, string> = { cash: "Cash", card: "Card", mpesa: "M-Pesa" };

// rpc names aren't in the generated types until they're regenerated
const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
};

/** The live table map for this hotel. */
export const useTableBoard = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["tableqr", "board", hotel.id],
    queryFn: () => rpc<BoardOutlet[]>("table_qr_board", { _hotel_id: hotel.id }),
    refetchInterval: 15_000, // safety net if the live connection drops
  });
};

/** Live updates; onNew runs (with the outlet) when a table calls, changes what it wants, or sends an order. */
export interface TableAlert { outletId: string | null; tableId: string | null; orderId?: string | null; what: "call" | "order" | "ready" }
export const useTableCallsRealtime = (onNew?: (a: TableAlert) => void) => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => liveChannel(`tableqr-${hotel.id}`, (c) => c
    .on("postgres_changes", { event: "*", schema: "public", table: "table_calls", filter: `hotel_id=eq.${hotel.id}` }, (p) => {
      qc.invalidateQueries({ queryKey: ["tableqr"] });
      const n = p.new as Partial<TableCall> | undefined;
      if (n?.status === "open" && (p.eventType === "INSERT" || (p.old as Partial<TableCall>)?.kind !== n.kind || (p.old as Partial<TableCall>)?.status !== "open"))
        onNew?.({ outletId: (p.new as { outlet_id?: string }).outlet_id ?? null, tableId: (p.new as { table_id?: string }).table_id ?? null, what: "call" });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "table_orders", filter: `hotel_id=eq.${hotel.id}` }, (p) => {
      qc.invalidateQueries({ queryKey: ["tableqr"] });
      if (p.eventType === "INSERT")
        onNew?.({ outletId: (p.new as { outlet_id?: string }).outlet_id ?? null, tableId: (p.new as { table_id?: string }).table_id ?? null, what: "order" });
    })
    // the kitchen / bar moves food along; "ready" means it is waiting at the pass for a waiter
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pos_order_items", filter: `hotel_id=eq.${hotel.id}` }, (p) => {
      qc.invalidateQueries({ queryKey: ["tableqr"] });
      const n = p.new as { status?: string; order_id?: string };
      if (n.status === "ready") onNew?.({ outletId: null, tableId: null, orderId: n.order_id ?? null, what: "ready" });
    })), [hotel.id, qc, onNew]);
};

const useAct = <A,>(fn: (a: A) => Promise<unknown>, success?: (a: A) => string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => { qc.invalidateQueries({ queryKey: ["tableqr"] }); const m = success?.(a); if (m) toast.success(m); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useUpdateTableCall = () =>
  useAct(({ id, status }: { id: string; status: "on_way" | "done" | "cancelled" }) => rpc("table_call_update", { _id: id, _status: status }),
    (a) => (a.status === "done" ? null : a.status === "on_way" ? "Table told you're on the way" : "Call dismissed"));
export const useSetOutletQr = () =>
  useAct(({ id, enabled }: { id: string; enabled: boolean }) => rpc("table_qr_set_outlet", { _outlet_id: id, _enabled: enabled }),
    (a) => (a.enabled ? "Table QR switched on" : "Table QR switched off"));
export const useSetTableQr = () =>
  useAct(({ id, enabled }: { id: string; enabled: boolean }) => rpc("table_qr_set_table", { _table_id: id, _enabled: enabled }), () => null);
export const useDecideTableOrder = () =>
  useAct(({ id, accept, reason }: { id: string; accept: boolean; reason?: string }) =>
    rpc<{ pos_order_number?: number }>("table_order_decide", { _id: id, _accept: accept, _reason: reason ?? null }),
    (a) => (a.accept ? "Order confirmed and sent to the kitchen" : "Order refused; the table sees your reason"));
export const useSetOutletOptions = () =>
  useAct(({ id, order, pay }: { id: string; order: boolean; pay: boolean }) => rpc("table_qr_set_outlet_options", { _outlet_id: id, _order: order, _pay: pay }),
    () => "Saved");
export const useServeItems = () =>
  useAct(({ ids }: { ids: string[]; table: string }) => rpc("pos_set_item_status", { _item_ids: ids, _status: "served" }),
    (a) => `Served at table ${a.table}`);
export const useResetTableLink = () =>
  useAct((id: string) => rpc("table_link_reset", { _table_id: id }), () => "New QR code made. Print it and replace the old sticker.");

export const useTableQrReport = (from: string, to: string, enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["tableqr", "report", hotel.id, from, to],
    enabled,
    queryFn: () => rpc<TableQrReport>("table_qr_report", { _hotel_id: hotel.id, _from: from, _to: to }),
  });
};

/** The diner's page (no sign-in). */
export const usePublicTable = (token: string) =>
  useQuery({
    queryKey: ["public", "table", token],
    queryFn: () => rpc<PublicTable | null>("public_table", { _token: token }),
    // quicker while food is on its way or an order waits for a waiter
    refetchInterval: (q) => {
      const d = q.state.data as PublicTable | null | undefined;
      const busy = d?.order?.status === "pending" || (d?.food ?? d?.bill?.lines ?? []).some((l) => l.status && l.status !== "served");
      return busy ? 5_000 : 8_000;
    },
    retry: 1,
  });
export const publicTableCall = (token: string, kind: TableCallKind, note?: string, pay?: PayMethod | null) =>
  rpc<TableCall>("public_table_call", { _token: token, _kind: kind, _note: note || null, _pay_method: pay ?? null });
export const publicTableCancel = (token: string) => rpc<TableCall | null>("public_table_cancel", { _token: token });
export const publicTableOrder = (token: string, items: { menu_item_id: string; qty: number; notes?: string }[], note?: string) =>
  rpc<TableOrder>("public_table_order", { _token: token, _items: items, _note: note || null });
export const publicTableOrderCancel = (token: string) => rpc<TableOrder | null>("public_table_order_cancel", { _token: token });
export const createTablePrompt = (token: string, phone: string) =>
  rpc<{ id: string; token: string; phone: string; amount: number }>("public_table_mpesa", { _token: token, _phone: phone });

export const fmtWait = (s: number | null | undefined) => {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${Math.round(s % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
