import { useEffect, useMemo, useState, type FormEvent } from "react";
import { endOfMonth, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths } from "date-fns";
import { AlertTriangle, Ban, CheckCircle2, Download, Pencil, Plus, Receipt, Repeat, RotateCcw, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useInventory } from "@/hooks/useInventory";
import {
  useBudgets, useCopyRecurring, useExpenseCategories, useExpenses, usePayExpense, usePnl, useReopenExpense, useSaveBudget,
  useSaveCategory, useSaveExpense, useUnpaidBills, useVoidExpense, type ExpenseInput,
} from "@/hooks/useFinance";
import { EXPENSE_GROUPS, EXPENSE_METHODS, formatDate, formatMoney, friendlyError, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Expense, ExpenseCategory, ExpenseGroup, ExpenseMethod, PnlLine } from "@/lib/db-types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const m0 = (v: number) => formatMoney(v, "");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const OPEX: ExpenseGroup[] = ["payroll", "utilities", "repairs", "marketing", "admin", "other"];

const FinancePage = () => {
  const { can } = useCurrentHotel();
  const admin = can("owner", "manager");
  const [tab, setTab] = useState("pnl");
  const unpaid = useUnpaidBills();
  return (
    <div className="space-y-4">
      <PageHeader title="Expenses & profit" subtitle="What you spend, bills to pay, budgets, and profit & loss" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="pnl">Profit & loss</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="bills">Bills to pay{unpaid.data?.length ? ` (${unpaid.data.length})` : ""}</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          {admin && <TabsTrigger value="categories">Categories</TabsTrigger>}
        </TabsList>
        <TabsContent value="pnl"><Pnl onBills={() => setTab("bills")} /></TabsContent>
        <TabsContent value="expenses"><Expenses admin={admin} /></TabsContent>
        <TabsContent value="bills"><Bills admin={admin} /></TabsContent>
        <TabsContent value="budget"><BudgetGrid canEdit={admin} /></TabsContent>
        {admin && <TabsContent value="categories"><Categories /></TabsContent>}
      </Tabs>
    </div>
  );
};
export default FinancePage;

// ======================================================================= P&L
type Row = { key: string; label: string; indent?: boolean; kind?: "head" | "total" | "result"; months: Record<string, number>; budget: number | null; sign: 1 | -1 };

const buildRows = (lines: PnlLine[], cats: ExpenseCategory[], months: string[]) => {
  const pick = (f: (l: PnlLine) => boolean) => {
    const by: Record<string, number> = {};
    let budget: number | null = null;
    lines.filter(f).forEach((l) => {
      const k = l.month.slice(0, 7);
      by[k] = (by[k] ?? 0) + Number(l.actual);
      if (l.budget != null) budget = (budget ?? 0) + Number(l.budget);
    });
    return { months: by, budget };
  };
  const sum = (rows: Row[]) => {
    const by: Record<string, number> = {};
    let budget: number | null = null;
    rows.forEach((r) => {
      months.forEach((m) => { by[m] = (by[m] ?? 0) + (r.months[m] ?? 0); });
      if (r.budget != null) budget = (budget ?? 0) + r.budget;
    });
    return { months: by, budget };
  };
  const nonEmpty = (r: Row) => Object.values(r.months).some((v) => Math.abs(v) > 0.004) || r.budget != null;

  const rev: Row[] = ([["rooms", "Rooms"], ["fnb", "Food & beverage"], ["other", "Other income"]] as const)
    .map(([k, label]) => ({ key: `rev-${k}`, label, indent: true, sign: 1 as const, ...pick((l) => l.section === "revenue" && l.line === k) }));
  const revTotal: Row = { key: "rev-total", label: "Total revenue", kind: "total", sign: 1, ...sum(rev) };

  const cos: Row[] = [
    { key: "cos-sold", label: "Ingredients used (recipes)", indent: true, sign: -1 as const, ...pick((l) => l.line === "stock_sold") },
    { key: "cos-waste", label: "Stock wasted", indent: true, sign: -1 as const, ...pick((l) => l.line === "stock_waste") },
    { key: "cos-count", label: "Stock count differences", indent: true, sign: -1 as const, ...pick((l) => l.line === "stock_counts") },
    ...cats.filter((c) => c.grp === "cost_of_sales").map((c) => ({ key: `cat-${c.id}`, label: c.name, indent: true, sign: -1 as const, ...pick((l) => l.category_id === c.id) })),
  ].filter(nonEmpty);
  const cosTotal: Row = { key: "cos-total", label: "Total cost of sales", kind: "total", sign: -1, ...sum(cos) };
  const gp: Row = { key: "gp", label: "Gross profit", kind: "result", sign: 1, months: Object.fromEntries(months.map((m) => [m, (revTotal.months[m] ?? 0) - (cosTotal.months[m] ?? 0)])),
    budget: revTotal.budget != null || cosTotal.budget != null ? (revTotal.budget ?? 0) - (cosTotal.budget ?? 0) : null };

  const opex: Row[] = [];
  OPEX.forEach((g) => {
    const rows: Row[] = cats.filter((c) => c.grp === g).map((c) => ({ key: `cat-${c.id}`, label: c.name, indent: true, sign: -1 as const, ...pick((l) => l.category_id === c.id) })).filter(nonEmpty);
    if (g === "repairs") {
      const issued: Row = { key: "issued", label: "Stock issued to departments", indent: true, sign: -1, ...pick((l) => l.line === "stock_issued") };
      if (nonEmpty(issued)) rows.push(issued);
    }
    if (rows.length) opex.push({ key: `grp-${g}`, label: EXPENSE_GROUPS[g], kind: "head", sign: -1, months: {}, budget: null }, ...rows);
  });
  const opexTotal: Row = { key: "opex-total", label: "Total expenses", kind: "total", sign: -1, ...sum(opex.filter((r) => r.kind !== "head")) };
  const op: Row = { key: "op", label: "Operating profit", kind: "result", sign: 1, months: Object.fromEntries(months.map((m) => [m, (gp.months[m] ?? 0) - (opexTotal.months[m] ?? 0)])),
    budget: gp.budget != null || opexTotal.budget != null ? (gp.budget ?? 0) - (opexTotal.budget ?? 0) : null };

  return {
    sections: [
      { title: "Revenue", rows: [...rev, revTotal] },
      { title: "Cost of sales", rows: [...cos, cosTotal] },
      { title: null, rows: [gp] },
      { title: "Expenses", rows: [...opex, opexTotal] },
      { title: null, rows: [op] },
    ],
    revTotal, cosTotal, gp, opexTotal, op,
  };
};

const Pnl = ({ onBills }: { onBills: () => void }) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const t = parseISO(today);
  const presets = [
    { key: "mtd", label: "This month", r: [iso(startOfMonth(t)), today] },
    { key: "lm", label: "Last month", r: [iso(startOfMonth(subMonths(t, 1))), iso(endOfMonth(subMonths(t, 1)))] },
    { key: "qtd", label: "This quarter", r: [iso(startOfQuarter(t)), today] },
    { key: "ytd", label: "This year", r: [iso(startOfYear(t)), today] },
    { key: "12m", label: "Last 12 months", r: [iso(startOfMonth(subMonths(t, 11))), today] },
  ] as const;
  const [preset, setPreset] = useState("mtd");
  const [[from, to], setRange] = useState<[string, string]>([presets[0].r[0], presets[0].r[1]]);
  const pnl = usePnl(from, to);
  const cats = useExpenseCategories();

  const months = useMemo(() => {
    const out: string[] = [];
    let d = startOfMonth(parseISO(from));
    while (iso(d) <= to) { out.push(iso(d).slice(0, 7)); d = startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
    return out;
  }, [from, to]);
  const built = useMemo(() => (pnl.data && cats.data ? buildRows(pnl.data.lines, cats.data, months) : null), [pnl.data, cats.data, months]);
  const tot = (r: Row) => months.reduce((s, m) => s + (r.months[m] ?? 0), 0);
  const multi = months.length > 1;
  const cur = hotel.currency;

  const chart = built ? months.map((m) => ({ label: format(parseISO(`${m}-01`), "MMM yy"), Revenue: built.revTotal.months[m] ?? 0,
    Costs: (built.cosTotal.months[m] ?? 0) + (built.opexTotal.months[m] ?? 0) })) : [];

  const csv = () => {
    if (!built) return;
    const head = ["Line", ...months.map((m) => format(parseISO(`${m}-01`), "MMM yyyy")), "Total", "Budget"];
    const rows: (string | number)[][] = [];
    built.sections.forEach((s) => {
      if (s.title) rows.push([s.title.toUpperCase()]);
      s.rows.forEach((r) => rows.push([r.label, ...months.map((m) => Number((r.months[m] ?? 0).toFixed(2))), Number(tot(r).toFixed(2)), r.budget ?? ""]));
    });
    downloadCsv(`profit-and-loss_${from}_${to}`, head, rows);
  };

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-wrap items-end gap-2">
          {presets.map((p) => <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => { setPreset(p.key); setRange([p.r[0], p.r[1]]); }}>{p.label}</Button>)}
          <div className="ml-auto flex items-end gap-2">
            <div className="space-y-1"><Label htmlFor="pl-from" className="text-xs">From</Label><Input id="pl-from" type="date" value={from} max={to} className="w-40" onChange={(e) => { setPreset(""); setRange([e.target.value, to]); }} /></div>
            <div className="space-y-1"><Label htmlFor="pl-to" className="text-xs">To</Label><Input id="pl-to" type="date" value={to} min={from} className="w-40" onChange={(e) => { setPreset(""); setRange([from, e.target.value]); }} /></div>
            <Button size="sm" variant="outline" onClick={csv} disabled={!built}><Download className="mr-1 h-4 w-4" />CSV</Button>
          </div>
        </CardContent>
      </Card>
      {pnl.isLoading || cats.isLoading ? <LoadingBlock /> : pnl.error ? <Card><CardContent className="p-6 text-red-600">{friendlyError(pnl.error)}</CardContent></Card> : built && pnl.data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Revenue", tot(built.revTotal), "before VAT and levy"],
              ["Gross profit", tot(built.gp), `${pct(tot(built.gp), tot(built.revTotal))} of revenue`],
              ["Expenses", tot(built.opexTotal), `${pct(tot(built.opexTotal), tot(built.revTotal))} of revenue`],
              ["Operating profit", tot(built.op), `${pct(tot(built.op), tot(built.revTotal))} margin`],
            ].map(([l, v, sub]) => (
              <Card key={l as string}><CardContent className="p-4"><div className="text-sm text-slate-500">{l}</div>
                <div className={`text-2xl font-bold tabular-nums ${l === "Operating profit" && (v as number) < 0 ? "text-red-700" : ""}`}>{formatMoney(v as number, cur)}</div>
                <div className="text-xs text-slate-500">{sub}</div></CardContent></Card>
            ))}
          </div>

          <div className={multi ? "space-y-4" : "grid lg:grid-cols-3 gap-4"}>
            <Card className={multi ? "" : "lg:col-span-2"}>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="min-w-[220px]">{cur}, before tax</TableHead>
                    {multi && months.map((m) => <TableHead key={m} className="text-right">{format(parseISO(`${m}-01`), "MMM")}</TableHead>)}
                    <TableHead className="text-right">{multi ? "Total" : "Actual"}</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">% of revenue</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {built.sections.map((s, si) => [
                      s.title && <TableRow key={`s${si}`} className="bg-slate-50 dark:bg-slate-900/50"><TableCell colSpan={months.length + 5} className="font-semibold py-2">{s.title}</TableCell></TableRow>,
                      ...s.rows.map((r) => {
                        if (r.kind === "head") return <TableRow key={r.key}><TableCell colSpan={months.length + 5} className="text-xs uppercase text-slate-500 pt-3 pb-1">{r.label}</TableCell></TableRow>;
                        const total = tot(r);
                        const diff = r.budget != null ? (total - r.budget) * r.sign : null;
                        return (
                          <TableRow key={r.key} className={r.kind === "result" ? "bg-blue-50/60 dark:bg-blue-950/30 font-semibold" : r.kind === "total" ? "font-medium" : ""}>
                            <TableCell className={r.indent ? "pl-8" : ""}>{r.label}</TableCell>
                            {multi && months.map((m) => <TableCell key={m} className="text-right tabular-nums">{Math.abs(r.months[m] ?? 0) > 0.004 ? m0(r.months[m]) : <span className="text-slate-300">–</span>}</TableCell>)}
                            <TableCell className={`text-right tabular-nums ${r.kind === "result" && total < 0 ? "text-red-700" : ""}`}>{m0(total)}</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-500">{r.budget != null ? m0(r.budget) : ""}</TableCell>
                            <TableCell className={`text-right tabular-nums ${diff == null ? "" : diff >= 0 ? "text-emerald-700" : "text-red-700"}`}>{diff != null ? `${diff >= 0 ? "+" : ""}${m0(diff)}` : ""}</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-500">{r.key !== "rev-total" ? pct(total, tot(built.revTotal)) : ""}</TableCell>
                          </TableRow>
                        );
                      }),
                    ])}
                  </TableBody>
                </Table>
                <p className="text-xs text-slate-500 p-4">Revenue follows the same rules as Reports. Cost of sales is stock actually used (recipes, waste, counts) plus cost-of-sales expenses. Supplier bills for stock are not costs until the stock is used. Expenses are counted on the date spent, without claimable VAT. Green differences are better than budget.</p>
              </CardContent>
            </Card>
            <div className={multi ? "grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start" : "space-y-4"}>
              {multi && (
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-base">Revenue and costs by month</CardTitle></CardHeader>
                  <CardContent className="h-56 pl-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                        <Tooltip formatter={(v: number) => formatMoney(v, cur)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="Revenue" fill="#2a78d6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Costs" fill="#eb6834" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">VAT and levy for the period</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span>VAT on sales</span><span className="tabular-nums">{formatMoney(Number(pnl.data.vat.output), cur)}</span></div>
                  <div className="flex justify-between"><span>VAT on expenses (claimable)</span><span className="tabular-nums">− {formatMoney(Number(pnl.data.vat.input), cur)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Estimated VAT to pay</span><span className="tabular-nums">{formatMoney(Number(pnl.data.vat.output) - Number(pnl.data.vat.input), cur)}</span></div>
                  <div className="flex justify-between pt-2"><span>Tourism levy to pay</span><span className="tabular-nums">{formatMoney(Number(pnl.data.vat.levy), cur)}</span></div>
                  <p className="text-xs text-slate-500 pt-1">An estimate to check against your iTax return; only expenses entered with VAT are counted.</p>
                </CardContent>
              </Card>
              <Card className={Number(pnl.data.payables.overdue) > 0 ? "border-amber-300" : ""}>
                <CardHeader className="pb-2"><CardTitle className="text-base">Bills to pay (today)</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-red-700">Overdue</span><span className="tabular-nums">{formatMoney(Number(pnl.data.payables.overdue), cur)}</span></div>
                  <div className="flex justify-between"><span>Due in 7 days</span><span className="tabular-nums">{formatMoney(Number(pnl.data.payables.due_7), cur)}</span></div>
                  <div className="flex justify-between"><span>Later / no date</span><span className="tabular-nums">{formatMoney(Number(pnl.data.payables.later), cur)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>{pnl.data.payables.count} unpaid</span><span className="tabular-nums">{formatMoney(Number(pnl.data.payables.total), cur)}</span></div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={onBills}>Open bills to pay</Button>
                </CardContent>
              </Card>
              {pnl.data.paid_out.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Paid out in the period</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {pnl.data.paid_out.map((p) => <div key={p.method} className="flex justify-between"><span>{EXPENSE_METHODS[p.method]} ({p.count})</span><span className="tabular-nums">{formatMoney(Number(p.amount), cur)}</span></div>)}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ======================================================================= expenses
const statusBadge = (e: Expense, today: string) =>
  e.status === "void" ? <Badge variant="outline" className="text-slate-500 line-through">Void</Badge>
    : e.status === "paid" ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Paid</Badge>
    : e.due_on && e.due_on < today ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Overdue</Badge>
    : <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Unpaid</Badge>;

const CategorySelect = ({ cats, value, onChange, includeStock = true, allowAll }: { cats: ExpenseCategory[]; value: string; onChange: (v: string) => void; includeStock?: boolean; allowAll?: boolean }) => (
  <Select value={value || (allowAll ? "all" : "")} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
    <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose category" /></SelectTrigger>
    <SelectContent>
      {allowAll && <SelectItem value="all">All categories</SelectItem>}
      {(Object.keys(EXPENSE_GROUPS) as ExpenseGroup[]).filter((g) => includeStock || g !== "stock").map((g) => {
        const list = cats.filter((c) => c.grp === g && (c.active || c.id === value));
        return list.length ? (
          <SelectGroup key={g}><SelectLabel>{EXPENSE_GROUPS[g]}</SelectLabel>{list.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectGroup>
        ) : null;
      })}
    </SelectContent>
  </Select>
);

const Expenses = ({ admin }: { admin: boolean }) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const from = `${month}-01`, to = iso(endOfMonth(parseISO(from)));
  const list = useExpenses(from, to);
  const cats = useExpenseCategories();
  const inv = useInventory();
  const copy = useCopyRecurring();
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<ExpenseInput | null>(null);
  const [pay, setPay] = useState<Expense | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const reopen = useReopenExpense();
  const catName = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const supName = new Map((inv.data?.suppliers ?? []).map((s) => [s.id, s.name]));
  const who = (e: Expense) => (e.supplier_id ? supName.get(e.supplier_id) ?? e.payee : e.payee) ?? "—";
  const rows = (list.data ?? []).filter((e) => (!cat || e.category_id === cat) && (status === "all" || e.status === status)
    && (!q || `${e.description} ${who(e)} ${e.reference ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const live = rows.filter((e) => e.status !== "void");
  const byGroup = (Object.keys(EXPENSE_GROUPS) as ExpenseGroup[]).map((g) => ({ g, total: live.filter((e) => catName.get(e.category_id)?.grp === g).reduce((s, e) => s + Number(e.amount), 0) })).filter((x) => x.total);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" aria-label="Month" />
          <div className="w-56"><CategorySelect cats={cats.data ?? []} value={cat} onChange={setCat} allowAll /></div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="void">Void</SelectItem></SelectContent>
          </Select>
          <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" aria-label="Search expenses" />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copy.mutate(from)} disabled={copy.isPending} title="Copy last month's repeating expenses (rent, salaries…) into this month as unpaid bills">
              <Repeat className="mr-1 h-4 w-4" />Add repeating
            </Button>
            <Button variant="ghost" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`expenses_${month}`,
              ["No.", "Date", "Paid to", "Description", "Category", "Group", "Amount", "VAT", "Net", "Reference", "Status", "Paid on", "Method", "Due"],
              rows.map((e) => [e.number, e.spent_on, who(e), e.description, catName.get(e.category_id)?.name, EXPENSE_GROUPS[catName.get(e.category_id)?.grp ?? "other"],
                Number(e.amount), Number(e.vat_amount), Number(e.net_amount), e.reference, e.status, e.paid_on, e.paid_method ? EXPENSE_METHODS[e.paid_method] : "", e.due_on]))}>
              <Download className="mr-1 h-4 w-4" />CSV
            </Button>
            <Button size="sm" onClick={() => setEdit({ spent_on: today, status: "paid", paid_method: "mpesa", vat_amount: 0 })}><Plus className="mr-1 h-4 w-4" />Expense</Button>
          </div>
        </CardContent>
      </Card>
      {byGroup.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byGroup.map(({ g, total }) => <Badge key={g} variant="secondary" className="font-normal py-1">{EXPENSE_GROUPS[g]}: <b className="ml-1">{formatMoney(total, hotel.currency)}</b></Badge>)}
          <Badge variant="outline" className="py-1">Total: <b className="ml-1">{formatMoney(live.reduce((s, e) => s + Number(e.amount), 0), hotel.currency)}</b></Badge>
        </div>
      )}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {list.isLoading ? <LoadingBlock /> : (
            <Table>
              <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Date</TableHead><TableHead>Paid to</TableHead><TableHead>What for</TableHead><TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">VAT</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className={e.status === "void" ? "opacity-50" : ""}>
                    <TableCell className="text-slate-500">#{e.number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.spent_on)}</TableCell>
                    <TableCell>{who(e)}</TableCell>
                    <TableCell>{e.description}{e.recurring && <Repeat className="inline ml-1 h-3 w-3 text-slate-400" aria-label="Repeats monthly" />}
                      {e.reference && <div className="text-xs text-slate-500">Ref {e.reference}</div>}
                      {e.status === "void" && <div className="text-xs text-slate-500">Void: {e.void_reason}</div>}</TableCell>
                    <TableCell className="text-sm">{catName.get(e.category_id)?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(Number(e.amount), "")}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">{Number(e.vat_amount) ? formatMoney(Number(e.vat_amount), "") : ""}</TableCell>
                    <TableCell>{statusBadge(e, today)}{e.status === "paid" && e.paid_method && <div className="text-xs text-slate-500">{EXPENSE_METHODS[e.paid_method]}</div>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {e.status === "unpaid" && <Button size="sm" variant="outline" onClick={() => setPay(e)}>Pay</Button>}
                      {(e.status === "unpaid" || (e.status === "paid" && admin)) && <Button size="sm" variant="ghost" onClick={() => setEdit(e)} aria-label={`Edit expense ${e.number}`}><Pencil className="h-4 w-4" /></Button>}
                      {admin && e.status === "paid" && <Button size="sm" variant="ghost" onClick={() => reopen.mutate(e.id)} aria-label={`Mark expense ${e.number} unpaid`} title="Mark unpaid"><RotateCcw className="h-4 w-4" /></Button>}
                      {admin && e.status !== "void" && <Button size="sm" variant="ghost" onClick={() => setVoiding(e)} aria-label={`Void expense ${e.number}`}><Ban className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={9}><EmptyState icon={Receipt} title="No expenses this month">Add what you spend: power, water, wages, repairs, market shopping…</EmptyState></TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {edit && <ExpenseDialog e={edit} cats={cats.data ?? []} onClose={() => setEdit(null)} />}
      {pay && <PayDialog e={pay} onClose={() => setPay(null)} />}
      {voiding && <VoidDialog e={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
};

const ExpenseDialog = ({ e, cats, onClose }: { e: ExpenseInput; cats: ExpenseCategory[]; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const inv = useInventory();
  const save = useSaveExpense();
  const [f, setF] = useState<ExpenseInput>(e);
  const [vatOn, setVatOn] = useState(Number(e.vat_amount ?? 0) > 0);
  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const rate = Number(hotel.vat_rate);
  useEffect(() => {
    if (vatOn && f.amount) set("vat_amount", Math.round((Number(f.amount) * rate / (1 + rate)) * 100) / 100);
    if (!vatOn) set("vat_amount", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vatOn, f.amount, rate]);
  const isPaid = f.status === "paid";
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    save.mutate({
      id: f.id, spent_on: f.spent_on, category_id: f.category_id, supplier_id: f.supplier_id || null, payee: f.supplier_id ? null : (f.payee?.trim() || null),
      description: f.description?.trim(), amount: Number(f.amount), vat_amount: Number(f.vat_amount || 0), reference: f.reference?.trim() || null,
      recurring: !!f.recurring, status: f.status === "void" ? "void" : isPaid ? "paid" : "unpaid",
      due_on: isPaid ? null : f.due_on || null, paid_on: isPaid ? f.paid_on || f.spent_on : null, paid_method: isPaid ? f.paid_method ?? "cash" : null,
      paid_reference: isPaid ? f.paid_reference?.trim() || null : null,
    }, { onSuccess: onClose });
  };
  const sups = (inv.data?.suppliers ?? []).filter((s) => s.active || s.id === f.supplier_id);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? `Expense #${(f as Partial<Expense>).number ?? ""}` : "New expense"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="ex-date">Date</Label><Input id="ex-date" type="date" required value={f.spent_on ?? ""} onChange={(x) => set("spent_on", x.target.value)} /></div>
            <div className="space-y-1"><Label>Category</Label><CategorySelect cats={cats} value={f.category_id ?? ""} onChange={(v) => set("category_id", v)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={f.supplier_id || "none"} onValueChange={(v) => set("supplier_id", v === "none" ? null : v)}>
                <SelectTrigger aria-label="Supplier"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not a listed supplier</SelectItem>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!f.supplier_id && <div className="space-y-1"><Label htmlFor="ex-payee">Paid to</Label><Input id="ex-payee" value={f.payee ?? ""} onChange={(x) => set("payee", x.target.value)} placeholder="KPLC, landlord, fundi…" required /></div>}
          </div>
          <div className="space-y-1"><Label htmlFor="ex-desc">What for</Label><Input id="ex-desc" required value={f.description ?? ""} onChange={(x) => set("description", x.target.value)} placeholder="Electricity token, plumbing repair room 104…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="ex-amt">Amount ({hotel.currency}, total paid)</Label><Input id="ex-amt" type="number" min={0.01} step="0.01" required value={f.amount ?? ""} onChange={(x) => set("amount", x.target.value === "" ? undefined : Number(x.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="ex-ref">Invoice / receipt no.</Label><Input id="ex-ref" value={f.reference ?? ""} onChange={(x) => set("reference", x.target.value)} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md border p-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={vatOn} onCheckedChange={setVatOn} />Includes VAT I can claim (with a KRA eTIMS invoice)</label>
            {vatOn && <div className="flex items-center gap-2 text-sm">VAT <Input type="number" min={0} step="0.01" className="w-28 h-8" value={f.vat_amount ?? 0} onChange={(x) => set("vat_amount", Number(x.target.value))} aria-label="VAT amount" /></div>}
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={isPaid} onCheckedChange={(v) => set("status", v ? "paid" : "unpaid")} />{isPaid ? "Already paid" : "Not paid yet (a bill)"}</label>
            {isPaid ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Paid by</Label>
                  <Select value={f.paid_method ?? "cash"} onValueChange={(v) => set("paid_method", v as ExpenseMethod)}>
                    <SelectTrigger aria-label="Paid by"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(EXPENSE_METHODS) as ExpenseMethod[]).map((m) => <SelectItem key={m} value={m}>{EXPENSE_METHODS[m]}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1"><Label htmlFor="ex-pon" className="text-xs">On</Label><Input id="ex-pon" type="date" value={f.paid_on ?? f.spent_on ?? ""} onChange={(x) => set("paid_on", x.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="ex-pref" className="text-xs">M-Pesa / bank ref</Label><Input id="ex-pref" value={f.paid_reference ?? ""} onChange={(x) => set("paid_reference", x.target.value.toUpperCase())} /></div>
              </div>
            ) : (
              <div className="space-y-1 w-48"><Label htmlFor="ex-due" className="text-xs">Due date</Label><Input id="ex-due" type="date" value={f.due_on ?? ""} onChange={(x) => set("due_on", x.target.value)} /></div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!f.recurring} onCheckedChange={(v) => set("recurring", v)} />Repeats every month (rent, salaries, internet…)</label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending || !f.category_id}>Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const PayDialog = ({ e, onClose }: { e: Expense; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const pay = usePayExpense();
  const [method, setMethod] = useState<ExpenseMethod>("bank_transfer");
  const [on, setOn] = useState(todayIn(hotel.timezone));
  const [ref, setRef] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Pay {formatMoney(Number(e.amount), hotel.currency)}</DialogTitle><DialogDescription>{e.description}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Paid by</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as ExpenseMethod)}><SelectTrigger aria-label="Paid by"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(EXPENSE_METHODS) as ExpenseMethod[]).map((m) => <SelectItem key={m} value={m}>{EXPENSE_METHODS[m]}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="pd-on">Paid on</Label><Input id="pd-on" type="date" value={on} onChange={(x) => setOn(x.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pd-ref">M-Pesa / bank reference</Label><Input id="pd-ref" value={ref} onChange={(x) => setRef(x.target.value.toUpperCase())} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pay.isPending} onClick={() => pay.mutate({ id: e.id, paid_on: on, paid_method: method, paid_reference: ref }, { onSuccess: onClose })}><CheckCircle2 className="mr-1 h-4 w-4" />Mark paid</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const VoidDialog = ({ e, onClose }: { e: Expense; onClose: () => void }) => {
  const v = useVoidExpense();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Void expense #{e.number}?</DialogTitle><DialogDescription>It stays in the list, crossed out, and leaves the totals. This can't be undone.</DialogDescription></DialogHeader>
        <Input autoFocus value={reason} onChange={(x) => setReason(x.target.value)} placeholder="Reason, e.g. entered twice" aria-label="Reason" />
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || v.isPending} onClick={() => v.mutate({ id: e.id, reason: reason.trim() }, { onSuccess: onClose })}>Void</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ======================================================================= bills
const Bills = ({ admin }: { admin: boolean }) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const bills = useUnpaidBills();
  const cats = useExpenseCategories();
  const inv = useInventory();
  const [pay, setPay] = useState<Expense | null>(null);
  const [edit, setEdit] = useState<Expense | null>(null);
  if (bills.isLoading) return <LoadingBlock />;
  const list = bills.data ?? [];
  const supName = new Map((inv.data?.suppliers ?? []).map((s) => [s.id, s.name]));
  const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name]));
  const in7 = iso(new Date(parseISO(today).getTime() + 7 * 86400000));
  const sumOf = (xs: Expense[]) => xs.reduce((s, e) => s + Number(e.amount), 0);
  const overdue = list.filter((e) => e.due_on && e.due_on < today);
  const soon = list.filter((e) => e.due_on && e.due_on >= today && e.due_on <= in7);
  const bySupplier = new Map<string, number>();
  list.forEach((e) => { const k = (e.supplier_id ? supName.get(e.supplier_id) : e.payee) ?? "—"; bySupplier.set(k, (bySupplier.get(k) ?? 0) + Number(e.amount)); });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={overdue.length ? "border-red-200" : ""}><CardContent className="p-4"><div className="text-sm text-red-700 flex items-center gap-1">{overdue.length > 0 && <AlertTriangle className="h-4 w-4" />}Overdue</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney(sumOf(overdue), hotel.currency)}</div><div className="text-xs text-slate-500">{overdue.length} bill{overdue.length === 1 ? "" : "s"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Due in the next 7 days</div><div className="text-2xl font-bold tabular-nums">{formatMoney(sumOf(soon), hotel.currency)}</div><div className="text-xs text-slate-500">{soon.length} bill{soon.length === 1 ? "" : "s"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">All unpaid</div><div className="text-2xl font-bold tabular-nums">{formatMoney(sumOf(list), hotel.currency)}</div><div className="text-xs text-slate-500">{list.length} bill{list.length === 1 ? "" : "s"}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-sm space-y-0.5"><div className="text-slate-500">Most owed to</div>
          {[...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><span className="truncate">{k}</span><span className="tabular-nums">{formatMoney(v, "")}</span></div>)}
          {!list.length && <span className="text-slate-500">Nobody</span>}</CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Unpaid bills</CardTitle>
          <CardDescription>Supplier bills and expenses not paid yet, earliest due first. Bills for deliveries can be added when you receive goods in Inventory.</CardDescription></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Due</TableHead><TableHead>Owed to</TableHead><TableHead>What for</TableHead><TableHead>Category</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.map((e) => {
                const late = e.due_on && e.due_on < today;
                const days = e.due_on ? Math.round((parseISO(e.due_on).getTime() - parseISO(today).getTime()) / 86400000) : null;
                return (
                  <TableRow key={e.id} className={late ? "bg-red-50/50 dark:bg-red-950/20" : ""}>
                    <TableCell className="whitespace-nowrap">{e.due_on ? formatDate(e.due_on) : "—"}
                      {days != null && <div className={`text-xs ${late ? "text-red-700" : "text-slate-500"}`}>{days < 0 ? `${-days} day${days === -1 ? "" : "s"} late` : days === 0 ? "Today" : `in ${days} day${days === 1 ? "" : "s"}`}</div>}</TableCell>
                    <TableCell>{(e.supplier_id ? supName.get(e.supplier_id) : e.payee) ?? "—"}</TableCell>
                    <TableCell>{e.description}{e.reference && <div className="text-xs text-slate-500">Ref {e.reference}</div>}</TableCell>
                    <TableCell className="text-sm">{catName.get(e.category_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.spent_on)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(Number(e.amount), "")}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" onClick={() => setPay(e)}><Wallet className="mr-1 h-4 w-4" />Pay</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(e)} aria-label={`Edit bill ${e.number}`}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!list.length && <TableRow><TableCell colSpan={7}><EmptyState icon={CheckCircle2} title="No unpaid bills" /></TableCell></TableRow>}
            </TableBody>
            {list.length > 0 && <TableFooter><TableRow><TableCell colSpan={5}>Total</TableCell><TableCell className="text-right">{formatMoney(sumOf(list), hotel.currency)}</TableCell><TableCell /></TableRow></TableFooter>}
          </Table>
        </CardContent>
      </Card>
      {pay && <PayDialog e={pay} onClose={() => setPay(null)} />}
      {edit && <ExpenseDialog e={edit} cats={cats.data ?? []} onClose={() => setEdit(null)} />}
      {!admin && <p className="text-xs text-slate-500">Owners and managers can void bills or reopen paid ones.</p>}
    </div>
  );
};

// ======================================================================= budget
const BudgetGrid = ({ canEdit }: { canEdit: boolean }) => {
  const { hotel } = useCurrentHotel();
  const [year, setYear] = useState(Number(todayIn(hotel.timezone).slice(0, 4)));
  const budgets = useBudgets(year);
  const cats = useExpenseCategories();
  const save = useSaveBudget();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
  const find = (month: string, row: { cat?: string; rev?: string }) =>
    (budgets.data ?? []).find((b) => b.month === month && (row.cat ? b.category_id === row.cat : b.revenue_grp === row.rev));
  if (budgets.isLoading || cats.isLoading) return <LoadingBlock />;
  const rows: { key: string; label: string; cat?: string; rev?: string; head?: string }[] = [
    { key: "h-rev", label: "Revenue targets", head: "rev" },
    { key: "r-rooms", label: "Rooms", rev: "rooms" }, { key: "r-fnb", label: "Food & beverage", rev: "fnb" }, { key: "r-other", label: "Other income", rev: "other" },
    ...(["cost_of_sales", ...OPEX] as ExpenseGroup[]).flatMap((g) => {
      const list = (cats.data ?? []).filter((c) => c.grp === g && c.active);
      return list.length ? [{ key: `h-${g}`, label: EXPENSE_GROUPS[g], head: g }, ...list.map((c) => ({ key: c.id, label: c.name, cat: c.id }))] : [];
    }),
  ];
  const setCell = (month: string, row: { cat?: string; rev?: string }, raw: string) => {
    const existing = find(month, row);
    const amount = raw.trim() === "" ? null : Number(raw);
    if (amount != null && (Number.isNaN(amount) || amount < 0)) return;
    if ((existing?.amount ?? null) === amount || (existing && amount != null && Number(existing.amount) === amount)) return;
    save.mutate({ id: existing?.id, month, category_id: row.cat ?? null, revenue_grp: row.rev ?? null, amount });
  };
  const fill = (row: { cat?: string; rev?: string; label: string }) => {
    const v = window.prompt(`Monthly budget for ${row.label} (every month of ${year}):`);
    if (v == null || v.trim() === "" || Number.isNaN(Number(v))) return;
    months.forEach((m) => setCell(m, row, v));
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-lg">Budget {year}</CardTitle>
          <CardDescription>{canEdit ? "Type a monthly amount (before VAT); it saves when you leave the box. Profit & loss compares actuals with these." : "Owners and managers set the budget."}</CardDescription></div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setYear(year - 1)}>{year - 1}</Button>
          <Button size="sm" variant="outline" onClick={() => setYear(year + 1)}>{year + 1}</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead className="min-w-[200px] sticky left-0 bg-white dark:bg-slate-950">Line</TableHead>
            {months.map((m) => <TableHead key={m} className="text-right min-w-[92px]">{format(parseISO(m), "MMM")}</TableHead>)}<TableHead className="text-right">Year</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => r.head ? (
              <TableRow key={r.key} className="bg-slate-50 dark:bg-slate-900/50"><TableCell colSpan={15} className="text-xs uppercase font-semibold text-slate-500 py-1.5"><span className="sticky left-4">{r.label}</span></TableCell></TableRow>
            ) : (
              <TableRow key={r.key}>
                <TableCell className="sticky left-0 bg-white dark:bg-slate-950">{r.label}</TableCell>
                {months.map((m) => {
                  const b = find(m, r);
                  return (
                    <TableCell key={m} className="p-1">
                      {canEdit ? (
                        <Input key={`${b?.id ?? "n"}-${b?.amount ?? ""}`} type="number" min={0} inputMode="decimal" defaultValue={b ? Number(b.amount) : ""} className="h-8 text-right px-1"
                          aria-label={`${r.label} ${format(parseISO(m), "MMMM")}`} onBlur={(x) => setCell(m, r, x.target.value)} />
                      ) : <div className="text-right tabular-nums text-sm">{b ? m0(Number(b.amount)) : ""}</div>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right tabular-nums font-medium">{m0(months.reduce((s, m) => s + Number(find(m, r)?.amount ?? 0), 0))}</TableCell>
                {canEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => fill(r)} title="Same amount every month">Fill</Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// ======================================================================= categories
const Categories = () => {
  const cats = useExpenseCategories();
  const save = useSaveCategory();
  const [edit, setEdit] = useState<Partial<ExpenseCategory> | null>(null);
  if (cats.isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle className="text-lg">Expense categories</CardTitle><CardDescription>The group decides where a category appears in profit & loss.</CardDescription></div>
        <Button size="sm" onClick={() => setEdit({ grp: "other", active: true, sort: 100 })}><Plus className="mr-1 h-4 w-4" />Category</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(cats.data ?? []).map((c) => (
              <TableRow key={c.id} className={!c.active ? "opacity-50" : ""}>
                <TableCell>{c.name}</TableCell><TableCell>{EXPENSE_GROUPS[c.grp]}</TableCell>
                <TableCell>{c.active ? <Badge variant="secondary">In use</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {edit && (
        <Dialog open onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{edit.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="ec-n">Name</Label><Input id="ec-n" value={edit.name ?? ""} onChange={(x) => setEdit({ ...edit, name: x.target.value })} /></div>
              <div className="space-y-1"><Label>Group</Label>
                <Select value={edit.grp} onValueChange={(v) => setEdit({ ...edit, grp: v as ExpenseGroup })}><SelectTrigger aria-label="Group"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(EXPENSE_GROUPS) as ExpenseGroup[]).map((g) => <SelectItem key={g} value={g}>{EXPENSE_GROUPS[g]}</SelectItem>)}</SelectContent></Select></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active ?? true} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />In use</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button disabled={!edit.name?.trim() || save.isPending} onClick={() => save.mutate({ id: edit.id, name: edit.name!.trim(), grp: edit.grp, active: edit.active ?? true, sort: edit.sort ?? 100 }, { onSuccess: () => setEdit(null) })}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
