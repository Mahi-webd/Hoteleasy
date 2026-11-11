import { useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRooms } from "@/hooks/useHotelQueries";
import { useCreateTicket } from "@/hooks/useOperations";
import { MT_CATEGORIES, PRIORITY } from "@/lib/format";
import type { MtCategory, Priority } from "@/lib/db-types";

const ELSEWHERE = "__elsewhere__";

/** Anyone on the team can report a problem, in a room or anywhere else. */
export const ReportIssueDialog = ({ roomId, onClose }: { roomId?: string; onClose: () => void }) => {
  const rooms = useRooms();
  const create = useCreateTicket();
  const [where, setWhere] = useState(roomId ?? "");
  const [category, setCategory] = useState<MtCategory>("other");
  const [priority, setPriority] = useState<Priority>("normal");
  const [blocks, setBlocks] = useState(false);
  const room = rooms.data?.find((r) => r.id === where);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate(
      {
        room_id: where === ELSEWHERE ? null : where,
        location: where === ELSEWHERE ? String(f.get("location") ?? "") : null,
        title: String(f.get("title") ?? ""),
        description: String(f.get("description") ?? ""),
        category,
        priority,
        blocks_room: where !== ELSEWHERE && blocks,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>Maintenance will see it straight away.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Where?</Label>
            <Select value={where} onValueChange={setWhere}>
              <SelectTrigger><SelectValue placeholder="Choose a room or other place" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ELSEWHERE}>Somewhere else (kitchen, pool, lobby…)</SelectItem>
                {rooms.data?.map((r) => <SelectItem key={r.id} value={r.id}>Room {r.room_number} · {r.room_types?.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {where === ELSEWHERE && (
            <div className="space-y-2">
              <Label htmlFor="mt-location">Place</Label>
              <Input id="mt-location" name="location" required placeholder="e.g. Kitchen, Swimming pool, Generator room" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mt-title">What's wrong?</Label>
            <Input id="mt-title" name="title" required placeholder="e.g. Shower leaking, AC not cooling, TV no signal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as MtCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(MT_CATEGORIES) as MtCategory[]).map((c) => <SelectItem key={c} value={c}>{MT_CATEGORIES[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How urgent?</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRIORITY) as Priority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY[p].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mt-desc">Details (optional)</Label>
            <Textarea id="mt-desc" name="description" rows={3} placeholder="Anything that helps the technician" />
          </div>
          {where && where !== ELSEWHERE && (
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox checked={blocks} onCheckedChange={(v) => setBlocks(v === true)} className="mt-0.5" />
              <span>
                <strong>Room can't be used until fixed</strong>
                <br />
                <span className="text-slate-500">
                  {room?.status === "occupied"
                    ? "A guest is in the room now. It will be taken out of service when they check out."
                    : "The room is taken out of service and can't be booked or checked into."}
                </span>
              </span>
            </label>
          )}
          {blocks && priority !== "urgent" && priority !== "high" && (
            <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Consider High or Urgent priority for a room that can't be sold.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!where || create.isPending}>Report problem</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
