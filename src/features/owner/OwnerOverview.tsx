import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useOwnerOverview } from "@/hooks/useAlerts";
import { formatMoney } from "@/lib/format";
import type { OwnerHotel } from "@/lib/db-types";
import { AlertRow } from "./Alerts";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const change = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

const Change = ({ now, before }: { now: number; before: number }) => {
  const c = change(now, before);
  if (c === null) return <span className="text-xs text-slate-400">no figures last month</span>;
  const up = c >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <span className={`text-xs inline-flex items-center ${up ? "text-emerald-700" : "text-red-700"}`}><Icon className="h-3 w-3" />{Math.abs(Math.round(c * 100))}% vs same days last month</span>;
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) => (
  <div><div className="text-xs text-slate-500">{label}</div><div className="text-lg font-bold tabular-nums leading-tight">{value}</div>{sub && <div>{sub}</div>}</div>
);

const HotelCard = ({ h, onOpen }: { h: OwnerHotel; onOpen: (page?: string) => void }) => {
  const occ = h.rooms ? h.in_house / h.rooms : 0;
  const cur = h.currency;
  return (
    <Card data-testid="owner-hotel">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" />{h.name}</CardTitle>
          <div className="text-xs text-slate-500">{h.city ?? ""}{h.city ? " · " : ""}{format(parseISO(h.today.from), "EEEE d MMM")}</div>
        </div>
        <div className="flex items-center gap-2">
          {h.alerts_high > 0 && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{h.alerts_high} urgent</Badge>}
          <Button size="sm" variant="outline" onClick={() => onOpen()}>Open<ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1"><span><b>{h.in_house}</b> of {h.rooms} rooms occupied tonight</span><span className="font-semibold">{pct(occ)}</span></div>
          <div className="h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, occ * 100)}%` }} /></div>
          <div className="text-xs text-slate-500 mt-1">{h.arrivals} arriving ({h.arrivals_left} still to come) · {h.departures} leaving{h.out_of_service ? ` · ${h.out_of_service} out of service` : ""}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Revenue today" value={formatMoney(h.today.total_revenue, cur)} />
          <Stat label="Month to date" value={formatMoney(h.mtd.total_revenue, cur)} sub={<Change now={h.mtd.total_revenue} before={h.last_month.total_revenue} />} />
          <Stat label="Occupancy this month" value={pct(h.mtd.occupancy)} sub={<span className="text-xs text-slate-500">ADR {formatMoney(h.mtd.adr, "")}</span>} />
          <Stat label="Collected today" value={formatMoney(h.today.collected, cur)} />
          <Stat label="Owed to you" value={formatMoney(h.debtors, cur)} sub={<span className="text-xs text-slate-500">guests who left + companies</span>} />
          <Stat label="Bills due in 7 days" value={formatMoney(h.bills_due, cur)} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Rooms booked, next 7 nights</div>
          <div className="flex items-end gap-1 h-16" role="img" aria-label={`Rooms booked next 7 nights: ${h.next_7_days.map((d) => d.occupied).join(", ")} of ${h.rooms}`}>
            {h.next_7_days.map((d) => {
              const r = h.rooms ? d.occupied / h.rooms : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${format(parseISO(d.date), "EEE d MMM")}: ${d.occupied} of ${h.rooms}`}>
                  <span className="text-[10px] text-slate-500 tabular-nums">{d.occupied}</span>
                  <div className="w-full rounded-t-sm bg-blue-500/80" style={{ height: `${Math.max(2, r * 40)}px` }} />
                  <span className="text-[10px] text-slate-500">{format(parseISO(d.date), "EEEEE")}</span>
                </div>
              );
            })}
          </div>
        </div>
        {h.alerts.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-slate-500">Needs attention</div>
            {h.alerts.slice(0, 4).map((a) => <AlertRow key={a.key} a={a} onOpen={() => onOpen(a.page)} />)}
            {h.alerts.length > 4 && <div className="text-xs text-slate-500">and {h.alerts.length - 4} more</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const OwnerOverview = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { switchHotel, hotel } = useCurrentHotel();
  const q = useOwnerOverview();
  const list = q.data ?? [];
  const sameCur = list.length > 1 && list.every((h) => h.currency === list[0].currency);
  const open = (id: string, page?: string) => {
    if (id !== hotel.id) switchHotel(id);
    onNavigate?.(page ?? "dashboard");
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Owner overview" subtitle="All your hotels on one page: today, this month, money owed and what needs attention" />
      {q.isLoading ? <LoadingBlock /> : !list.length ? <EmptyState icon={LayoutDashboard} title="Nothing to show">This page is for owners, managers and accountants.</EmptyState> : (
        <>
          {sameCur && (
            <Card><CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={`All ${list.length} hotels: occupied tonight`} value={`${list.reduce((a, h) => a + h.in_house, 0)} / ${list.reduce((a, h) => a + h.rooms, 0)}`} />
              <Stat label="Revenue today" value={formatMoney(list.reduce((a, h) => a + h.today.total_revenue, 0), list[0].currency)} />
              <Stat label="Month to date" value={formatMoney(list.reduce((a, h) => a + h.mtd.total_revenue, 0), list[0].currency)}
                sub={<Change now={list.reduce((a, h) => a + h.mtd.total_revenue, 0)} before={list.reduce((a, h) => a + h.last_month.total_revenue, 0)} />} />
              <Stat label="Owed to you" value={formatMoney(list.reduce((a, h) => a + h.debtors, 0), list[0].currency)} />
            </CardContent></Card>
          )}
          <div className="grid xl:grid-cols-2 gap-4">{list.map((h) => <HotelCard key={h.hotel_id} h={h} onOpen={(page) => open(h.hotel_id, page)} />)}</div>
          <p className="text-xs text-slate-500">Revenue is before VAT and levy, as in Reports. Updates every two minutes.</p>
        </>
      )}
    </div>
  );
};
export default OwnerOverview;
