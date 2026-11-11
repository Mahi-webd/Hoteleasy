import { useMemo, useState, type FormEvent } from "react";
import { BedDouble, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  useDeleteRoom, useDeleteRoomType, useReservations, useRoomTypes, useRooms, useSaveRoom, useSaveRoomType, useSetRoomStatus,
} from "@/hooks/useHotelQueries";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { ROOM_STATUS, formatMoney, formatShortDate, guestName, todayIn } from "@/lib/format";
import type { Room, RoomStatus, RoomType } from "@/lib/db-types";

/** Statuses staff may set by hand. "occupied" only comes from check-in. */
const MANUAL_STATUSES: RoomStatus[] = ["available", "dirty", "cleaning", "maintenance", "out_of_order"];

const RoomsPage = () => {
  const { hotel, can } = useCurrentHotel();
  const canManage = can("owner", "manager");
  const canSetStatus = can("owner", "manager", "front_desk", "housekeeping");
  const rooms = useRooms();
  const types = useRoomTypes();
  const today = todayIn(hotel.timezone);
  const inHouse = useReservations({ status: "checked_in" });
  const setStatus = useSetRoomStatus();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [status, setStatus_] = useState<string>("all");
  const [typeId, setTypeId] = useState<string>("all");
  const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
  const [editingType, setEditingType] = useState<Partial<RoomType> | null>(null);

  const guestByRoom = useMemo(() => {
    const m = new Map<string, { name: string; until: string }>();
    inHouse.data?.forEach((r) => r.room_id && m.set(r.room_id, { name: guestName(r.guests), until: r.check_out }));
    return m;
  }, [inHouse.data]);

  const filtered = (rooms.data ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    return (
      (status === "all" || r.status === status) &&
      (typeId === "all" || r.room_type_id === typeId) &&
      (!q ||
        r.room_number.toLowerCase().includes(q) ||
        r.room_types?.name.toLowerCase().includes(q) ||
        guestByRoom.get(r.id)?.name.toLowerCase().includes(q))
    );
  });

  const byFloor = useMemo(() => {
    const groups = new Map<string, Room[]>();
    filtered.forEach((r) => {
      const k = r.floor == null ? "No floor set" : `Floor ${r.floor}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    });
    return [...groups.entries()];
  }, [filtered]);

  const counts = (rooms.data ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        subtitle="Live room status. Check-in and check-out update it automatically."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setEditingType({ max_occupancy: 2, amenities: [] })}>
                <Plus className="mr-2 h-4 w-4" />Room type
              </Button>
              <Button
                disabled={!types.data?.length}
                title={!types.data?.length ? "Add a room type first" : undefined}
                onClick={() => setEditingRoom({ room_type_id: types.data?.[0]?.id })}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Plus className="mr-2 h-4 w-4" />Add room
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {(Object.keys(ROOM_STATUS) as RoomStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus_(status === s ? "all" : s)}
            className={`rounded-lg border p-3 text-left transition ${status === s ? "ring-2 ring-blue-500" : ""} bg-white/70 dark:bg-slate-900/60`}
          >
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className={`h-2 w-2 rounded-full ${ROOM_STATUS[s].dot}`} />{ROOM_STATUS[s].label}
            </div>
            <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">Rooms ({rooms.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="types">Room types ({types.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative md:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Room number, type or guest" className="pl-9" />
            </div>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All room types</SelectItem>
                {types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus_}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(ROOM_STATUS) as RoomStatus[]).map((s) => <SelectItem key={s} value={s}>{ROOM_STATUS[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {rooms.isLoading ? (
            <LoadingBlock />
          ) : !rooms.data?.length ? (
            <Card><CardContent>
              <EmptyState icon={BedDouble} title="No rooms yet">
                {canManage ? "Create a room type (e.g. Standard, Deluxe), then add your rooms." : "Ask a manager to add the hotel's rooms."}
              </EmptyState>
            </CardContent></Card>
          ) : !filtered.length ? (
            <Card><CardContent><EmptyState icon={Search} title="No rooms match those filters" /></CardContent></Card>
          ) : (
            byFloor.map(([floor, list]) => (
              <div key={floor} className="space-y-2">
                <div className="text-sm font-semibold text-slate-500">{floor}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {list.map((room) => {
                    const g = guestByRoom.get(room.id);
                    const st = ROOM_STATUS[room.status];
                    return (
                      <Card key={room.id} className={`border-2 ${st.className.split(" ").find((c) => c.startsWith("border-"))} bg-white/80 dark:bg-slate-900/70`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xl font-bold">{room.room_number}</div>
                              <div className="text-xs text-slate-500">{room.room_types?.name}</div>
                            </div>
                            {(canSetStatus || canManage) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canSetStatus && room.status !== "occupied" && (
                                    <>
                                      <DropdownMenuLabel>Set status</DropdownMenuLabel>
                                      {MANUAL_STATUSES.filter((s) => s !== room.status).map((s) => (
                                        <DropdownMenuItem key={s} onClick={() => setStatus.mutate({ id: room.id, status: s, label: room.room_number })}>
                                          <span className={`mr-2 h-2 w-2 rounded-full ${ROOM_STATUS[s].dot}`} />{ROOM_STATUS[s].label}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  {room.status === "occupied" && (
                                    <DropdownMenuLabel className="font-normal text-xs text-slate-500 max-w-[200px]">
                                      Occupied rooms free up when the guest is checked out.
                                    </DropdownMenuLabel>
                                  )}
                                  {canManage && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => setEditingRoom(room)}><Pencil className="mr-2 h-4 w-4" />Edit room</DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={() => {
                                          if (confirm(`Delete room ${room.room_number}? Past reservations keep their history.`)) deleteRoom.mutate(room.id);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />Delete room
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          {g ? (
                            <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                              {g.name}<br />
                              <span className={g.until <= today ? "text-red-600 font-medium" : "text-slate-500"}>
                                {g.until < today ? "Overdue: " : g.until === today ? "Leaves today" : "Until "}
                                {g.until !== today && formatShortDate(g.until)}
                              </span>
                            </div>
                          ) : room.notes ? (
                            <div className="text-xs text-slate-500 truncate" title={room.notes}>{room.notes}</div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="types">
          <RoomTypesTable types={types.data ?? []} rooms={rooms.data ?? []} canManage={canManage} currency={hotel.currency} onEdit={setEditingType} />
        </TabsContent>
      </Tabs>

      {editingRoom && <RoomDialog room={editingRoom} types={types.data ?? []} onClose={() => setEditingRoom(null)} />}
      {editingType && <RoomTypeDialog type={editingType} onClose={() => setEditingType(null)} />}
    </div>
  );
};

const RoomTypesTable = ({
  types, rooms, canManage, currency, onEdit,
}: { types: RoomType[]; rooms: Room[]; canManage: boolean; currency: string; onEdit: (t: RoomType) => void }) => {
  const del = useDeleteRoomType();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Room types</CardTitle>
        <CardDescription>The standard nightly rate is used as the default price when booking.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rate / night</TableHead>
              <TableHead>Max guests</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead>Amenities</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{formatMoney(t.base_rate, currency)}</TableCell>
                <TableCell>{t.max_occupancy}</TableCell>
                <TableCell>{rooms.filter((r) => r.room_type_id === t.id).length}</TableCell>
                <TableCell className="max-w-xs">
                  <div className="flex flex-wrap gap-1">{t.amenities.map((a) => <Badge key={a} variant="secondary" className="font-normal">{a}</Badge>)}</div>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmButton size="sm" variant="ghost" title={`Delete room type "${t.name}"?`} description="Only possible if no rooms or reservations use it." onConfirm={() => del.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!types.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No room types yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const RoomDialog = ({ room, types, onClose }: { room: Partial<Room>; types: RoomType[]; onClose: () => void }) => {
  const save = useSaveRoom();
  const [typeId, setTypeId] = useState(room.room_type_id ?? types[0]?.id ?? "");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const floor = String(f.get("floor") ?? "").trim();
    save.mutate(
      { id: room.id, room_number: String(f.get("room_number")), room_type_id: typeId, floor: floor === "" ? null : Number(floor), notes: String(f.get("notes") ?? "") },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{room.id ? `Edit room ${room.room_number}` : "Add room"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Room number</Label>
              <Input name="room_number" defaultValue={room.room_number} required placeholder="e.g. 105" />
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Input name="floor" type="number" defaultValue={room.floor ?? ""} placeholder="e.g. 1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Room type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={room.notes ?? ""} placeholder="e.g. Garden view, near lift" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !typeId}>Save room</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RoomTypeDialog = ({ type, onClose }: { type: Partial<RoomType>; onClose: () => void }) => {
  const save = useSaveRoomType();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate(
      {
        id: type.id,
        name: String(f.get("name")),
        description: String(f.get("description") ?? ""),
        base_rate: Number(f.get("base_rate")),
        max_occupancy: Number(f.get("max_occupancy")),
        amenities: String(f.get("amenities") ?? "").split(",").map((a) => a.trim()).filter(Boolean),
      },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{type.id ? `Edit ${type.name}` : "New room type"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input name="name" defaultValue={type.name} required placeholder="e.g. Executive Suite" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rate per night (KES)</Label>
              <Input name="base_rate" type="number" min={0} step="50" defaultValue={type.base_rate ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label>Max guests</Label>
              <Input name="max_occupancy" type="number" min={1} max={20} defaultValue={type.max_occupancy ?? 2} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Amenities (comma separated)</Label>
            <Input name="amenities" defaultValue={type.amenities?.join(", ")} placeholder="WiFi, TV, Balcony" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={type.description ?? ""} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoomsPage;
