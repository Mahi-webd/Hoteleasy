import { useEffect, useMemo, useState } from "react";
import { BedDouble, ChefHat, CheckCheck, Maximize2, Printer, ShoppingBag, Wine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useKds, usePosRealtime, usePosSetup, useSetItemStatus } from "@/hooks/usePos";
import { LoadingBlock } from "@/components/common/PageHeader";
import { minutesSince } from "@/lib/format";
import type { PosItemStatus, PosOrder, PosOrderItem, PosStation } from "@/lib/db-types";

type Lane = "sent" | "preparing" | "ready";
const LANES: { key: Lane; title: string; next: PosItemStatus; action: string }[] = [
  { key: "sent", title: "New", next: "preparing", action: "Start" },
  { key: "preparing", title: "Preparing", next: "ready", action: "Ready" },
  { key: "ready", title: "Ready to serve", next: "served", action: "Served" },
];
const LATE_MIN = 15;
const STATION_KEY = "hoteleasy.kds.station";

/** Live kitchen / bar board. Open it on a tablet or screen at each station. */
const KitchenDisplay = () => {
  usePosRealtime();
  const kds = useKds();
  const setup = usePosSetup();
  const setStatus = useSetItemStatus();
  const [station, setStation] = useState<PosStation | "all">(() => (localStorage.getItem(STATION_KEY) as PosStation) || "kitchen");
  const [outlet, setOutlet] = useState<string>("all");
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { localStorage.setItem(STATION_KEY, station); }, [station]);

  // one ticket per order per lane: an order's items split across lanes by status
  const tickets = useMemo(() => {
    const out: Record<Lane, { order: PosOrder; items: PosOrderItem[] }[]> = { sent: [], preparing: [], ready: [] };
    (kds.data ?? []).forEach((o) => {
      if (outlet !== "all" && o.outlet_id !== outlet) return;
      const items = (o.pos_order_items ?? []).filter((i) => (station === "all" ? i.station !== "none" : i.station === station));
      (["sent", "preparing", "ready"] as Lane[]).forEach((lane) => {
        const li = items.filter((i) => i.status === lane);
        if (li.length) out[lane].push({ order: o, items: li });
      });
    });
    (Object.keys(out) as Lane[]).forEach((k) => out[k].sort((a, b) => (a.items[0].sent_at ?? "").localeCompare(b.items[0].sent_at ?? "")));
    return out;
  }, [kds.data, station, outlet]);

  if (kds.isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          {station === "bar" ? <Wine className="h-6 w-6" /> : <ChefHat className="h-6 w-6" />}
          {station === "bar" ? "Bar orders" : station === "kitchen" ? "Kitchen orders" : "All orders"}
        </h2>
        <div className="flex flex-wrap gap-1">
          {(["kitchen", "bar", "all"] as const).map((s) => (
            <Button key={s} size="sm" variant={station === s ? "default" : "outline"} onClick={() => setStation(s)}>{s === "all" ? "All stations" : s === "bar" ? "Bar" : "Kitchen"}</Button>
          ))}
          <select className="h-9 rounded-md border px-2 text-sm bg-background" value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet">
            <option value="all">All outlets</option>
            {setup.data?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Full screen"><Maximize2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 items-start">
        {LANES.map((lane) => (
          <div key={lane.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-600">{lane.title}</div>
              <Badge variant="secondary">{tickets[lane.key].length}</Badge>
            </div>
            {!tickets[lane.key].length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">Nothing here</div>}
            {tickets[lane.key].map(({ order: o, items }) => {
              const mins = minutesSince(items[0].sent_at);
              const late = lane.key !== "ready" && mins >= LATE_MIN;
              const where = o.pos_tables?.name ? `Table ${o.pos_tables.name}`
                : o.order_type === "room_service" ? `Room ${o.reservations?.rooms?.room_number ?? ""}` : o.label || "Takeaway";
              return (
                <Card key={`${o.id}-${lane.key}`} className={`${late ? "border-2 border-red-500" : lane.key === "ready" ? "border-2 border-green-500" : ""}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-lg font-bold flex items-center gap-1">
                          {o.order_type === "room_service" ? <BedDouble className="h-4 w-4" /> : o.order_type === "takeaway" ? <ShoppingBag className="h-4 w-4" /> : null}
                          {where}
                        </div>
                        <div className="text-xs text-slate-500">#{o.number} · {o.pos_outlets?.name} · {o.guests} guest{o.guests === 1 ? "" : "s"}</div>
                      </div>
                      <div className={`text-sm font-semibold ${late ? "text-red-600" : "text-slate-500"}`}>{mins} min</div>
                    </div>
                    <ul className="space-y-1">
                      {items.map((i) => (
                        <li key={i.id}>
                          <button className="w-full text-left rounded px-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                            title="Tap to move just this item on" onClick={() => setStatus.mutate({ ids: [i.id], status: lane.next })}>
                            <span className="font-semibold">{Number(i.quantity)}×</span> {i.name}
                            {i.modifiers.length > 0 && <div className="text-xs text-slate-600 pl-5">{i.modifiers.map((m) => m.name).join(" · ")}</div>}
                            {i.notes && <div className="text-xs font-semibold text-red-700 pl-5">⚠ {i.notes}</div>}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button className={`flex-1 h-11 ${lane.key === "preparing" ? "bg-green-600 hover:bg-green-700" : ""}`}
                        onClick={() => setStatus.mutate({ ids: items.map((i) => i.id), status: lane.next })}>
                        {lane.key === "ready" && <CheckCheck className="mr-1 h-4 w-4" />}{lane.action}
                      </Button>
                      {lane.key === "sent" && (
                        <Button variant="outline" className="h-11" asChild aria-label="Print ticket">
                          <a href={`/pos-ticket/${o.id}?station=${station}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /></a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Tickets turn red after {LATE_MIN} minutes. Tap a single line to move just that item; the button moves the whole ticket.</p>
    </div>
  );
};

export default KitchenDisplay;
