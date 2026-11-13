import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, LogIn, LogOut, Pencil, Plus, Printer, Send, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import {
  useClock, useCopyWeek, useDeleteShift, useDeleteTemplate, useFixTime, useHoursReport, useImportMembers, useLeave, useOpenEntries,
  usePublishRota, useSaveLeave, useSaveShift, useSaveStaff, useSaveTemplate, useShiftTemplates, useShifts, useStaffList, useStaffPay, useTimeEntries,
} from "@/hooks/useStaff";
import { DEPARTMENTS, EMPLOYMENT, LEAVE_KINDS, SHIFT_COLORS, addDays, formatDate, formatMoney, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Employment, LeaveKind, LeaveRequest, Shift, ShiftTemplate, Staff, StaffPay } from "@/lib/db-types";
import { dateIn, hoursBetween, localToIso, mondayOf, timeIn, windowIso } from "./time";

const MAX_WEEK_HOURS = 52;

const StaffPage = () => {
  const { can } = useCurrentHotel();
  const admin = can("owner", "manager");
  const clocker = can("owner", "manager", "front_desk");
  const money = can("owner", "manager", "accountant");
  const [tab, setTab] = useState(admin ? "rota" : clocker ? "today" : "hours");
  return (
    <div className="space-y-4">
      <PageHeader title="Staff & rota" subtitle="Who works when, who's in today, leave, and hours for payroll" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {admin && <TabsTrigger value="rota">Rota</TabsTrigger>}
          {clocker && <TabsTrigger value="today">Today</TabsTrigger>}
          {admin && <TabsTrigger value="leave">Leave</TabsTrigger>}
          {money && <TabsTrigger value="hours">Hours & pay</TabsTrigger>}
          {admin && <TabsTrigger value="people">Staff</TabsTrigger>}
          {admin && <TabsTrigger value="types">Shift types</TabsTrigger>}
        </TabsList>
        {admin && <TabsContent value="rota"><Rota /></TabsContent>}
        {clocker && <TabsContent value="today"><Today admin={admin} /></TabsContent>}
        {admin && <TabsContent value="leave"><LeaveAdmin /></TabsContent>}
        {money && <TabsContent value="hours"><Hours /></TabsContent>}
        {admin && <TabsContent value="people"><People /></TabsContent>}
        {admin && <TabsContent value="types"><Templates /></TabsContent>}
      </Tabs>
    </div>
  );
};
export default StaffPage;

// ======================================================================= rota
export const ShiftChip = ({ s, tpl, tz, onClick }: { s: Shift; tpl?: ShiftTemplate; tz: string; onClick?: () => void }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className={`w-full text-left rounded-md border px-1.5 py-1 text-xs leading-tight ${SHIFT_COLORS[tpl?.color ?? "slate"]} ${s.published ? "" : "border-dashed opacity-80"} ${onClick ? "hover:ring-2 hover:ring-blue-400" : ""}`}
    aria-label={`${tpl?.name ?? "Shift"} ${timeIn(s.starts_at, tz)} to ${timeIn(s.ends_at, tz)}${s.published ? "" : ", draft"}`}>
    <div className="font-semibold">{timeIn(s.starts_at, tz)}–{timeIn(s.ends_at, tz)}</div>
    <div className="opacity-80 truncate">{tpl?.name ?? "Custom"}{!s.published && " · draft"}</div>
  </button>
);

const Rota = () => {
  const { hotel } = useCurrentHotel();
  const tz = hotel.timezone;
  const today = todayIn(tz);
  const [monday, setMonday] = useState(mondayOf(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [wf, wt] = windowIso(days[0], days[6]);
  const staff = useStaffList();
  const tpls = useShiftTemplates();
  const shifts = useShifts(wf, wt);
  const leave = useLeave(days[0], days[6]);
  const publish = usePublishRota();
  const copy = useCopyWeek();
  const [dept, setDept] = useState("all");
  const [edit, setEdit] = useState<{ shift?: Shift; staff: Staff; date: string } | null>(null);
  const tplById = new Map((tpls.data ?? []).map((t) => [t.id, t]));
  const week = (shifts.data ?? []).filter((s) => days.includes(dateIn(s.starts_at, tz)));
  const drafts = week.filter((s) => !s.published).length;
  const people = (staff.data ?? []).filter((s) => s.active && (dept === "all" || s.department === dept));
  const depts = [...new Set((staff.data ?? []).filter((s) => s.active).map((s) => s.department))].sort();
  const onLeave = (st: Staff, d: string) => (leave.data ?? []).find((l) => l.staff_id === st.id && l.status === "approved" && d >= l.from_date && d <= l.to_date);

  if (staff.isLoading || tpls.isLoading) return <LoadingBlock />;
  if (!staff.data?.length) return <Card><CardContent><EmptyState icon={Users} title="Add your staff first">Go to the Staff tab to add the team, then build the rota here.</EmptyState></CardContent></Card>;

  let lastDept = "";
  return (
    <div className="space-y-3">
      <Card className="print:hidden">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-semibold min-w-[190px] text-center">{format(parseISO(days[0]), "d MMM")} – {format(parseISO(days[6]), "d MMM yyyy")}</div>
          <Button size="icon" variant="outline" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setMonday(mondayOf(today))}>This week</Button>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-48" aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All departments</SelectItem>{depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
            <ConfirmButton size="sm" variant="outline" title="Copy this week to next week?" description="Shifts are copied as drafts. People on leave, or already busy then, are skipped."
              onConfirm={() => copy.mutate(days[0])}><Copy className="mr-1 h-4 w-4" />Copy to next week</ConfirmButton>
            <Button size="sm" disabled={!drafts || publish.isPending} onClick={() => publish.mutate({ from: days[0], to: days[6] })}>
              <Send className="mr-1 h-4 w-4" />Publish{drafts ? ` ${drafts} draft${drafts === 1 ? "" : "s"}` : "ed"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="hidden print:block text-lg font-semibold">{hotel.name} · Rota {format(parseISO(days[0]), "d MMM")} – {format(parseISO(days[6]), "d MMM yyyy")}</div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 min-w-[170px] font-medium text-slate-500">Staff</th>
                {days.map((d) => (
                  <th key={d} className={`p-2 min-w-[110px] font-medium text-left ${d === today ? "text-blue-700" : "text-slate-500"}`}>
                    {format(parseISO(d), "EEE")} <span className="font-normal">{format(parseISO(d), "d")}</span>
                  </th>
                ))}
                <th className="p-2 text-right font-medium text-slate-500">Hours</th>
              </tr>
            </thead>
            <tbody>
              {people.map((st) => {
                const mine = week.filter((s) => s.staff_id === st.id);
                const hrs = mine.reduce((h, s) => h + hoursBetween(s.starts_at, s.ends_at, s.break_minutes), 0);
                const workDays = new Set(mine.map((s) => dateIn(s.starts_at, tz))).size;
                const head = st.department !== lastDept ? (lastDept = st.department) : null;
                return [
                  head && <tr key={`h-${head}`} className="bg-slate-50 dark:bg-slate-900/50"><td colSpan={9} className="px-2 py-1 text-xs uppercase font-semibold text-slate-500">{head}</td></tr>,
                  <tr key={st.id} className="border-b align-top">
                    <td className="p-2"><div className="font-medium">{st.full_name}</div><div className="text-xs text-slate-500">{st.job_title ?? EMPLOYMENT[st.employment]}</div></td>
                    {days.map((d) => {
                      const cell = mine.filter((s) => dateIn(s.starts_at, tz) === d);
                      const lv = onLeave(st, d);
                      return (
                        <td key={d} className={`p-1 ${d === today ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                          <div className="space-y-1">
                            {lv ? <div className="rounded-md border border-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-1 text-xs text-slate-600">{LEAVE_KINDS[lv.kind]}</div> : (
                              <>
                                {cell.map((s) => <ShiftChip key={s.id} s={s} tpl={s.template_id ? tplById.get(s.template_id) : undefined} tz={tz} onClick={() => setEdit({ shift: s, staff: st, date: d })} />)}
                                <AddShift staff={st} date={d} templates={tpls.data ?? []} onCustom={() => setEdit({ staff: st, date: d })} />
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-right tabular-nums whitespace-nowrap">
                      <span className={hrs > MAX_WEEK_HOURS ? "text-red-700 font-semibold" : ""}>{hrs.toFixed(1)}</span>
                      {hrs > MAX_WEEK_HOURS && <div className="text-[11px] text-red-700">over {MAX_WEEK_HOURS} h</div>}
                      {workDays === 7 && <div className="text-[11px] text-amber-700">no day off</div>}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500 print:hidden">Dashed shifts are drafts that staff can't see yet; press Publish when the week is ready. Click a shift to change it. Hours exclude breaks; the warning shows above {MAX_WEEK_HOURS} hours a week or when someone has no day off.</p>
      {edit && <ShiftDialog {...edit} templates={tpls.data ?? []} onClose={() => setEdit(null)} />}
    </div>
  );
};

const AddShift = ({ staff, date, templates, onCustom }: { staff: Staff; date: string; templates: ShiftTemplate[]; onCustom: () => void }) => {
  const save = useSaveShift();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full rounded-md border border-dashed border-transparent hover:border-slate-300 text-slate-300 hover:text-slate-500 text-xs py-1 print:hidden"
          aria-label={`Add shift for ${staff.full_name} on ${format(parseISO(date), "EEEE d MMM")}`}><Plus className="h-3.5 w-3.5 mx-auto" /></button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1" align="start">
        <div className="text-xs text-slate-500 px-1 pb-1">{staff.full_name} · {format(parseISO(date), "EEE d MMM")}</div>
        {templates.map((t) => (
          <button key={t.id} type="button" disabled={save.isPending} className={`w-full text-left rounded-md border px-2 py-1.5 text-sm ${SHIFT_COLORS[t.color]}`}
            onClick={() => save.mutate({ staffId: staff.id, date, starts: t.starts.slice(0, 5), ends: t.ends.slice(0, 5), breakMinutes: t.break_minutes, templateId: t.id }, { onSuccess: () => setOpen(false) })}>
            <b>{t.name}</b> <span className="opacity-75">{t.starts.slice(0, 5)}–{t.ends.slice(0, 5)}</span>
          </button>
        ))}
        <Button size="sm" variant="ghost" className="w-full" onClick={() => { setOpen(false); onCustom(); }}>Other times…</Button>
      </PopoverContent>
    </Popover>
  );
};

const ShiftDialog = ({ shift, staff, date, templates, onClose }: { shift?: Shift; staff: Staff; date: string; templates: ShiftTemplate[]; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const tz = hotel.timezone;
  const save = useSaveShift();
  const del = useDeleteShift();
  const [d, setD] = useState(shift ? dateIn(shift.starts_at, tz) : date);
  const [starts, setStarts] = useState(shift ? timeIn(shift.starts_at, tz) : "08:00");
  const [ends, setEnds] = useState(shift ? timeIn(shift.ends_at, tz) : "16:00");
  const [brk, setBrk] = useState(String(shift?.break_minutes ?? 30));
  const [tpl, setTpl] = useState(shift?.template_id ?? "");
  const [note, setNote] = useState(shift?.note ?? "");
  const pickTpl = (id: string) => {
    setTpl(id === "none" ? "" : id);
    const t = templates.find((x) => x.id === id);
    if (t) { setStarts(t.starts.slice(0, 5)); setEnds(t.ends.slice(0, 5)); setBrk(String(t.break_minutes)); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{shift ? "Change shift" : "New shift"}: {staff.full_name}</DialogTitle>
          {shift && <DialogDescription>{shift.published ? "Published: staff can see this shift." : "Draft: not visible to staff yet."}</DialogDescription>}</DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="sh-date">Date</Label><Input id="sh-date" type="date" value={d} onChange={(e) => setD(e.target.value)} /></div>
            <div className="space-y-1"><Label>Shift type</Label>
              <Select value={tpl || "none"} onValueChange={pickTpl}><SelectTrigger aria-label="Shift type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Custom</SelectItem>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label htmlFor="sh-s">Starts</Label><Input id="sh-s" type="time" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="sh-e">Ends</Label><Input id="sh-e" type="time" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="sh-b">Break (min)</Label><Input id="sh-b" type="number" min={0} max={240} value={brk} onChange={(e) => setBrk(e.target.value)} /></div>
          </div>
          {ends <= starts && <p className="text-xs text-slate-500">Ends the next morning.</p>}
          <div className="space-y-1"><Label htmlFor="sh-n">Note</Label><Input id="sh-n" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Covering reception, wedding setup" /></div>
        </div>
        <DialogFooter className="gap-2">
          {shift && <Button variant="ghost" className="mr-auto text-red-700" onClick={() => del.mutate(shift.id, { onSuccess: onClose })}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate({ id: shift?.id, staffId: staff.id, date: d, starts, ends, breakMinutes: Number(brk) || 0, templateId: tpl || null, note }, { onSuccess: onClose })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ======================================================================= today
const Today = ({ admin }: { admin: boolean }) => {
  const { hotel } = useCurrentHotel();
  const tz = hotel.timezone;
  const today = todayIn(tz);
  const [wf, wt] = windowIso(addDays(today, -1), today);
  const staff = useStaffList();
  const tpls = useShiftTemplates();
  const shifts = useShifts(wf, wt);
  const entries = useTimeEntries(wf, wt);
  const open = useOpenEntries();
  const leave = useLeave(today, today);
  const clock = useClock();
  const [fix, setFix] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const tplById = new Map((tpls.data ?? []).map((t) => [t.id, t]));
  if (staff.isLoading) return <LoadingBlock />;
  const now = Date.now();
  // shifts happening today (started today, or overnight still running)
  const todays = (shifts.data ?? []).filter((s) => dateIn(s.starts_at, tz) === today || (new Date(s.starts_at).getTime() < now && new Date(s.ends_at).getTime() > now));
  const openBy = new Map((open.data ?? []).map((e) => [e.staff_id, e]));
  const rows = (staff.data ?? []).filter((s) => s.active && (!q || s.full_name.toLowerCase().includes(q.toLowerCase())))
    .map((st) => {
      const sh = todays.filter((s) => s.staff_id === st.id);
      const es = (entries.data ?? []).filter((e) => e.staff_id === st.id && (dateIn(e.clock_in, tz) === today || !e.clock_out));
      const isIn = openBy.get(st.id);
      const lv = (leave.data ?? []).find((l) => l.staff_id === st.id && l.status === "approved");
      const first = sh[0];
      const late = first && !es.length && new Date(first.starts_at).getTime() + 10 * 60000 < now && new Date(first.ends_at).getTime() > now;
      return { st, sh, es, isIn, lv, late, rank: isIn ? 0 : late ? 1 : sh.length ? 2 : 3 };
    })
    .filter((r) => r.sh.length || r.es.length || r.isIn || q)
    .sort((a, b) => a.rank - b.rank || a.st.full_name.localeCompare(b.st.full_name));
  const inCount = rows.filter((r) => r.isIn).length;
  const lateCount = rows.filter((r) => r.late).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">On duty now</div><div className="text-2xl font-bold">{inCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Shifts today</div><div className="text-2xl font-bold">{todays.length}</div></CardContent></Card>
        <Card className={lateCount ? "border-amber-300" : ""}><CardContent className="p-4"><div className="text-sm text-slate-500">Not in yet (late)</div><div className={`text-2xl font-bold ${lateCount ? "text-amber-700" : ""}`}>{lateCount}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div><CardTitle className="text-lg">Attendance today</CardTitle><CardDescription>Clock in staff who don't use the app (guards, gardeners, casuals). Staff with a login can clock themselves in under My shifts.</CardDescription></div>
          <Input className="w-48" placeholder="Find anyone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find staff" />
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Shift</TableHead><TableHead>Clocked</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map(({ st, sh, es, isIn, lv, late }) => (
                <TableRow key={st.id}>
                  <TableCell><div className="font-medium">{st.full_name}</div><div className="text-xs text-slate-500">{st.department}</div></TableCell>
                  <TableCell className="w-40">{sh.length ? <div className="space-y-1">{sh.map((s) => <ShiftChip key={s.id} s={s} tpl={s.template_id ? tplById.get(s.template_id) : undefined} tz={tz} />)}</div> : <span className="text-slate-400 text-sm">Not on the rota</span>}</TableCell>
                  <TableCell className="text-sm">
                    {es.map((e) => (
                      <div key={e.id} className="flex items-center gap-1">
                        <span className="tabular-nums">{timeIn(e.clock_in, tz)} – {e.clock_out ? timeIn(e.clock_out, tz) : "…"}</span>
                        {e.source === "supervisor" && <Badge variant="outline" className="text-[10px] px-1 py-0">by desk</Badge>}
                        {e.edited_by && <Badge variant="outline" className="text-[10px] px-1 py-0">edited</Badge>}
                        {admin && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setFix(e.id)} aria-label="Correct times"><Pencil className="h-3 w-3" /></Button>}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>
                    {lv ? <Badge variant="outline">{LEAVE_KINDS[lv.kind]}</Badge>
                      : isIn ? <Badge className="bg-emerald-600 hover:bg-emerald-600">On duty</Badge>
                      : late ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Late</Badge>
                      : es.length ? <Badge variant="secondary">Done</Badge> : <Badge variant="outline">Expected</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isIn ? <Button size="sm" variant="outline" disabled={clock.isPending} onClick={() => clock.mutate({ action: "out", staffId: st.id })} aria-label={`Clock out ${st.full_name}`}><LogOut className="mr-1 h-4 w-4" />Clock out</Button>
                      : <Button size="sm" disabled={clock.isPending || !!lv} onClick={() => clock.mutate({ action: "in", staffId: st.id })} aria-label={`Clock in ${st.full_name}`}><LogIn className="mr-1 h-4 w-4" />Clock in</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={5}><EmptyState icon={CalendarDays} title="Nobody is on the published rota today">Search for anyone above to clock them in.</EmptyState></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {fix && <FixDialog entry={(entries.data ?? []).find((e) => e.id === fix)!} onClose={() => setFix(null)} />}
    </div>
  );
};

const FixDialog = ({ entry, onClose }: { entry: { id: string; clock_in: string; clock_out: string | null }; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const tz = hotel.timezone;
  const fix = useFixTime();
  const [din, setDin] = useState(dateIn(entry.clock_in, tz));
  const [tin, setTin] = useState(timeIn(entry.clock_in, tz));
  const [tout, setTout] = useState(entry.clock_out ? timeIn(entry.clock_out, tz) : "");
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Correct clock times</DialogTitle><DialogDescription>The change and your reason are recorded.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1 col-span-3"><Label htmlFor="fx-d">Date in</Label><Input id="fx-d" type="date" value={din} onChange={(e) => setDin(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="fx-i">In</Label><Input id="fx-i" type="time" value={tin} onChange={(e) => setTin(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="fx-o">Out</Label><Input id="fx-o" type="time" value={tout} onChange={(e) => setTout(e.target.value)} /></div>
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason, e.g. forgot to clock out" aria-label="Reason" />
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!note.trim() || fix.isPending} onClick={() => {
            const ci = localToIso(din, tin, tz);
            let co = tout ? localToIso(din, tout, tz) : null;
            if (co && co <= ci) co = localToIso(addDays(din, 1), tout, tz);
            fix.mutate({ id: entry.id, clockIn: ci, clockOut: co, note: note.trim() }, { onSuccess: onClose });
          }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ======================================================================= leave
const LeaveAdmin = () => {
  const { hotel } = useCurrentHotel();
  const staff = useStaffList();
  const leave = useLeave(addDays(todayIn(hotel.timezone), -60));
  const save = useSaveLeave();
  const [add, setAdd] = useState(false);
  const name = new Map((staff.data ?? []).map((s) => [s.id, s.full_name]));
  const list = leave.data ?? [];
  const pending = list.filter((l) => l.status === "requested");
  const rest = list.filter((l) => l.status !== "requested");
  const row = (l: LeaveRequest, actions: boolean) => (
    <TableRow key={l.id} className={l.status === "cancelled" || l.status === "refused" ? "opacity-60" : ""}>
      <TableCell className="font-medium">{name.get(l.staff_id)}</TableCell><TableCell>{LEAVE_KINDS[l.kind]}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(l.from_date)} – {formatDate(l.to_date)}<div className="text-xs text-slate-500">{Math.round((parseISO(l.to_date).getTime() - parseISO(l.from_date).getTime()) / 86400000) + 1} day(s)</div></TableCell>
      <TableCell className="text-sm text-slate-600">{l.note}</TableCell>
      <TableCell><Badge variant="outline" className={l.status === "approved" ? "border-emerald-200 text-emerald-700" : l.status === "requested" ? "border-amber-300 text-amber-800" : ""}>{{ requested: "Waiting", approved: "Approved", refused: "Refused", cancelled: "Cancelled" }[l.status]}</Badge></TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {actions && <>
          <Button size="sm" onClick={() => save.mutate({ id: l.id, status: "approved" })} aria-label={`Approve leave for ${name.get(l.staff_id)}`}><Check className="mr-1 h-4 w-4" />Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => save.mutate({ id: l.id, status: "refused" })} aria-label={`Refuse leave for ${name.get(l.staff_id)}`}><X className="h-4 w-4" /></Button>
        </>}
        {!actions && l.status === "approved" && l.to_date >= todayIn(hotel.timezone) && <Button size="sm" variant="ghost" onClick={() => save.mutate({ id: l.id, status: "cancelled" })}>Cancel</Button>}
      </TableCell>
    </TableRow>
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-lg">Waiting for you</CardTitle>
          <CardDescription>Approving leave removes that person's shifts on those days from the rota.</CardDescription></div>
          <Button size="sm" onClick={() => setAdd(true)}><Plus className="mr-1 h-4 w-4" />Record leave</Button></CardHeader>
        <CardContent className="p-0"><Table><TableBody>
          {pending.map((l) => row(l, true))}
          {!pending.length && <TableRow><TableCell className="text-center text-slate-500 py-6">No requests waiting</TableCell></TableRow>}
        </TableBody></Table></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Leave</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Note</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rest.map((l) => row(l, false))}{!rest.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No leave recorded</TableCell></TableRow>}</TableBody>
        </Table></CardContent>
      </Card>
      {add && <LeaveDialog staff={(staff.data ?? []).filter((s) => s.active)} admin onClose={() => setAdd(false)} />}
    </div>
  );
};

export const LeaveDialog = ({ staff, admin, fixedStaffId, onClose }: { staff: Staff[]; admin?: boolean; fixedStaffId?: string; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const save = useSaveLeave();
  const today = todayIn(hotel.timezone);
  const [sid, setSid] = useState(fixedStaffId ?? "");
  const [kind, setKind] = useState<LeaveKind>("annual");
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 1));
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{admin ? "Record leave" : "Ask for leave"}</DialogTitle>
          {!admin && <DialogDescription>Your manager will approve or refuse it.</DialogDescription>}</DialogHeader>
        <div className="space-y-3">
          {!fixedStaffId && (
            <div className="space-y-1"><Label>Staff</Label>
              <Select value={sid} onValueChange={setSid}><SelectTrigger aria-label="Staff member"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select></div>
          )}
          <div className="space-y-1"><Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as LeaveKind)}><SelectTrigger aria-label="Leave type"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LEAVE_KINDS) as LeaveKind[]).map((k) => <SelectItem key={k} value={k}>{LEAVE_KINDS[k]}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="lv-f">From</Label><Input id="lv-f" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></div>
            <div className="space-y-1"><Label htmlFor="lv-t">To (last day)</Label><Input id="lv-t" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="lv-n">Note</Label><Textarea id="lv-n" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!sid || save.isPending} onClick={() => save.mutate({ staff_id: sid, kind, from_date: from, to_date: to, note: note.trim() || null, status: admin ? "approved" : "requested" }, { onSuccess: onClose })}>
            {admin ? "Save as approved" : "Send request"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ======================================================================= hours
const Hours = () => {
  const { hotel, can } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const r = useHoursReport(from, to);
  const rows = r.data ?? [];
  const casualTotal = rows.filter((x) => x.employment === "casual").reduce((s, x) => s + Number(x.pay_estimate ?? 0), 0);
  const presets = [
    ["This month", `${today.slice(0, 7)}-01`, today],
    ["Last 7 days", addDays(today, -6), today],
    ["Last month", format(new Date(parseISO(`${today.slice(0, 7)}-01`).getTime() - 86400000), "yyyy-MM-01"), format(new Date(parseISO(`${today.slice(0, 7)}-01`).getTime() - 86400000), "yyyy-MM-dd")],
  ];
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          {presets.map(([l, f, t]) => <Button key={l} size="sm" variant={from === f && to === t ? "default" : "outline"} onClick={() => { setFrom(f); setTo(t); }}>{l}</Button>)}
          <div className="space-y-1 ml-auto"><Label htmlFor="hr-f" className="text-xs">From</Label><Input id="hr-f" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label htmlFor="hr-t" className="text-xs">To</Label><Input id="hr-t" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => downloadCsv(`staff-hours_${from}_${to}`,
            ["Name", "Department", "Employment", "Shifts", "Scheduled hours", "Days worked", "Hours worked", "Overtime hours", "Late", "Absent", "Leave days", "Sick days", "Pay type", "Rate", "Pay estimate"],
            rows.map((x) => [x.name, x.department, EMPLOYMENT[x.employment], x.shifts, x.scheduled_hours, x.worked_days, x.worked_hours, x.overtime_hours, x.late, x.absent, x.leave_days, x.sick_days, x.pay_type ?? "", x.rate ?? "", x.pay_estimate ?? ""]))}>
            <Download className="mr-1 h-4 w-4" />CSV for payroll</Button>
        </CardContent>
      </Card>
      {r.isLoading ? <LoadingBlock /> : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead className="text-right">Shifts</TableHead><TableHead className="text-right">Rota hours</TableHead>
                <TableHead className="text-right">Days in</TableHead><TableHead className="text-right">Hours worked</TableHead><TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Late</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Leave</TableHead><TableHead className="text-right">Pay estimate</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((x) => (
                  <TableRow key={x.staff_id}>
                    <TableCell><div className="font-medium">{x.name}</div><div className="text-xs text-slate-500">{x.department} · {EMPLOYMENT[x.employment]}{x.open ? " · still clocked in" : ""}</div></TableCell>
                    <TableCell className="text-right">{x.shifts}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(x.scheduled_hours).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{x.worked_days}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Number(x.worked_hours).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(x.overtime_hours) ? Number(x.overtime_hours).toFixed(1) : "–"}</TableCell>
                    <TableCell className={`text-right ${x.late ? "text-amber-700 font-medium" : ""}`}>{x.late || "–"}</TableCell>
                    <TableCell className={`text-right ${x.absent ? "text-red-700 font-medium" : ""}`}>{x.absent || "–"}</TableCell>
                    <TableCell className="text-right">{x.leave_days || "–"}{x.sick_days ? <div className="text-xs text-slate-500">{x.sick_days} sick</div> : null}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.pay_estimate != null ? formatMoney(Number(x.pay_estimate), "") : <span className="text-slate-400 text-xs">no rate</span>}
                      {x.pay_type && <div className="text-xs text-slate-500">{formatMoney(Number(x.rate), "")} {x.pay_type === "monthly" ? "/month" : x.pay_type === "daily" ? "/day" : "/hour"}</div>}</TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={10}><EmptyState icon={Users} title="No staff yet" /></TableCell></TableRow>}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right">{rows.reduce((s, x) => s + x.shifts, 0)}</TableCell>
                  <TableCell className="text-right">{rows.reduce((s, x) => s + Number(x.scheduled_hours), 0).toFixed(1)}</TableCell><TableCell />
                  <TableCell className="text-right">{rows.reduce((s, x) => s + Number(x.worked_hours), 0).toFixed(1)}</TableCell><TableCell colSpan={4} />
                  <TableCell className="text-right">{formatMoney(rows.reduce((s, x) => s + Number(x.pay_estimate ?? 0), 0), hotel.currency)}</TableCell></TableRow></TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-slate-500">Hours worked come from clock in/out, less the shift's break. "Absent" counts published shifts that ended with no clock-in. Pay estimates: daily rate × days in, hourly rate × hours, monthly salary × share of the month. They are a guide for payroll, not a payslip (no PAYE, NSSF, SHIF or housing levy deductions).
        {can("owner", "manager", "accountant") && casualTotal > 0 && ` Casual wages in this period: ${formatMoney(casualTotal, hotel.currency)}; record them under Expenses & profit → Casual labour when paid.`}</p>
    </div>
  );
};

// ======================================================================= people
const People = () => {
  const staff = useStaffList();
  const pay = useStaffPay(true);
  const team = useTeam();
  const imp = useImportMembers();
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const [showAll, setShowAll] = useState(false);
  const payBy = new Map((pay.data ?? []).map((p) => [p.staff_id, p]));
  const memberName = new Map((team.data ?? []).map((m) => [m.user_id, m.full_name || m.email]));
  if (staff.isLoading) return <LoadingBlock />;
  const list = (staff.data ?? []).filter((s) => showAll || s.active);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-lg">Staff</CardTitle><CardDescription>Everyone who works here, with or without an app login. Pay rates are visible only to owners, managers and accountants.</CardDescription></div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm"><Switch checked={showAll} onCheckedChange={setShowAll} />Show former staff</label>
          <Button size="sm" variant="outline" onClick={() => imp.mutate(undefined)} disabled={imp.isPending}><UserPlus className="mr-1 h-4 w-4" />Add team logins</Button>
          <Button size="sm" onClick={() => setEdit({ department: "Housekeeping", employment: "permanent", active: true })}><Plus className="mr-1 h-4 w-4" />Staff</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Job</TableHead><TableHead>Type</TableHead><TableHead>Phone</TableHead><TableHead>App login</TableHead><TableHead className="text-right">Pay</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.map((s) => {
              const p = payBy.get(s.id);
              return (
                <TableRow key={s.id} className={!s.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{s.full_name}</TableCell><TableCell>{s.department}</TableCell><TableCell>{s.job_title ?? "—"}</TableCell>
                  <TableCell>{EMPLOYMENT[s.employment]}</TableCell><TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.user_id ? <Badge variant="secondary">{memberName.get(s.user_id) ?? "Linked"}</Badge> : <span className="text-slate-400 text-sm">None</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{p ? `${formatMoney(Number(p.rate), "")} /${p.pay_type === "monthly" ? "month" : p.pay_type === "daily" ? "day" : "hour"}` : "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(s)} aria-label={`Edit ${s.full_name}`}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              );
            })}
            {!list.length && <TableRow><TableCell colSpan={8}><EmptyState icon={Users} title="No staff yet">Use "Add team logins" to bring in everyone you've invited, then add staff without logins (guards, gardeners, casuals).</EmptyState></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {edit && <StaffDialog s={edit} pay={edit.id ? payBy.get(edit.id) : undefined} members={team.data ?? []} taken={new Set((staff.data ?? []).filter((x) => x.user_id && x.id !== edit.id).map((x) => x.user_id!))} onClose={() => setEdit(null)} />}
    </Card>
  );
};

const StaffDialog = ({ s, pay, members, taken, onClose }: {
  s: Partial<Staff>; pay?: StaffPay; members: { user_id: string; full_name: string | null; email: string | null }[]; taken: Set<string>; onClose: () => void;
}) => {
  const save = useSaveStaff();
  const [f, setF] = useState<Partial<Staff>>(s);
  const [payType, setPayType] = useState<StaffPay["pay_type"] | "none">(pay?.pay_type ?? (s.employment === "casual" ? "daily" : "none"));
  const [rate, setRate] = useState(pay ? String(pay.rate) : "");
  const set = <K extends keyof Staff>(k: K, v: Staff[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{s.id ? `Edit ${s.full_name}` : "New staff member"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="st-n">Full name</Label><Input id="st-n" value={f.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="st-d">Department</Label><Input id="st-d" list="st-depts" value={f.department ?? ""} onChange={(e) => set("department", e.target.value)} />
              <datalist id="st-depts">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist></div>
            <div className="space-y-1"><Label htmlFor="st-j">Job title</Label><Input id="st-j" value={f.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} placeholder="Room attendant, chef, guard…" /></div>
            <div className="space-y-1"><Label>Employment</Label>
              <Select value={f.employment ?? "permanent"} onValueChange={(v) => set("employment", v as Employment)}><SelectTrigger aria-label="Employment"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(EMPLOYMENT) as Employment[]).map((k) => <SelectItem key={k} value={k}>{EMPLOYMENT[k]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="st-p">Phone</Label><Input id="st-p" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="st-s">Started on</Label><Input id="st-s" type="date" value={f.started_on ?? ""} onChange={(e) => set("started_on", e.target.value || null)} /></div>
            <div className="space-y-1"><Label>App login</Label>
              <Select value={f.user_id ?? "none"} onValueChange={(v) => set("user_id", v === "none" ? null : v)}><SelectTrigger aria-label="App login"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No login</SelectItem>{members.filter((m) => !taken.has(m.user_id)).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="rounded-md border p-3 grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Pay</Label>
              <Select value={payType} onValueChange={(v) => setPayType(v as typeof payType)}><SelectTrigger aria-label="Pay type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not recorded</SelectItem><SelectItem value="monthly">Monthly salary</SelectItem><SelectItem value="daily">Per day</SelectItem><SelectItem value="hourly">Per hour</SelectItem></SelectContent></Select></div>
            {payType !== "none" && <div className="space-y-1"><Label htmlFor="st-r">Rate</Label><Input id="st-r" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} /></div>}
          </div>
          <div className="space-y-1"><Label htmlFor="st-no">Notes</Label><Textarea id="st-no" rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Emergency contact, skills…" /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active ?? true} onCheckedChange={(v) => set("active", v)} />Works here now (turn off when someone leaves; their history stays)</label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.full_name?.trim() || save.isPending} onClick={() => save.mutate({
            staff: { id: f.id, full_name: f.full_name!.trim(), department: f.department?.trim() || "Front office", job_title: f.job_title?.trim() || null, phone: f.phone?.trim() || null,
              employment: f.employment ?? "permanent", user_id: f.user_id ?? null, active: f.active ?? true, started_on: f.started_on || null, notes: f.notes?.trim() || null },
            pay: payType === "none" ? (pay ? null : undefined) : { pay_type: payType, rate: Number(rate) || 0 },
          }, { onSuccess: onClose })}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ======================================================================= templates
const Templates = () => {
  const tpls = useShiftTemplates();
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const [edit, setEdit] = useState<Partial<ShiftTemplate> | null>(null);
  const colors = Object.keys(SHIFT_COLORS);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-lg">Shift types</CardTitle><CardDescription>Quick picks for the rota. Changing one doesn't change shifts already on the rota.</CardDescription></div>
        <Button size="sm" onClick={() => setEdit({ starts: "08:00", ends: "16:00", break_minutes: 30, color: "blue", sort: 10 })}><Plus className="mr-1 h-4 w-4" />Shift type</Button></CardHeader>
      <CardContent className="space-y-2">
        {(tpls.data ?? []).map((t) => (
          <div key={t.id} className={`flex items-center justify-between rounded-md border px-3 py-2 ${SHIFT_COLORS[t.color]}`}>
            <div><b>{t.name}</b> <span className="opacity-80">{t.starts.slice(0, 5)}–{t.ends.slice(0, 5)} · {t.break_minutes} min break</span></div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit(t)} aria-label={`Edit ${t.name}`}><Pencil className="h-4 w-4" /></Button>
              <ConfirmButton size="sm" variant="ghost" title={`Remove ${t.name}?`} description="Shifts already on the rota stay." onConfirm={() => del.mutate(t.id)} aria-label={`Remove ${t.name}`}><Trash2 className="h-4 w-4" /></ConfirmButton>
            </div>
          </div>
        ))}
      </CardContent>
      {edit && (
        <Dialog open onOpenChange={(v) => !v && setEdit(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{edit.id ? "Edit shift type" : "New shift type"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="tp-n">Name</Label><Input id="tp-n" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label htmlFor="tp-s">Starts</Label><Input id="tp-s" type="time" value={edit.starts?.slice(0, 5)} onChange={(e) => setEdit({ ...edit, starts: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="tp-e">Ends</Label><Input id="tp-e" type="time" value={edit.ends?.slice(0, 5)} onChange={(e) => setEdit({ ...edit, ends: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="tp-b">Break</Label><Input id="tp-b" type="number" min={0} value={edit.break_minutes} onChange={(e) => setEdit({ ...edit, break_minutes: Number(e.target.value) })} /></div>
              </div>
              <div className="flex gap-2">{colors.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setEdit({ ...edit, color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${SHIFT_COLORS[c]} ${edit.color === c ? "ring-2 ring-offset-2 ring-blue-500" : ""}`} />
              ))}</div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button disabled={!edit.name?.trim() || save.isPending} onClick={() => save.mutate({ id: edit.id, name: edit.name!.trim(), starts: edit.starts, ends: edit.ends, break_minutes: edit.break_minutes ?? 0, color: edit.color, sort: edit.sort ?? 10 }, { onSuccess: () => setEdit(null) })}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

