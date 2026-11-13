import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Clock, FileText, LogIn, LogOut, Plus, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useClock, useLeave, useMyPayslips, useMyStaff, useSaveLeave, useShiftTemplates, useShifts, useStaffList, useTimeEntries } from "@/hooks/useStaff";
import { LEAVE_KINDS, addDays, formatDate, formatMoney, todayIn } from "@/lib/format";
import { LeaveDialog, ShiftChip } from "./StaffPage";
import { dateIn, hoursBetween, timeIn, windowIso } from "./time";

const MyShiftsPage = () => {
  const { hotel } = useCurrentHotel();
  const tz = hotel.timezone;
  const today = todayIn(tz);
  const me = useMyStaff();
  const staff = useStaffList();
  const tpls = useShiftTemplates();
  const [wf, wt] = windowIso(addDays(today, -1), addDays(today, 14));
  const shifts = useShifts(wf, wt);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [ef, et] = windowIso(monthStart, today);
  const entries = useTimeEntries(ef, et);
  const leave = useLeave(addDays(today, -30));
  const clock = useClock();
  const saveLeave = useSaveLeave();
  const [asking, setAsking] = useState(false);
  const slips = useMyPayslips(me.data?.id);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  if (me.isLoading) return <LoadingBlock />;
  const st = me.data;
  if (!st) {
    return (
      <div className="space-y-4">
        <PageHeader title="My shifts" subtitle="Your rota, clock in and out, and leave" />
        <Card><CardContent><EmptyState icon={UserX} title="Your login isn't linked to a staff record yet">Ask the owner or a manager to link you under Staff & rota → Staff. Then your shifts and clock-in button appear here.</EmptyState></CardContent></Card>
      </div>
    );
  }
  const tplById = new Map((tpls.data ?? []).map((t) => [t.id, t]));
  const nameBy = new Map((staff.data ?? []).map((s) => [s.id, s]));
  const mine = (shifts.data ?? []).filter((s) => s.staff_id === st.id && new Date(s.ends_at).getTime() > Date.now() - 12 * 3600000);
  const myEntries = (entries.data ?? []).filter((e) => e.staff_id === st.id);
  const open = myEntries.find((e) => !e.clock_out);
  const now = Date.now();
  const current = mine.find((s) => new Date(s.starts_at).getTime() - 3 * 3600000 < now && new Date(s.ends_at).getTime() > now);
  const next = mine.find((s) => new Date(s.starts_at).getTime() > now);
  const monthHours = myEntries.reduce((h, e) => h + hoursBetween(e.clock_in, e.clock_out ?? new Date().toISOString()), 0);
  const todaysTeam = (shifts.data ?? []).filter((s) => dateIn(s.starts_at, tz) === today);
  const myLeave = (leave.data ?? []).filter((l) => l.staff_id === st.id);

  return (
    <div className="space-y-4">
      <PageHeader title="My shifts" subtitle={`${st.full_name} · ${st.department}`} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className={open ? "border-emerald-300" : ""}>
          <CardContent className="p-6 space-y-4 text-center">
            <Clock className={`h-10 w-10 mx-auto ${open ? "text-emerald-600" : "text-slate-400"}`} />
            {open ? (
              <div><div className="text-xl font-bold">On duty</div><div className="text-slate-600">since {timeIn(open.clock_in, tz)} · {hoursBetween(open.clock_in, new Date().toISOString()).toFixed(1)} h</div></div>
            ) : (
              <div><div className="text-xl font-bold">Off duty</div>
                <div className="text-slate-600">{current ? `Your shift ${timeIn(current.starts_at, tz)}–${timeIn(current.ends_at, tz)}` : next ? `Next shift ${format(new Date(next.starts_at), "EEE d MMM")} at ${timeIn(next.starts_at, tz)}` : "No shift coming up"}</div></div>
            )}
            {open
              ? <Button size="lg" variant="outline" className="w-full" disabled={clock.isPending} onClick={() => clock.mutate({ action: "out" })}><LogOut className="mr-2 h-5 w-5" />Clock out</Button>
              : <Button size="lg" className="w-full" disabled={clock.isPending} onClick={() => clock.mutate({ action: "in" })}><LogIn className="mr-2 h-5 w-5" />Clock in</Button>}
            <div className="text-xs text-slate-500">This month: {monthHours.toFixed(1)} hours over {new Set(myEntries.map((e) => dateIn(e.clock_in, tz))).size} day(s)</div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-lg">My next two weeks</CardTitle><CardDescription>Only published shifts show here.</CardDescription></CardHeader>
          <CardContent>
            {mine.length ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {mine.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-24 text-sm"><div className="font-medium">{format(new Date(s.starts_at), "EEE d MMM")}</div>{dateIn(s.starts_at, tz) === today && <Badge variant="secondary" className="text-[10px]">Today</Badge>}</div>
                    <div className="flex-1"><ShiftChip s={s} tpl={s.template_id ? tplById.get(s.template_id) : undefined} tz={tz} /></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={CalendarDays} title="No shifts published for you yet" />}
          </CardContent>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Working today</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {todaysTeam.map((s) => (
              <div key={s.id} className="flex justify-between gap-2"><span>{nameBy.get(s.staff_id)?.full_name} <span className="text-slate-500">· {nameBy.get(s.staff_id)?.department}</span></span>
                <span className="tabular-nums text-slate-600">{timeIn(s.starts_at, tz)}–{timeIn(s.ends_at, tz)}</span></div>
            ))}
            {!todaysTeam.length && <p className="text-slate-500">No published shifts today.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-lg">My leave</CardTitle>
            <Button size="sm" onClick={() => setAsking(true)}><Plus className="mr-1 h-4 w-4" />Ask for leave</Button></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {myLeave.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span>{LEAVE_KINDS[l.kind]} · {formatDate(l.from_date)} – {formatDate(l.to_date)}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={l.status === "approved" ? "border-emerald-200 text-emerald-700" : l.status === "requested" ? "border-amber-300 text-amber-800" : "text-slate-500"}>
                    {{ requested: "Waiting", approved: "Approved", refused: "Refused", cancelled: "Cancelled" }[l.status]}</Badge>
                  {(l.status === "requested" || (l.status === "approved" && l.from_date > today)) && <Button size="sm" variant="ghost" onClick={() => saveLeave.mutate({ id: l.id, status: "cancelled" })}>Cancel</Button>}
                </span>
              </div>
            ))}
            {!myLeave.length && <p className="text-slate-500">No leave in the last month or coming up.</p>}
          </CardContent>
        </Card>
      </div>
      {(() => {
        const mySlips = (slips.data ?? []).filter((p) => p.payroll_runs && p.payroll_runs.status !== "draft").sort((a, b) => b.payroll_runs!.month.localeCompare(a.payroll_runs!.month)).slice(0, 12);
        return mySlips.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">My payslips</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {mySlips.map((p) => (
                <a key={p.id} href={`/payslips/${p.run_id}?staff=${p.staff_id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" />{format(parseISO(p.payroll_runs!.month), "MMMM yyyy")}</span>
                  <span className="tabular-nums font-medium">{formatMoney(Number(p.net), hotel.currency)} net</span>
                </a>
              ))}
            </CardContent>
          </Card>
        );
      })()}
      {asking && <LeaveDialog staff={[st]} fixedStaffId={st.id} onClose={() => setAsking(false)} />}
      <p className="text-xs text-slate-500">Today is {format(parseISO(today), "EEEE d MMMM")}.</p>
    </div>
  );
};
export default MyShiftsPage;
