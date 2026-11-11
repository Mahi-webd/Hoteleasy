import { useEffect, useState } from "react";
import { Crown, Mail, Pencil, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useDeleteGuest, useGuestStays, useGuests } from "@/hooks/useHotelQueries";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { RES_STATUS, formatDate, formatMoney, formatShortDate, guestName } from "@/lib/format";
import type { Guest } from "@/lib/db-types";
import { GuestForm } from "./GuestForm";

const useDebounced = (value: string, ms = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const GuestsPage = () => {
  const { can } = useCurrentHotel();
  const canEdit = can("owner", "manager", "front_desk");
  const [search, setSearch] = useState("");
  const guests = useGuests(useDebounced(search));
  const [editing, setEditing] = useState<Partial<Guest> | null>(null);
  const [viewing, setViewing] = useState<Guest | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guests"
        subtitle="Every guest who has stayed or booked, with their history"
        actions={canEdit && (
          <Button onClick={() => setEditing({})} className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="mr-2 h-4 w-4" />Add guest
          </Button>
        )}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, email or ID number" className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {guests.isLoading ? (
            <LoadingBlock />
          ) : !guests.data?.length ? (
            <EmptyState icon={Users} title={search ? "No guests match your search" : "No guests yet"}>
              {!search && "Guests are added when you create a reservation, or with “Add guest”."}
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Nationality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.data.map((g) => (
                  <TableRow key={g.id} className="cursor-pointer" onClick={() => setViewing(g)}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {guestName(g)}
                        {g.is_vip && <Crown className="h-4 w-4 text-amber-500" />}
                      </span>
                    </TableCell>
                    <TableCell>{g.phone ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{g.email ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{g.id_number ? `${g.id_type ?? ""} ${g.id_number}` : "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{g.nationality ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? `Edit ${guestName(editing as Guest)}` : "Add guest"}</DialogTitle></DialogHeader>
            <GuestForm
              guest={editing}
              onCancel={() => setEditing(null)}
              onSaved={(g) => {
                setEditing(null);
                if (viewing) setViewing(g);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {viewing && (
        <GuestProfile
          guest={viewing}
          canEdit={canEdit}
          canDelete={can("owner", "manager")}
          onEdit={() => setEditing(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
};

const GuestProfile = ({
  guest, canEdit, canDelete, onEdit, onClose,
}: { guest: Guest; canEdit: boolean; canDelete: boolean; onEdit: () => void; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const stays = useGuestStays(guest.id);
  const del = useDeleteGuest();
  const completed = stays.data?.filter((s) => s.status === "checked_out") ?? [];
  const spent = completed.reduce((sum, s) => sum + Number(s.total_amount), 0);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {guestName(guest)} {guest.is_vip && <Badge className="bg-amber-500">VIP</Badge>}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-4 text-sm">
          <div className="space-y-1">
            {guest.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /><a href={`tel:${guest.phone}`}>{guest.phone}</a></div>}
            {guest.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /><a href={`mailto:${guest.email}`}>{guest.email}</a></div>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-slate-500">ID</dt><dd>{guest.id_number ? `${guest.id_type ?? ""} ${guest.id_number}` : "—"}</dd>
            <dt className="text-slate-500">Nationality</dt><dd>{guest.nationality ?? "—"}</dd>
            <dt className="text-slate-500">Date of birth</dt><dd>{formatDate(guest.date_of_birth)}</dd>
            <dt className="text-slate-500">Address</dt><dd>{guest.address ?? "—"}</dd>
            <dt className="text-slate-500">Guest since</dt><dd>{formatDate(guest.created_at)}</dd>
          </dl>
          {guest.notes && <div className="rounded-md bg-amber-50 border border-amber-200 p-3">{guest.notes}</div>}

          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-3"><div className="text-slate-500 text-xs">Completed stays</div><div className="text-xl font-bold">{completed.length}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-slate-500 text-xs">Room revenue</div><div className="text-xl font-bold">{formatMoney(spent, hotel.currency)}</div></CardContent></Card>
          </div>

          <div className="space-y-2">
            <div className="font-semibold">Stays</div>
            {stays.isLoading ? <LoadingBlock /> : !stays.data?.length ? (
              <div className="text-slate-500">No reservations yet.</div>
            ) : (
              stays.data.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border p-2">
                  <div>
                    <div className="font-medium">{formatShortDate(s.check_in)} → {formatShortDate(s.check_out)} <span className="text-slate-400 font-normal">· {s.code}</span></div>
                    <div className="text-xs text-slate-500">{s.rooms ? `Room ${s.rooms.room_number}` : s.room_types?.name} · {formatMoney(s.total_amount, hotel.currency)}</div>
                  </div>
                  <Badge variant="outline" className={RES_STATUS[s.status].className}>{RES_STATUS[s.status].label}</Badge>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {canEdit && <Button variant="outline" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}
            {canDelete && !stays.data?.length && (
              <ConfirmButton variant="outline" className="text-red-600" title={`Delete ${guestName(guest)}?`} onConfirm={() => del.mutate(guest.id, { onSuccess: onClose })}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </ConfirmButton>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GuestsPage;
