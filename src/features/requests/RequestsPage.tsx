import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO, subDays } from "date-fns";
import { BellRing, Check, Hand, Pencil, Plus, QrCode, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useInHouseGuests } from "@/hooks/usePos";
import {
  useCreateRequest, useDeleteRequestType, useRequestTypes, useRequests, useRequestsRealtime, useSaveGuestInfo, useSaveRequestType, useUpdateRequest,
} from "@/hooks/useRequests";
import { DEPT_LABEL, type GuestRequest, type RequestDept, type RequestType } from "@/lib/db-types";
import { REQUEST_ICONS } from "../public/GuestStayPage";

const DEPTS: RequestDept[] = ["front_desk", "housekeeping", "maintenance", "restaurant"];
const ROLE_DEPT: Record<string, RequestDept | undefined> = { housekeeping: "housekeeping", maintenance: "maintenance", restaurant: "restaurant" };
const STATUS_CLS = { new: "border-red-200 bg-red-50 text-red-700", acknowledged: "border-blue-200 bg-blue-50 text-blue-700", done: "border-emerald-200 bg-emerald-50 text-emerald-700", cancelled: "border-slate-200 text-slate-400" };
const STATUS_LABEL = { new: "New", acknowledged: "On it", done: "Done", cancelled: "Cancelled" };

const beep = () => {
  try {
    const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(ctx.currentTime + 0.2);
  } catch { /* no audio */ }
};

const RequestsPage = () => {
  const { role, can, allowed, customRole } = useCurrentHotel();
  const admin = allowed("requests.settings");
  const desk = customRole ? allowed("requests.edit") : can("owner", "manager", "front_desk");
  const since = useMemo(() => subDays(new Date(), 1).toISOString(), []);
  const q = useRequests(since);
  const onNew = useCallback((r: GuestRequest) => { beep(); toast.info(`New request: ${r.label}`); }, []);
  useRequestsRealtime(onNew);
  const [dept, setDept] = useState<RequestDept | "all">(ROLE_DEPT[role ?? ""] ?? "all");
  const [adding, setAdding] = useState(false);
  const list = (q.data ?? []).filter((r) => dept === "all" || r.department === dept);
  const open = list.filter((r) => r.status === "new" || r.status === "acknowledged")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "new" ? -1 : 1) || (a.wanted_at ?? a.created_at).localeCompare(b.wanted_at ?? b.created_at));
  const closed = list.filter((r) => r.status === "done" || r.status === "cancelled");
  const newCount = (q.data ?? []).filter((r) => r.status === "new" && (dept === "all" || r.department === dept)).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Guest requests" subtitle="What guests ask for from the QR code in their room, live"
        actions={desk ? <Button onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" />Log a request</Button> : null} />
      <Tabs defaultValue="live">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="live">Open{newCount ? ` (${newCount} new)` : ""}</TabsTrigger>
          <TabsTrigger value="done">Done today</TabsTrigger>
          {admin && <TabsTrigger value="setup">Setup & QR codes</TabsTrigger>}
        </TabsList>
        <TabsContent value="live" className="space-y-3">
          <DeptFilter dept={dept} setDept={setDept} counts={(q.data ?? []).filter((r) => r.status === "new" || r.status === "acknowledged")} />
          {q.isLoading ? <LoadingBlock /> : !open.length ? (
            <Card><CardContent><EmptyState icon={BellRing} title="All caught up">New requests appear here instantly, with a sound.</EmptyState></CardContent></Card>
          ) : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{open.map((r) => <RequestCard key={r.id} r={r} />)}</div>}
        </TabsContent>
        <TabsContent value="done" className="space-y-3">
          <DeptFilter dept={dept} setDept={setDept} />
          {!closed.length ? <Card><CardContent><EmptyState icon={Check} title="Nothing closed in the last day" /></CardContent></Card>
            : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{closed.map((r) => <RequestCard key={r.id} r={r} />)}</div>}
        </TabsContent>
        {admin && <TabsContent value="setup"><Setup /></TabsContent>}
      </Tabs>
      {adding && <AddDialog onClose={() => setAdding(false)} />}
    </div>
  );
};
export default RequestsPage;

const DeptFilter = ({ dept, setDept, counts }: { dept: RequestDept | "all"; setDept: (d: RequestDept | "all") => void; counts?: GuestRequest[] }) => (
  <div className="flex flex-wrap gap-1">
    {(["all", ...DEPTS] as const).map((d) => {
      const n = counts?.filter((r) => d === "all" || r.department === d).length;
      return <Button key={d} size="sm" variant={dept === d ? "default" : "outline"} onClick={() => setDept(d)}>{d === "all" ? "Everyone" : DEPT_LABEL[d]}{n ? ` (${n})` : ""}</Button>;
    })}
  </div>
);

const RequestCard = ({ r }: { r: GuestRequest }) => {
  const upd = useUpdateRequest();
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const g = r.reservations?.guests;
  const Icon = REQUEST_ICONS[({ housekeeping: "towel", maintenance: "wrench", front_desk: "bell", restaurant: "utensils" } as const)[r.department]] ?? BellRing;
  const late = r.status === "new" && Date.now() - Date.parse(r.created_at) > 15 * 60_000;
  return (
    <Card className={r.status === "new" ? (late ? "border-red-400" : "border-red-200") : ""} data-testid="request-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="rounded-md bg-slate-100 dark:bg-slate-800 p-2"><Icon className="h-5 w-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{r.label}</div>
            <div className="text-sm">Room <b>{r.rooms?.room_number ?? "?"}</b> · {g ? `${g.first_name} ${g.last_name}` : ""}</div>
          </div>
          <Badge variant="outline" className={STATUS_CLS[r.status]}>{STATUS_LABEL[r.status]}</Badge>
        </div>
        {r.details && <div className="text-sm rounded bg-slate-50 dark:bg-slate-900 p-2">“{r.details}”</div>}
        {r.wanted_at && <div className="text-sm text-violet-700">For {format(parseISO(r.wanted_at), "EEE d MMM, HH:mm")}</div>}
        {r.reply && <div className="text-xs text-blue-700">Told guest: {r.reply}</div>}
        <div className="text-xs text-slate-500">{DEPT_LABEL[r.department]} · {r.from_guest ? "from guest page" : "logged by staff"} · {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}
          {r.ticket_id && " · maintenance ticket opened"}{late && <span className="text-red-600 font-medium"> · waiting over 15 min</span>}</div>
        {replying && <div className="flex gap-2"><Input value={reply} maxLength={300} onChange={(e) => setReply(e.target.value)} placeholder="e.g. Taxi booked for 5 pm" aria-label="Reply to guest" />
          <Button size="sm" disabled={!reply.trim()} onClick={() => upd.mutate({ id: r.id, status: r.status === "new" ? "acknowledged" : r.status, reply }, { onSuccess: () => { setReplying(false); setReply(""); } })}>Send</Button></div>}
        <div className="flex flex-wrap gap-1">
          {r.status === "new" && <Button size="sm" onClick={() => upd.mutate({ id: r.id, status: "acknowledged" })}><Hand className="mr-1 h-4 w-4" />On it</Button>}
          {(r.status === "new" || r.status === "acknowledged") && <>
            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => upd.mutate({ id: r.id, status: "done" })}><Check className="mr-1 h-4 w-4" />Done</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying((v) => !v)}>Reply</Button>
            <Button size="sm" variant="ghost" aria-label={`Cancel ${r.label}`} onClick={() => upd.mutate({ id: r.id, status: "cancelled" })}><X className="h-4 w-4" /></Button>
          </>}
          {r.status === "done" && <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: r.id, status: "new" })}><RotateCcw className="mr-1 h-4 w-4" />Reopen</Button>}
        </div>
      </CardContent>
    </Card>
  );
};

const AddDialog = ({ onClose }: { onClose: () => void }) => {
  const guests = useInHouseGuests();
  const types = useRequestTypes();
  const add = useCreateRequest();
  const [res, setRes] = useState("");
  const [type, setType] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log a request</DialogTitle><DialogDescription>For a guest who phoned or asked at the desk.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Select value={res} onValueChange={setRes}><SelectTrigger aria-label="Guest"><SelectValue placeholder="Room / guest" /></SelectTrigger>
            <SelectContent>{(guests.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>Room {g.rooms?.room_number} · {g.guests?.first_name} {g.guests?.last_name}</SelectItem>)}</SelectContent></Select>
          <Select value={type} onValueChange={setType}><SelectTrigger aria-label="Request"><SelectValue placeholder="What they need" /></SelectTrigger>
            <SelectContent>{(types.data ?? []).filter((t) => t.active).map((t) => <SelectItem key={t.id} value={t.id}>{t.label} ({DEPT_LABEL[t.department]})</SelectItem>)}</SelectContent></Select>
          <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details" aria-label="Details" />
          <div className="space-y-1"><Label htmlFor="add-when">When (optional)</Label><Input id="add-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!res || !type || add.isPending} onClick={() => add.mutate({ reservationId: res, typeId: type, details, wantedAt: when ? new Date(when).toISOString() : null }, { onSuccess: onClose })}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- setup
const Setup = () => {
  const { hotel, can } = useCurrentHotel();
  const types = useRequestTypes();
  const save = useSaveRequestType();
  const del = useDeleteRequestType();
  const info = useSaveGuestInfo();
  const [editing, setEditing] = useState<Partial<RequestType> | null>(null);
  const [gi, setGi] = useState(hotel.guest_info ?? "");
  useEffect(() => setGi(hotel.guest_info ?? ""), [hotel.guest_info]);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap">
          <div><CardTitle className="text-lg">QR codes for the rooms</CardTitle>
            <CardDescription>Print a sticker or card for each room. Guests scan it, confirm their last name, and can ask for things for the rest of their stay. Their link stops working at check-out.</CardDescription></div>
          <Button variant="outline" asChild><a href="/room-qr" target="_blank" rel="noreferrer"><QrCode className="mr-1 h-4 w-4" />Print QR codes</a></Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2"><div><CardTitle className="text-lg">What guests can ask for</CardTitle>
          <CardDescription>Each goes to a team: housekeeping, maintenance, front desk or the restaurant. Repairs also open a maintenance ticket.</CardDescription></div>
          <Button size="sm" onClick={() => setEditing({ department: "front_desk", icon: "bell", active: true, sort: 20 })}><Plus className="mr-1 h-4 w-4" />Add</Button></CardHeader>
        <CardContent className="divide-y">
          {(types.data ?? []).map((t) => {
            const Icon = REQUEST_ICONS[t.icon] ?? BellRing;
            return (
              <div key={t.id} className={`py-2 flex items-center gap-3 ${t.active ? "" : "opacity-50"}`}>
                <Icon className="h-5 w-5 text-slate-500" /><div className="flex-1"><div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-slate-500">{DEPT_LABEL[t.department]}{t.ask_time ? " · asks for a time" : ""}{t.ask_details ? " · asks for details" : ""}</div></div>
                <Switch checked={t.active} onCheckedChange={(v) => save.mutate({ id: t.id, active: v })} aria-label={`${t.label} offered`} />
                <Button size="icon" variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit ${t.label}`}><Pencil className="h-4 w-4" /></Button>
                <ConfirmButton size="icon" variant="ghost" title={`Remove ${t.label}?`} onConfirm={() => del.mutate(t.id)} aria-label={`Remove ${t.label}`}><Trash2 className="h-4 w-4" /></ConfirmButton>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Good to know (shown on the guest page)</CardTitle>
          <CardDescription>Wi-Fi name and password, breakfast hours, pool times, emergency number…</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={5} maxLength={2000} value={gi} onChange={(e) => setGi(e.target.value)} aria-label="Guest information"
            placeholder={"Wi-Fi: Olsupat-Guest · password: karibu2026\nBreakfast 6:30–10:00 in the restaurant\nPool open 7:00–19:00"} />
          <div className="flex justify-end"><Button size="sm" disabled={gi === (hotel.guest_info ?? "") || info.isPending} onClick={() => info.mutate(gi)}>Save</Button></div>
        </CardContent>
      </Card>
      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing.id ? "Edit request" : "New request type"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="rt-label">Label</Label><Input id="rt-label" value={editing.label ?? ""} maxLength={60} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={editing.department} onValueChange={(v) => setEditing({ ...editing, department: v as RequestDept })}>
                  <SelectTrigger aria-label="Team"><SelectValue /></SelectTrigger><SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{DEPT_LABEL[d]}</SelectItem>)}</SelectContent></Select>
                <Select value={editing.icon} onValueChange={(v) => setEditing({ ...editing, icon: v })}>
                  <SelectTrigger aria-label="Icon"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(REQUEST_ICONS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.ask_time} onCheckedChange={(v) => setEditing({ ...editing, ask_time: v })} />Ask the guest for a time</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.ask_details} onCheckedChange={(v) => setEditing({ ...editing, ask_details: v })} />Ask for details</label>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={!editing.label?.trim() || save.isPending} onClick={() => save.mutate({ id: editing.id, label: editing.label!.trim(), department: editing.department, icon: editing.icon,
                ask_time: !!editing.ask_time, ask_details: !!editing.ask_details, active: editing.active ?? true, sort: editing.sort ?? 20 }, { onSuccess: () => setEditing(null) })}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
