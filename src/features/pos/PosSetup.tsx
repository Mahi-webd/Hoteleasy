import { useState, type FormEvent } from "react";
import { CookingPot, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { RecipeDialog } from "@/features/inventory/RecipeDialog";
import { useRecipes } from "@/hooks/useInventory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useDeleteRow, useHasPin, useMenu, usePosSetup, useSaveRow, useSetItemGroups, useSetPin, useSetupDefaults } from "@/hooks/usePos";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { LoadingBlock } from "@/components/common/PageHeader";
import { CHARGE_KINDS, OUTLET_KINDS, formatMoney } from "@/lib/format";
import type { ChargeKind, MenuCategory, MenuItem, ModifierGroup, OutletKind, PosOutlet, PosStation, TaxCategory } from "@/lib/db-types";

const STATIONS: Record<PosStation, string> = { kitchen: "Kitchen", bar: "Bar", none: "No ticket (served at till)" };
const TAX: Record<TaxCategory, string> = { standard: "Standard VAT", zero_rated: "Zero-rated", exempt: "Exempt" };

export const SetPinCard = () => {
  const has = useHasPin();
  const setPin = useSetPin();
  const [pin, setPinV] = useState("");
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" />Your approval PIN</CardTitle>
        <CardDescription>
          {has.data ? "Set. You can change it any time." : "Not set yet."} Waiters ask a manager to type this on their screen to approve voids, comps and discounts. Keep it private.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPin.mutate(pin, { onSuccess: () => setPinV("") }); }}>
          <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPinV(e.target.value.replace(/\D/g, ""))} placeholder="4–6 digits" aria-label="New PIN" />
          <Button type="submit" disabled={pin.length < 4 || setPin.isPending}>{has.data ? "Change PIN" : "Set PIN"}</Button>
        </form>
      </CardContent>
    </Card>
  );
};

export const PosSetup = () => {
  const setup = usePosSetup();
  const menu = useMenu();
  if (setup.isLoading || menu.isLoading) return <LoadingBlock />;
  return (
    <Tabs defaultValue="items">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="items">Menu items</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="options">Options (modifiers)</TabsTrigger>
        <TabsTrigger value="outlets">Outlets & service charge</TabsTrigger>
        <TabsTrigger value="tables">Tables</TabsTrigger>
      </TabsList>
      <TabsContent value="items"><Items items={menu.data!.items} cats={menu.data!.categories} groups={menu.data!.groups} outlets={setup.data!.outlets} /></TabsContent>
      <TabsContent value="categories"><Categories cats={menu.data!.categories} /></TabsContent>
      <TabsContent value="options"><Groups groups={menu.data!.groups} /></TabsContent>
      <TabsContent value="outlets"><Outlets outlets={setup.data!.outlets} /></TabsContent>
      <TabsContent value="tables"><Tables outlets={setup.data!.outlets} /></TabsContent>
    </Tabs>
  );
};

// ---------------------------------------------------------------- outlets
const Outlets = ({ outlets }: { outlets: PosOutlet[] }) => {
  const save = useSaveRow("pos_outlets", "Outlet");
  const defaults = useSetupDefaults();
  const [edit, setEdit] = useState<Partial<PosOutlet> | null>(null);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-lg">Outlets</CardTitle><CardDescription>Each outlet has its own tables, bills and sales report. The service charge set here is the default for new bills.</CardDescription></div>
        <Button size="sm" onClick={() => setEdit({ kind: "restaurant", service_charge_rate: 0, active: true })}><Plus className="mr-1 h-4 w-4" />Outlet</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Service charge</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {outlets.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{OUTLET_KINDS[o.kind]}</TableCell>
                <TableCell>{Number(o.service_charge_rate) ? `${(Number(o.service_charge_rate) * 100).toFixed(1).replace(/\.0$/, "")}%` : "None"}</TableCell>
                <TableCell>{o.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(o)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!outlets.length && <TableRow><TableCell colSpan={5} className="text-center py-6"><Button onClick={() => defaults.mutate(false)}>Create the 4 standard outlets</Button></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {edit && (
        <Dialog open onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? `Edit ${edit.name}` : "New outlet"}</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({ id: edit.id, name: String(f.get("name")).trim(), kind: edit.kind, active: edit.active,
                service_charge_rate: Number(f.get("svc") || 0) / 100 }, { onSuccess: () => setEdit(null) });
            }}>
              <div className="space-y-1"><Label htmlFor="o-name">Name</Label><Input id="o-name" name="name" defaultValue={edit.name} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={edit.kind} onValueChange={(v) => setEdit({ ...edit, kind: v as OutletKind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(OUTLET_KINDS) as OutletKind[]).map((k) => <SelectItem key={k} value={k}>{OUTLET_KINDS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="o-svc">Service charge %</Label>
                  <Input id="o-svc" name="svc" type="number" min={0} max={30} step="0.5" defaultValue={Number(edit.service_charge_rate ?? 0) * 100} />
                </div>
              </div>
              <p className="text-xs text-slate-500">Applies to new bills in this outlet. On a single bill, a manager can change it from the bill's menu.</p>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />Active (shown on the POS)</label>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------- tables
const Tables = ({ outlets }: { outlets: PosOutlet[] }) => {
  const setup = usePosSetup();
  const save = useSaveRow("pos_tables", "Table");
  const del = useDeleteRow("pos_tables", "Table");
  const [outlet, setOutlet] = useState(outlets[0]?.id ?? "");
  const tables = (setup.data?.tables ?? []).filter((t) => t.outlet_id === outlet);
  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    save.mutate({ outlet_id: outlet, name: String(f.get("name")).trim(), seats: Number(f.get("seats") || 4), sort: tables.length + 1 }, { onSuccess: () => form.reset() });
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Tables</CardTitle><CardDescription>Room service and takeaway don't need tables.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {outlets.map((o) => <Button key={o.id} size="sm" variant={o.id === outlet ? "default" : "outline"} onClick={() => setOutlet(o.id)}>{o.name}</Button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <div key={t.id} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <span className="font-medium">{t.name}</span><span className="text-slate-400">· {t.seats}</span>
              <button className="ml-1 text-slate-400 hover:text-red-600" aria-label={`Remove table ${t.name}`} onClick={() => confirm(`Remove table ${t.name}?`) && del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!tables.length && <span className="text-sm text-slate-500">No tables in this outlet.</span>}
        </div>
        <form onSubmit={add} className="flex gap-2 max-w-md">
          <Input name="name" placeholder="Table name, e.g. T11" required aria-label="Table name" />
          <Input name="seats" type="number" min={1} max={50} defaultValue={4} className="w-24" aria-label="Seats" />
          <Button type="submit" disabled={!outlet}>Add</Button>
        </form>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- categories
const Categories = ({ cats }: { cats: MenuCategory[] }) => {
  const save = useSaveRow("menu_categories", "Category");
  const del = useDeleteRow("menu_categories", "Category");
  const [station, setStation] = useState<PosStation>("kitchen");
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Categories</CardTitle><CardDescription>The station decides which screen gets the order: kitchen or bar.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Goes to</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {cats.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Select value={c.station} onValueChange={(v) => save.mutate({ id: c.id, station: v })}>
                    <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(STATIONS) as PosStation[]).map((s) => <SelectItem key={s} value={s}>{STATIONS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <ConfirmButton size="sm" variant="ghost" title={`Delete ${c.name}?`} description="Only possible when it has no items." onConfirm={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form className="flex gap-2 max-w-lg" onSubmit={(e) => {
          e.preventDefault(); const form = e.currentTarget;
          save.mutate({ name: String(new FormData(form).get("name")).trim(), station, sort: cats.length + 1 }, { onSuccess: () => form.reset() });
        }}>
          <Input name="name" placeholder="New category, e.g. Desserts" required aria-label="Category name" />
          <Select value={station} onValueChange={(v) => setStation(v as PosStation)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(STATIONS) as PosStation[]).map((s) => <SelectItem key={s} value={s}>{STATIONS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit">Add</Button>
        </form>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- items
const Items = ({ items, cats, groups, outlets }: { items: MenuItem[]; cats: MenuCategory[]; groups: ModifierGroup[]; outlets: PosOutlet[] }) => {
  const { hotel } = useCurrentHotel();
  const del = useDeleteRow("menu_items", "Item");
  const save = useSaveRow("menu_items", "Item");
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [recipe, setRecipe] = useState<MenuItem | null>(null);
  const recipes = useRecipes();
  const withRecipe = new Set((recipes.data ?? []).map((r) => r.menu_item_id));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-lg">Menu items ({items.length})</CardTitle><CardDescription>Prices {hotel.prices_include_vat ? "include" : "exclude"} VAT (Settings → Billing).</CardDescription></div>
        <Button size="sm" disabled={!cats.length} onClick={() => setEdit({ category_id: cats[0]?.id, tax_category: "standard", charge_kind: "food", outlet_ids: [], active: true, available: true })}>
          <Plus className="mr-1 h-4 w-4" />Item
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Options</TableHead><TableHead>Sold in</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id} className={!i.active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{i.name}{!i.available && <Badge variant="outline" className="ml-2">sold out</Badge>}{!i.active && <Badge variant="outline" className="ml-2">hidden</Badge>}</TableCell>
                <TableCell>{catName.get(i.category_id)}</TableCell>
                <TableCell className="text-right">{formatMoney(i.price, "")}</TableCell>
                <TableCell className="text-xs text-slate-500">{(i.menu_item_modifier_groups ?? []).map((g) => groups.find((x) => x.id === g.group_id)?.name).filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell className="text-xs text-slate-500">{i.outlet_ids.length ? i.outlet_ids.map((id) => outlets.find((o) => o.id === id)?.name).join(", ") : "All outlets"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setRecipe(i)} aria-label={`Recipe for ${i.name}`} title="Recipe (ingredients for stock and cost)">
                    <CookingPot className={`h-4 w-4 ${withRecipe.has(i.id) ? "text-emerald-600" : "text-slate-400"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(i)} aria-label={`Edit ${i.name}`}><Pencil className="h-4 w-4" /></Button>
                  <ConfirmButton size="sm" variant="ghost" title={`Delete ${i.name}?`} description="Past bills keep their copy. To keep it for later, hide it instead."
                    onConfirm={() => del.mutate(i.id, { onError: () => save.mutate({ id: i.id, active: false }) })}><Trash2 className="h-4 w-4" /></ConfirmButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {edit && <ItemDialog item={edit} cats={cats} groups={groups} outlets={outlets} onClose={() => setEdit(null)} />}
      {recipe && <RecipeDialog item={recipe} onClose={() => setRecipe(null)} />}
    </Card>
  );
};

const ItemDialog = ({ item, cats, groups, outlets, onClose }: { item: Partial<MenuItem>; cats: MenuCategory[]; groups: ModifierGroup[]; outlets: PosOutlet[]; onClose: () => void }) => {
  const save = useSaveRow("menu_items", "Item");
  const setGroups = useSetItemGroups();
  const [v, setV] = useState({
    ...item,
    groupIds: (item.menu_item_modifier_groups ?? []).sort((a, b) => a.sort - b.sort).map((g) => g.group_id),
  });
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate(
      {
        id: v.id, name: String(f.get("name")).trim(), description: String(f.get("description") ?? "").trim() || null,
        price: Number(f.get("price")), category_id: v.category_id, tax_category: v.tax_category, charge_kind: v.charge_kind,
        station: v.station ?? null, item_code: String(f.get("item_code") ?? "").trim() || null, outlet_ids: v.outlet_ids ?? [],
        active: v.active ?? true, available: v.available ?? true,
      },
      { onSuccess: (row) => setGroups.mutate({ itemId: (row as unknown as MenuItem).id, groupIds: v.groupIds }, { onSuccess: onClose }) },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item.id ? `Edit ${item.name}` : "New menu item"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1"><Label htmlFor="i-name">Name</Label><Input id="i-name" name="name" defaultValue={item.name} required /></div>
            <div className="space-y-1"><Label htmlFor="i-price">Price</Label><Input id="i-price" name="price" type="number" min={0} step="1" defaultValue={item.price} required /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="i-desc">Description (optional)</Label><Textarea id="i-desc" name="description" rows={2} defaultValue={item.description ?? ""} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={v.category_id} onValueChange={(x) => setV({ ...v, category_id: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Goes to</Label>
              <Select value={v.station ?? "default"} onValueChange={(x) => setV({ ...v, station: x === "default" ? null : (x as PosStation) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Category default</SelectItem>
                  {(Object.keys(STATIONS) as PosStation[]).map((s) => <SelectItem key={s} value={s}>{STATIONS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>On the room bill as</Label>
              <Select value={v.charge_kind} onValueChange={(x) => setV({ ...v, charge_kind: x as ChargeKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["food", "drinks", "other"] as ChargeKind[]).map((k) => <SelectItem key={k} value={k}>{CHARGE_KINDS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>VAT</Label>
              <Select value={v.tax_category} onValueChange={(x) => setV({ ...v, tax_category: x as TaxCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TAX) as TaxCategory[]).map((k) => <SelectItem key={k} value={k}>{TAX[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label htmlFor="i-code">Item code (for eTIMS, optional)</Label><Input id="i-code" name="item_code" defaultValue={item.item_code ?? ""} /></div>
          <div className="space-y-2">
            <Label>Options asked when ordering</Label>
            <div className="flex flex-wrap gap-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v.groupIds.includes(g.id)} onCheckedChange={(c) => setV({ ...v, groupIds: c ? [...v.groupIds, g.id] : v.groupIds.filter((x) => x !== g.id) })} />
                  {g.name}
                </label>
              ))}
              {!groups.length && <span className="text-sm text-slate-500">No option groups yet (Options tab).</span>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sold in</Label>
            <div className="flex flex-wrap gap-3">
              {outlets.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(v.outlet_ids ?? []).includes(o.id)}
                    onCheckedChange={(c) => setV({ ...v, outlet_ids: c ? [...(v.outlet_ids ?? []), o.id] : (v.outlet_ids ?? []).filter((x) => x !== o.id) })} />
                  {o.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">Tick none to sell it everywhere.</p>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={v.active ?? true} onCheckedChange={(x) => setV({ ...v, active: x })} />Show on the menu</label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending || !v.category_id}>Save item</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- option groups
const Groups = ({ groups }: { groups: ModifierGroup[] }) => {
  const saveG = useSaveRow("modifier_groups", "Option group");
  const delG = useDeleteRow("modifier_groups", "Option group");
  const saveO = useSaveRow("modifier_options", "Option");
  const delO = useDeleteRow("modifier_options", "Option");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Option groups</CardTitle><CardDescription>e.g. "How cooked?" (required, pick 1), "Extras" (optional, up to 3). Attach them to items in the item editor.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => {
            e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
            saveG.mutate({ name: String(f.get("name")).trim(), min_choices: Number(f.get("min")), max_choices: Number(f.get("max")), sort: groups.length + 1 }, { onSuccess: () => form.reset() });
          }}>
            <div className="space-y-1"><Label htmlFor="g-name" className="text-xs">Name</Label><Input id="g-name" name="name" placeholder="e.g. Extras" required /></div>
            <div className="space-y-1"><Label htmlFor="g-min" className="text-xs">Must pick at least</Label><Input id="g-min" name="min" type="number" min={0} defaultValue={0} className="w-24" /></div>
            <div className="space-y-1"><Label htmlFor="g-max" className="text-xs">Can pick up to</Label><Input id="g-max" name="max" type="number" min={1} defaultValue={1} className="w-24" /></div>
            <Button type="submit">Add group</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">{g.name}</CardTitle>
                <CardDescription>{g.min_choices > 0 ? `Required, pick ${g.min_choices}` : "Optional"}{g.max_choices > 1 ? ` · up to ${g.max_choices}` : ""}</CardDescription>
              </div>
              <ConfirmButton size="sm" variant="ghost" title={`Delete "${g.name}"?`} onConfirm={() => delG.mutate(g.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.modifier_options.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b pb-1">
                  <span>{o.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-slate-500">{Number(o.price_delta) ? `+${formatMoney(o.price_delta, "")}` : "free"}</span>
                    <button className="text-slate-400 hover:text-red-600" aria-label={`Remove ${o.name}`} onClick={() => delO.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              ))}
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
                saveO.mutate({ group_id: g.id, name: String(f.get("name")).trim(), price_delta: Number(f.get("price") || 0), sort: g.modifier_options.length + 1 }, { onSuccess: () => form.reset() });
              }}>
                <Input name="name" placeholder="Option" required aria-label="Option name" />
                <Input name="price" type="number" step="1" placeholder="+0" className="w-24" aria-label="Extra price" />
                <Button type="submit" size="sm">Add</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
