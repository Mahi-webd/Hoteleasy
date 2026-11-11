import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type {
  MenuCategory, MenuItem, ModifierGroup, PosItemStatus, PosOrder, PosOutlet, PosPaymentMethod, PosShift, PosTable, ShiftReport,
} from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export class WrongPinError extends Error {
  constructor() { super("Wrong manager PIN"); }
}

const KEYS = ["pos", "folio", "balances", "activity"];

const usePosAction = <TArgs, TRes = unknown>(fn: (a: TArgs) => Promise<TRes>, success?: string | ((a: TArgs) => string) | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => {
      KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(a) : success);
    },
    onError: (e) => { if (!(e instanceof WrongPinError)) toast.error(friendlyError(e)); },
  });
};

/** RPCs that need manager approval return 'ok' | 'wrong_pin'. */
const approved = async (p: PromiseLike<{ data: unknown; error: unknown }>) => {
  const r = unwrap(await p);
  if (r === "wrong_pin") throw new WrongPinError();
  return r;
};

// ------------------------------------------------------------------ live updates
export const usePosRealtime = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    const filter = `hotel_id=eq.${hotel.id}`;
    const ch = supabase
      .channel(`pos-${hotel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_orders", filter }, () => qc.invalidateQueries({ queryKey: ["pos", "orders"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_order_items", filter }, () => {
        qc.invalidateQueries({ queryKey: ["pos", "orders"] });
        qc.invalidateQueries({ queryKey: ["pos", "kds"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items", filter }, () => qc.invalidateQueries({ queryKey: ["pos", "menu"] }))
      .subscribe();
    // Fallback refresh in case the live connection drops.
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["pos", "kds"] }), 20_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [hotel.id, qc]);
};

// ------------------------------------------------------------------ setup data
export const usePosSetup = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "setup", hotel.id],
    queryFn: async () => {
      const [outlets, tables] = await Promise.all([
        supabase.from("pos_outlets").select("*").eq("hotel_id", hotel.id).order("sort").order("name"),
        supabase.from("pos_tables").select("*").eq("hotel_id", hotel.id).order("sort").order("name"),
      ]);
      return { outlets: unwrap(outlets) as PosOutlet[], tables: unwrap(tables) as PosTable[] };
    },
  });
};

export const useMenu = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "menu", hotel.id],
    queryFn: async () => {
      const [cats, items, groups] = await Promise.all([
        supabase.from("menu_categories").select("*").eq("hotel_id", hotel.id).order("sort").order("name"),
        supabase.from("menu_items").select("*, menu_item_modifier_groups(group_id, sort)").eq("hotel_id", hotel.id).order("sort").order("name"),
        supabase.from("modifier_groups").select("*, modifier_options(*)").eq("hotel_id", hotel.id).order("sort"),
      ]);
      const g = (unwrap(groups) as ModifierGroup[]).map((x) => ({ ...x, modifier_options: [...x.modifier_options].sort((a, b) => a.sort - b.sort) }));
      return { categories: unwrap(cats) as MenuCategory[], items: unwrap(items) as MenuItem[], groups: g };
    },
  });
};

export const useSetupDefaults = () => {
  const { hotel } = useCurrentHotel();
  return usePosAction(
    async (withMenu: boolean) => unwrap(await supabase.rpc("pos_setup_defaults", { _hotel_id: hotel.id, _with_menu: withMenu })),
    "POS set up: outlets, tables and menu are ready",
  );
};

/** Generic upsert/delete for setup tables (managers only, enforced by RLS). */
export const useSaveRow = (table: string, label: string) => {
  const { hotel } = useCurrentHotel();
  return usePosAction(
    async (row: Record<string, unknown>) => {
      const { id, ...rest } = row;
      const needsHotel = !["modifier_options"].includes(table);
      return id
        ? unwrap(await supabase.from(table).update(rest).eq("id", id as string).select().single())
        : unwrap(await supabase.from(table).insert(needsHotel ? { ...rest, hotel_id: hotel.id } : rest).select().single());
    },
    `${label} saved`,
  );
};

export const useDeleteRow = (table: string, label: string) =>
  usePosAction(async (id: string) => unwrap(await supabase.from(table).delete().eq("id", id)), `${label} deleted`);

export const useSetItemGroups = () =>
  usePosAction(async ({ itemId, groupIds }: { itemId: string; groupIds: string[] }) => {
    unwrap(await supabase.from("menu_item_modifier_groups").delete().eq("item_id", itemId));
    if (groupIds.length) {
      unwrap(await supabase.from("menu_item_modifier_groups").insert(groupIds.map((g, i) => ({ item_id: itemId, group_id: g, sort: i }))));
    }
  }, null);

export const useToggleAvailable = () =>
  usePosAction(
    async ({ id, available }: { id: string; available: boolean; name: string }) =>
      unwrap(await supabase.from("menu_items").update({ available }).eq("id", id)),
    (a) => (a.available ? `${a.name} back on` : `${a.name} marked sold out`),
  );

// ------------------------------------------------------------------ PIN
export const useHasPin = () => {
  const { hotel, can } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "pin", hotel.id],
    enabled: can("owner", "manager"),
    queryFn: async () => unwrap(await supabase.rpc("has_my_pin", { _hotel_id: hotel.id })) as boolean,
  });
};

export const useSetPin = () => {
  const { hotel } = useCurrentHotel();
  return usePosAction(async (pin: string) => unwrap(await supabase.rpc("set_my_pin", { _hotel_id: hotel.id, _pin: pin })), "Approval PIN saved");
};

// ------------------------------------------------------------------ orders
const ORDER_SELECT =
  "*, pos_order_items(*), pos_payments(*), pos_tables(name), pos_outlets(name, kind), reservations(id, code, rooms(room_number), guests(first_name, last_name))";

export const useOpenOrders = (outletId?: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "orders", "open", hotel.id, outletId],
    enabled: !!outletId,
    queryFn: async () =>
      unwrap(
        await supabase.from("pos_orders").select(ORDER_SELECT).eq("hotel_id", hotel.id).eq("outlet_id", outletId!).eq("status", "open").order("opened_at"),
      ) as PosOrder[],
  });
};

export const useRecentClosed = (outletId?: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "orders", "closed", hotel.id, outletId],
    enabled: !!outletId,
    queryFn: async () =>
      unwrap(
        await supabase.from("pos_orders").select(ORDER_SELECT).eq("hotel_id", hotel.id).eq("outlet_id", outletId!)
          .neq("status", "open").gte("closed_at", new Date(Date.now() - 24 * 3600_000).toISOString()).order("closed_at", { ascending: false }).limit(50),
      ) as PosOrder[],
  });
};

export const useOrder = (id?: string | null) =>
  useQuery({
    queryKey: ["pos", "orders", "one", id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from("pos_orders").select(ORDER_SELECT).eq("id", id!).single()) as PosOrder,
  });

export const useCreateOrder = () => {
  const { hotel } = useCurrentHotel();
  return usePosAction(
    async (o: { outlet_id: string; table_id?: string | null; order_type: string; guests: number; label?: string | null; reservation_id?: string | null }) =>
      unwrap(await supabase.from("pos_orders").insert({ ...o, hotel_id: hotel.id }).select("id").single()) as { id: string },
    null,
  );
};

export const useUpdateOrder = () =>
  usePosAction(
    async ({ id, patch }: { id: string; patch: Record<string, unknown>; message?: string }) =>
      unwrap(await supabase.from("pos_orders").update(patch).eq("id", id)),
    (a) => a.message ?? "",
  );

export const useAddItem = () =>
  usePosAction(
    async (i: { order_id: string; menu_item_id: string | null; quantity: number; modifierIds: string[]; notes?: string | null; name?: string; unit_price?: number }) =>
      unwrap(
        await supabase.from("pos_order_items").insert({
          order_id: i.order_id,
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          notes: i.notes?.trim() || null,
          modifiers: i.modifierIds.map((id) => ({ id })),
          // server replaces name/price for menu items; used only for managers' open items
          name: i.name ?? "item",
          unit_price: i.unit_price ?? 0,
        }),
      ),
    null,
  );

export const useSetQty = () =>
  usePosAction(async ({ id, quantity }: { id: string; quantity: number }) =>
    unwrap(await supabase.from("pos_order_items").update({ quantity }).eq("id", id)), null);

export const useRemoveNewItem = () =>
  usePosAction(async (id: string) => unwrap(await supabase.from("pos_order_items").delete().eq("id", id)), null);

export const useSendOrder = () =>
  usePosAction(async (orderId: string) => unwrap(await supabase.rpc("pos_send_order", { _order_id: orderId })) as number, "Sent to kitchen / bar");

export const useVoidItem = () =>
  usePosAction(
    async (a: { itemId: string; reason: string; pin?: string; comp?: boolean; quantity?: number }) =>
      approved(supabase.rpc("pos_void_item", { _item_id: a.itemId, _reason: a.reason, _pin: a.pin ?? null, _comp: !!a.comp, _quantity: a.quantity ?? null })),
    (a) => (a.comp ? "Item comped" : "Item voided"),
  );

export const useDiscount = () =>
  usePosAction(
    async (a: { orderId: string; kind: "percent" | "amount" | null; value: number; reason: string; pin?: string }) =>
      approved(supabase.rpc("pos_set_discount", { _order_id: a.orderId, _kind: a.kind, _value: a.value, _reason: a.reason, _pin: a.pin ?? null })),
    (a) => (a.kind ? "Discount applied" : "Discount removed"),
  );

export const useServiceCharge = () =>
  usePosAction(
    async (a: { orderId: string; rate: number; pin?: string }) =>
      approved(supabase.rpc("pos_set_service_charge", { _order_id: a.orderId, _rate: a.rate, _pin: a.pin ?? null })),
    "Service charge updated",
  );

export const useMoveItems = () =>
  usePosAction(
    async (a: { itemIds: string[]; toOrder?: string | null }) =>
      unwrap(await supabase.rpc("pos_move_items", { _item_ids: a.itemIds, _to_order: a.toOrder ?? null })) as string,
    "Items moved to a separate bill",
  );

export const usePay = () =>
  usePosAction(
    async (a: { orderId: string; method: PosPaymentMethod; amount: number; tendered?: number | null; reference?: string | null }) =>
      unwrap(await supabase.rpc("pos_pay", { _order_id: a.orderId, _method: a.method, _amount: a.amount, _tendered: a.tendered ?? null, _reference: a.reference ?? null })) as PosOrder,
    null,
  );

export const useChargeToRoom = () =>
  usePosAction(
    async (a: { orderId: string; reservationId: string; room: string }) =>
      unwrap(await supabase.rpc("pos_charge_to_room", { _order_id: a.orderId, _reservation_id: a.reservationId })) as PosOrder,
    (a) => `Charged to room ${a.room}`,
  );

export const useVoidOrder = () =>
  usePosAction(
    async (a: { orderId: string; reason: string; pin?: string }) =>
      approved(supabase.rpc("pos_void_order", { _order_id: a.orderId, _reason: a.reason, _pin: a.pin ?? null })),
    "Bill voided",
  );

export const useReopenOrder = () =>
  usePosAction(
    async (a: { orderId: string; reason: string; pin?: string }) =>
      approved(supabase.rpc("pos_reopen_order", { _order_id: a.orderId, _reason: a.reason, _pin: a.pin ?? null })),
    "Bill reopened",
  );

/** Checked-in guests, for charge to room / room service. */
export const useInHouseGuests = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "inhouse", hotel.id],
    queryFn: async () =>
      unwrap(
        await supabase.from("reservations").select("id, code, check_out, rooms(room_number), guests(first_name, last_name, is_vip)")
          .eq("hotel_id", hotel.id).eq("status", "checked_in"),
      ) as unknown as { id: string; code: string; check_out: string; rooms: { room_number: string } | null; guests: { first_name: string; last_name: string; is_vip: boolean } | null }[],
  });
};

// ------------------------------------------------------------------ kitchen display
export const useKds = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "kds", hotel.id],
    refetchInterval: 30_000,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("pos_orders")
          .select("id, number, outlet_id, order_type, label, guests, opened_at, pos_tables(name), pos_outlets(name, kind), reservations(rooms(room_number)), pos_order_items(*)")
          .eq("hotel_id", hotel.id)
          .in("status", ["open", "paid"])
          .gte("opened_at", new Date(Date.now() - 18 * 3600_000).toISOString()),
      ) as unknown as PosOrder[],
  });
};

export const useSetItemStatus = () =>
  usePosAction(
    async ({ ids, status }: { ids: string[]; status: PosItemStatus }) =>
      unwrap(await supabase.rpc("pos_set_item_status", { _item_ids: ids, _status: status })),
    null,
  );

// ------------------------------------------------------------------ shifts
export const useMyShift = () => {
  const { hotel } = useCurrentHotel();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pos", "shift", hotel.id, user?.id],
    queryFn: async () =>
      unwrap(await supabase.from("pos_shifts").select("*").eq("hotel_id", hotel.id).eq("user_id", user!.id).is("closed_at", null).maybeSingle()) as PosShift | null,
  });
};

export const useShiftReport = (shiftId?: string) =>
  useQuery({
    queryKey: ["pos", "shift-report", shiftId],
    enabled: !!shiftId,
    queryFn: async () => unwrap(await supabase.rpc("pos_shift_report", { _shift_id: shiftId })) as ShiftReport,
  });

export const useShifts = (sinceIso: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "shifts", hotel.id, sinceIso],
    queryFn: async () =>
      unwrap(await supabase.from("pos_shifts").select("*").eq("hotel_id", hotel.id).gte("opened_at", sinceIso).order("opened_at", { ascending: false })) as PosShift[],
  });
};

export const useOpenShift = () => {
  const { hotel } = useCurrentHotel();
  return usePosAction(async (float: number) => unwrap(await supabase.rpc("pos_open_shift", { _hotel_id: hotel.id, _float: float })), "Shift opened");
};

export const useCloseShift = () =>
  usePosAction(
    async (a: { shiftId: string; counted: number; notes?: string }) =>
      unwrap(await supabase.rpc("pos_close_shift", { _shift_id: a.shiftId, _counted: a.counted, _notes: a.notes ?? null })) as PosShift,
    "Shift closed",
  );

// ------------------------------------------------------------------ reports
export const useSales = (fromIso: string, toIso: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["pos", "sales", hotel.id, fromIso, toIso],
    queryFn: async () =>
      unwrap(
        await supabase.from("pos_orders").select("*, pos_order_items(*), pos_payments(*), pos_outlets(name, kind)")
          .eq("hotel_id", hotel.id).gte("opened_at", fromIso).lt("opened_at", toIso).order("opened_at"),
      ) as PosOrder[],
  });
};
