import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Crown, LogIn, LogOut, MoreVertical, Pencil, Plus, Search, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useAvailableRooms, useCancelReservation, useCheckIn, useCheckOut, useReservations, useRooms } from "@/hooks/useHotelQueries";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { RES_STATUS, ROOM_STATUS, SOURCE_LABELS, addDays, formatMoney, formatShortDate, guestName, todayIn } from "@/lib/format";
import type { Reservation, ReservationStatus } from "@/lib/db-types";
import { ReservationDialog } from "./ReservationDialog";

type View = "arrivals" | "inhouse" | "departures" | "upcoming" | "all" | "calendar";

const ReservationsPage = () => {
  const { hotel, can } = useCurrentHotel();
  const canEdit = can("owner", "manager", "front_desk");
  const today = todayIn(hotel.timezone);
  const [view, setView] = useState<View>("arrivals");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(addDays(today, 60));
  const [editing, setEditing] = useState<{ r?: Reservation; defaults?: { check_in?: string; room_id?: string; room_type_id?: string } } | null>(null);
  const [checkingIn, setCheckingIn] = useState<Reservation | null>(null);

  // One query covering today's operational views; a ranged one for "all".
  const active = useReservations({ from: addDays(today, -60), to: addDays(today, 365) });
  const ranged = useReservations({ from, to, status });
  const source = view === "all" ? ranged : active;

  const rows = useMemo(() => {
    const list = source.data ?? [];
    const q = search.trim().toLowerCase();
    const byView = list.filter((r) => {
      switch (view) {
        case "arrivals": return r.status === "confirmed" && r.check_in <= today;
        case "inhouse": return r.status === "checked_in";
        case "departures": return r.status === "checked_in" && r.check_out <= today;
        case "upcoming": return r.status === "confirmed" && r.check_in > today;
        default: return true;
      }
    });
    return q
      ? byView.filter((r) =>
          [r.code, guestName(r.guests), r.guests?.phone, r.rooms?.room_number].some((v) => v?.toLowerCase().includes(q)),
        )
      : byView;
  }, [source.data, view, search, today]);

  const counts = useMemo(() => {
    const l = active.data ?? [];
    return {
      arrivals: l.filter((r) => r.status === "confirmed" && r.check_in <= today).length,
      inhouse: l.filter((r) => r.status === "checked_in").length,
      departures: l.filter((r) => r.status === "checked_in" && r.check_out <= today).length,
      upcoming: l.filter((r) => r.status === "confirmed" && r.check_in > today).length,
    };
  }, [active.data, today]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        subtitle="Bookings, arrivals, in-house guests and departures"
        actions={canEdit && (
          <Button onClick={() => setEditing({})} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="mr-2 h-4 w-4" />New reservation
          </Button>
        )}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="arrivals">Arrivals {counts.arrivals > 0 && <Badge className="ml-2" variant="secondary">{counts.arrivals}</Badge>}</TabsTrigger>
          <TabsTrigger value="inhouse">In house {counts.inhouse > 0 && <Badge className="ml-2" variant="secondary">{counts.inhouse}</Badge>}</TabsTrigger>
          <TabsTrigger value="departures">Departures {counts.departures > 0 && <Badge className="ml-2" variant="secondary">{counts.departures}</Badge>}</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1 h-4 w-4" />Calendar</TabsTrigger>
          <TabsTrigger value="all">Search all</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "calendar" ? (
        <TapeChart
          reservations={active.data ?? []}
          today={today}
          onOpen={(r) => canEdit && setEditing({ r })}
          onNew={(d) => canEdit && setEditing({ defaults: d })}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest name, phone, room or booking code" className="pl-9" />
            </div>
            {view === "all" && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Stays from</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
                  <Label className="text-xs">to</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    {(Object.keys(RES_STATUS) as ReservationStatus[]).map((s) => <SelectItem key={s} value={s}>{RES_STATUS[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {source.isLoading ? (
                <LoadingBlock />
              ) : !rows.length ? (
                <EmptyState icon={CalendarDays} title={
                  { arrivals: "No arrivals waiting", inhouse: "No guests in house", departures: "No departures due", upcoming: "No upcoming reservations", all: "No reservations found", calendar: "" }[view]
                } />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Stay</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead className="hidden md:table-cell">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <ReservationRow key={r.id} r={r} today={today} currency={hotel.currency} canEdit={canEdit}
                        onEdit={() => setEditing({ r })} onCheckIn={() => setCheckingIn(r)} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {editing && <ReservationDialog reservation={editing.r} defaults={editing.defaults} onClose={() => setEditing(null)} />}
      {checkingIn && <CheckInDialog reservation={checkingIn} onClose={() => setCheckingIn(null)} />}
    </div>
  );
};

const ReservationRow = ({
  r, today, currency, canEdit, onEdit, onCheckIn,
}: { r: Reservation; today: string; currency: string; canEdit: boolean; onEdit: () => void; onCheckIn: () => void }) => {
  const checkOut = useCheckOut();
  const cancel = useCancelReservation();
  const st = RES_STATUS[r.status];
  const late = r.status === "confirmed" && r.check_in < today;
  const overdue = r.status === "checked_in" && r.check_out < today;
  const open = r.status === "confirmed" || r.status === "checked_in";

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium flex items-center gap-1">{guestName(r.guests)}{r.guests?.is_vip && <Crown className="h-4 w-4 text-amber-500" />}</div>
        <div className="text-xs text-slate-500">{r.code} · {SOURCE_LABELS[r.source]}{r.guests?.phone ? ` · ${r.guests.phone}` : ""}</div>
        {r.special_requests && <div className="text-xs text-blue-700 truncate max-w-[240px]" title={r.special_requests}>“{r.special_requests}”</div>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div>{formatShortDate(r.check_in)} → {formatShortDate(r.check_out)}</div>
        <div className="text-xs text-slate-500">{r.nights} night{r.nights === 1 ? "" : "s"} · {r.adults + r.children} guest{r.adults + r.children === 1 ? "" : "s"}</div>
      </TableCell>
      <TableCell>
        {r.rooms ? <span className="font-medium">{r.rooms.room_number}</span> : <span className="text-amber-700 text-sm">Not assigned</span>}
        <div className="text-xs text-slate-500">{r.room_types?.name}</div>
      </TableCell>
      <TableCell className="hidden md:table-cell whitespace-nowrap">{formatMoney(r.total_amount, currency)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={st.className}>{st.label}</Badge>
        {late && <div className="text-xs text-red-600 mt-1">Arrival was {formatShortDate(r.check_in)}</div>}
        {overdue && <div className="text-xs text-red-600 mt-1">Overdue checkout</div>}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {canEdit && r.status === "confirmed" && r.check_in <= today && (
          <Button size="sm" onClick={onCheckIn} className="bg-green-600 hover:bg-green-700"><LogIn className="mr-1 h-4 w-4" />Check in</Button>
        )}
        {canEdit && r.status === "checked_in" && (
          <Button size="sm" variant={r.check_out <= today ? "default" : "outline"} disabled={checkOut.isPending}
            onClick={() => {
              const early = r.check_out > today ? `\n\nNote: they are booked until ${formatShortDate(r.check_out)}. Edit the dates first if the bill should only cover nights stayed.` : "";
              if (confirm(`Check out ${guestName(r.guests)} from room ${r.rooms?.room_number}?${early}`)) checkOut.mutate(r.id);
            }}>
            <LogOut className="mr-1 h-4 w-4" />Check out
          </Button>
        )}
        {canEdit && open && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 ml-1"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />{r.status === "checked_in" ? "Extend / edit stay" : "Edit"}</DropdownMenuItem>
              {r.status === "confirmed" && (
                <>
                  <DropdownMenuSeparator />
                  {r.check_in <= today && (
                    <DropdownMenuItem onClick={() => confirm(`Mark ${r.code} as a no-show?`) && cancel.mutate({ id: r.id, noShow: true })}>
                      <AlertTriangle className="mr-2 h-4 w-4" />No-show
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-red-600" onClick={() => confirm(`Cancel reservation ${r.code} for ${guestName(r.guests)}?`) && cancel.mutate({ id: r.id })}>
                    <XCircle className="mr-2 h-4 w-4" />Cancel reservation
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

const CheckInDialog = ({ reservation: r, onClose }: { reservation: Reservation; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const checkIn = useCheckIn();
  const rooms = useRooms();
  const available = useAvailableRooms(r.check_in, r.check_out, r.room_type_id, r.id);
  const [roomId, setRoomId] = useState<string>(r.room_id ?? "");
  const room = rooms.data?.find((x) => x.id === roomId);
  const notReady = room && room.status !== "available";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check in {guestName(r.guests)}</DialogTitle>
          <DialogDescription>
            {r.code} · {formatShortDate(r.check_in)} → {formatShortDate(r.check_out)} · {r.room_types?.name} · {formatMoney(r.total_amount, hotel.currency)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Room</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger><SelectValue placeholder="Choose a room" /></SelectTrigger>
            <SelectContent>
              {available.data?.map((x) => (
                <SelectItem key={x.id} value={x.id}>Room {x.room_number} · {ROOM_STATUS[x.status].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {available.data?.length === 0 && <p className="text-sm text-red-600">No {r.room_types?.name} room is free for this stay.</p>}
          {notReady && (
            <p className="text-sm text-amber-700 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />Room {room.room_number} is marked {ROOM_STATUS[room.status].label.toLowerCase()}. Make sure it's ready.
            </p>
          )}
        </div>
        {r.special_requests && <div className="rounded-md bg-blue-50 p-3 text-sm">Request: {r.special_requests}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!roomId || checkIn.isPending} className="bg-green-600 hover:bg-green-700"
            onClick={() => checkIn.mutate({ id: r.id, roomId }, { onSuccess: onClose })}>
            <LogIn className="mr-2 h-4 w-4" />Check in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Rooms × days grid showing who is in which room. */
const DAYS = 14;
const TapeChart = ({
  reservations, today, onOpen, onNew,
}: { reservations: Reservation[]; today: string; onOpen: (r: Reservation) => void; onNew: (d: { check_in: string; room_id: string; room_type_id: string }) => void }) => {
  const rooms = useRooms();
  const [start, setStart] = useState(addDays(today, -1));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const end = days[DAYS - 1];
  const live = reservations.filter((r) => (r.status === "confirmed" || r.status === "checked_in" || r.status === "checked_out") && r.room_id && r.check_out > start && r.check_in <= end);
  const unassigned = reservations.filter((r) => r.status === "confirmed" && !r.room_id && r.check_out > start && r.check_in <= end);

  if (rooms.isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setStart(addDays(today, -1))}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setStart(addDays(start, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-500" />Confirmed</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500" />In house</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-400" />Checked out</span>
          </div>
        </div>
        {unassigned.length > 0 && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {unassigned.length} booking{unassigned.length > 1 ? "s" : ""} in this period without a room yet:{" "}
            {unassigned.slice(0, 5).map((r) => <button key={r.id} className="underline mr-2" onClick={() => onOpen(r)}>{guestName(r.guests)} ({formatShortDate(r.check_in)})</button>)}
          </div>
        )}
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `90px repeat(${DAYS}, minmax(52px, 1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={d} className={`text-center text-xs py-1 border-b ${d === today ? "bg-blue-100 font-bold" : ""}`}>
                {new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "short" })}<br />{formatShortDate(d)}
              </div>
            ))}
            {rooms.data?.map((room) => {
              const mine = live.filter((r) => r.room_id === room.id);
              return (
                <div key={room.id} className="contents">
                  <div className="text-sm py-2 pr-2 border-b flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${ROOM_STATUS[room.status].dot}`} />
                    <span className="font-medium">{room.room_number}</span>
                    <span className="text-[10px] text-slate-400 truncate">{room.room_types?.name}</span>
                  </div>
                  <div className="relative border-b" style={{ gridColumn: `span ${DAYS}` }}>
                    <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
                      {days.map((d) => (
                        <button key={d} title="New booking" onClick={() => onNew({ check_in: d < today ? today : d, room_id: room.id, room_type_id: room.room_type_id })}
                          className={`border-l h-10 hover:bg-blue-50 ${d === today ? "bg-blue-50/50" : ""}`} />
                      ))}
                    </div>
                    {mine.map((r) => {
                      const s = Math.max(0, days.indexOf(r.check_in < start ? start : r.check_in));
                      const e = r.check_out > end ? DAYS : days.indexOf(r.check_out);
                      const span = Math.max(1, e - s);
                      const color = r.status === "checked_in" ? "bg-green-500" : r.status === "checked_out" ? "bg-slate-400" : "bg-blue-500";
                      return (
                        <button key={r.id} onClick={() => onOpen(r)} title={`${guestName(r.guests)} · ${r.code}`}
                          className={`absolute top-1 bottom-1 ${color} text-white text-xs rounded px-1 truncate text-left`}
                          style={{ left: `calc(${(s / DAYS) * 100}% + 50% / ${DAYS})`, width: `calc(${(span / DAYS) * 100}% - 2px)` }}>
                          {guestName(r.guests)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-slate-500">Bars start mid-day on arrival and end mid-day on departure. Click an empty cell to book that room.</p>
      </CardContent>
    </Card>
  );
};

export default ReservationsPage;
