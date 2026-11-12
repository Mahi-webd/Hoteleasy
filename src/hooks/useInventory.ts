import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import { WrongPinError } from "@/hooks/usePos";
import type {
  CostReport, PurchaseOrder, Recipe, StockCount, StockItem, StockLevel, StockLocation, StockMovement, Supplier,
} from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

const KEYS = ["inv", "activity", "pos"];

const useInvAction = <TArgs, TRes = unknown>(fn: (a: TArgs) => Promise<TRes>, success?: string | ((a: TArgs) => string) | null) => {
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

export type MoveLine = { item_id: string; qty: number; unit_cost?: number };

// ---------------------------------------------------------------- reads
export const useInventory = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "base", hotel.id],
    queryFn: async () => {
      const [locs, items, levels, sups] = await Promise.all([
        supabase.from("stock_locations").select("*").eq("hotel_id", hotel.id).order("sort").order("name"),
        supabase.from("stock_items").select("*").eq("hotel_id", hotel.id).order("category").order("name"),
        supabase.from("stock_levels").select("item_id, location_id, hotel_id, qty").eq("hotel_id", hotel.id),
        supabase.from("suppliers").select("*").eq("hotel_id", hotel.id).order("name"),
      ]);
      return {
        locations: unwrap(locs) as StockLocation[],
        items: unwrap(items) as StockItem[],
        levels: unwrap(levels) as StockLevel[],
        suppliers: unwrap(sups) as Supplier[],
      };
    },
  });
};

export const usePurchaseOrders = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "po", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("purchase_orders").select("*, purchase_order_lines(*)").eq("hotel_id", hotel.id)
        .order("number", { ascending: false }).limit(200)) as PurchaseOrder[],
  });
};

export const useMovements = (opts: { from: string; to: string; itemId?: string; locationId?: string; kind?: string }) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "moves", hotel.id, opts],
    queryFn: async () => {
      let q = supabase.from("stock_movements").select("*").eq("hotel_id", hotel.id)
        .gte("created_at", `${opts.from}T00:00:00+03:00`).lt("created_at", `${opts.to}T23:59:59.999+03:00`)
        .order("created_at", { ascending: false }).limit(1000);
      if (opts.itemId) q = q.eq("item_id", opts.itemId);
      if (opts.locationId) q = q.eq("location_id", opts.locationId);
      if (opts.kind) q = q.eq("kind", opts.kind);
      return unwrap(await q) as StockMovement[];
    },
  });
};

export const useCounts = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "counts", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("stock_counts").select("*, stock_count_lines(*)").eq("hotel_id", hotel.id)
        .order("number", { ascending: false }).limit(50)) as StockCount[],
  });
};

export const useRecipes = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "recipes", hotel.id],
    queryFn: async () => unwrap(await supabase.from("menu_item_recipes").select("*").eq("hotel_id", hotel.id)) as Recipe[],
  });
};

export const useCostReport = (from: string, to: string, enabled = true) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["inv", "cost", hotel.id, from, to],
    enabled: enabled && !!from && !!to && from <= to,
    queryFn: async () => unwrap(await supabase.rpc("inv_cost_report", { _hotel_id: hotel.id, _from: from, _to: to })) as CostReport,
  });
};

// ---------------------------------------------------------------- writes
export const useInvSave = (table: "stock_items" | "suppliers" | "stock_locations", label: string) => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async (row: Record<string, unknown>) => {
    const { id, ...rest } = row;
    return id
      ? unwrap(await supabase.from(table).update(rest).eq("id", id as string).select().single())
      : unwrap(await supabase.from(table).insert({ ...rest, hotel_id: hotel.id }).select().single());
  }, `${label} saved`);
};

export const useInvSetup = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async (withItems: boolean) =>
    unwrap(await supabase.rpc("inv_setup_defaults", { _hotel_id: hotel.id, _with_items: withItems })), "Stores are ready");
};

export const useSetOutletStore = () =>
  useInvAction(async ({ outletId, locationId }: { outletId: string; locationId: string | null }) =>
    unwrap(await supabase.from("pos_outlets").update({ stock_location_id: locationId }).eq("id", outletId)), "Outlet linked");

export const useReceive = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async (a: { locationId: string; lines: MoveLine[]; supplierId?: string | null; poId?: string | null;
                                   reference?: string; note?: string; opening?: boolean }) =>
    unwrap(await supabase.rpc("inv_receive", {
      _hotel_id: hotel.id, _location_id: a.locationId, _lines: a.lines, _supplier_id: a.supplierId || null, _po_id: a.poId || null,
      _reference: a.reference || null, _note: a.note || null, _opening: !!a.opening,
    })), (a) => (a.opening ? "Opening stock recorded" : "Goods received"));
};

export const useMove = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async (a: { kind: "transfer" | "issue" | "waste" | "return"; locationId: string; lines: MoveLine[];
                                   toLocationId?: string | null; department?: string; note?: string; supplierId?: string | null }) =>
    unwrap(await supabase.rpc("inv_move", {
      _hotel_id: hotel.id, _kind: a.kind, _location_id: a.locationId, _lines: a.lines.map(({ item_id, qty }) => ({ item_id, qty })),
      _to_location_id: a.toLocationId || null, _department: a.department || null, _note: a.note || null, _supplier_id: a.supplierId || null,
    })), (a) => ({ transfer: "Stock moved", issue: "Stock issued", waste: "Waste recorded", return: "Return recorded" })[a.kind]);
};

export const useSavePo = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async (a: { id?: string; supplierId: string; locationId: string; expectedOn?: string | null; notes?: string;
                                   lines: { item_id: string; qty: number; unit_cost: number }[] }) => {
    const head = { supplier_id: a.supplierId, location_id: a.locationId, expected_on: a.expectedOn || null, notes: a.notes || null };
    const po = a.id
      ? unwrap(await supabase.from("purchase_orders").update(head).eq("id", a.id).select().single()) as PurchaseOrder
      : unwrap(await supabase.from("purchase_orders").insert({ ...head, hotel_id: hotel.id }).select().single()) as PurchaseOrder;
    unwrap(await supabase.from("purchase_order_lines").delete().eq("po_id", po.id));
    const lines = a.lines.filter((l) => l.qty > 0);
    if (lines.length) {
      unwrap(await supabase.from("purchase_order_lines").insert(lines.map((l) => ({ ...l, po_id: po.id, hotel_id: hotel.id }))));
    }
    return po;
  }, "Purchase order saved");
};

export const useDeletePo = () =>
  useInvAction(async (id: string) => unwrap(await supabase.from("purchase_orders").delete().eq("id", id)), "Draft deleted");

export const usePoAction = () =>
  useInvAction(async ({ id, action }: { id: string; action: "approve" | "cancel" | "close" }) =>
    unwrap(await supabase.rpc("inv_po_set_status", { _po_id: id, _action: action })),
    ({ action }) => ({ approve: "Order approved", cancel: "Order cancelled", close: "Order closed" })[action]);

export const useStartCount = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async ({ locationId, note }: { locationId: string; note?: string }) =>
    unwrap(await supabase.rpc("inv_count_start", { _hotel_id: hotel.id, _location_id: locationId, _note: note || null })), "Count started");
};

export const useSaveCountLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ countId, itemId, counted }: { countId: string; itemId: string; counted: number | null }) =>
      unwrap(await supabase.from("stock_count_lines").update({ counted }).eq("count_id", countId).eq("item_id", itemId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inv", "counts"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const usePostCount = () =>
  useInvAction(async ({ countId, pin }: { countId: string; pin?: string }) => {
    const r = unwrap(await supabase.rpc("inv_count_post", { _count_id: countId, _pin: pin || null }));
    if (r === "wrong_pin") throw new WrongPinError();
    return Number(r);
  }, "Count posted; stock adjusted");

export const useCancelCount = () =>
  useInvAction(async (countId: string) => unwrap(await supabase.rpc("inv_count_cancel", { _count_id: countId })), "Count cancelled");

export const useSaveRecipe = () => {
  const { hotel } = useCurrentHotel();
  return useInvAction(async ({ menuItemId, lines }: { menuItemId: string; lines: { stock_item_id: string; qty: number }[] }) => {
    unwrap(await supabase.from("menu_item_recipes").delete().eq("menu_item_id", menuItemId));
    const rows = lines.filter((l) => l.stock_item_id && l.qty > 0);
    if (rows.length) {
      unwrap(await supabase.from("menu_item_recipes").insert(rows.map((l) => ({ ...l, menu_item_id: menuItemId, hotel_id: hotel.id }))));
    }
  }, "Recipe saved");
};
