import { useMemo, useState, type FormEvent } from "react";
import { BedDouble, CheckCircle2, Play, Plus, RotateCcw, Sparkles, UserRound, Wrench, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRooms, useTeam } from "@/hooks/useHotelQueries";
import { useCreateStayovers, useCreateTask, useHousekeepingTasks, useUpdateTask } from "@/hooks/useOperations";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { HK_STATUS, HK_TYPES, PRIORITY, ROOM_STATUS, timeAgo, todayIn } from "@/lib/format";
import type { HkTask, HkTaskType, Priority } from "@/lib/db-types";
import { ReportIssueDialog } from "../maintenance/ReportIssueDialog";

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const TYPE_ORDER: Record<HkTaskType, number> = { checkout_clean: 0, deep_clean: 1, inspection: 2, stayover_clean: 3, turndown: 4 };

const HousekeepingPage = () => {
  const { user } = useAuth();
  const { hotel, can } = useCurrentHotel();
  const isSupervisor = can("owner", "manager", "front_desk");
  const tasks = useHousekeepingTasks();
  const team = useTeam();
  const stayovers = useCreateStayovers();
  const names = useMemo(() => new Map(team.data?.map((m) => [m.user_id, m.full_name || m.email]) ?? []), [team.data]);
  const housekeepers = (team.data ?? []).filter((m) => m.role === "housekeeping" || m.role === "manager" || m.role === "owner");
  const [view, setView] = useState<"all" | "mine">(can("housekeeping") ? "mine" : "all");
  const [adding, setAdding] = useState(false);
  const [reportRoom, setReportRoom] = useState<string | null>(null);
  const today = todayIn(hotel.timezone);

  const all = tasks.data ?? [];
  const visible = all.filter((t) => view === "all" || t.assigned_to === user?.id || (t.assigned_to === null && t.status !== "done"));
  const sortOpen = (a: HkTask, b: HkTask) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    TYPE_ORDER[a.task_type] - TYPE_ORDER[b.task_type] ||
    (a.rooms?.room_number ?? "").localeCompare(b.rooms?.room_number ?? "", undefined, { numeric: true });
  const inProgress = visible.filter((t) => t.status === "in_progress").sort(sortOpen);
  const pending = visible.filter((t) => t.status === "pending").sort(sortOpen);
  const done = visible
    .filter((t) => t.status === "done" && (t.completed_at ?? "").slice(0, 10) >= today.slice(0, 10))
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const stats = {
    todo: all.filter((t) => t.status === "pending").length,
    cleaning: all.filter((t) => t.status === "in_progress").length,
    urgent: all.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.priority === "urgent").length,
    done: all.filter((t) => t.status === "done" && (t.completed_at ?? "") >= today).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Housekeeping"
        subtitle="Rooms to clean today. Tap Start when you begin and Done when the room is ready."
        actions={
          <>
            <Button variant="outline" disabled={stayovers.isPending} onClick={() => stayovers.mutate(undefined)}>
              <Sparkles className="mr-2 h-4 w-4" />Daily service for occupied rooms
            </Button>
            <Button onClick={() => setAdding(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600"><Plus className="mr-2 h-4 w-4" />Add task</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="To do" value={stats.todo} />
        <Stat label="Being cleaned" value={stats.cleaning} />
        <Stat label="Urgent (guest arriving)" value={stats.urgent} tone={stats.urgent ? "red" : undefined} />
        <Stat label="Done today" value={stats.done} tone="green" />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "all" | "mine")}>
        <TabsList>
          <TabsTrigger value="mine"><UserRound className="mr-1 h-4 w-4" />My rooms</TabsTrigger>
          <TabsTrigger value="all">Everyone</TabsTrigger>
        </TabsList>
      </Tabs>

      {tasks.isLoading ? <LoadingBlock /> : !inProgress.length && !pending.length && !done.length ? (
        <Card><CardContent><EmptyState icon={BedDouble} title="Nothing to clean right now">Rooms appear here automatically when guests check out.</EmptyState></CardContent></Card>
      ) : (
        <>
          <Section title="Cleaning now" tasks={inProgress} names={names} housekeepers={housekeepers} canAssign={isSupervisor} onReport={setReportRoom} />
          <Section title="To do" tasks={pending} names={names} housekeepers={housekeepers} canAssign={isSupervisor} onReport={setReportRoom} />
          <Section title="Done today" tasks={done} names={names} housekeepers={housekeepers} canAssign={false} onReport={setReportRoom} compact />
        </>
      )}

      {adding && <AddTaskDialog housekeepers={housekeepers} onClose={() => setAdding(false)} />}
      {reportRoom && <ReportIssueDialog roomId={reportRoom} onClose={() => setReportRoom(null)} />}
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: "red" | "green" }) => (
  <Card className={tone === "red" ? "border-red-300" : ""}>
    <CardContent className="p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${tone === "red" ? "text-red-600" : tone === "green" ? "text-green-600" : ""}`}>{value}</div>
    </CardContent>
  </Card>
);

const Section = ({
  title, tasks, names, housekeepers, canAssign, onReport, compact,
}: {
  title: string; tasks: HkTask[]; names: Map<string, string>; housekeepers: { user_id: string; full_name: string | null; email: string }[];
  canAssign: boolean; onReport: (roomId: string) => void; compact?: boolean;
}) =>
  tasks.length ? (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-slate-500">{title} ({tasks.length})</div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {tasks.map((t) => compact ? (
          <Card key={t.id} className="bg-green-50/50 dark:bg-slate-900/60">
            <CardContent className="p-3">
              <div className="text-lg font-bold">{t.rooms?.room_number}</div>
              <div className="text-xs text-slate-500">{HK_TYPES[t.task_type]}</div>
              <div className="text-xs text-slate-500">{t.completed_by ? names.get(t.completed_by) ?? "" : ""} · {t.completed_at ? timeAgo(t.completed_at) : ""}</div>
            </CardContent>
          </Card>
        ) : (
          <TaskCard key={t.id} t={t} names={names} housekeepers={housekeepers} canAssign={canAssign} onReport={onReport} />
        ))}
      </div>
    </div>
  ) : null;

const TaskCard = ({
  t, names, housekeepers, canAssign, onReport,
}: { t: HkTask; names: Map<string, string>; housekeepers: { user_id: string; full_name: string | null; email: string }[]; canAssign: boolean; onReport: (roomId: string) => void }) => {
  const { user } = useAuth();
  const { can } = useCurrentHotel();
  const update = useUpdateTask();
  const room = t.rooms;
  const blocked = room?.status === "maintenance" || room?.status === "out_of_order";

  return (
    <Card className={`${t.priority === "urgent" ? "border-2 border-red-400" : ""} bg-white/80 dark:bg-slate-900/70`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-3xl font-bold leading-none">{room?.room_number}</div>
            <div className="text-xs text-slate-500 mt-1">{room?.room_types?.name}{room?.floor != null ? ` · Floor ${room.floor}` : ""}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className={HK_STATUS[t.status].className}>{HK_STATUS[t.status].label}</Badge>
            {t.priority !== "normal" && <Badge variant="outline" className={PRIORITY[t.priority].className}>{PRIORITY[t.priority].label}</Badge>}
          </div>
        </div>
        <div className="text-sm">
          <span className="font-medium">{HK_TYPES[t.task_type]}</span>
          {room && <span className="text-slate-500"> · room is {ROOM_STATUS[room.status].label.toLowerCase()}</span>}
          {t.notes && <div className="text-blue-700 text-sm">{t.notes}</div>}
          {blocked && <div className="text-orange-700 text-xs mt-1">Room is waiting for maintenance.</div>}
        </div>

        {canAssign ? (
          <Select value={t.assigned_to ?? "none"} onValueChange={(v) => update.mutate({ id: t.id, patch: { assigned_to: v === "none" ? null : v }, message: "Assigned" })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not assigned</SelectItem>
              {housekeepers.map((h) => <SelectItem key={h.user_id} value={h.user_id}>{h.full_name || h.email}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs text-slate-500">{t.assigned_to ? `Assigned to ${t.assigned_to === user?.id ? "you" : names.get(t.assigned_to) ?? "someone"}` : "Not assigned"}</div>
        )}

        <div className="flex gap-2">
          {t.status === "pending" && (
            <Button className="flex-1 h-11" variant="outline"
              onClick={() => update.mutate({ id: t.id, patch: { status: "in_progress", ...(t.assigned_to ? {} : { assigned_to: user?.id ?? null }) }, message: `Started room ${room?.room_number}` })}>
              <Play className="mr-2 h-4 w-4" />Start
            </Button>
          )}
          <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700" disabled={update.isPending}
            onClick={() => update.mutate({ id: t.id, patch: { status: "done" }, message: `Room ${room?.room_number} done${t.task_type === "checkout_clean" && !blocked ? " — ready to sell" : ""}` })}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Done
          </Button>
        </div>
        <div className="flex justify-between text-xs">
          <button className="text-slate-500 hover:text-orange-700 flex items-center gap-1" onClick={() => onReport(t.room_id)}>
            <Wrench className="h-3.5 w-3.5" />Report a problem
          </button>
          <span className="flex gap-3">
            {t.status === "in_progress" && (
              <button className="text-slate-500 hover:text-slate-800 flex items-center gap-1" onClick={() => update.mutate({ id: t.id, patch: { status: "pending" }, message: "Moved back to To do" })}>
                <RotateCcw className="h-3.5 w-3.5" />Undo start
              </button>
            )}
            {can("owner", "manager", "front_desk") && (
              <button className="text-slate-500 hover:text-red-700 flex items-center gap-1"
                onClick={() => confirm(`Cancel this ${HK_TYPES[t.task_type].toLowerCase()} for room ${room?.room_number}?`) && update.mutate({ id: t.id, patch: { status: "cancelled" }, message: "Task cancelled" })}>
                <X className="h-3.5 w-3.5" />Cancel
              </button>
            )}
          </span>
        </div>
        {t.started_at && t.status === "in_progress" && <div className="text-xs text-slate-400">Started {timeAgo(t.started_at)}</div>}
      </CardContent>
    </Card>
  );
};

const AddTaskDialog = ({ housekeepers, onClose }: { housekeepers: { user_id: string; full_name: string | null; email: string }[]; onClose: () => void }) => {
  const rooms = useRooms();
  const create = useCreateTask();
  const [roomId, setRoomId] = useState("");
  const [type, setType] = useState<HkTaskType>("deep_clean");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assignee, setAssignee] = useState("none");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      { room_id: roomId, task_type: type, priority, notes: String(new FormData(e.currentTarget).get("notes") ?? ""), assigned_to: assignee === "none" ? null : assignee },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add housekeeping task</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Choose room" /></SelectTrigger>
              <SelectContent>{rooms.data?.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.room_number} · {ROOM_STATUS[r.status].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Task</Label>
              <Select value={type} onValueChange={(v) => setType(v as HkTaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(HK_TYPES) as HkTaskType[]).map((k) => <SelectItem key={k} value={k}>{HK_TYPES[k]}</SelectItem>)}</SelectContent>
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
            <Label>Assign to</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Anyone</SelectItem>
                {housekeepers.map((h) => <SelectItem key={h.user_id} value={h.user_id}>{h.full_name || h.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hk-notes">Notes</Label>
            <Input id="hk-notes" name="notes" placeholder="e.g. Extra bed, VIP amenities, change curtains" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!roomId || create.isPending}>Add task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HousekeepingPage;
