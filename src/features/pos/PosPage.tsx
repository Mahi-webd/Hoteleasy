import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BedDouble, Clock, KeyRound, Plus, Settings2, ShoppingBag, UtensilsCrossed, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  useCreateOrder, useHasPin, useInHouseGuests, useMyShift, useOpenOrders, usePosRealtime, usePosSetup, useRecentClosed, useSetupDefaults,
} from "@/hooks/usePos";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { formatMoney, guestName, minutesSince } from "@/lib/format";
import type { PosOrder, PosTable } from "@/lib/db-types";
import { OrderScreen, orderTitle } from "./OrderScreen";
import { ShiftPanel } from "./ShiftPanel";
import { SalesReport } from "./SalesReport";
import { PosSetup, SetPinCard } from "./PosSetup";

const OUTLET_KEY = "hoteleasy.pos.outlet";

const PosPage = () => {
  usePosRealtime();
  const { can } = useCurrentHotel();
  const isManager = can("owner", "manager");
  const setup = usePosSetup();
  const defaults = useSetupDefaults();
  const shift = useMyShift();
  const hasPin = useHasPin();
  const [tab, setTab] = useState("floor");
  const [outletId, setOutletId] = useState<string | null>(() => localStorage.getItem(OUTLET_KEY));
  const [orderId, setOrderId] = useState<string | null>(null);

  const outlets = (setup.data?.outlets ?? []).filter((o) => o.active);
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];
  useEffect(() => { if (outlet) localStorage.setItem(OUTLET_KEY, outlet.id); }, [outlet]);

  if (setup.isLoading) return <LoadingBlock />;

  if (!outlets.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Restaurant & Bar POS" subtitle="Orders, kitchen screens, bills and room charges" />
        <Card><CardContent className="py-10 text-center space-y-4">
          <UtensilsCrossed className="h-10 w-10 mx-auto text-slate-300" />
          <div className="font-semibold text-lg">Set up your outlets to start</div>
          <p className="text-slate-600 max-w-md mx-auto text-sm">
            We'll create a Restaurant (10 tables), Bar (6), Room service and Pool bar (4), with a sample Kenyan menu you can edit or delete.
          </p>
          {isManager ? (
            <div className="flex justify-center gap-2">
              <Button onClick={() => defaults.mutate(true)} disabled={defaults.isPending}>Set up with sample menu</Button>
              <Button variant="outline" onClick={() => defaults.mutate(false)} disabled={defaults.isPending}>Outlets only, empty menu</Button>
            </div>
          ) : <p className="text-sm text-slate-500">Ask a manager to set up the POS.</p>}
        </CardContent></Card>
      </div>
    );
  }

  if (orderId) return <OrderScreen orderId={orderId} onBack={() => setOrderId(null)} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Restaurant & Bar POS"
        subtitle="Tap a table to open or continue its bill"
        actions={
          <div className="flex flex-wrap gap-1">
            {outlets.map((o) => (
              <Button key={o.id} size="sm" variant={o.id === outlet?.id ? "default" : "outline"} onClick={() => { setOutletId(o.id); setTab("floor"); }}>
                {o.name}
              </Button>
            ))}
          </div>
        }
      />

      {!shift.isLoading && !shift.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><Wallet className="h-4 w-4" />You can take orders, but open your cash shift before taking payment.</span>
          <Button size="sm" variant="outline" onClick={() => setTab("shift")}>Open shift</Button>
        </div>
      )}
      {isManager && hasPin.data === false && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Set your approval PIN so you can approve voids and discounts on a waiter's screen.</span>
          <Button size="sm" variant="outline" onClick={() => setTab("setup")}>Set PIN</Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="floor"><UtensilsCrossed className="mr-1 h-4 w-4" />{outlet?.name}</TabsTrigger>
          <TabsTrigger value="shift"><Clock className="mr-1 h-4 w-4" />Shift{shift.data ? " · open" : ""}</TabsTrigger>
          {can("owner", "manager", "accountant", "front_desk") && <TabsTrigger value="sales">Sales</TabsTrigger>}
          {isManager && <TabsTrigger value="setup"><Settings2 className="mr-1 h-4 w-4" />Setup</TabsTrigger>}
        </TabsList>
        <TabsContent value="floor">{outlet && <Floor outletId={outlet.id} tables={setup.data!.tables.filter((t) => t.outlet_id === outlet.id && t.active)} kind={outlet.kind} onOpen={setOrderId} />}</TabsContent>
        <TabsContent value="shift"><ShiftPanel /></TabsContent>
        <TabsContent value="sales"><SalesReport /></TabsContent>
        <TabsContent value="setup" className="space-y-6"><SetPinCard /><PosSetup /></TabsContent>
      </Tabs>
    </div>
  );
};

const Floor = ({ outletId, tables, kind, onOpen }: { outletId: string; tables: PosTable[]; kind: string; onOpen: (id: string) => void }) => {
  const { hotel } = useCurrentHotel();
  const open = useOpenOrders(outletId);
  const closed = useRecentClosed(outletId);
  const create = useCreateOrder();
  const [newFor, setNewFor] = useState<{ kind: "table"; table: PosTable } | { kind: "takeaway" } | { kind: "room" } | null>(null);
  const byTable = useMemo(() => new Map((open.data ?? []).filter((o) => o.table_id).map((o) => [o.table_id!, o])), [open.data]);
  const others = (open.data ?? []).filter((o) => !o.table_id);

  const start = (o: Parameters<typeof create.mutate>[0]) => create.mutate(o, { onSuccess: (r) => { setNewFor(null); onOpen(r.id); } });

  if (open.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setNewFor({ kind: "takeaway" })}><ShoppingBag className="mr-2 h-4 w-4" />Walk-in / takeaway</Button>
        <Button variant="outline" onClick={() => setNewFor({ kind: "room" })}><BedDouble className="mr-2 h-4 w-4" />{kind === "room_service" ? "New room-service order" : "Order for a hotel guest"}</Button>
      </div>

      {tables.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-500 mb-2">Tables</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
            {tables.map((t) => {
              const o = byTable.get(t.id);
              const ready = o?.pos_order_items?.some((i) => i.status === "ready");
              const unsent = o?.pos_order_items?.some((i) => i.status === "new");
              return (
                <button key={t.id} onClick={() => (o ? onOpen(o.id) : setNewFor({ kind: "table", table: t }))}
                  aria-label={`Table ${t.name}, ${o ? `bill open, ${formatMoney(o.total, hotel.currency)}` : "free"}`}
                  className={`aspect-square rounded-xl border-2 p-2 flex flex-col items-center justify-center text-center transition hover:shadow-md ${o ? (ready ? "border-green-500 bg-green-50" : "border-blue-500 bg-blue-50 dark:bg-slate-800") : "border-slate-200 bg-white dark:bg-slate-900"}`}>
                  <div className="text-xl font-bold">{t.name}</div>
                  {o ? (
                    <>
                      <div className="text-xs font-medium">{formatMoney(o.total, "")}</div>
                      <div className="text-[10px] text-slate-500">{minutesSince(o.opened_at)} min{ready ? " · food ready" : unsent ? " · not sent" : ""}</div>
                    </>
                  ) : <div className="text-[10px] text-slate-400">{t.seats} seats · free</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-slate-500 mb-2">Other open bills ({others.length})</div>
        {!others.length ? <p className="text-sm text-slate-400">None.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {others.map((o) => <BillCard key={o.id} o={o} currency={hotel.currency} onOpen={onOpen} />)}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-500 mb-2">Closed in the last 24 hours</div>
        {!closed.data?.length ? <p className="text-sm text-slate-400">None yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {closed.data.map((o) => (
              <button key={o.id} onClick={() => onOpen(o.id)} className="rounded-md border px-3 py-2 text-left text-sm bg-white dark:bg-slate-900 hover:shadow-sm">
                <span className="font-medium">#{o.number}</span> · {orderTitle(o)} · {formatMoney(o.total, "")}
                <Badge variant="outline" className="ml-2 text-[10px]">{o.status === "void" ? "Void" : o.pos_payments?.some((p) => p.method === "room" && !p.voided_at) ? "To room" : "Paid"}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {newFor && <NewBillDialog mode={newFor} outletId={outletId} busy={create.isPending} onStart={start} onClose={() => setNewFor(null)} />}
    </div>
  );
};

const BillCard = ({ o, currency, onOpen }: { o: PosOrder; currency: string; onOpen: (id: string) => void }) => (
  <button onClick={() => onOpen(o.id)} className="text-left">
    <Card className="hover:shadow-md transition">
      <CardContent className="p-3">
        <div className="flex justify-between"><span className="font-semibold">{orderTitle(o)}</span><span className="text-xs text-slate-400">#{o.number}</span></div>
        {o.reservations && <div className="text-xs text-slate-500">{guestName(o.reservations.guests)}</div>}
        <div className="flex justify-between mt-1 text-sm"><span className="text-slate-500">{minutesSince(o.opened_at)} min</span><span className="font-medium">{formatMoney(o.total, currency)}</span></div>
      </CardContent>
    </Card>
  </button>
);

const NewBillDialog = ({
  mode, outletId, busy, onStart, onClose,
}: {
  mode: { kind: "table"; table: PosTable } | { kind: "takeaway" } | { kind: "room" }; outletId: string; busy: boolean;
  onStart: (o: { outlet_id: string; table_id?: string | null; order_type: string; guests: number; label?: string | null; reservation_id?: string | null }) => void;
  onClose: () => void;
}) => {
  const guests = useInHouseGuests();
  const [n, setN] = useState(mode.kind === "table" ? Math.min(2, mode.table.seats) : 1);
  const [label, setLabel] = useState("");
  const [res, setRes] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode.kind === "table") onStart({ outlet_id: outletId, table_id: mode.table.id, order_type: "dine_in", guests: n });
    else if (mode.kind === "takeaway") onStart({ outlet_id: outletId, order_type: "takeaway", guests: n, label: label.trim() || null });
    else onStart({ outlet_id: outletId, order_type: "room_service", guests: n, reservation_id: res });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode.kind === "table" ? `New bill · table ${mode.table.name}` : mode.kind === "takeaway" ? "Walk-in / takeaway" : "Order for a hotel guest"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {mode.kind === "takeaway" && (
            <div className="space-y-1"><Label htmlFor="nb-label">Name (optional)</Label><Input id="nb-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kevin, Pool lounger 4" /></div>
          )}
          {mode.kind === "room" && (
            <div className="space-y-1">
              <Label>Guest</Label>
              <select className="w-full h-10 rounded-md border px-3 bg-background" value={res} onChange={(e) => setRes(e.target.value)} required>
                <option value="">Choose a checked-in guest</option>
                {[...(guests.data ?? [])].sort((a, b) => (a.rooms?.room_number ?? "").localeCompare(b.rooms?.room_number ?? "", undefined, { numeric: true }))
                  .map((g) => <option key={g.id} value={g.id}>Room {g.rooms?.room_number} · {guestName(g.guests)}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Guests</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((k) => (
                <button type="button" key={k} onClick={() => setN(k)} className={`h-10 w-10 rounded-md border ${n === k ? "bg-blue-600 text-white border-blue-600" : ""}`}>{k}</button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || (mode.kind === "room" && !res)}><Plus className="mr-1 h-4 w-4" />Start bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PosPage;
