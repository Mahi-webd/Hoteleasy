import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Info, Printer } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useReport, type DailyRow, type PeriodReport } from "@/hooks/useReports";
import {
  CHARGE_KINDS, PAYMENT_METHODS, POS_METHODS, OUTLET_KINDS, RES_STATUS, SOURCE_LABELS,
  addDays, formatDate, formatMoney, formatMoney2, friendlyError, todayIn,
} from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { BookingSource, ChargeKind, OutletKind, ReservationStatus } from "@/lib/db-types";

// Categorical slots 1–3 (validated palette), light and dark steps.
const SERIES = {
  light: { rooms: "#2a78d6", fnb: "#eb6834", other: "#1baf7a", occ: "#2a78d6", grid: "#e5e7eb", surface: "#ffffff" },
  dark: { rooms: "#3987e5", fnb: "#d95926", other: "#199e70", occ: "#3987e5", grid: "#334155", surface: "#0f172a" },
};
const GROUP_LABEL = { rooms: "Rooms", fnb: "Food & beverage", other: "Other income" } as const;

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

const deptLabel = (dept: string) =>
  dept === "service_charge" ? "Service charge (POS)" : CHARGE_KINDS[dept as ChargeKind] ?? dept;
const methodLabel = (source: string, m: string) =>
  source === "pos" ? POS_METHODS[m as keyof typeof POS_METHODS] ?? m : PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m;

const useIsDark = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
};

type Preset = { key: string; label: string; range: (today: string) => [string, string] };
const PRESETS: Preset[] = [
  { key: "today", label: "Today", range: (t) => [t, t] },
  { key: "yesterday", label: "Yesterday", range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: "7d", label: "Last 7 days", range: (t) => [addDays(t, -6), t] },
  { key: "30d", label: "Last 30 days", range: (t) => [addDays(t, -29), t] },
  { key: "mtd", label: "This month", range: (t) => [iso(startOfMonth(parseISO(t))), t] },
  { key: "lm", label: "Last month", range: (t) => {
    const m = subMonths(parseISO(t), 1);
    return [iso(startOfMonth(m)), iso(endOfMonth(m))];
  } },
  { key: "ytd", label: "This year", range: (t) => [iso(startOfYear(parseISO(t))), t] },
];

/** Daily rows rolled up to months for long periods. */
const bucket = (rows: DailyRow[], monthly: boolean) => {
  if (!monthly) return rows.map((r) => ({ ...r, label: format(parseISO(r.date), "d MMM"), days: 1 }));
  const m = new Map<string, DailyRow & { label: string; days: number }>();
  rows.forEach((r) => {
    const k = r.date.slice(0, 7);
    const e = m.get(k) ?? { ...r, date: k, label: format(parseISO(r.date), "MMM yyyy"), days: 0,
      rooms_sold: 0, occupancy: 0, room_revenue: 0, fnb_revenue: 0, other_revenue: 0, vat: 0, levy: 0, collected: 0 };
    e.days += 1;
    e.rooms_sold += r.rooms_sold; e.occupancy += r.occupancy;
    e.room_revenue += r.room_revenue; e.fnb_revenue += r.fnb_revenue; e.other_revenue += r.other_revenue;
    e.vat += r.vat; e.levy += r.levy; e.collected += r.collected;
    m.set(k, e);
  });
  return [...m.values()].map((e) => ({ ...e, occupancy: e.days ? e.occupancy / e.days : 0 }));
};

const ReportsPage = () => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [preset, setPreset] = useState("mtd");
  const [[from, to], setRange] = useState<[string, string]>(() => PRESETS[4].range(today));
  const report = useReport(from, to);
  const r = report.data;
  const cur = hotel.currency;
  const [tab, setTab] = useState("overview");

  const choose = (p: Preset) => { setPreset(p.key); setRange(p.range(today)); };
  const label = `${formatDate(from)} – ${formatDate(to)}`;
  const fileStem = `${hotel.name.replace(/[^\w]+/g, "-")}_${from}_${to}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Occupancy, revenue, taxes, payments and guests for any period" />

      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => choose(p)}>{p.label}</Button>
          ))}
          <div className="flex items-end gap-2 ml-auto">
            <div className="space-y-1">
              <Label htmlFor="rep-from" className="text-xs">From</Label>
              <Input id="rep-from" type="date" value={from} max={to} onChange={(e) => { setPreset(""); setRange([e.target.value, to]); }} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-to" className="text-xs">To</Label>
              <Input id="rep-to" type="date" value={to} min={from} max={today} onChange={(e) => { setPreset(""); setRange([from, e.target.value]); }} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block text-lg font-semibold">{hotel.name} · {label}</div>

      {report.isLoading ? <LoadingBlock /> : report.error ? (
        <Card><CardContent className="p-6 text-red-600">{friendlyError(report.error)}</CardContent></Card>
      ) : !r ? null : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto print:hidden">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue & tax</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="guests">Bookings & guests</TabsTrigger>
            <TabsTrigger value="balances">Balances owing{r.debtors.length ? ` (${r.debtors.length})` : ""}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><Overview r={r} cur={cur} file={fileStem} /></TabsContent>
          <TabsContent value="revenue"><Revenue r={r} cur={cur} file={fileStem} /></TabsContent>
          <TabsContent value="payments"><Payments r={r} cur={cur} file={fileStem} /></TabsContent>
          <TabsContent value="guests"><Guests r={r} cur={cur} file={fileStem} /></TabsContent>
          <TabsContent value="balances"><Balances r={r} cur={cur} file={fileStem} /></TabsContent>
        </Tabs>
      )}

      <p className="text-xs text-slate-500 flex gap-1.5 items-start">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Revenue is before VAT and tourism levy unless marked “gross”. Room revenue counts on the night stayed; other guest-bill
          charges on the day posted; restaurant & bar bills on the day paid (bills charged to a room are counted once, in F&amp;B).
          Voided items are left out. Occupancy uses all rooms in the hotel. Periods end today; see the dashboard for the forecast.
        </span>
      </p>
    </div>
  );
};

export default ReportsPage;

// ---------------------------------------------------------------------------

type TabProps = { r: PeriodReport; cur: string; file: string };

const change = (now: number, before: number) => (before ? (now - before) / Math.abs(before) : null);

const Kpi = ({ label, value, now, before, sub, fmt }: {
  label: string; value: string; now: number; before: number; sub?: string; fmt?: (v: number) => string;
}) => {
  const c = change(now, before);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
          {c === null ? <span>{now ? "New this period" : "No change"}</span> : (
            <span className={`inline-flex items-center font-medium ${c >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {c >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(c * 100).toFixed(0)}%
            </span>
          )}
          {c !== null && <span>vs previous {fmt ? `(${fmt(before)})` : "period"}</span>}
          {sub && <span className="w-full">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
};

const Section = ({ title, children, onCsv, note }: { title: string; children: ReactNode; onCsv?: () => void; note?: string }) => (
  <Card>
    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
      <div>
        <CardTitle className="text-lg">{title}</CardTitle>
        {note && <p className="text-xs text-slate-500 mt-1">{note}</p>}
      </div>
      {onCsv && (
        <Button size="sm" variant="ghost" onClick={onCsv} className="print:hidden" aria-label={`Download ${title} as CSV`}>
          <Download className="mr-1 h-4 w-4" />CSV
        </Button>
      )}
    </CardHeader>
    <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
  </Card>
);

const Empty = ({ cols, text = "Nothing in this period" }: { cols: number; text?: string }) => (
  <TableRow><TableCell colSpan={cols} className="text-center text-slate-500 py-6">{text}</TableCell></TableRow>
);

const n2 = (v: number) => Number(v.toFixed(2));

// ---------------------------------------------------------------------------

const Overview = ({ r, cur, file }: TabProps) => {
  const k = r.kpis, p = r.previous;
  const dark = useIsDark();
  const c = dark ? SERIES.dark : SERIES.light;
  const monthly = k.days > 62;
  const rows = useMemo(() => bucket(r.daily, monthly), [r.daily, monthly]);
  const money = (v: number) => formatMoney(v, cur);
  const short = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
  const tip = {
    contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { fontWeight: 600 },
    cursor: { fill: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
  };

  if (!k.rooms) {
    return <EmptyState icon={BarChart3} title="Add rooms first">Reports need at least one room in the hotel.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Occupancy" value={pct(k.occupancy)} now={k.occupancy} before={p.occupancy} fmt={pct}
          sub={`${k.room_nights_sold} of ${k.room_nights_available} room nights`} />
        <Kpi label="Average daily rate (ADR)" value={money(k.adr)} now={k.adr} before={p.adr} fmt={money} />
        <Kpi label="RevPAR" value={money(k.revpar)} now={k.revpar} before={p.revpar} fmt={money}
          sub="Room revenue per available room night" />
        <Kpi label="Total revenue" value={money(k.total_revenue)} now={k.total_revenue} before={p.total_revenue} fmt={money}
          sub={`${money(k.gross)} including taxes`} />
        <Kpi label="Room revenue" value={money(k.room_revenue)} now={k.room_revenue} before={p.room_revenue} fmt={money} />
        <Kpi label="Food & beverage" value={money(k.fnb_revenue)} now={k.fnb_revenue} before={p.fnb_revenue} fmt={money} />
        <Kpi label="Other income" value={money(k.other_revenue)} now={k.other_revenue} before={p.other_revenue} fmt={money} />
        <Kpi label="Money collected" value={money(k.collected)} now={k.collected} before={p.collected} fmt={money}
          sub="Cash, M-Pesa, card & bank, less refunds" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-lg">Revenue by {monthly ? "month" : "day"}</CardTitle>
            <p className="text-xs text-slate-500">Before tax, {cur}</p></CardHeader>
          <CardContent className="h-72 pl-0" role="img" aria-label="Stacked bar chart of rooms, food and beverage, and other revenue">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} barCategoryGap={rows.length > 20 ? 1 : "20%"}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={12} />
                <YAxis tickFormatter={short} tickLine={false} axisLine={false} fontSize={11} width={48} />
                <Tooltip {...tip} formatter={(v: number, name: string) => [formatMoney(v, cur), name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="room_revenue" name="Rooms" stackId="a" fill={c.rooms} stroke={c.surface} strokeWidth={1} />
                <Bar dataKey="fnb_revenue" name="Food & beverage" stackId="a" fill={c.fnb} stroke={c.surface} strokeWidth={1} />
                <Bar dataKey="other_revenue" name="Other" stackId="a" fill={c.other} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-lg">Occupancy by {monthly ? "month" : "day"}</CardTitle>
            <p className="text-xs text-slate-500">Share of rooms sold</p></CardHeader>
          <CardContent className="h-72 pl-0" role="img" aria-label="Line chart of occupancy percentage">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={12} />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} fontSize={11} width={44} />
                <Tooltip {...tip} cursor={{ stroke: c.grid }} formatter={(v: number) => [pct(v), "Occupancy"]} />
                <Line type="linear" dataKey="occupancy" stroke={c.occ} strokeWidth={2}
                  dot={rows.length <= 31 ? { r: 3, strokeWidth: 2, fill: c.surface } : false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Section title={monthly ? "Month by month" : "Day by day"} onCsv={() => downloadCsv(`${file}_daily`,
        ["Date", "Rooms sold", "Occupancy %", "Room revenue", "F&B revenue", "Other revenue", "Total revenue", "VAT", "Tourism levy", "Collected"],
        r.daily.map((d) => [d.date, d.rooms_sold, n2(d.occupancy * 100), n2(d.room_revenue), n2(d.fnb_revenue), n2(d.other_revenue),
          n2(d.room_revenue + d.fnb_revenue + d.other_revenue), n2(d.vat), n2(d.levy), n2(d.collected)]))}>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{monthly ? "Month" : "Date"}</TableHead><TableHead className="text-right">Rooms sold</TableHead>
            <TableHead className="text-right">Occupancy</TableHead><TableHead className="text-right">ADR</TableHead>
            <TableHead className="text-right">Rooms</TableHead><TableHead className="text-right">F&B</TableHead>
            <TableHead className="text-right">Other</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Collected</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {[...rows].reverse().map((d) => (
              <TableRow key={d.date}>
                <TableCell className="whitespace-nowrap">{monthly ? d.label : format(parseISO(d.date), "EEE d MMM")}</TableCell>
                <TableCell className="text-right tabular-nums">{d.rooms_sold}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(d.occupancy)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(d.rooms_sold ? d.room_revenue / d.rooms_sold : 0, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(d.room_revenue, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(d.fnb_revenue, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(d.other_revenue, "")}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(d.room_revenue + d.fnb_revenue + d.other_revenue, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(d.collected, "")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter><TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{k.room_nights_sold}</TableCell>
            <TableCell className="text-right">{pct(k.occupancy)}</TableCell>
            <TableCell className="text-right">{formatMoney(k.adr, "")}</TableCell>
            <TableCell className="text-right">{formatMoney(k.room_revenue, "")}</TableCell>
            <TableCell className="text-right">{formatMoney(k.fnb_revenue, "")}</TableCell>
            <TableCell className="text-right">{formatMoney(k.other_revenue, "")}</TableCell>
            <TableCell className="text-right">{formatMoney(k.total_revenue, "")}</TableCell>
            <TableCell className="text-right">{formatMoney(k.collected, "")}</TableCell>
          </TableRow></TableFooter>
        </Table>
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Revenue = ({ r, cur, file }: TabProps) => {
  const groups = (["rooms", "fnb", "other"] as const).map((g) => {
    const rows = r.departments.filter((d) => d.grp === g);
    const sum = (f: "net" | "vat" | "levy" | "gross") => rows.reduce((s, d) => s + d[f], 0);
    return { g, rows, net: sum("net"), vat: sum("vat"), levy: sum("levy"), gross: sum("gross") };
  }).filter((x) => x.rows.length);
  const k = r.kpis;
  const monthly = useMemo(() => bucket(r.daily, true), [r.daily]);
  const m2 = (v: number) => formatMoney2(v, "");

  return (
    <div className="space-y-4">
      <Section title="Revenue by department" note={`${cur}. Net is before VAT and levy.`}
          onCsv={() => downloadCsv(`${file}_departments`, ["Group", "Department", "Net", "VAT", "Tourism levy", "Gross"],
            r.departments.map((d) => [GROUP_LABEL[d.grp], deptLabel(d.dept), n2(d.net), n2(d.vat), n2(d.levy), n2(d.gross)]))}>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Department</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Levy</TableHead><TableHead className="text-right">Gross</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {groups.map((g) => [
                <TableRow key={g.g} className="bg-slate-50 dark:bg-slate-900/50 font-medium">
                  <TableCell>{GROUP_LABEL[g.g]}</TableCell>
                  <TableCell className="text-right tabular-nums">{m2(g.net)}</TableCell><TableCell className="text-right tabular-nums">{m2(g.vat)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m2(g.levy)}</TableCell><TableCell className="text-right tabular-nums">{m2(g.gross)}</TableCell>
                </TableRow>,
                ...(g.rows.length === 1 && g.g === "rooms" ? [] : g.rows).map((d) => (
                  <TableRow key={g.g + d.dept}>
                    <TableCell className="pl-8 text-slate-600 dark:text-slate-300">{deptLabel(d.dept)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m2(d.net)}</TableCell><TableCell className="text-right tabular-nums">{m2(d.vat)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m2(d.levy)}</TableCell><TableCell className="text-right tabular-nums">{m2(d.gross)}</TableCell>
                  </TableRow>
                )),
              ])}
              {!groups.length && <Empty cols={5} />}
            </TableBody>
            <TableFooter><TableRow>
              <TableCell>Total</TableCell><TableCell className="text-right">{m2(k.total_revenue)}</TableCell>
              <TableCell className="text-right">{m2(k.vat)}</TableCell><TableCell className="text-right">{m2(k.levy)}</TableCell>
              <TableCell className="text-right">{m2(k.gross)}</TableCell>
            </TableRow></TableFooter>
          </Table>
        </Section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Tax summary" note="For your VAT and tourism levy returns"
          onCsv={() => downloadCsv(`${file}_tax_by_month`, ["Month", "Net sales", "VAT", "Tourism levy", "Gross"],
            monthly.map((m) => [m.date, n2(m.room_revenue + m.fnb_revenue + m.other_revenue), n2(m.vat), n2(m.levy),
              n2(m.room_revenue + m.fnb_revenue + m.other_revenue + m.vat + m.levy)]))}>
          <Table>
            <TableBody>
              <TableRow><TableCell>Sales before tax</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(k.total_revenue, cur)}</TableCell></TableRow>
              <TableRow><TableCell>VAT</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(k.vat, cur)}</TableCell></TableRow>
              <TableRow><TableCell>Tourism levy</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(k.levy, cur)}</TableCell></TableRow>
              <TableRow className="font-semibold"><TableCell>Gross sales</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(k.gross, cur)}</TableCell></TableRow>
            </TableBody>
          </Table>
          {monthly.length > 1 && (
            <Table>
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">Levy</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthly.map((m) => (
                  <TableRow key={m.date}><TableCell>{m.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{m2(m.vat)}</TableCell><TableCell className="text-right tabular-nums">{m2(m.levy)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-slate-500 p-4 pt-2">Submit invoices to KRA through your usual eTIMS route; these totals help you check the return.</p>
        </Section>

        <Section title="F&B sales by staff" note="Paid bills, with voids and comps they entered"
          onCsv={() => downloadCsv(`${file}_fnb_staff`, ["Staff", "Bills", "Sales (gross)", "Voids", "Comps"],
            r.staff.map((s) => [s.name, s.bills, n2(s.sales), s.voids, s.comps]))}>
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead className="text-right">Bills</TableHead>
              <TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Voids</TableHead><TableHead className="text-right">Comps</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.staff.map((s) => (
                <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell className="text-right">{s.bills}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(s.sales, "")}</TableCell>
                  <TableCell className="text-right">{s.voids}</TableCell><TableCell className="text-right">{s.comps}</TableCell></TableRow>
              ))}
              {!r.staff.length && <Empty cols={5} />}
            </TableBody>
          </Table>
        </Section>
      </div>

      <Section title="Restaurant & bar outlets" note={`${cur}. Total includes service charge and taxes.`}
        onCsv={() => downloadCsv(`${file}_outlets`, ["Outlet", "Type", "Bills", "Guests", "Net", "Service charge", "VAT", "Levy", "Total", "Discounts", "Charged to rooms", "Average bill"],
          r.outlets.map((o) => [o.outlet, OUTLET_KINDS[o.kind as OutletKind] ?? o.kind, o.bills, o.covers, n2(o.net), n2(o.service_charge), n2(o.vat), n2(o.levy), n2(o.total), n2(o.discounts), n2(o.room_charged), n2(o.avg_bill)]))}>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Outlet</TableHead><TableHead className="text-right">Bills</TableHead><TableHead className="text-right">Guests</TableHead>
            <TableHead className="text-right">Net</TableHead><TableHead className="text-right">Service charge</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Average bill</TableHead>
            <TableHead className="text-right">Discounts</TableHead><TableHead className="text-right">Charged to rooms</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {r.outlets.map((o) => (
              <TableRow key={o.outlet}>
                <TableCell>{o.outlet}</TableCell><TableCell className="text-right">{o.bills}</TableCell><TableCell className="text-right">{o.covers}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(o.net, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(o.service_charge, "")}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney(o.total, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(o.avg_bill, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(o.discounts, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(o.room_charged, "")}</TableCell>
              </TableRow>
            ))}
            {!r.outlets.length && <Empty cols={9} text="No paid restaurant or bar bills in this period" />}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Payments = ({ r, cur, file }: TabProps) => {
  const fd = r.payments.filter((p) => p.source === "front_desk");
  const pos = r.payments.filter((p) => p.source === "pos" && p.method !== "room");
  const room = r.payments.find((p) => p.source === "pos" && p.method === "room");
  const byMethod = new Map<string, { label: string; fd: number; pos: number; count: number }>();
  [...fd, ...pos].forEach((p) => {
    const k = p.method;
    const e = byMethod.get(k) ?? { label: methodLabel(p.source, p.method), fd: 0, pos: 0, count: 0 };
    if (p.source === "pos") e.pos += p.amount; else e.fd += p.amount;
    e.count += p.count;
    byMethod.set(k, e);
  });
  const rows = [...byMethod.values()].sort((a, b) => b.fd + b.pos - (a.fd + a.pos));
  const tFd = fd.reduce((s, p) => s + p.amount, 0), tPos = pos.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Collected</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney(tFd + tPos, cur)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Front desk</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney(tFd, cur)}</div>
          <div className="text-xs text-slate-500">Guest bills, deposits, less refunds</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Restaurant & bar</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney(tPos, cur)}</div>
          <div className="text-xs text-slate-500">{room ? `Plus ${formatMoney(room.amount, cur)} charged to rooms (${room.count} bills)` : "Paid at the till"}</div></CardContent></Card>
      </div>
      <Section title="By payment method" note={`${cur}. Bills charged to rooms are not money yet; they are paid at check-out at the front desk.`}
        onCsv={() => downloadCsv(`${file}_payments`, ["Method", "Front desk", "Restaurant & bar", "Total", "Transactions"],
          rows.map((x) => [x.label, n2(x.fd), n2(x.pos), n2(x.fd + x.pos), x.count]))}>
        <Table>
          <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Front desk</TableHead>
            <TableHead className="text-right">Restaurant & bar</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Share</TableHead><TableHead className="text-right">Transactions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((x) => (
              <TableRow key={x.label}>
                <TableCell>{x.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney2(x.fd, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney2(x.pos, "")}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatMoney2(x.fd + x.pos, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{tFd + tPos ? pct((x.fd + x.pos) / (tFd + tPos)) : "—"}</TableCell>
                <TableCell className="text-right">{x.count}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <Empty cols={6} text="No payments in this period" />}
          </TableBody>
          <TableFooter><TableRow><TableCell>Total</TableCell>
            <TableCell className="text-right">{formatMoney2(tFd, "")}</TableCell><TableCell className="text-right">{formatMoney2(tPos, "")}</TableCell>
            <TableCell className="text-right">{formatMoney2(tFd + tPos, "")}</TableCell><TableCell /><TableCell /></TableRow></TableFooter>
        </Table>
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Guests = ({ r, cur, file }: TabProps) => {
  const s = r.stays;
  const totalNights = r.sources.reduce((a, x) => a + x.nights, 0);
  const stat = (label: string, value: string | number, sub?: string) => (
    <Card><CardContent className="p-4"><div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</CardContent></Card>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat("Arrivals", s.arrivals, `${s.new_bookings} new bookings made`)}
        {stat("Average stay", `${s.avg_length_of_stay} nights`, `${s.avg_guests} guests per room`)}
        {stat("Booked ahead", `${s.avg_lead_days} days`, "Average time from booking to arrival")}
        {stat("Cancellations / no-shows", `${s.cancellations} / ${s.no_shows}`)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Where bookings come from" note={`Room nights in this period. Revenue in ${cur}, before tax.`}
          onCsv={() => downloadCsv(`${file}_sources`, ["Source", "Stays", "Room nights", "Share of nights %", "Room revenue", "ADR"],
            r.sources.map((x) => [SOURCE_LABELS[x.source as BookingSource] ?? x.source, x.stays, x.nights, n2(totalNights ? x.nights / totalNights * 100 : 0), n2(x.revenue), n2(x.adr)]))}>
          <Table>
            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Stays</TableHead>
              <TableHead className="text-right">Nights</TableHead><TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">ADR</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.sources.map((x) => (
                <TableRow key={x.source}>
                  <TableCell>{SOURCE_LABELS[x.source as BookingSource] ?? x.source}</TableCell>
                  <TableCell className="text-right">{x.stays}</TableCell><TableCell className="text-right">{x.nights}</TableCell>
                  <TableCell className="text-right tabular-nums">{totalNights ? pct(x.nights / totalNights) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.revenue, "")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.adr, "")}</TableCell>
                </TableRow>
              ))}
              {!r.sources.length && <Empty cols={6} text="No rooms sold in this period" />}
            </TableBody>
          </Table>
        </Section>
        <Section title="Room types" onCsv={() => downloadCsv(`${file}_room_types`, ["Room type", "Rooms", "Nights sold", "Occupancy %", "Room revenue", "ADR"],
          r.room_types.map((x) => [x.room_type, x.rooms, x.nights, n2(x.occupancy * 100), n2(x.revenue), n2(x.adr)]))}>
          <Table>
            <TableHeader><TableRow><TableHead>Room type</TableHead><TableHead className="text-right">Rooms</TableHead>
              <TableHead className="text-right">Nights</TableHead><TableHead className="text-right">Occupancy</TableHead>
              <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">ADR</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.room_types.map((x) => (
                <TableRow key={x.room_type}>
                  <TableCell>{x.room_type}</TableCell><TableCell className="text-right">{x.rooms}</TableCell>
                  <TableCell className="text-right">{x.nights}</TableCell><TableCell className="text-right tabular-nums">{pct(x.occupancy)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.revenue, "")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(x.adr, "")}</TableCell>
                </TableRow>
              ))}
              {!r.room_types.length && <Empty cols={6} />}
            </TableBody>
          </Table>
        </Section>
      </div>
      <Section title="Guest nationalities" note="Top 15 by room nights"
        onCsv={() => downloadCsv(`${file}_nationalities`, ["Nationality", "Guests", "Room nights"], r.nationalities.map((x) => [x.nationality, x.guests, x.nights]))}>
        <Table>
          <TableHeader><TableRow><TableHead>Nationality</TableHead><TableHead className="text-right">Guests</TableHead><TableHead className="text-right">Room nights</TableHead></TableRow></TableHeader>
          <TableBody>
            {r.nationalities.map((x) => (
              <TableRow key={x.nationality}><TableCell>{x.nationality}</TableCell><TableCell className="text-right">{x.guests}</TableCell><TableCell className="text-right">{x.nights}</TableCell></TableRow>
            ))}
            {!r.nationalities.length && <Empty cols={3} />}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Balances = ({ r, cur, file }: TabProps) => {
  const total = r.debtors.reduce((s, d) => s + d.balance, 0);
  const left = r.debtors.filter((d) => d.status === "checked_out");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Owed to the hotel</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney2(total, cur)}</div><div className="text-xs text-slate-500">As at now, all guests</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Guests in house</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney2(total - left.reduce((s, d) => s + d.balance, 0), cur)}</div>
          <div className="text-xs text-slate-500">{r.debtors.length - left.length} open bills, settled at check-out</div></CardContent></Card>
        <Card className={left.length ? "border-amber-300" : ""}><CardContent className="p-4"><div className="text-sm text-slate-500">Left with a balance</div>
          <div className="text-2xl font-bold tabular-nums">{formatMoney2(left.reduce((s, d) => s + d.balance, 0), cur)}</div>
          <div className="text-xs text-slate-500">{left.length} checked-out stays, e.g. company accounts</div></CardContent></Card>
      </div>
      <Section title="Unpaid guest bills" note="Collect these from Billing & Payments."
        onCsv={() => downloadCsv(`${file}_balances_owing`, ["Booking", "Guest", "Phone", "Room", "Check-in", "Check-out", "Status", "Charges", "Paid", "Balance"],
          r.debtors.map((d) => [d.code, d.guest, d.phone, d.room, d.check_in, d.check_out, RES_STATUS[d.status as ReservationStatus]?.label ?? d.status, n2(d.charges), n2(d.paid), n2(d.balance)]))}>
        <Table>
          <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Room</TableHead><TableHead>Stay</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {r.debtors.map((d) => (
              <TableRow key={d.reservation_id}>
                <TableCell><div className="font-medium">{d.guest}</div><div className="text-xs text-slate-500">{d.code}{d.phone ? ` · ${d.phone}` : ""}</div></TableCell>
                <TableCell>{d.room ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(d.check_in)} – {formatDate(d.check_out)}</TableCell>
                <TableCell><Badge variant="outline" className={RES_STATUS[d.status as ReservationStatus]?.className}>{RES_STATUS[d.status as ReservationStatus]?.label ?? d.status}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney2(d.charges, "")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney2(d.paid, "")}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatMoney2(d.balance, "")}</TableCell>
              </TableRow>
            ))}
            {!r.debtors.length && <Empty cols={7} text="Nobody owes the hotel anything" />}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
};
