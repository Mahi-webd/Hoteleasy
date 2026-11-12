import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatQty } from "@/lib/format";
import type { StockItem, StockLevel, StockLocation } from "@/lib/db-types";

export const onHand = (levels: StockLevel[], itemId: string, locationId?: string | null) =>
  levels.filter((l) => l.item_id === itemId && (!locationId || l.location_id === locationId)).reduce((s, l) => s + Number(l.qty), 0);

/** Searchable item picker grouped by category. */
export const ItemPicker = ({ items, value, onChange, exclude = [], label = "Choose item" }: {
  items: StockItem[]; value: string; onChange: (id: string) => void; exclude?: string[]; label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const cur = items.find((i) => i.id === value);
  const groups = useMemo(() => {
    const m = new Map<string, StockItem[]>();
    items.filter((i) => i.active || i.id === value).forEach((i) => m.set(i.category, [...(m.get(i.category) ?? []), i]));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items, value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={cur ? `Item: ${cur.name}` : label}
          className="w-full justify-between font-normal">
          <span className="truncate">{cur ? cur.name : <span className="text-slate-500">{label}</span>}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Search items…" />
          <CommandList>
            <CommandEmpty>No item found. Add it under Stock first.</CommandEmpty>
            {groups.map(([cat, list]) => (
              <CommandGroup key={cat} heading={cat}>
                {list.map((i) => (
                  <CommandItem key={i.id} value={`${i.name} ${i.sku ?? ""} ${cat}`} disabled={exclude.includes(i.id) && i.id !== value}
                    onSelect={() => { onChange(i.id); setOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${i.id === value ? "opacity-100" : "opacity-0"}`} />
                    <span className="flex-1">{i.name}</span><span className="text-xs text-slate-500">{i.unit}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export type Line = { key: number; item_id: string; qty: string; unit_cost: string };
let seq = 0;
export const newLine = (p: Partial<Omit<Line, "key">> = {}): Line => ({ key: ++seq, item_id: "", qty: "", unit_cost: "", ...p });

/** Editable list of item + quantity (+ cost) rows. */
export const LinesEditor = ({ lines, setLines, items, levels, locationId, withCost, currency, showOnHand = true }: {
  lines: Line[]; setLines: (l: Line[]) => void; items: StockItem[]; levels: StockLevel[]; locationId?: string | null;
  withCost?: boolean; currency: string; showOnHand?: boolean;
}) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const set = (k: number, p: Partial<Line>) => setLines(lines.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
  return (
    <div className="space-y-2">
      <div className={`hidden sm:grid gap-2 text-xs text-slate-500 ${withCost ? "grid-cols-[1fr_110px_120px_100px_36px]" : "grid-cols-[1fr_110px_120px_36px]"}`}>
        <span>Item</span><span>Quantity</span>{withCost && <span>Unit cost</span>}<span className="text-right">{withCost ? "Line total" : showOnHand ? "In store" : ""}</span><span />
      </div>
      {lines.map((l, idx) => {
        const it = byId.get(l.item_id);
        const have = it && locationId ? onHand(levels, it.id, locationId) : null;
        return (
          <div key={l.key} className={`grid gap-2 items-center ${withCost ? "sm:grid-cols-[1fr_110px_120px_100px_36px]" : "sm:grid-cols-[1fr_110px_120px_36px]"} grid-cols-2`}>
            <div className="col-span-2 sm:col-span-1">
              <ItemPicker items={items} value={l.item_id} exclude={lines.map((x) => x.item_id)}
                onChange={(id) => set(l.key, { item_id: id, unit_cost: withCost && !l.unit_cost ? String(byId.get(id)?.last_cost ?? (Number(byId.get(id)?.avg_cost) || "")) : l.unit_cost })} />
            </div>
            <div className="relative">
              <Input type="number" min={0} step="any" inputMode="decimal" value={l.qty} aria-label={`Quantity line ${idx + 1}`}
                onChange={(e) => set(l.key, { qty: e.target.value })} className="pr-10" />
              <span className="absolute right-2 top-2.5 text-xs text-slate-500">{it?.unit}</span>
            </div>
            {withCost && (
              <Input type="number" min={0} step="any" inputMode="decimal" value={l.unit_cost} aria-label={`Unit cost line ${idx + 1}`}
                onChange={(e) => set(l.key, { unit_cost: e.target.value })} />
            )}
            <div className="text-right text-sm tabular-nums">
              {withCost ? formatMoney((Number(l.qty) || 0) * (Number(l.unit_cost) || 0), "")
                : have != null && showOnHand ? <span className={have < (Number(l.qty) || 0) ? "text-red-600" : "text-slate-500"}>{formatQty(have, it?.unit)}</span> : null}
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, newLine()])}><Plus className="mr-1 h-4 w-4" />Add line</Button>
        {withCost && <div className="text-sm font-semibold">Total {formatMoney(total, currency)}</div>}
      </div>
    </div>
  );
};

export const StoreSelect = ({ locations, value, onChange, label = "Store", allowAll, id }: {
  locations: StockLocation[]; value: string; onChange: (v: string) => void; label?: string; allowAll?: boolean; id?: string;
}) => (
  <Select value={value || (allowAll ? "all" : "")} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
    <SelectTrigger id={id} aria-label={label}><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
    <SelectContent>
      {allowAll && <SelectItem value="all">All stores</SelectItem>}
      {locations.filter((l) => l.active).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const toMoveLines = (lines: Line[]) =>
  lines.filter((l) => l.item_id && Number(l.qty) > 0).map((l) => ({ item_id: l.item_id, qty: Number(l.qty), unit_cost: Number(l.unit_cost) || 0 }));

export type InvData = NonNullable<ReturnType<typeof import("@/hooks/useInventory").useInventory>["data"]>;
