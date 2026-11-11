import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import type { MenuItem, ModifierGroup } from "@/lib/db-types";

/** Choose options (e.g. "How cooked?", "Side"), quantity and a note for one item. */
export const ModifierDialog = ({
  item, groups, currency, onAdd, onClose,
}: {
  item: MenuItem; groups: ModifierGroup[]; currency: string;
  onAdd: (a: { modifierIds: string[]; quantity: number; notes: string }) => void; onClose: () => void;
}) => {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const toggle = (g: ModifierGroup, optId: string) =>
    setPicked((p) => {
      const cur = p[g.id] ?? [];
      if (cur.includes(optId)) return { ...p, [g.id]: cur.filter((x) => x !== optId) };
      if (g.max_choices === 1) return { ...p, [g.id]: [optId] };
      if (cur.length >= g.max_choices) return p;
      return { ...p, [g.id]: [...cur, optId] };
    });

  const missing = groups.filter((g) => (picked[g.id]?.length ?? 0) < g.min_choices);
  const delta = groups.flatMap((g) => g.modifier_options.filter((o) => picked[g.id]?.includes(o.id))).reduce((s, o) => s + Number(o.price_delta), 0);
  const unit = Number(item.price) + delta;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{formatMoney(item.price, currency)}{item.description ? ` · ${item.description}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <div className="text-sm font-medium">
                {g.name}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {g.min_choices > 0 ? "required" : "optional"}{g.max_choices > 1 ? ` · up to ${g.max_choices}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.modifier_options.map((o) => {
                  const on = picked[g.id]?.includes(o.id);
                  return (
                    <button key={o.id} type="button" onClick={() => toggle(g, o.id)}
                      className={`rounded-lg border px-3 py-2 text-sm min-h-[44px] ${on ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-900 hover:bg-slate-50"}`}>
                      {o.name}{Number(o.price_delta) ? ` +${Number(o.price_delta)}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="mod-note">Note for the kitchen</Label>
            <Input id="mod-note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. no onions, extra hot" />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
            <span className="text-xl font-bold w-8 text-center">{qty}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => setQty((q) => q + 1)}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={missing.length > 0} onClick={() => onAdd({ modifierIds: Object.values(picked).flat(), quantity: qty, notes })}>
            {missing.length ? `Choose ${missing.map((g) => g.name).join(", ")}` : `Add ${qty} · ${formatMoney(unit * qty, currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
