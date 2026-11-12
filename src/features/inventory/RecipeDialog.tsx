import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useInventory, useRecipes, useSaveRecipe } from "@/hooks/useInventory";
import { formatMoney } from "@/lib/format";
import type { MenuItem } from "@/lib/db-types";
import { ItemPicker } from "./shared";

/** Ingredients for one portion of a menu item. */
export const RecipeDialog = ({ item, onClose }: { item: MenuItem; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const inv = useInventory();
  const recipes = useRecipes();
  const save = useSaveRecipe();
  const existing = useMemo(() => (recipes.data ?? []).filter((r) => r.menu_item_id === item.id), [recipes.data, item.id]);
  const [lines, setLines] = useState<{ key: number; stock_item_id: string; qty: string }[] | null>(null);
  const rows = lines ?? existing.map((r, i) => ({ key: i, stock_item_id: r.stock_item_id, qty: String(r.qty) }));
  const set = (next: typeof rows) => setLines(next);
  const items = inv.data?.items ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const cost = rows.reduce((s, l) => s + (Number(l.qty) || 0) * Number(byId.get(l.stock_item_id)?.avg_cost ?? 0), 0);
  // Menu prices may include VAT and levy; compare cost with the price before tax.
  const tax = item.tax_category === "standard" ? Number(hotel.vat_rate) : 0;
  const net = hotel.prices_include_vat ? Number(item.price) / (1 + tax + Number(hotel.tourism_levy_rate)) : Number(item.price);
  const pctCost = net ? cost / net : 0;

  if (!inv.data?.locations.length && !inv.isLoading) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recipe for {item.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Set up Inventory first (Operations → Inventory), then add the ingredients here.</p>
          <DialogFooter><Button onClick={onClose}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Recipe for {item.name}</DialogTitle>
          <DialogDescription>Ingredients for one portion. When the item is sent to the kitchen or bar, these come out of the outlet's store.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((l, idx) => {
            const it = byId.get(l.stock_item_id);
            return (
              <div key={l.key} className="grid grid-cols-[1fr_130px_90px_36px] gap-2 items-center">
                <ItemPicker items={items} value={l.stock_item_id} exclude={rows.map((r) => r.stock_item_id)}
                  onChange={(id) => set(rows.map((r) => (r.key === l.key ? { ...r, stock_item_id: id } : r)))} label="Choose ingredient" />
                <div className="relative">
                  <Input type="number" min={0} step="any" inputMode="decimal" value={l.qty} aria-label={`Ingredient quantity ${idx + 1}`} className="pr-10"
                    onChange={(e) => set(rows.map((r) => (r.key === l.key ? { ...r, qty: e.target.value } : r)))} />
                  <span className="absolute right-2 top-2.5 text-xs text-slate-500">{it?.unit}</span>
                </div>
                <span className="text-right text-sm tabular-nums text-slate-500">{formatMoney((Number(l.qty) || 0) * Number(it?.avg_cost ?? 0), "")}</span>
                <Button variant="ghost" size="icon" aria-label="Remove ingredient" onClick={() => set(rows.filter((r) => r.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => set([...rows, { key: Date.now(), stock_item_id: "", qty: "" }])}><Plus className="mr-1 h-4 w-4" />Ingredient</Button>
          <p className="text-xs text-slate-500">Use the stock unit: 0.25 kg of beef, 1 btl of Tusker, 0.03 l of gin (one tot ≈ 0.025–0.035 l).</p>
        </div>
        <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-3 text-sm grid grid-cols-3 gap-2">
          <div><div className="text-slate-500">Portion cost</div><div className="font-semibold">{formatMoney(cost, hotel.currency)}</div></div>
          <div><div className="text-slate-500">Price before tax</div><div className="font-semibold">{formatMoney(net, hotel.currency)}</div></div>
          <div><div className="text-slate-500">Cost %</div><div className={`font-semibold ${pctCost > 0.4 ? "text-red-700" : ""}`}>{cost ? `${(pctCost * 100).toFixed(1)}%` : "—"}</div></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate({ menuItemId: item.id, lines: rows.map((r) => ({ stock_item_id: r.stock_item_id, qty: Number(r.qty) })) }, { onSuccess: onClose })}>Save recipe</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
