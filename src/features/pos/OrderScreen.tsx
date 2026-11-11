import { useMemo, useState } from "react";
import {
  ArrowLeft, Ban, BedDouble, ChefHat, Gift, Minus, MoreVertical, Percent, Plus, Printer, Scissors, Search, Send, Trash2, Users, Wallet, Wine,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  useAddItem, useDiscount, useMenu, useMoveItems, useOrder, usePosSetup, useRemoveNewItem, useSendOrder, useServiceCharge, useSetQty,
  useToggleAvailable, useUpdateOrder, useVoidItem, useVoidOrder,
} from "@/hooks/usePos";
import { LoadingBlock } from "@/components/common/PageHeader";
import { ITEM_STATUS, formatMoney, formatMoney2, guestName, minutesSince } from "@/lib/format";
import type { MenuItem, PosOrder, PosOrderItem } from "@/lib/db-types";
import { ApprovalDialog } from "./ApprovalDialog";
import { ModifierDialog } from "./ModifierDialog";
import { PayDialog } from "./PayDialog";

export const orderTitle = (o: PosOrder) =>
  o.pos_tables?.name ? `Table ${o.pos_tables.name}`
    : o.order_type === "room_service" && o.reservations?.rooms ? `Room ${o.reservations.rooms.room_number}`
    : o.label || (o.order_type === "takeaway" ? "Takeaway" : "Walk-in");

type Dialog =
  | { kind: "void" | "comp"; item: PosOrderItem }
  | { kind: "discount" | "service" | "void-bill" | "pay" }
  | null;

export const OrderScreen = ({ orderId, onBack }: { orderId: string; onBack: () => void }) => {
  const { hotel, can } = useCurrentHotel();
  const cur = hotel.currency;
  const order = useOrder(orderId);
  const menu = useMenu();
  const setup = usePosSetup();
  const add = useAddItem();
  const setQty = useSetQty();
  const remove = useRemoveNewItem();
  const send = useSendOrder();
  const voidItem = useVoidItem();
  const discount = useDiscount();
  const service = useServiceCharge();
  const voidOrder = useVoidOrder();
  const move = useMoveItems();
  const update = useUpdateOrder();
  const sold = useToggleAvailable();

  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<MenuItem | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<"menu" | "bill">("menu");
  const [discKind, setDiscKind] = useState<"percent" | "amount">("percent");
  const [discValue, setDiscValue] = useState("10");
  const [svcRate, setSvcRate] = useState("");
  const [vQty, setVQty] = useState(1);

  const o = order.data;
  const groupsById = useMemo(() => new Map(menu.data?.groups.map((g) => [g.id, g]) ?? []), [menu.data]);
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (menu.data?.items ?? []).filter((i) =>
      i.active && (!o || !i.outlet_ids.length || i.outlet_ids.includes(o.outlet_id)) &&
      (cat === "all" || i.category_id === cat) && (!q || i.name.toLowerCase().includes(q) || i.item_code?.toLowerCase() === q));
  }, [menu.data, cat, search, o]);

  if (order.isLoading || menu.isLoading || !o) return <LoadingBlock />;

  const lines = [...(o.pos_order_items ?? [])].sort((a, b) => a.added_at.localeCompare(b.added_at));
  const newLines = lines.filter((l) => l.status === "new");
  const due = Math.round((Number(o.total) - Number(o.paid_total)) * 100) / 100;
  const open = o.status === "open";

  const addItem = (i: MenuItem) => {
    if (!open) return;
    const groups = (i.menu_item_modifier_groups ?? []).sort((a, b) => a.sort - b.sort).map((g) => groupsById.get(g.group_id)).filter(Boolean);
    if (groups.length) return setPick(i);
    const same = newLines.find((l) => l.menu_item_id === i.id && !l.notes && l.modifiers.length === 0);
    if (same) setQty.mutate({ id: same.id, quantity: Number(same.quantity) + 1 });
    else add.mutate({ order_id: o.id, menu_item_id: i.id, quantity: 1, modifierIds: [] });
  };

  const Ticket = (
    <Card className="flex flex-col h-full">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold truncate">{orderTitle(o)} <span className="text-slate-400 font-normal">· #{o.number}</span></div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              {o.pos_outlets?.name}
              <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{o.guests}</span>
              {o.reservations && <span className="flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{guestName(o.reservations.guests)}</span>}
              {!open && <Badge variant="outline">{o.status === "paid" ? "Paid" : "Void"}</Badge>}
            </div>
          </div>
          {open && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Bill options"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialog({ kind: "discount" })}><Percent className="mr-2 h-4 w-4" />Discount</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSvcRate(String(Number(o.service_charge_rate) * 100)); setDialog({ kind: "service" }); }}><Percent className="mr-2 h-4 w-4" />Service charge</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSplitMode(true); setSelected([]); setMobileTab("bill"); }}><Scissors className="mr-2 h-4 w-4" />Split items to new bill</DropdownMenuItem>
                <DropdownMenuSeparator />
                {setup.data && o.order_type === "dine_in" && (
                  <>
                    {setup.data.tables.filter((t) => t.outlet_id === o.outlet_id && t.active && t.id !== o.table_id).length > 0 && (
                      <DropdownMenuItem onClick={() => {
                        const name = prompt("Move to which table? (type its name, e.g. T5)");
                        const t = setup.data!.tables.find((x) => x.outlet_id === o.outlet_id && x.name.toLowerCase() === name?.trim().toLowerCase());
                        if (name && !t) return alert("No table with that name");
                        if (t) update.mutate({ id: o.id, patch: { table_id: t.id }, message: `Moved to table ${t.name}` });
                      }}>Move to another table</DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuItem onClick={() => {
                  const n = Number(prompt("Number of guests", String(o.guests)));
                  if (n >= 1) update.mutate({ id: o.id, patch: { guests: Math.round(n) }, message: "Guests updated" });
                }}>Change number of guests</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => setDialog({ kind: "void-bill" })}><Trash2 className="mr-2 h-4 w-4" />Void whole bill</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {splitMode && (
          <div className="p-2 bg-amber-50 border-b text-sm flex items-center justify-between gap-2">
            <span>Tick the items to move to a separate bill.</span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setSplitMode(false)}>Cancel</Button>
              <Button size="sm" disabled={!selected.length || move.isPending}
                onClick={() => move.mutate({ itemIds: selected }, { onSuccess: () => { setSplitMode(false); setSelected([]); } })}>Move {selected.length}</Button>
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y min-h-[200px]">
          {!lines.length && <div className="p-6 text-center text-sm text-slate-500">Tap items on the menu to add them.</div>}
          {lines.map((l) => {
            const st = ITEM_STATUS[l.status];
            const dead = l.status === "void";
            return (
              <div key={l.id} className={`p-3 flex gap-2 ${dead ? "opacity-50" : ""}`}>
                {splitMode && !dead && (
                  <Checkbox checked={selected.includes(l.id)} className="mt-1"
                    onCheckedChange={(v) => setSelected((s) => (v ? [...s, l.id] : s.filter((x) => x !== l.id)))} aria-label={`Select ${l.name}`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${dead ? "line-through" : ""}`}>
                    {Number(l.quantity) !== 1 && <span>{Number(l.quantity)}× </span>}{l.name}
                  </div>
                  {l.modifiers.length > 0 && <div className="text-xs text-slate-500">{l.modifiers.map((m) => m.name).join(", ")}</div>}
                  {l.notes && <div className="text-xs text-blue-700">“{l.notes}”</div>}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.className}`}>{st.label}</Badge>
                    {l.station !== "none" && l.status !== "new" && !dead && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        {l.station === "bar" ? <Wine className="h-3 w-3" /> : <ChefHat className="h-3 w-3" />}
                        {l.status === "sent" || l.status === "preparing" ? `${minutesSince(l.sent_at)} min` : ""}
                      </span>
                    )}
                    {l.comped && <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">Comp: {l.comp_reason}</Badge>}
                    {dead && l.void_reason && <span className="text-[10px] text-red-600">{l.void_reason}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm ${l.comped || dead ? "line-through text-slate-400" : ""}`}>{formatMoney(Number(l.quantity) * Number(l.unit_price), "")}</div>
                  {open && !splitMode && l.status === "new" && (
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Less"
                        onClick={() => (Number(l.quantity) > 1 ? setQty.mutate({ id: l.id, quantity: Number(l.quantity) - 1 }) : remove.mutate(l.id))}>
                        {Number(l.quantity) > 1 ? <Minus className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                      <Button size="icon" variant="outline" className="h-7 w-7" aria-label="More" onClick={() => setQty.mutate({ id: l.id, quantity: Number(l.quantity) + 1 })}><Plus className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {open && !splitMode && l.status !== "new" && !dead && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 mt-1" aria-label={`Options for ${l.name}`}><MoreVertical className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setVQty(Number(l.quantity)); setDialog({ kind: "void", item: l }); }}><Ban className="mr-2 h-4 w-4" />Void (remove from bill)</DropdownMenuItem>
                        {!l.comped && <DropdownMenuItem onClick={() => { setVQty(Number(l.quantity)); setDialog({ kind: "comp", item: l }); }}><Gift className="mr-2 h-4 w-4" />Comp (free of charge)</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t p-3 space-y-1 text-sm">
          <Row label="Items" value={formatMoney2(o.items_gross, cur)} />
          {Number(o.discount_amount) > 0 && <Row label={`Discount${o.discount_kind === "percent" ? ` ${Number(o.discount_value)}%` : ""}`} value={`− ${formatMoney2(o.discount_amount, cur)}`} />}
          {Number(o.service_charge) > 0 && <Row label={`Service charge ${(Number(o.service_charge_rate) * 100).toFixed(1).replace(/\.0$/, "")}%`} value={formatMoney2(Number(o.service_charge) * (1 + Number(hotel.vat_rate)), cur)} />}
          <Row label={`incl. VAT ${formatMoney2(o.vat_amount, cur)}${Number(o.levy_amount) ? ` · levy ${formatMoney2(o.levy_amount, cur)}` : ""}`} value="" muted />
          <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span>{formatMoney2(o.total, cur)}</span></div>
          {Number(o.paid_total) > 0 && <Row label="Paid" value={formatMoney2(o.paid_total, cur)} />}
          {open && Number(o.paid_total) > 0 && <div className="flex justify-between font-semibold text-red-600"><span>Still to pay</span><span>{formatMoney2(due, cur)}</span></div>}
        </div>

        {open && (
          <div className="p-3 border-t grid grid-cols-3 gap-2">
            <Button className="h-12" variant={newLines.length ? "default" : "outline"} disabled={!newLines.length || send.isPending} onClick={() => send.mutate(o.id)}>
              <Send className="mr-1 h-4 w-4" />Send{newLines.length ? ` (${newLines.length})` : ""}
            </Button>
            <Button className="h-12" variant="outline" asChild><a href={`/pos-bill/${o.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Bill</a></Button>
            <Button className="h-12 bg-green-600 hover:bg-green-700" disabled={!lines.some((l) => l.status !== "void") || newLines.length > 0}
              title={newLines.length ? "Send the new items first" : undefined} onClick={() => setDialog({ kind: "pay" })}>
              <Wallet className="mr-1 h-4 w-4" />Pay
            </Button>
          </div>
        )}
        {!open && (
          <div className="p-3 border-t grid grid-cols-2 gap-2">
            <Button variant="outline" asChild><a href={`/pos-bill/${o.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Receipt</a></Button>
            <Button onClick={onBack}>Done</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const Menu = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the menu" className="pl-9" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <CatChip on={cat === "all"} onClick={() => setCat("all")}>All</CatChip>
        {menu.data?.categories.map((c) => <CatChip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</CatChip>)}
      </div>
      {!items.length ? (
        <div className="py-10 text-center text-sm text-slate-500">{menu.data?.items.length ? "No items match." : "The menu is empty. A manager can add items in POS → Setup."}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
          {items.map((i) => (
            <div key={i.id} className="relative">
              <button disabled={!open || !i.available} onClick={() => addItem(i)}
                aria-label={i.available ? `Add ${i.name}, ${formatMoney(i.price, cur)}` : `${i.name}, sold out`}
                className={`w-full h-full min-h-[76px] text-left rounded-lg border p-3 transition ${i.available ? "bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-sm active:scale-[0.98]" : "bg-slate-100 dark:bg-slate-800 opacity-60"}`}>
                <div className="font-medium text-sm leading-tight pr-5">{i.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{i.available ? formatMoney(i.price, "") : "Sold out"}</div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute top-1 right-1 p-1 text-slate-400 hover:text-slate-700" aria-label={`${i.name} options`}><MoreVertical className="h-3.5 w-3.5" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => sold.mutate({ id: i.id, available: !i.available, name: i.name })}>
                    {i.available ? "Mark sold out" : "Back on the menu"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />All bills</Button>
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "menu" | "bill")} className="lg:hidden">
          <TabsList>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="bill">Bill · {formatMoney(o.total, "")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <div className={mobileTab === "menu" ? "" : "hidden lg:block"}>{Menu}</div>
        <div className={`${mobileTab === "bill" ? "" : "hidden lg:block"} lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]`}>{Ticket}</div>
      </div>

      {pick && (
        <ModifierDialog item={pick} currency={cur}
          groups={(pick.menu_item_modifier_groups ?? []).sort((a, b) => a.sort - b.sort).map((g) => groupsById.get(g.group_id)!).filter(Boolean)}
          onClose={() => setPick(null)}
          onAdd={(a) => add.mutate({ order_id: o.id, menu_item_id: pick.id, ...a }, { onSuccess: () => setPick(null) })} />
      )}
      {dialog?.kind === "void" && (
        <ApprovalDialog title={`Void ${dialog.item.name}?`} description="It comes off the bill and shows on the voids report." confirmLabel="Void item"
          onClose={() => setDialog(null)} onSubmit={(reason, pin) => voidItem.mutateAsync({ itemId: dialog.item.id, reason, pin, quantity: vQty })}>
          {Number(dialog.item.quantity) > 1 && (
            <div className="flex items-center gap-2">
              <Label>How many?</Label>
              {Array.from({ length: Math.min(Number(dialog.item.quantity), 10) }, (_, k) => k + 1).map((n) => (
                <button type="button" key={n} onClick={() => setVQty(n)} className={`h-9 w-9 rounded-md border ${vQty === n ? "bg-blue-600 text-white border-blue-600" : ""}`}>{n}</button>
              ))}
              <span className="text-sm text-slate-500">of {Number(dialog.item.quantity)}</span>
            </div>
          )}
        </ApprovalDialog>
      )}
      {dialog?.kind === "comp" && (
        <ApprovalDialog title={`Comp ${dialog.item.name}?`} description="The guest isn't charged for it. It shows on the comps report." confirmLabel="Comp item"
          reasons={["Long wait", "Complaint", "Kitchen error", "VIP / management", "Staff meal"]}
          onClose={() => setDialog(null)} onSubmit={(reason, pin) => voidItem.mutateAsync({ itemId: dialog.item.id, reason, pin, comp: true, quantity: vQty })}>
          {Number(dialog.item.quantity) > 1 && (
            <div className="flex items-center gap-2">
              <Label>How many?</Label>
              {Array.from({ length: Math.min(Number(dialog.item.quantity), 10) }, (_, k) => k + 1).map((n) => (
                <button type="button" key={n} onClick={() => setVQty(n)} className={`h-9 w-9 rounded-md border ${vQty === n ? "bg-blue-600 text-white border-blue-600" : ""}`}>{n}</button>
              ))}
              <span className="text-sm text-slate-500">of {Number(dialog.item.quantity)}</span>
            </div>
          )}
        </ApprovalDialog>
      )}
      {dialog?.kind === "discount" && (
        <ApprovalDialog title="Discount this bill" confirmLabel="Apply discount" reasons={["Returning guest", "Staff", "Corporate rate", "Promotion", "Complaint"]}
          onClose={() => setDialog(null)}
          onSubmit={(reason, pin) => discount.mutateAsync({ orderId: o.id, kind: Number(discValue) > 0 ? discKind : null, value: Number(discValue), reason: reason || "Removed", pin })}>
          <div className="grid grid-cols-2 gap-2">
            <Select value={discKind} onValueChange={(v) => setDiscKind(v as "percent" | "amount")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="percent">Percent %</SelectItem><SelectItem value="amount">Amount ({cur})</SelectItem></SelectContent>
            </Select>
            <Input type="number" min={0} step="1" value={discValue} onChange={(e) => setDiscValue(e.target.value)} aria-label="Discount value" />
          </div>
          <p className="text-xs text-slate-500">Enter 0 to remove a discount.</p>
        </ApprovalDialog>
      )}
      {dialog?.kind === "service" && (
        <ApprovalDialog title="Service charge for this bill" confirmLabel="Save" needsReason={false} onClose={() => setDialog(null)}
          onSubmit={(_r, pin) => service.mutateAsync({ orderId: o.id, rate: Number(svcRate || 0) / 100, pin })}>
          <div className="space-y-1">
            <Label htmlFor="svc-rate">Service charge %</Label>
            <Input id="svc-rate" type="number" min={0} max={30} step="0.5" value={svcRate} onChange={(e) => setSvcRate(e.target.value)} />
            <p className="text-xs text-slate-500">The outlet's default is {(Number(setup.data?.outlets.find((x) => x.id === o.outlet_id)?.service_charge_rate ?? 0) * 100).toFixed(1).replace(/\.0$/, "")}%. VAT is added on top of the service charge.</p>
          </div>
        </ApprovalDialog>
      )}
      {dialog?.kind === "void-bill" && (
        <ApprovalDialog title={`Void bill #${o.number}?`} description="Every item comes off. Food already sent needs a manager." confirmLabel="Void bill"
          onClose={() => setDialog(null)} onSubmit={(reason, pin) => voidOrder.mutateAsync({ orderId: o.id, reason, pin }).then(onBack)} />
      )}
      {dialog?.kind === "pay" && <PayDialog order={o} onClose={() => setDialog(null)} onPaid={() => {}} />}
    </div>
  );
};

const Row = ({ label, value, muted }: { label: string; value: string; muted?: boolean }) => (
  <div className={`flex justify-between ${muted ? "text-xs text-slate-500" : ""}`}><span>{label}</span><span>{value}</span></div>
);

const CatChip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${on ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 hover:bg-slate-50"}`}>{children}</button>
);
