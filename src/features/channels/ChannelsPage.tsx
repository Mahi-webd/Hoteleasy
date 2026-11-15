import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Copy, Info, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, LoadingBlock } from "@/components/common/PageHeader";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRooms } from "@/hooks/useHotelQueries";
import { CHANNELS, feedUrl, useChannelEvents, useChannelLinks, useDeleteLink, useSaveLink, useSyncLink, type LinkDraft } from "@/hooks/useChannels";
import { formatShortDate, timeAgo } from "@/lib/format";
import type { ChannelEvent, ChannelKind, ChannelLink } from "@/lib/db-types";

const COLORS: Record<ChannelKind, string> = {
  booking_com: "bg-blue-700 hover:bg-blue-700", airbnb: "bg-rose-500 hover:bg-rose-500", expedia: "bg-amber-500 hover:bg-amber-500",
  vrbo: "bg-indigo-600 hover:bg-indigo-600", other: "bg-slate-600 hover:bg-slate-600",
};
const EVENT: Record<ChannelEvent["status"], { label: string; cls: string }> = {
  booked: { label: "Booked here", cls: "bg-green-100 text-green-800" },
  conflict: { label: "Double booked", cls: "bg-red-100 text-red-800" },
  skipped: { label: "Block, skipped", cls: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 line-through" },
  past: { label: "Past", cls: "bg-slate-100 text-slate-500" },
};

const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Link copied. Paste it into the site's calendar import."), () => toast.error("Couldn't copy: select the link and copy it"));

/** Booking.com / Airbnb / Expedia calendar sync (iCal), one room per link. */
const ChannelsPage = () => {
  const { allowed } = useCurrentHotel();
  const links = useChannelLinks();
  const sync = useSyncLink();
  const del = useDeleteLink();
  const canEdit = allowed("channels.edit");
  const canSync = allowed("channels.edit", "reservations.create");
  const [editing, setEditing] = useState<LinkDraft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  if (links.isLoading) return <LoadingBlock />;
  const rows = links.data ?? [];
  const problems = rows.filter((l) => l.last_sync_ok === false);

  return (
    <div className="space-y-6">
      <PageHeader title="Booking.com & Airbnb"
        subtitle="Keep each room's calendar in step with the booking sites, so the same night is never sold twice."
        actions={canEdit && <Button onClick={() => setEditing({ channel: "booking_com", name: "", room_id: "", import_url: "", import_blocks: false, enabled: true })}>
          <Plus className="mr-1 h-4 w-4" />Add calendar link</Button>} />

      {problems.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4 flex gap-3" data-testid="channel-problems">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="text-sm space-y-1">
            {problems.map((l) => (
              <div key={l.id}><b>{CHANNELS[l.channel]}, room {l.rooms?.room_number}:</b> {l.last_sync_message}</div>
            ))}
            <div className="text-slate-600 dark:text-slate-300">Open the link below to see which booking. A double booking is kept without a room: move one of the guests.</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Calendar links</CardTitle>
            <CardDescription>Bookings from the sites arrive here within about 10 minutes. Your bookings close the room on the sites the next time they read your calendar (Airbnb and Booking.com do this every few hours).</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setHelp((h) => !h)}><Info className="mr-1 h-4 w-4" />How to connect</Button>
        </CardHeader>
        {help && <CardContent className="pt-0"><HowTo /></CardContent>}
        <CardContent className="p-0">
          {!rows.length ? (
            <div className="px-6 pb-6 text-sm text-slate-500">No calendar links yet.{canEdit && " Add one for each room you sell on Booking.com, Airbnb or Expedia."}</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Site</TableHead><TableHead>Room</TableHead><TableHead>Last read</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.flatMap((l) => [
                    <TableRow key={l.id} className={l.enabled ? "" : "opacity-60"} data-testid={`link-${l.id}`}>
                      <TableCell><button onClick={() => setOpen(open === l.id ? null : l.id)} aria-label={`Show bookings from ${CHANNELS[l.channel]} for room ${l.rooms?.room_number}`}>
                        {open === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TableCell>
                      <TableCell><Badge className={COLORS[l.channel]}>{CHANNELS[l.channel]}</Badge>{l.name && <div className="text-xs text-slate-500 mt-1">{l.name}</div>}</TableCell>
                      <TableCell><div className="font-medium">Room {l.rooms?.room_number}</div><div className="text-xs text-slate-500">{l.rooms?.room_types?.name}</div></TableCell>
                      <TableCell className="text-sm">
                        {!l.enabled ? <span className="text-slate-500">Paused</span>
                          : !l.import_url ? <span className="text-slate-500">Only sending our calendar</span>
                          : !l.last_sync_at ? <span className="text-slate-500">Not read yet</span>
                          : <div className={l.last_sync_ok === false ? "text-red-700" : ""}>
                              <span className="inline-flex items-center gap-1">{l.last_sync_ok === false ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}{timeAgo(l.last_sync_at)}</span>
                              <div className="text-xs text-slate-500">{l.last_sync_message}</div>
                            </div>}
                        <div className="text-xs text-slate-400 mt-0.5">{l.last_export_at ? `Site read our calendar ${timeAgo(l.last_export_at)}` : "Site hasn't read our calendar yet"}</div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {canSync && l.import_url && l.enabled && (
                          <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate(l.id)}>
                            {sync.isPending && sync.variables === l.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Sync now</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => copy(feedUrl(l.export_token))} title="Copy our calendar link for this room"><Copy className="h-4 w-4" /><span className="sr-only">Copy our calendar link</span></Button>
                        {canEdit && <Button size="sm" variant="ghost" aria-label="Edit link" onClick={() => setEditing({ id: l.id, channel: l.channel, name: l.name ?? "", room_id: l.room_id, import_url: l.import_url ?? "", import_blocks: l.import_blocks, enabled: l.enabled })}><Pencil className="h-4 w-4" /></Button>}
                        {canEdit && <ConfirmButton size="sm" variant="ghost" aria-label="Remove link" title={`Remove the ${CHANNELS[l.channel]} link for room ${l.rooms?.room_number}?`}
                          description="Upcoming bookings imported from this link are cancelled here (not on the site). Also remove our calendar from the site."
                          onConfirm={() => del.mutate(l.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>}
                      </TableCell>
                    </TableRow>,
                    open === l.id ? <TableRow key={`${l.id}-detail`}><TableCell colSpan={5} className="bg-slate-50 dark:bg-slate-900/50"><LinkDetail l={l} /></TableCell></TableRow> : null,
                ])}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {editing && <LinkDialog draft={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const LinkDetail = ({ l }: { l: ChannelLink }) => {
  const ev = useChannelEvents(l.id);
  return (
    <div className="space-y-3 py-1">
      <div className="space-y-1">
        <Label className="text-xs">Our calendar for room {l.rooms?.room_number}: paste into {CHANNELS[l.channel]} → calendar import</Label>
        <div className="flex gap-2"><Input readOnly value={feedUrl(l.export_token)} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" variant="outline" onClick={() => copy(feedUrl(l.export_token))}><Copy className="mr-1 h-4 w-4" />Copy</Button></div>
      </div>
      {ev.isLoading ? <div className="text-sm text-slate-500">Loading…</div> : !ev.data?.length ? (
        <div className="text-sm text-slate-500">{l.import_url ? "No upcoming bookings in the site's calendar." : "Add the site's calendar link to bring its bookings in."}</div>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nights</TableHead><TableHead>From the site</TableHead><TableHead>Here</TableHead></TableRow></TableHeader>
          <TableBody>
            {ev.data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{formatShortDate(e.check_in)} → {formatShortDate(e.check_out)}</TableCell>
                <TableCell className="text-sm">{e.summary || "Booked"}</TableCell>
                <TableCell>
                  <span className={`text-xs rounded px-2 py-0.5 ${EVENT[e.status].cls}`}>{EVENT[e.status].label}</span>
                  {e.reservations?.code && <span className="ml-2 font-mono text-xs">{e.reservations.code}</span>}
                  {e.message && <div className={`text-xs mt-1 ${e.status === "conflict" ? "text-red-700" : "text-slate-500"}`}>{e.message}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

const LinkDialog = ({ draft, onClose }: { draft: LinkDraft; onClose: () => void }) => {
  const rooms = useRooms();
  const save = useSaveLink();
  const [d, setD] = useState<LinkDraft>(draft);
  const set = <K extends keyof LinkDraft>(k: K, v: LinkDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? "Edit calendar link" : "Add calendar link"}</DialogTitle>
          <DialogDescription>One link per room and site. Booking.com only offers calendar sync when each room is listed on its own (one unit per room type).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Site</Label>
              <Select value={d.channel} onValueChange={(v) => setD((x) => ({ ...x, channel: v as ChannelKind, import_blocks: v === "booking_com" ? x.import_blocks : false }))}>
                <SelectTrigger aria-label="Site"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CHANNELS) as ChannelKind[]).map((c) => <SelectItem key={c} value={c}>{CHANNELS[c]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Room</Label>
              <Select value={d.room_id} onValueChange={(v) => set("room_id", v)}>
                <SelectTrigger aria-label="Room"><SelectValue placeholder="Pick a room" /></SelectTrigger>
                <SelectContent>{(rooms.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>Room {r.room_number} · {r.room_types?.name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ch-name">Listing name (optional)</Label>
            <Input id="ch-name" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Garden cottage with river view" /></div>
          <div className="space-y-1.5"><Label htmlFor="ch-url">The site's calendar link (export)</Label>
            <Input id="ch-url" value={d.import_url} onChange={(e) => set("import_url", e.target.value)} placeholder="https://…ics" className="font-mono text-xs" />
            <p className="text-xs text-slate-500">{d.channel === "airbnb" ? "Airbnb: Calendar → Availability → Connect calendars → Connect to another website → copy the link."
              : d.channel === "booking_com" ? "Booking.com extranet: Rates & availability → Sync calendars → Export calendar. Choose \"Booked dates only\"."
              : "Copy the calendar export (iCal/.ics) link from the site."} Leave empty to only send our calendar.</p></div>
          <label className="flex items-start gap-3"><Switch checked={d.import_blocks} onCheckedChange={(v) => set("import_blocks", v)} aria-label="Import blocked dates" />
            <span className="text-sm">Also import "not available" dates as bookings
              <span className="block text-xs text-slate-500">Leave off for Airbnb: its feed repeats the dates it got from us.</span></span></label>
          <label className="flex items-center gap-3"><Switch checked={d.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="Link on" /><span className="text-sm">Link on</span></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!d.room_id || save.isPending} onClick={() => save.mutate(d, { onSuccess: onClose })}>{d.id ? "Save" : "Add link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const HowTo = () => (
  <div className="grid md:grid-cols-2 gap-4 text-sm rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
    <div className="space-y-1">
      <div className="font-semibold">Airbnb (one listing = one room)</div>
      <ol className="list-decimal ml-5 space-y-0.5 text-slate-700 dark:text-slate-300">
        <li>Here: <b>Add calendar link</b>, site Airbnb, pick the room.</li>
        <li>Airbnb → Calendar → the listing → Availability → <b>Connect calendars</b>.</li>
        <li><b>Import</b>: paste our link (copy button in the list), name it "HotelEasy".</li>
        <li><b>Export</b>: copy Airbnb's link and paste it into the link here.</li>
      </ol>
    </div>
    <div className="space-y-1">
      <div className="font-semibold">Booking.com (each room listed on its own)</div>
      <ol className="list-decimal ml-5 space-y-0.5 text-slate-700 dark:text-slate-300">
        <li>Extranet → Rates &amp; availability → <b>Sync calendars</b>. Only shown when the room type has 1 unit.</li>
        <li><b>Import calendar</b>: paste our link for that room.</li>
        <li><b>Export calendar</b>: choose "Booked dates only", copy the link, paste it here.</li>
        <li>For many rooms of the same type on Booking.com, a channel manager connection is needed instead.</li>
      </ol>
    </div>
    <p className="md:col-span-2 text-xs text-slate-500">Imported bookings show the site as the source, with "Airbnb guest" as the name and price 0: add the real name and price at check-in (the site collects the money). If a site cancels a booking, it is cancelled here too. Airbnb doesn't always release dates it got from us when a booking here is cancelled: open the night on Airbnb if it stays blocked.</p>
  </div>
);

export default ChannelsPage;
