import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Package, Pencil, Plus, ShoppingBag, Warehouse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { usePosSetup } from "@/hooks/usePos";
import { useInvSave, useInvSetup, useInventory, useSetOutletStore } from "@/hooks/useInventory";
import { LOCATION_KINDS, STOCK_UNITS, formatMoney, formatQty } from "@/lib/format";
import type { StockItem, StockLevel, StockLocation, StockLocationKind, Supplier } from "@/lib/db-types";
import { onHand, StoreSelect } from "./shared";
import { PurchaseOrders, ReceiveGoods } from "./Purchasing";
import { MoveStock, MovementHistory } from "./StockMoves";
import { StockCounts } from "./Counts";
import { StockCosts } from "./Costs";

const InventoryPage = () => {
  const { can } = useCurrentHotel();
  const inv = useInventory();
  const staff = can("owner", "manager", "storekeeper");
  const admin = can("owner", "manager");
  const seesCost = can("owner", "manager", "storekeeper", "accountant");
  const [tab, setTab] = useState("stock");
  const [receivePo, setReceivePo] = useState<string | null>(null);
  const [draftFromLow, setDraftFromLow] = useState<{ item_id: string; qty: number }[] | null>(null);

  if (inv.isLoading) return <LoadingBlock />;
  const d = inv.data!;

  const actions = staff ? (
    <>
      <Button variant="outline" onClick={() => setTab("move")}>Transfer / issue</Button>
      <Button onClick={() => { setReceivePo(null); setTab("receive"); }}><Plus className="mr-1 h-4 w-4" />Receive goods</Button>
    </>
  ) : can("restaurant") ? <Button variant="outline" onClick={() => setTab("move")}>Record waste</Button> : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" subtitle="Stores, stock levels, purchasing, transfers, counts and food cost" actions={actions} />
      {!d.locations.length ? (
        <FirstRun admin={admin} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="stock">Stock</TabsTrigger>
            {staff && <TabsTrigger value="receive">Receive</TabsTrigger>}
            {(staff || seesCost) && <TabsTrigger value="orders">Purchase orders</TabsTrigger>}
            <TabsTrigger value="move">{staff ? "Transfers & waste" : "Waste"}</TabsTrigger>
            {staff && <TabsTrigger value="counts">Counts</TabsTrigger>}
            <TabsTrigger value="history">History</TabsTrigger>
            {seesCost && <TabsTrigger value="costs">Costs</TabsTrigger>}
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            {admin && <TabsTrigger value="setup">Stores</TabsTrigger>}
          </TabsList>
          <TabsContent value="stock">
            <StockList items={d.items} levels={d.levels} locations={d.locations} suppliers={d.suppliers} staff={staff} seesCost={seesCost}
              onOrderLow={(lines) => { setDraftFromLow(lines); setTab("orders"); }} />
          </TabsContent>
          {staff && <TabsContent value="receive"><ReceiveGoods data={d} poId={receivePo} onDone={() => { setReceivePo(null); setTab("stock"); }} /></TabsContent>}
          <TabsContent value="orders">
            <PurchaseOrders data={d} canEdit={staff} canApprove={admin} draftLines={draftFromLow} clearDraft={() => setDraftFromLow(null)}
              onReceive={(id) => { setReceivePo(id); setTab("receive"); }} />
          </TabsContent>
          <TabsContent value="move"><MoveStock data={d} wasteOnly={!staff} /></TabsContent>
          {staff && <TabsContent value="counts"><StockCounts data={d} admin={admin} /></TabsContent>}
          <TabsContent value="history"><MovementHistory data={d} seesCost={seesCost} /></TabsContent>
          {seesCost && <TabsContent value="costs"><StockCosts /></TabsContent>}
          <TabsContent value="suppliers"><Suppliers suppliers={d.suppliers} canEdit={staff} /></TabsContent>
          {admin && <TabsContent value="setup"><Stores locations={d.locations} /></TabsContent>}
        </Tabs>
      )}
    </div>
  );
};
export default InventoryPage;

// ---------------------------------------------------------------- first run
const FirstRun = ({ admin }: { admin: boolean }) => {
  const setup = useInvSetup();
  return (
    <Card>
      <CardContent>
        <EmptyState icon={Warehouse} title="Inventory isn't set up yet">
          {admin ? (
            <div className="space-y-3">
              <p>Create a Main store, Kitchen, Bar and Housekeeping store, link your restaurant and bar outlets to them, and add common items you can edit.</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setup.mutate(true)} disabled={setup.isPending}>Set up stores and starter items</Button>
                <Button variant="outline" onClick={() => setup.mutate(false)} disabled={setup.isPending}>Stores only</Button>
              </div>
            </div>
          ) : "Ask the owner or a manager to set up the stores."}
        </EmptyState>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- stock list
const StockList = ({ items, levels, locations, suppliers, staff, seesCost, onOrderLow }: {
  items: StockItem[]; levels: StockLevel[]; locations: StockLocation[]; suppliers: Supplier[]; staff: boolean; seesCost: boolean;
  onOrderLow: (lines: { item_id: string; qty: number }[]) => void;
}) => {
  const { hotel } = useCurrentHotel();
  const [store, setStore] = useState("");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [edit, setEdit] = useState<Partial<StockItem> | null>(null);
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const active = locations.filter((l) => l.active);

  const rows = items
    .filter((i) => (showHidden || i.active) && (cat === "all" || i.category === cat) && (!q || `${i.name} ${i.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())))
    .map((i) => {
      const total = onHand(levels, i.id);
      const here = store ? onHand(levels, i.id, store) : total;
      return { i, total, here, low: i.active && Number(i.reorder_level) > 0 && total <= Number(i.reorder_level) };
    })
    .filter((r) => !lowOnly || r.low);
  const lowCount = items.filter((i) => i.active && Number(i.reorder_level) > 0 && onHand(levels, i.id) <= Number(i.reorder_level)).length;
  const value = rows.reduce((s, r) => s + r.here * Number(r.i.avg_cost), 0);

  return (
    <div className="space-y-3">
      {lowCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <span className="flex-1"><b>{lowCount}</b> item{lowCount === 1 ? " is" : "s are"} at or below the reorder level.</span>
          <Button size="sm" variant="outline" onClick={() => setLowOnly(true)}>Show them</Button>
          {staff && (
            <Button size="sm" onClick={() => onOrderLow(items.filter((i) => i.active && Number(i.reorder_level) > 0 && onHand(levels, i.id) <= Number(i.reorder_level))
              .map((i) => ({ item_id: i.id, qty: Number(i.reorder_qty) || Number(i.reorder_level) * 2 })))}>
              <ShoppingBag className="mr-1 h-4 w-4" />Draft purchase order
            </Button>
          )}
        </div>
      )}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="w-44"><StoreSelect locations={locations} value={store} onChange={setStore} allowAll /></div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" aria-label="Search items" />
          <label className="flex items-center gap-2 text-sm"><Switch checked={lowOnly} onCheckedChange={setLowOnly} />Low stock</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={showHidden} onCheckedChange={setShowHidden} />Hidden items</label>
          <div className="ml-auto flex items-center gap-3">
            {seesCost && <span className="text-sm text-slate-500">Value: <b className="text-slate-800 dark:text-slate-100">{formatMoney(value, hotel.currency)}</b></span>}
            {staff && <Button size="sm" onClick={() => setEdit({ unit: "pcs", category: cat !== "all" ? cat : "Food", active: true, reorder_level: 0, reorder_qty: 0 })}><Plus className="mr-1 h-4 w-4" />Item</Button>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead>Category</TableHead>
              {!store && active.map((l) => <TableHead key={l.id} className="text-right">{l.name}</TableHead>)}
              <TableHead className="text-right">{store ? "In store" : "Total"}</TableHead>
              <TableHead className="text-right">Reorder at</TableHead>
              {seesCost && <TableHead className="text-right">Avg cost</TableHead>}
              {seesCost && <TableHead className="text-right">Value</TableHead>}
              {staff && <TableHead />}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(({ i, total, here, low }) => (
                <TableRow key={i.id} className={!i.active ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="font-medium">{i.name}{low && <Badge variant="outline" className="ml-2 border-amber-300 bg-amber-50 text-amber-800">Low</Badge>}</div>
                    {i.sku && <div className="text-xs text-slate-500">{i.sku}</div>}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">{i.category}</TableCell>
                  {!store && active.map((l) => {
                    const q2 = onHand(levels, i.id, l.id);
                    return <TableCell key={l.id} className={`text-right tabular-nums ${q2 < 0 ? "text-red-600" : q2 === 0 ? "text-slate-400" : ""}`}>{q2 ? formatQty(q2) : "–"}</TableCell>;
                  })}
                  <TableCell className={`text-right tabular-nums font-medium ${(store ? here : total) < 0 ? "text-red-600" : ""}`}>{formatQty(store ? here : total, i.unit)}</TableCell>
                  <TableCell className="text-right tabular-nums text-slate-500">{Number(i.reorder_level) ? formatQty(i.reorder_level) : "—"}</TableCell>
                  {seesCost && <TableCell className="text-right tabular-nums">{formatMoney(Number(i.avg_cost), "")}</TableCell>}
                  {seesCost && <TableCell className="text-right tabular-nums">{formatMoney(here * Number(i.avg_cost), "")}</TableCell>}
                  {staff && <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(i)} aria-label={`Edit ${i.name}`}><Pencil className="h-4 w-4" /></Button></TableCell>}
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={10}><EmptyState icon={Package} title={items.length ? "No items match" : "No stock items yet"}>{staff && !items.length ? "Add the things you buy and store: food, drinks, cleaning and guest supplies." : null}</EmptyState></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">Negative numbers mean more was sold (by recipe) than was received or moved into that store: receive or transfer stock, or count it.</p>
      {edit && <ItemDialog item={edit} cats={cats} suppliers={suppliers} onClose={() => setEdit(null)} />}
    </div>
  );
};

const ItemDialog = ({ item, cats, suppliers, onClose }: { item: Partial<StockItem>; cats: string[]; suppliers: Supplier[]; onClose: () => void }) => {
  const save = useInvSave("stock_items", "Item");
  const [unit, setUnit] = useState(item.unit ?? "pcs");
  const [active, setActive] = useState(item.active ?? true);
  const [sup, setSup] = useState(item.preferred_supplier_id ?? "");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      id: item.id, name: String(f.get("name")).trim(), sku: String(f.get("sku") || "").trim() || null,
      category: String(f.get("category") || "Other").trim(), unit, active,
      reorder_level: Number(f.get("reorder_level") || 0), reorder_qty: Number(f.get("reorder_qty") || 0),
      preferred_supplier_id: sup || null, notes: String(f.get("notes") || "").trim() || null,
    }, { onSuccess: onClose });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item.id ? `Edit ${item.name}` : "New stock item"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1"><Label htmlFor="si-name">Name</Label><Input id="si-name" name="name" defaultValue={item.name} required /></div>
            <div className="space-y-1"><Label htmlFor="si-sku">Code (optional)</Label><Input id="si-sku" name="sku" defaultValue={item.sku ?? ""} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="si-cat">Category</Label>
              <Input id="si-cat" name="category" list="si-cats" defaultValue={item.category} required />
              <datalist id="si-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger aria-label="Unit"><SelectValue /></SelectTrigger>
                <SelectContent>{[...new Set([...STOCK_UNITS, unit])].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="si-rl">Reorder when at or below</Label><Input id="si-rl" name="reorder_level" type="number" min={0} step="any" defaultValue={item.reorder_level ?? 0} /></div>
            <div className="space-y-1"><Label htmlFor="si-rq">Usual order quantity</Label><Input id="si-rq" name="reorder_qty" type="number" min={0} step="any" defaultValue={item.reorder_qty ?? 0} /></div>
          </div>
          <div className="space-y-1">
            <Label>Usual supplier</Label>
            <Select value={sup || "none"} onValueChange={(v) => setSup(v === "none" ? "" : v)}>
              <SelectTrigger aria-label="Usual supplier"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">None</SelectItem>{suppliers.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="si-notes">Notes</Label><Textarea id="si-notes" name="notes" rows={2} defaultValue={item.notes ?? ""} /></div>
          {item.id && <p className="text-xs text-slate-500">Average cost {formatMoney(Number(item.avg_cost ?? 0), "")} comes from goods received and can't be typed in.</p>}
          <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} />Active (hidden items stay in history)</label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- suppliers
const Suppliers = ({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) => {
  const save = useInvSave("suppliers", "Supplier");
  const [edit, setEdit] = useState<Partial<Supplier> | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-lg">Suppliers</CardTitle><CardDescription>Who you buy from. Their KRA PIN appears on purchase orders.</CardDescription></div>
        {canEdit && <Button size="sm" onClick={() => setEdit({ active: true })}><Plus className="mr-1 h-4 w-4" />Supplier</Button>}
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>KRA PIN</TableHead><TableHead>Terms</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id} className={!s.active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.contact_name ?? "—"}</TableCell>
                <TableCell>{s.phone ?? "—"}{s.email && <div className="text-xs text-slate-500">{s.email}</div>}</TableCell>
                <TableCell>{s.kra_pin ?? "—"}</TableCell><TableCell>{s.payment_terms ?? "—"}</TableCell>
                {canEdit && <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(s)} aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            ))}
            {!suppliers.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No suppliers yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {edit && (
        <Dialog open onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? `Edit ${edit.name}` : "New supplier"}</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const v = (k: string) => String(f.get(k) || "").trim() || null;
              save.mutate({ id: edit.id, name: v("name"), contact_name: v("contact_name"), phone: v("phone"), email: v("email"),
                kra_pin: v("kra_pin")?.toUpperCase() ?? null, payment_terms: v("payment_terms"), notes: v("notes"), active: edit.active ?? true },
                { onSuccess: () => setEdit(null) });
            }}>
              <div className="space-y-1"><Label htmlFor="su-n">Name</Label><Input id="su-n" name="name" defaultValue={edit.name} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="su-c">Contact person</Label><Input id="su-c" name="contact_name" defaultValue={edit.contact_name ?? ""} /></div>
                <div className="space-y-1"><Label htmlFor="su-p">Phone</Label><Input id="su-p" name="phone" defaultValue={edit.phone ?? ""} /></div>
                <div className="space-y-1"><Label htmlFor="su-e">Email</Label><Input id="su-e" name="email" type="email" defaultValue={edit.email ?? ""} /></div>
                <div className="space-y-1"><Label htmlFor="su-k">KRA PIN</Label><Input id="su-k" name="kra_pin" defaultValue={edit.kra_pin ?? ""} placeholder="P051234567X" /></div>
              </div>
              <div className="space-y-1"><Label htmlFor="su-t">Payment terms</Label><Input id="su-t" name="payment_terms" defaultValue={edit.payment_terms ?? ""} placeholder="e.g. 30 days, cash on delivery" /></div>
              <div className="space-y-1"><Label htmlFor="su-no">Notes</Label><Textarea id="su-no" name="notes" rows={2} defaultValue={edit.notes ?? ""} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------- stores & outlet links
const Stores = ({ locations }: { locations: StockLocation[] }) => {
  const save = useInvSave("stock_locations", "Store");
  const link = useSetOutletStore();
  const pos = usePosSetup();
  const [edit, setEdit] = useState<Partial<StockLocation> | null>(null);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="text-lg">Stores</CardTitle><CardDescription>Places where stock is kept. Each has its own quantities.</CardDescription></div>
          <Button size="sm" onClick={() => setEdit({ kind: "other", active: true })}><Plus className="mr-1 h-4 w-4" />Store</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell><TableCell>{LOCATION_KINDS[l.kind]}</TableCell>
                  <TableCell>{l.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(l)} aria-label={`Edit ${l.name}`}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-lg">Restaurant & bar outlets</CardTitle>
          <CardDescription>When an order is sent to the kitchen or bar, its recipe ingredients come out of this store.</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>Takes stock from</TableHead></TableRow></TableHeader>
            <TableBody>
              {(pos.data?.outlets ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="w-56">
                    <Select value={o.stock_location_id ?? "none"} onValueChange={(v) => link.mutate({ outletId: o.id, locationId: v === "none" ? null : v })}>
                      <SelectTrigger aria-label={`Store for ${o.name}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Don't track stock</SelectItem>{locations.filter((l) => l.active).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!pos.data?.outlets.length && <TableRow><TableCell colSpan={2} className="text-center text-slate-500 py-6">Set up the POS outlets first</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {edit && (
        <Dialog open onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? `Edit ${edit.name}` : "New store"}</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({ id: edit.id, name: String(f.get("name")).trim(), kind: edit.kind, active: edit.active ?? true }, { onSuccess: () => setEdit(null) });
            }}>
              <div className="space-y-1"><Label htmlFor="st-n">Name</Label><Input id="st-n" name="name" defaultValue={edit.name} required /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={edit.kind} onValueChange={(v) => setEdit({ ...edit, kind: v as StockLocationKind })}>
                  <SelectTrigger aria-label="Store type"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(LOCATION_KINDS) as StockLocationKind[]).map((k) => <SelectItem key={k} value={k}>{LOCATION_KINDS[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active</label>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
