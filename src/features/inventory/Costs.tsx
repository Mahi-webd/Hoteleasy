import { useState } from "react";
import { startOfMonth, parseISO, format } from "date-fns";
import { Download, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useCostReport } from "@/hooks/useInventory";
import { MOVE_KINDS, addDays, formatMoney, friendlyError, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

const pct = (a: number, b: number) => (b && a ? `${((a / b) * 100).toFixed(1)}%` : "—");
const KIND = { food: "Food", drinks: "Drinks", other: "Other", service: "Service" } as Record<string, string>;

export const StockCosts = () => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(format(startOfMonth(parseISO(today)), "yyyy-MM-dd"));
  const [to, setTo] = useState(today);
  const r = useCostReport(from, to);
  const cur = hotel.currency;
  const preset = (f: string, t: string) => { setFrom(f); setTo(t); };

  const d = r.data;
  const sales = d?.outlets.reduce((s, o) => s + Number(o.sales), 0) ?? 0;
  const cost = d?.outlets.reduce((s, o) => s + Number(o.cost), 0) ?? 0;
  const byKind = (k: string) => d?.outlets.filter((o) => o.kind === k).reduce((s, o) => ({ sales: s.sales + Number(o.sales), cost: s.cost + Number(o.cost) }), { sales: 0, cost: 0 }) ?? { sales: 0, cost: 0 };
  const food = byKind("food"), drinks = byKind("drinks");
  const mv = (k: string) => -(d?.movements.filter((m) => m.kind === k).reduce((s, m) => s + Number(m.value), 0) ?? 0) || 0;
  const purchases = d?.purchases.reduce((s, p) => s + Number(p.value), 0) ?? 0;
  const stockValue = d?.stock_value.reduce((s, x) => s + Number(x.value), 0) ?? 0;
  const noRecipe = d?.items.filter((i) => !i.has_recipe).length ?? 0;
  const stat = (label: string, value: string, sub?: string) => (
    <Card><CardContent className="p-4"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-bold tabular-nums">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" onClick={() => preset(addDays(today, -6), today)}>Last 7 days</Button>
          <Button size="sm" variant="outline" onClick={() => preset(format(startOfMonth(parseISO(today)), "yyyy-MM-dd"), today)}>This month</Button>
          <Button size="sm" variant="outline" onClick={() => preset(addDays(today, -29), today)}>Last 30 days</Button>
          <div className="space-y-1 ml-auto"><Label htmlFor="ic-from" className="text-xs">From</Label><Input id="ic-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label htmlFor="ic-to" className="text-xs">To</Label><Input id="ic-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </CardContent>
      </Card>
      {r.isLoading ? <LoadingBlock /> : r.error ? <Card><CardContent className="p-6 text-red-600">{friendlyError(r.error)}</CardContent></Card> : d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stat("Food cost", pct(food.cost, food.sales), `${formatMoney(food.cost, cur)} on ${formatMoney(food.sales, cur)} food sales`)}
            {stat("Drinks cost", pct(drinks.cost, drinks.sales), `${formatMoney(drinks.cost, cur)} on ${formatMoney(drinks.sales, cur)} drinks sales`)}
            {stat("Waste", formatMoney(mv("waste"), cur), `Count differences ${formatMoney(-mv("adjust") || 0, cur)}`)}
            {stat("Bought", formatMoney(purchases, cur), `Stock on hand now ${formatMoney(stockValue, cur)}`)}
          </div>
          {noRecipe > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-md p-3 flex gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              {noRecipe} item{noRecipe === 1 ? "" : "s"} sold in this period {noRecipe === 1 ? "has" : "have"} no recipe, so {noRecipe === 1 ? "its" : "their"} cost counts as zero.
              Add recipes in Restaurant & Bar POS → Setup → Items.
            </p>
          )}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Cost of sales by outlet</CardTitle>
                <CardDescription>Recipe cost of what was sold, against sales before tax. Items sold before their recipe was added count at zero.</CardDescription></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Outlet</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Cost %</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.outlets.map((o) => (
                      <TableRow key={o.outlet + o.kind}><TableCell>{o.outlet}</TableCell><TableCell>{KIND[o.kind] ?? o.kind}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(o.sales), "")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(o.cost), "")}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(Number(o.cost), Number(o.sales))}</TableCell></TableRow>
                    ))}
                    {!d.outlets.length && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">No paid bills in this period</TableCell></TableRow>}
                  </TableBody>
                  {d.outlets.length > 0 && <TableFooter><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{formatMoney(sales, "")}</TableCell>
                    <TableCell className="text-right">{formatMoney(cost, "")}</TableCell><TableCell className="text-right">{pct(cost, sales)}</TableCell></TableRow></TableFooter>}
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Stock used and lost</CardTitle><CardDescription>Value of stock movements in the period, by store</CardDescription></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Store</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.movements.filter((m) => !["transfer_in", "transfer_out"].includes(m.kind)).map((m) => (
                      <TableRow key={m.location + m.kind}><TableCell>{m.location}</TableCell><TableCell>{MOVE_KINDS[m.kind]}</TableCell>
                        <TableCell className={`text-right tabular-nums ${Number(m.value) < 0 ? "text-red-700 dark:text-red-400" : ""}`}>{formatMoney(Number(m.value), "")}</TableCell></TableRow>
                    ))}
                    {!d.movements.length && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-6">No stock movements</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div><CardTitle className="text-lg">Menu items: margin</CardTitle><CardDescription>Price, recipe cost and profit for each item sold. High cost % items are candidates for a price or recipe change.</CardDescription></div>
              <Button size="sm" variant="ghost" onClick={() => downloadCsv(`menu-margins_${from}_${to}`, ["Item", "Type", "Sold", "Sales", "Cost", "Cost %", "Profit", "Has recipe"],
                d.items.map((i) => [i.item, KIND[i.kind] ?? i.kind, Number(i.qty), Number(i.sales), Number(i.cost), Number(i.sales) ? Number((Number(i.cost) / Number(i.sales) * 100).toFixed(1)) : "", Number(i.sales) - Number(i.cost), i.has_recipe ? "yes" : "no"]))}>
                <Download className="mr-1 h-4 w-4" />CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Cost %</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.items.map((i) => {
                    const c = Number(i.sales) ? Number(i.cost) / Number(i.sales) : 0;
                    return (
                      <TableRow key={i.item + i.kind}>
                        <TableCell>{i.item}{!i.has_recipe && <Badge variant="outline" className="ml-2 text-amber-800 border-amber-300">no recipe</Badge>}</TableCell>
                        <TableCell className="text-right">{Number(i.qty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(i.sales), "")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(i.cost), "")}</TableCell>
                        <TableCell className={`text-right tabular-nums ${c > 0.4 ? "text-red-700 font-medium" : ""}`}>{pct(Number(i.cost), Number(i.sales))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(Number(i.sales) - Number(i.cost), "")}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!d.items.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Nothing sold in this period</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Purchases by supplier</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Deliveries</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.purchases.map((p) => <TableRow key={p.supplier}><TableCell>{p.supplier}</TableCell><TableCell className="text-right">{p.deliveries}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(Number(p.value), "")}</TableCell></TableRow>)}
                    {!d.purchases.length && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-6">No deliveries received</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Stock on hand now</CardTitle><CardDescription>At average cost</CardDescription></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Store</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.stock_value.map((s) => <TableRow key={s.location}><TableCell>{s.location}</TableCell><TableCell className="text-right">{s.items}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(Number(s.value), "")}</TableCell></TableRow>)}
                  </TableBody>
                  <TableFooter><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{formatMoney(stockValue, cur)}</TableCell></TableRow></TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>
          {d.comps > 0 && <p className="text-xs text-slate-500">Voided and comped items that had already been made cost {formatMoney(Number(d.comps), cur)} in ingredients.</p>}
        </>
      )}
    </div>
  );
};
