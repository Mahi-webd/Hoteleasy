import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, PackageCheck, Pencil, Printer, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useDeletePo, usePoAction, usePurchaseOrders, useReceive, useSavePo } from "@/hooks/useInventory";
import { useBillFromReceipt } from "@/hooks/useFinance";
import { addDays, todayIn } from "@/lib/format";
import { PO_STATUS, formatDate, formatMoney, formatQty } from "@/lib/format";
import type { PurchaseOrder } from "@/lib/db-types";
import { LinesEditor, StoreSelect, newLine, toMoveLines, type InvData, type Line } from "./shared";

const poTotal = (po: PurchaseOrder) => po.purchase_order_lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_cost), 0);

// ---------------------------------------------------------------- receive goods
export const ReceiveGoods = ({ data, poId, onDone }: { data: InvData; poId: string | null; onDone: () => void }) => {
  const { hotel, can } = useCurrentHotel();
  const pos = usePurchaseOrders();
  const receive = useReceive();
  const open = (pos.data ?? []).filter((p) => p.status === "approved" || p.status === "partly_received");
  const [po, setPo] = useState<string>(poId ?? "");
  const [loc, setLoc] = useState(data.locations.find((l) => l.kind === "main" && l.active)?.id ?? data.locations[0]?.id ?? "");
  const [sup, setSup] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [opening, setOpening] = useState(false);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [bill, setBill] = useState(true);
  const [dueDays, setDueDays] = useState("30");
  const makeBill = useBillFromReceipt();

  // Picking an order fills in what is still to come.
  useEffect(() => {
    const p = (pos.data ?? []).find((x) => x.id === po);
    if (!p) return;
    setLoc(p.location_id); setSup(p.supplier_id); setOpening(false);
    const rest = p.purchase_order_lines.filter((l) => Number(l.qty_received) < Number(l.qty))
      .map((l) => newLine({ item_id: l.item_id, qty: String(Number(l.qty) - Number(l.qty_received)), unit_cost: String(l.unit_cost) }));
    setLines(rest.length ? rest : [newLine()]);
  }, [po, pos.data]);
  useEffect(() => { if (poId) setPo(poId); }, [poId]);

  const submit = () => {
    const l = toMoveLines(lines);
    const withBill = bill && !opening && !!sup && l.some((x) => (x.unit_cost ?? 0) > 0);
    receive.mutate({ locationId: loc, lines: l, supplierId: opening ? null : sup || null, poId: po || null, reference: ref, note, opening }, {
      onSuccess: (batch) => {
        if (withBill) makeBill.mutate({ batch: batch as string, dueOn: dueDays ? addDays(todayIn(hotel.timezone), Number(dueDays) || 0) : null });
        setLines([newLine()]); setRef(""); setNote(""); setPo(""); onDone();
      },
    });
  };
  const ready = !!loc && toMoveLines(lines).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{opening ? "Opening stock" : "Receive goods"}</CardTitle>
        <CardDescription>{opening ? "Enter what is on the shelves today and what it cost. Use this once when you start." :
          "Check the delivery against the supplier's invoice. Prices here update each item's average cost."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {!opening && (
            <div className="space-y-1">
              <Label>Purchase order</Label>
              <Select value={po || "none"} onValueChange={(v) => setPo(v === "none" ? "" : v)}>
                <SelectTrigger aria-label="Purchase order"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No order</SelectItem>
                  {open.map((p) => <SelectItem key={p.id} value={p.id}>#{p.number} · {data.suppliers.find((s) => s.id === p.supplier_id)?.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1"><Label htmlFor="rc-loc">Into store</Label><StoreSelect id="rc-loc" locations={data.locations} value={loc} onChange={setLoc} /></div>
          {!opening && (
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={sup || "none"} onValueChange={(v) => setSup(v === "none" ? "" : v)} disabled={!!po}>
                <SelectTrigger aria-label="Supplier"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not recorded</SelectItem>{data.suppliers.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {!opening && <div className="space-y-1"><Label htmlFor="rc-ref">Invoice / delivery note no.</Label><Input id="rc-ref" value={ref} onChange={(e) => setRef(e.target.value)} /></div>}
        </div>
        <LinesEditor lines={lines} setLines={setLines} items={data.items} levels={data.levels} locationId={loc} withCost currency={hotel.currency} />
        <div className="space-y-1"><Label htmlFor="rc-note">Note</Label><Textarea id="rc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short delivery, damaged items…" /></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!opening && sup && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={bill} onCheckedChange={setBill} />Add the supplier's bill to Bills to pay, due in
              <Input type="number" min={0} className="w-16 h-8" value={dueDays} onChange={(e) => setDueDays(e.target.value)} aria-label="Bill due in days" disabled={!bill} />days
            </label>
          )}
          {can("owner", "manager", "storekeeper") && !po ? (
            <label className="flex items-center gap-2 text-sm"><Switch checked={opening} onCheckedChange={setOpening} />This is opening stock (no supplier)</label>
          ) : <span />}
          <Button onClick={submit} disabled={!ready || receive.isPending}><PackageCheck className="mr-2 h-4 w-4" />{opening ? "Save opening stock" : "Receive into store"}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- purchase orders
export const PurchaseOrders = ({ data, canEdit, canApprove, draftLines, clearDraft, onReceive }: {
  data: InvData; canEdit: boolean; canApprove: boolean; draftLines: { item_id: string; qty: number }[] | null; clearDraft: () => void;
  onReceive: (id: string) => void;
}) => {
  const { hotel } = useCurrentHotel();
  const pos = usePurchaseOrders();
  const act = usePoAction();
  const del = useDeletePo();
  const [edit, setEdit] = useState<Partial<PurchaseOrder> & { lines?: Line[] } | null>(null);
  const [show, setShow] = useState<PurchaseOrder | null>(null);
  const [filter, setFilter] = useState("open");
  const sup = (id: string) => data.suppliers.find((s) => s.id === id)?.name ?? "—";
  const store = (id: string) => data.locations.find((l) => l.id === id)?.name ?? "—";

  // "Draft purchase order" from low stock: one supplier at a time (the usual one of the first item).
  useEffect(() => {
    if (!draftLines?.length) return;
    const items = new Map(data.items.map((i) => [i.id, i]));
    const firstSup = draftLines.map((l) => items.get(l.item_id)?.preferred_supplier_id).find(Boolean) ?? data.suppliers.find((s) => s.active)?.id;
    const mine = draftLines.filter((l) => !items.get(l.item_id)?.preferred_supplier_id || items.get(l.item_id)?.preferred_supplier_id === firstSup);
    setEdit({
      supplier_id: firstSup ?? "", location_id: data.locations.find((l) => l.kind === "main")?.id ?? data.locations[0]?.id,
      lines: mine.map((l) => newLine({ item_id: l.item_id, qty: String(l.qty), unit_cost: String(items.get(l.item_id)?.last_cost ?? (Number(items.get(l.item_id)?.avg_cost) || "")) })),
    });
    clearDraft();
  }, [draftLines, data, clearDraft]);

  if (pos.isLoading) return <LoadingBlock />;
  const list = (pos.data ?? []).filter((p) => filter === "all" || (filter === "open" ? ["draft", "approved", "partly_received"].includes(p.status) : p.status === filter));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-lg">Purchase orders</CardTitle>
          <CardDescription>{canApprove ? "Storekeepers draft orders; you approve them before they go to the supplier." : "You draft orders; a manager approves them before they go to the supplier."}</CardDescription></div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40" aria-label="Show orders"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem><SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="received">Received</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && <Button size="sm" disabled={!data.suppliers.length} title={!data.suppliers.length ? "Add a supplier first" : undefined}
            onClick={() => setEdit({ supplier_id: data.suppliers.find((s) => s.active)?.id, location_id: data.locations.find((l) => l.kind === "main")?.id ?? data.locations[0]?.id, lines: [newLine()] })}>New order</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Supplier</TableHead><TableHead>Deliver to</TableHead><TableHead>Expected</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">#{p.number}</TableCell>
                <TableCell>{sup(p.supplier_id)}</TableCell><TableCell>{store(p.location_id)}</TableCell>
                <TableCell>{formatDate(p.expected_on)}</TableCell>
                <TableCell><Badge variant="outline" className={PO_STATUS[p.status].className}>{PO_STATUS[p.status].label}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(poTotal(p), "")}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setShow(p)} aria-label={`View order ${p.number}`}><ClipboardList className="h-4 w-4" /></Button>
                  {canEdit && p.status === "draft" && <Button size="sm" variant="ghost" aria-label={`Edit order ${p.number}`}
                    onClick={() => setEdit({ ...p, lines: p.purchase_order_lines.map((l) => newLine({ item_id: l.item_id, qty: String(l.qty), unit_cost: String(l.unit_cost) })) })}><Pencil className="h-4 w-4" /></Button>}
                  {canApprove && p.status === "draft" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, action: "approve" })}><Check className="mr-1 h-4 w-4" />Approve</Button>}
                  {canEdit && (p.status === "approved" || p.status === "partly_received") && <Button size="sm" onClick={() => onReceive(p.id)}><PackageCheck className="mr-1 h-4 w-4" />Receive</Button>}
                  {canEdit && p.status === "partly_received" && <ConfirmButton size="sm" variant="ghost" title={`Close order #${p.number}?`}
                    description="The supplier won't deliver the rest. What was received stays in stock." onConfirm={() => act.mutate({ id: p.id, action: "close" })}>Close</ConfirmButton>}
                  {canEdit && p.status === "draft" && <ConfirmButton size="sm" variant="ghost" title={`Delete draft #${p.number}?`} onConfirm={() => del.mutate(p.id)} aria-label={`Delete order ${p.number}`}><Trash2 className="h-4 w-4" /></ConfirmButton>}
                  {canApprove && p.status === "approved" && <ConfirmButton size="sm" variant="ghost" title={`Cancel order #${p.number}?`} onConfirm={() => act.mutate({ id: p.id, action: "cancel" })} aria-label={`Cancel order ${p.number}`}><X className="h-4 w-4" /></ConfirmButton>}
                </TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={7}><EmptyState icon={ClipboardList} title="No orders here" /></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {edit && <PoDialog data={data} po={edit} onClose={() => setEdit(null)} currency={hotel.currency} />}
      {show && <PoView data={data} po={show} onClose={() => setShow(null)} />}
    </Card>
  );
};

const PoDialog = ({ data, po, onClose, currency }: { data: InvData; po: Partial<PurchaseOrder> & { lines?: Line[] }; onClose: () => void; currency: string }) => {
  const save = useSavePo();
  const [sup, setSup] = useState(po.supplier_id ?? "");
  const [loc, setLoc] = useState(po.location_id ?? "");
  const [expected, setExpected] = useState(po.expected_on ?? "");
  const [notes, setNotes] = useState(po.notes ?? "");
  const [lines, setLines] = useState<Line[]>(po.lines ?? [newLine()]);
  const submit = () => save.mutate({
    id: po.id, supplierId: sup, locationId: loc, expectedOn: expected || null, notes,
    lines: toMoveLines(lines).map((l) => ({ item_id: l.item_id, qty: l.qty, unit_cost: l.unit_cost ?? 0 })),
  }, { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{po.id ? `Purchase order #${po.number}` : "New purchase order"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Select value={sup} onValueChange={setSup}>
              <SelectTrigger aria-label="Supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>{data.suppliers.filter((s) => s.active || s.id === sup).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Deliver to</Label><StoreSelect locations={data.locations} value={loc} onChange={setLoc} /></div>
          <div className="space-y-1"><Label htmlFor="po-exp">Expected</Label><Input id="po-exp" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
        </div>
        <LinesEditor lines={lines} setLines={setLines} items={data.items} levels={data.levels} withCost currency={currency} showOnHand={false} />
        <div className="space-y-1"><Label htmlFor="po-notes">Notes for the supplier</Label><Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!sup || !loc || !toMoveLines(lines).length || save.isPending}>Save draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PoView = ({ data, po, onClose }: { data: InvData; po: PurchaseOrder; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const items = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const s = data.suppliers.find((x) => x.id === po.supplier_id);
  const print = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const rows = po.purchase_order_lines.map((l) => {
      const it = items.get(l.item_id);
      return `<tr><td>${esc(it?.name ?? "")}</td><td style="text-align:right">${formatQty(l.qty, it?.unit)}</td><td style="text-align:right">${formatMoney(Number(l.unit_cost), "")}</td><td style="text-align:right">${formatMoney(Number(l.qty) * Number(l.unit_cost), "")}</td></tr>`;
    }).join("");
    w.document.write(`<!doctype html><title>PO ${po.number}</title><style>body{font:14px system-ui;margin:40px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}h1{margin:0}</style>
      <h1>${esc(hotel.name)}</h1><h2>Purchase order #${po.number}</h2>
      <p><b>To:</b> ${esc(s?.name ?? "")}${s?.kra_pin ? ` · KRA PIN ${esc(s.kra_pin)}` : ""}<br/><b>Deliver to:</b> ${esc(data.locations.find((l) => l.id === po.location_id)?.name ?? "")}
      ${po.expected_on ? `<br/><b>Expected:</b> ${formatDate(po.expected_on)}` : ""}<br/><b>Status:</b> ${PO_STATUS[po.status].label}${po.approved_at ? ` (approved ${formatDate(po.approved_at.slice(0, 10))})` : ""}</p>
      <table><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Total</th></tr>${rows}
      <tr><td colspan=3><b>Total</b></td><td style="text-align:right"><b>${formatMoney(poTotal(po), hotel.currency)}</b></td></tr></table>
      ${po.notes ? `<p>${esc(po.notes)}</p>` : ""}<script>print()</script>`);
    w.document.close();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Purchase order #{po.number} · {s?.name}</DialogTitle></DialogHeader>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <Badge variant="outline" className={PO_STATUS[po.status].className}>{PO_STATUS[po.status].label}</Badge>
          <span className="ml-2">Deliver to {data.locations.find((l) => l.id === po.location_id)?.name}{po.expected_on ? ` by ${formatDate(po.expected_on)}` : ""}</span>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Received</TableHead>
            <TableHead className="text-right">Unit price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {po.purchase_order_lines.map((l) => {
              const it = items.get(l.item_id);
              return (
                <TableRow key={l.id}>
                  <TableCell>{it?.name}</TableCell><TableCell className="text-right">{formatQty(l.qty, it?.unit)}</TableCell>
                  <TableCell className={`text-right ${Number(l.qty_received) < Number(l.qty) ? "text-amber-700" : ""}`}>{formatQty(l.qty_received)}</TableCell>
                  <TableCell className="text-right">{formatMoney(Number(l.unit_cost), "")}</TableCell>
                  <TableCell className="text-right">{formatMoney(Number(l.qty) * Number(l.unit_cost), "")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="text-right font-semibold">Total {formatMoney(poTotal(po), hotel.currency)}</div>
        {po.notes && <p className="text-sm text-slate-600">{po.notes}</p>}
        <DialogFooter><Button variant="outline" onClick={print}><Printer className="mr-2 h-4 w-4" />Print</Button><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
