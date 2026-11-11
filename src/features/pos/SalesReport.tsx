import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import { useSales } from "@/hooks/usePos";
import { LoadingBlock } from "@/components/common/PageHeader";
import { POS_METHODS, addDays, formatMoney, formatMoney2, todayIn } from "@/lib/format";
import type { PosPaymentMethod } from "@/lib/db-types";

const dayStart = (d: string, tz: string) => {
  const probe = new Date(`${d}T12:00:00Z`);
  const off = new Date(probe.toLocaleString("en-US", { timeZone: tz })).getTime() - probe.getTime();
  return new Date(new Date(`${d}T00:00:00Z`).getTime() - off).toISOString();
};

/** Sales by outlet, item, payment method and staff; taxes; voids and comps (who and who approved). */
export const SalesReport = () => {
  const { hotel } = useCurrentHotel();
  const cur = hotel.currency;
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const sales = useSales(dayStart(from, hotel.timezone), dayStart(addDays(to, 1), hotel.timezone));
  const team = useTeam();
  const names = useMemo(() => new Map(team.data?.map((m) => [m.user_id, m.full_name || m.email]) ?? []), [team.data]);

  const r = useMemo(() => {
    const orders = sales.data ?? [];
    const paid = orders.filter((o) => o.status === "paid");
    const sum = (f: (o: (typeof paid)[number]) => number) => paid.reduce((s, o) => s + f(o), 0);
    const byOutlet = new Map<string, { bills: number; total: number }>();
    const byItem = new Map<string, { qty: number; total: number }>();
    const byMethod = new Map<PosPaymentMethod, number>();
    const byWaiter = new Map<string, { bills: number; total: number }>();
    paid.forEach((o) => {
      const k = o.pos_outlets?.name ?? "—";
      const e = byOutlet.get(k) ?? { bills: 0, total: 0 };
      byOutlet.set(k, { bills: e.bills + 1, total: e.total + Number(o.total) });
      const w = o.waiter_id ?? "—";
      const ew = byWaiter.get(w) ?? { bills: 0, total: 0 };
      byWaiter.set(w, { bills: ew.bills + 1, total: ew.total + Number(o.total) });
      o.pos_order_items?.filter((i) => i.status !== "void" && !i.comped).forEach((i) => {
        const ei = byItem.get(i.name) ?? { qty: 0, total: 0 };
        byItem.set(i.name, { qty: ei.qty + Number(i.quantity), total: ei.total + Number(i.gross) });
      });
      o.pos_payments?.filter((p) => !p.voided_at).forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount)));
    });
    const exceptions = orders.flatMap((o) =>
      (o.pos_order_items ?? []).filter((i) => i.status === "void" && i.sent_at || i.comped).map((i) => ({ o, i })));
    const discounts = orders.filter((o) => Number(o.discount_amount) > 0);
    return {
      paid, open: orders.filter((o) => o.status === "open"), voidBills: orders.filter((o) => o.status === "void"),
      total: sum((o) => Number(o.total)), net: sum((o) => Number(o.net_amount)), vat: sum((o) => Number(o.vat_amount)),
      levy: sum((o) => Number(o.levy_amount)), service: sum((o) => Number(o.service_charge)), discount: sum((o) => Number(o.discount_amount)),
      guests: sum((o) => o.guests),
      byOutlet: [...byOutlet.entries()].sort((a, b) => b[1].total - a[1].total),
      byItem: [...byItem.entries()].sort((a, b) => b[1].total - a[1].total),
      byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]),
      byWaiter: [...byWaiter.entries()].sort((a, b) => b[1].total - a[1].total),
      exceptions, discounts,
    };
  }, [sales.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <Button variant="outline" onClick={() => { setFrom(today); setTo(today); }}>Today</Button>
        <Button variant="outline" onClick={() => { setFrom(addDays(today, -6)); setTo(today); }}>Last 7 days</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>
      {sales.isLoading ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <K label="Sales (paid bills)" value={formatMoney(r.total, cur)} sub={`${r.paid.length} bills · ${r.guests} guests`} strong />
            <K label="Average bill" value={formatMoney(r.paid.length ? r.total / r.paid.length : 0, cur)} sub={`${formatMoney(r.guests ? r.total / r.guests : 0, cur)} per guest`} />
            <K label="Discounts given" value={formatMoney(r.discount, cur)} sub={`${r.discounts.length} bills`} />
            <K label="Still open" value={String(r.open.length)} sub={`${r.voidBills.length} voided bills`} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Simple title="By outlet" head={["Outlet", "Bills", "Sales"]} rows={r.byOutlet.map(([k, v]) => [k, String(v.bills), formatMoney(v.total, "")])} />
            <Simple title="By payment" head={["Method", "Amount"]} rows={r.byMethod.map(([k, v]) => [POS_METHODS[k], formatMoney(v, "")])} />
            <Simple title="Tax summary" head={["", cur]} rows={[
              ["Sales before tax", formatMoney2(r.net, "")], ["Service charge", formatMoney2(r.service, "")],
              ["VAT", formatMoney2(r.vat, "")], ["Tourism levy", formatMoney2(r.levy, "")], ["Total", formatMoney2(r.total, "")],
            ]} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Simple title="Top items" head={["Item", "Qty", "Sales"]} rows={r.byItem.slice(0, 15).map(([k, v]) => [k, String(v.qty), formatMoney(v.total, "")])} />
            <Simple title="By waiter" head={["Waiter", "Bills", "Sales"]} rows={r.byWaiter.map(([k, v]) => [names.get(k) ?? "—", String(v.bills), formatMoney(v.total, "")])} />
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Voids, comps and discounts</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Bill</TableHead><TableHead>What</TableHead><TableHead>Reason</TableHead><TableHead>Entered by</TableHead><TableHead>Approved by</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.exceptions.map(({ o, i }) => (
                    <TableRow key={i.id}>
                      <TableCell>#{o.number}</TableCell>
                      <TableCell>{i.comped ? "Comp" : "Void"} · {Number(i.quantity)}× {i.name}</TableCell>
                      <TableCell>{i.comp_reason ?? i.void_reason}</TableCell>
                      <TableCell>{names.get(i.added_by ?? "") ?? "—"}</TableCell>
                      <TableCell>{names.get(i.approved_by ?? "") ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatMoney(Number(i.quantity) * Number(i.unit_price), "")}</TableCell>
                    </TableRow>
                  ))}
                  {r.discounts.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>#{o.number}</TableCell>
                      <TableCell>Discount{o.discount_kind === "percent" ? ` ${Number(o.discount_value)}%` : ""}</TableCell>
                      <TableCell>{o.discount_reason}</TableCell>
                      <TableCell>{names.get(o.waiter_id ?? "") ?? "—"}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-right">{formatMoney(o.discount_amount, "")}</TableCell>
                    </TableRow>
                  ))}
                  {!r.exceptions.length && !r.discounts.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">None in this period</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const K = ({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) => (
  <Card className={strong ? "border-blue-300" : ""}><CardContent className="p-4">
    <div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-bold">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}
  </CardContent></Card>
);

const Simple = ({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
    <CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>{head.map((h, i) => <TableHead key={i} className={i ? "text-right" : ""}>{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j ? "text-right" : ""}>{c}</TableCell>)}</TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={head.length} className="text-center text-slate-500 py-4">No sales</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);
