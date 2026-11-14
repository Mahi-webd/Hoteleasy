import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, Lock, MoonStar, Printer, RotateCcw, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useCancelReservation } from "@/hooks/useHotelQueries";
import { useCloseDay, useClosedDays, useDayChecks, useDayReport, useReopenDay } from "@/hooks/useAudit";
import { formatMoney, todayIn } from "@/lib/format";
import type { DayCheck, DayReport } from "@/lib/db-types";

const nice = (d: string) => format(parseISO(d), "EEEE d MMMM yyyy");
const pct = (n: number) => `${Math.round(Number(n) * 100)}%`;

const Check = ({ c, blocking, onNavigate, onNoShow }: { c: DayCheck; blocking: boolean; onNavigate?: (p: string) => void; onNoShow?: (id: string, label: string) => void }) => (
  <div className={`rounded-md border p-3 space-y-2 ${blocking ? "border-red-200 bg-red-50/60 dark:bg-red-950/20" : "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20"}`} data-testid={blocking ? "check-blocking" : "check-warning"}>
    <div className="flex items-start gap-2">
      {blocking ? <CircleAlert className="h-5 w-5 text-red-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
      <div className="flex-1"><div className="font-medium text-sm">{c.title}</div><div className="text-xs text-slate-600">{c.detail}</div></div>
      {(c.key === "arrivals" || c.key === "departures") && <Button size="sm" variant="outline" onClick={() => onNavigate?.("reservations")}>Reservations<ChevronRight className="ml-1 h-4 w-4" /></Button>}
      {c.key === "pos_bills" && <Button size="sm" variant="outline" onClick={() => onNavigate?.("pos")}>POS<ChevronRight className="ml-1 h-4 w-4" /></Button>}
    </div>
    {!!c.items?.length && c.key !== "pos_bills" && (
      <div className="divide-y rounded bg-white dark:bg-slate-950 border">
        {c.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="flex-1">{i.guest} <span className="text-xs text-slate-500">· {i.code}{i.room ? ` · room ${i.room}` : ""}</span></span>
            {c.key === "arrivals" && onNoShow && <Button size="sm" variant="ghost" className="text-red-700" onClick={() => onNoShow(i.id, `${i.guest} (${i.code})`)}><UserX className="mr-1 h-4 w-4" />No-show</Button>}
          </div>
        ))}
      </div>
    )}
  </div>
);

export const DayFigures = ({ r }: { r: DayReport }) => {
  const cur = r.hotel.currency;
  const collected = r.payments.reduce((a, p) => a + Number(p.amount), 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Occupancy", `${pct(r.kpis.occupancy)} (${r.in_house}/${r.rooms})`], ["Room revenue", formatMoney(r.kpis.room_revenue, cur)],
          ["ADR / RevPAR", `${formatMoney(r.kpis.adr, "")} / ${formatMoney(r.kpis.revpar, "")}`], ["Total revenue", formatMoney(r.kpis.total_revenue, cur)],
          ["Food & drink", formatMoney(r.kpis.fnb_revenue, cur)], ["Other", formatMoney(r.kpis.other_revenue, cur)],
          ["Money taken", formatMoney(collected, cur)], ["Month to date", formatMoney(r.mtd.total_revenue, cur)]].map(([l, v]) => (
          <div key={l} className="rounded-md border p-2"><div className="text-xs text-slate-500">{l}</div><div className="font-semibold tabular-nums">{v}</div></div>
        ))}
      </div>
      <div className="text-sm text-slate-600">{r.arrivals} arrived · {r.departures} left · {r.no_shows} no-show{r.no_shows === 1 ? "" : "s"} · {r.cancellations} cancelled · {r.new_bookings} new booking{r.new_bookings === 1 ? "" : "s"} · {r.guests} guests in house{r.voids ? ` · ${r.voids} voids` : ""}</div>
    </div>
  );
};

const AuditPage = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { hotel, can, allowed } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const first = useDayChecks(today);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => { if (!day && first.data) setDay(first.data.next_to_close); }, [first.data, day]);
  const checks = useDayChecks(day);
  const report = useDayReport(day);
  const days = useClosedDays();
  const close = useCloseDay();
  const reopen = useReopenDay();
  const noShow = useCancelReservation();
  const [notes, setNotes] = useState("");
  const c = checks.data;
  const closedAlready = !!c?.last_closed && !!day && day <= c.last_closed;
  const canClose = allowed("audit.create");

  return (
    <div className="space-y-4">
      <PageHeader title="Night audit" subtitle="Check the day, close it, and lock its figures. The daily manager's report is kept for every closed day." />
      <Card>
        <CardHeader className="pb-2 flex flex-row flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><MoonStar className="h-5 w-5" />{day ? nice(day) : "…"}</CardTitle>
            <CardDescription>{c?.last_closed ? `Closed up to ${format(parseISO(c.last_closed), "EEE d MMM")}.` : "No days closed yet: start with yesterday or today."}</CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label htmlFor="audit-day" className="text-xs">Day</Label>
              <Input id="audit-day" type="date" max={today} value={day ?? ""} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-40" /></div>
            {day && <Button variant="outline" asChild><a href={`/day-report/${day}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Manager's report</a></Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {checks.isLoading || !c ? <LoadingBlock /> : closedAlready ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-700" />This day is closed and locked.</div>
          ) : (
            <>
              {c.blocking.length === 0 && c.warnings.length === 0 && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm flex items-center gap-2" data-testid="checks-ok"><CheckCircle2 className="h-4 w-4 text-emerald-700" />Everything checks out. Ready to close.</div>
              )}
              {c.blocking.map((b) => <Check key={b.key} c={b} blocking onNavigate={onNavigate}
                onNoShow={canClose ? (id, label) => { if (confirm(`Mark ${label} as a no-show?`)) noShow.mutate({ id, noShow: true }); } : undefined} />)}
              {c.warnings.map((w) => <Check key={w.key} c={w} blocking={false} onNavigate={onNavigate} />)}
            </>
          )}
          {report.data && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">Figures {report.data.closed ? <Badge variant="outline" className="border-emerald-200 text-emerald-700">final</Badge> : <Badge variant="outline">so far</Badge>}</div>
              <DayFigures r={report.data} />
            </div>
          )}
          {!closedAlready && c && canClose && (
            <div className="space-y-2 border-t pt-3">
              <Label htmlFor="audit-notes">Notes for the manager (optional)</Label>
              <Textarea id="audit-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Power cut 22:00–23:30, generator on. Room 104 noisy guests." />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-slate-500">After closing, payments, charges and restaurant bills from this day can't be voided or changed. Corrections go on the next day.</p>
                <Button disabled={!c.can_close || close.isPending} onClick={() => close.mutate({ day: day!, notes }, { onSuccess: () => { setNotes(""); setDay(null); first.refetch(); } })}>
                  <Lock className="mr-1 h-4 w-4" />Close {day && format(parseISO(day), "EEE d MMM")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Closed days</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {days.isLoading ? <LoadingBlock /> : !(days.data ?? []).length ? <EmptyState icon={MoonStar} title="No closed days yet">Close a day to keep its report.</EmptyState> : (
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Occupancy</TableHead><TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Money taken</TableHead><TableHead>Closed</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(days.data ?? []).map((d, i) => (
                  <TableRow key={d.day}>
                    <TableCell className="font-medium whitespace-nowrap">{format(parseISO(d.day), "EEE d MMM yyyy")}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(d.summary.kpis.occupancy)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.summary.kpis.total_revenue, hotel.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.summary.payments.reduce((a, p) => a + Number(p.amount), 0), hotel.currency)}</TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{format(parseISO(d.closed_at), "d MMM HH:mm")}{d.notes ? " · has notes" : ""}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" asChild><a href={`/day-report/${d.day}`} target="_blank" rel="noreferrer" aria-label={`Report for ${d.day}`}><Printer className="h-4 w-4" /></a></Button>
                      {i === 0 && allowed("audit.delete") && (
                        <Button size="sm" variant="ghost" onClick={() => { const reason = prompt(`Reopen ${d.day}? Say why (it will be logged):`); if (reason?.trim()) reopen.mutate({ day: d.day, reason: reason.trim() }); }}>
                          <RotateCcw className="mr-1 h-4 w-4" />Reopen</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default AuditPage;
