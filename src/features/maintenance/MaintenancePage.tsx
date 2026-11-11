import { useMemo, useState, type FormEvent } from "react";
import { Ban, MapPin, Plus, Search, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import { useTickets, useUpdateTicket } from "@/hooks/useOperations";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { MT_CATEGORIES, MT_STATUS, PRIORITY, ROLE_LABELS, formatMoney, timeAgo } from "@/lib/format";
import type { MtStatus, MtTicket, Priority } from "@/lib/db-types";
import { ReportIssueDialog } from "./ReportIssueDialog";

type View = "open" | "mine" | "fixed" | "all";
const OPEN: MtStatus[] = ["open", "in_progress", "on_hold"];
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const MaintenancePage = () => {
  const { user } = useAuth();
  const { can } = useCurrentHotel();
  const tickets = useTickets();
  const team = useTeam();
  const names = useMemo(() => new Map(team.data?.map((m) => [m.user_id, m.full_name || m.email]) ?? []), [team.data]);
  const [view, setView] = useState<View>(can("maintenance") ? "mine" : "open");
  const [search, setSearch] = useState("");
  const [reporting, setReporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tickets.data ?? [])
      .filter((t) => {
        if (view === "open" && !OPEN.includes(t.status)) return false;
        if (view === "mine" && !(OPEN.includes(t.status) && t.assigned_to === user?.id)) return false;
        if (view === "fixed" && t.status !== "resolved") return false;
        return !q || [t.title, t.location, t.rooms?.room_number, `#${t.number}`, t.description].some((v) => v?.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        OPEN.includes(a.status) && OPEN.includes(b.status)
          ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
      );
  }, [tickets.data, view, search, user?.id]);

  const all = tickets.data ?? [];
  const openCount = all.filter((t) => OPEN.includes(t.status)).length;
  const mineCount = all.filter((t) => OPEN.includes(t.status) && t.assigned_to === user?.id).length;
  const blocked = all.filter((t) => OPEN.includes(t.status) && t.blocks_room).length;
  const current = all.find((t) => t.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Repairs and problems around the hotel"
        actions={<Button onClick={() => setReporting(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600"><Plus className="mr-2 h-4 w-4" />Report problem</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Open issues</div><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Rooms out of service</div><div className={`text-2xl font-bold ${blocked ? "text-red-600" : ""}`}>{blocked}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Assigned to me</div><div className="text-2xl font-bold">{mineCount}</div></CardContent></Card>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
            <TabsTrigger value="fixed">Fixed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issues, rooms, places" className="pl-9" />
        </div>
      </div>

      {tickets.isLoading ? <LoadingBlock /> : !list.length ? (
        <Card><CardContent><EmptyState icon={Wrench} title={view === "mine" ? "Nothing assigned to you" : view === "open" ? "No open issues 🎉" : "No issues"} /></CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="text-left">
              <Card className={`h-full hover:shadow-md transition ${t.priority === "urgent" && OPEN.includes(t.status) ? "border-red-400 border-2" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{t.title}</div>
                    <span className="text-xs text-slate-400">#{t.number}</span>
                  </div>
                  <div className="text-sm text-slate-600 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />{t.rooms ? `Room ${t.rooms.room_number}` : t.location}
                    {t.blocks_room && OPEN.includes(t.status) && <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 border-red-200"><Ban className="h-3 w-3 mr-1" />Out of service</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className={MT_STATUS[t.status].className}>{MT_STATUS[t.status].label}</Badge>
                    <Badge variant="outline" className={PRIORITY[t.priority].className}>{PRIORITY[t.priority].label}</Badge>
                    <Badge variant="secondary" className="font-normal">{MT_CATEGORIES[t.category]}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    Reported {timeAgo(t.created_at)}{t.reported_by && names.get(t.reported_by) ? ` by ${names.get(t.reported_by)}` : ""}
                    {t.assigned_to && <> · {names.get(t.assigned_to) ?? "assigned"}</>}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {reporting && <ReportIssueDialog onClose={() => setReporting(false)} />}
      {current && <TicketSheet ticket={current} names={names} onClose={() => setOpenId(null)} />}
    </div>
  );
};

const TicketSheet = ({ ticket: t, names, onClose }: { ticket: MtTicket; names: Map<string, string>; onClose: () => void }) => {
  const { user } = useAuth();
  const { hotel, can } = useCurrentHotel();
  const team = useTeam();
  const update = useUpdateTicket();
  const canWork = can("owner", "manager", "maintenance", "front_desk") || t.assigned_to === user?.id;
  const [status, setStatus] = useState<MtStatus>(t.status);
  const [priority, setPriority] = useState<Priority>(t.priority);
  const [assignee, setAssignee] = useState<string>(t.assigned_to ?? "none");
  const [blocks, setBlocks] = useState(t.blocks_room);
  const technicians = (team.data ?? []).filter((m) => ["maintenance", "manager", "owner"].includes(m.role));

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cost = String(f.get("cost") ?? "").trim();
    update.mutate(
      {
        id: t.id,
        patch: {
          status,
          priority,
          assigned_to: assignee === "none" ? null : assignee,
          blocks_room: !!t.room_id && blocks,
          resolution_notes: String(f.get("resolution_notes") ?? "").trim() || null,
          cost: cost === "" ? null : Number(cost),
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>#{t.number} · {t.title}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400" />{t.rooms ? `Room ${t.rooms.room_number}` : t.location}</div>
            <div className="text-slate-500">{MT_CATEGORIES[t.category]} · reported {timeAgo(t.created_at)}{t.reported_by && names.get(t.reported_by) ? ` by ${names.get(t.reported_by)}` : ""}</div>
            {t.resolved_at && <div className="text-green-700">Fixed {timeAgo(t.resolved_at)}{t.resolved_by && names.get(t.resolved_by) ? ` by ${names.get(t.resolved_by)}` : ""}</div>}
          </div>
          {t.description && <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-3 whitespace-pre-line">{t.description}</div>}

          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={!canWork} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as MtStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(MT_STATUS) as MtStatus[]).map((s) => <SelectItem key={s} value={s}>{MT_STATUS[s].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(PRIORITY) as Priority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assigned to</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nobody yet</SelectItem>
                    {technicians.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || m.email} · {ROLE_LABELS[m.role]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {t.room_id && (
                <label className="flex items-center gap-2"><Switch checked={blocks} onCheckedChange={setBlocks} />Room out of service until fixed</label>
              )}
              <div className="space-y-2">
                <Label htmlFor="mt-res">What was done</Label>
                <Textarea id="mt-res" name="resolution_notes" rows={3} defaultValue={t.resolution_notes ?? ""} placeholder="e.g. Replaced shower mixer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt-cost">Cost of repair ({hotel.currency}, optional)</Label>
                <Input id="mt-cost" name="cost" type="number" min={0} step="1" defaultValue={t.cost ?? ""} />
                {t.cost != null && <p className="text-xs text-slate-500">Recorded: {formatMoney(t.cost, hotel.currency)}</p>}
              </div>
              {status === "resolved" && t.status !== "resolved" && t.blocks_room && (
                <p className="text-xs text-blue-700">The room will be sent to housekeeping for cleaning before it can be sold again.</p>
              )}
            </fieldset>
            {canWork ? (
              <Button type="submit" className="w-full" disabled={update.isPending}>Save</Button>
            ) : (
              <p className="text-xs text-slate-500">Only managers, maintenance staff or the person assigned can update this issue.</p>
            )}
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MaintenancePage;
