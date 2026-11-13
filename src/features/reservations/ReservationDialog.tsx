import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarRange, Crown, Search, UserPlus, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useStayQuote } from "@/hooks/useRates";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useAvailableRooms, useGuests, useRoomTypes, useSaveReservation } from "@/hooks/useHotelQueries";
import { ROOM_STATUS, SOURCE_LABELS, addDays, formatMoney, guestName, nightsBetween, todayIn } from "@/lib/format";
import type { BookingSource, Guest, Reservation } from "@/lib/db-types";
import { GuestForm } from "../guests/GuestForm";

const NO_ROOM = "__none__";

/** Create a reservation, or edit one that hasn't checked out yet. */
export const ReservationDialog = ({
  reservation,
  defaults,
  onClose,
}: {
  reservation?: Reservation;
  defaults?: { check_in?: string; room_id?: string; room_type_id?: string };
  onClose: () => void;
}) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const types = useRoomTypes();
  const save = useSaveReservation();
  const isEdit = !!reservation;
  const inHouse = reservation?.status === "checked_in";

  const [guest, setGuest] = useState<Pick<Guest, "id" | "first_name" | "last_name" | "phone" | "is_vip"> | null>(
    reservation?.guests ?? null,
  );
  const [guestSearch, setGuestSearch] = useState("");
  const [creatingGuest, setCreatingGuest] = useState(false);
  const guestResults = useGuests(guestSearch.length >= 2 ? guestSearch : "__nothing__");

  const [checkIn, setCheckIn] = useState(reservation?.check_in ?? defaults?.check_in ?? today);
  const [checkOut, setCheckOut] = useState(reservation?.check_out ?? addDays(defaults?.check_in ?? today, 1));
  const [typeId, setTypeId] = useState(reservation?.room_type_id ?? defaults?.room_type_id ?? "");
  const [roomId, setRoomId] = useState<string>(reservation?.room_id ?? defaults?.room_id ?? NO_ROOM);
  const [rate, setRate] = useState<string>(reservation ? String(reservation.rate_per_night) : "");
  // Nightly prices from the season rules; null when one rate applies to every night.
  const [nightly, setNightly] = useState<Record<string, number> | null>(reservation?.nightly_rates ?? null);
  const [manualRate, setManualRate] = useState(false);
  const [adults, setAdults] = useState(reservation?.adults ?? 1);
  const [children, setChildren] = useState(reservation?.children ?? 0);
  const [source, setSource] = useState<BookingSource>(reservation?.source ?? "walk_in");

  useEffect(() => {
    if (!typeId && types.data?.length) setTypeId(types.data[0].id);
  }, [types.data, typeId]);

  const type = types.data?.find((t) => t.id === typeId);
  const validDates = checkOut > checkIn;
  // Price the stay from the season rules: always for new bookings, and for edits once the dates or room type change.
  const stayChanged = !isEdit || checkIn !== reservation.check_in || checkOut !== reservation.check_out || typeId !== reservation.room_type_id;
  const quote = useStayQuote(typeId, checkIn, checkOut, validDates && stayChanged);
  useEffect(() => {
    if (!quote.data || manualRate || !stayChanged) return;
    setRate(String(quote.data.average));
    setNightly(quote.data.uniform ? null : Object.fromEntries(quote.data.nights.map((n) => [n.date, Number(n.rate)])));
  }, [quote.data, manualRate, stayChanged]);

  const nights = validDates ? nightsBetween(checkIn, checkOut) : 0;
  const available = useAvailableRooms(checkIn, checkOut, typeId, reservation?.id);
  const availableIds = useMemo(() => new Set(available.data?.map((r) => r.id)), [available.data]);
  const roomStillFree = roomId === NO_ROOM || availableIds.has(roomId) || available.isLoading;
  const nightlyTotal = nightly ? Object.entries(nightly).filter(([d]) => d >= checkIn && d < checkOut).reduce((a, [, v]) => a + Number(v), 0) : null;
  const total = nightly && nightlyTotal !== null ? nightlyTotal + Math.max(0, nights - Object.keys(nightly).filter((d) => d >= checkIn && d < checkOut).length) * Number(rate || 0) : nights * Number(rate || 0);
  const q = stayChanged ? quote.data : undefined;
  const overCapacity = type && adults + children > type.max_occupancy;

  useEffect(() => {
    // If the selected room no longer fits the new dates/type, clear it.
    if (roomId !== NO_ROOM && available.data && !availableIds.has(roomId) && !inHouse) setRoomId(NO_ROOM);
  }, [available.data, availableIds, roomId, inHouse]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guest) return;
    const f = new FormData(e.currentTarget);
    save.mutate(
      {
        id: reservation?.id,
        guest_id: guest.id,
        room_type_id: typeId,
        room_id: roomId === NO_ROOM ? null : roomId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        rate_per_night: Number(rate),
        nightly_rates: nightly,
        source,
        special_requests: String(f.get("special_requests") ?? "").trim() || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit reservation ${reservation.code}` : "New reservation"}</DialogTitle>
        </DialogHeader>

        {/* Guest */}
        <div className="space-y-2">
          <Label>Guest</Label>
          {guest ? (
            <div className="flex items-center justify-between rounded-md border bg-slate-50 dark:bg-slate-800 px-3 py-2">
              <div>
                <div className="font-medium flex items-center gap-1">{guestName(guest)}{guest.is_vip && <Crown className="h-4 w-4 text-amber-500" />}</div>
                <div className="text-xs text-slate-500">{guest.phone ?? "No phone"}</div>
              </div>
              {!inHouse && <Button variant="ghost" size="sm" onClick={() => setGuest(null)}><X className="h-4 w-4" /></Button>}
            </div>
          ) : creatingGuest ? (
            <div className="rounded-md border p-3">
              <GuestForm compact onCancel={() => setCreatingGuest(false)} onSaved={(g) => { setGuest(g); setCreatingGuest(false); }} />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input autoFocus value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} placeholder="Find returning guest by name or phone" className="pl-9" />
                </div>
                <Button type="button" variant="outline" onClick={() => setCreatingGuest(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />New guest
                </Button>
              </div>
              {guestSearch.length >= 2 && (
                <div className="rounded-md border max-h-48 overflow-y-auto divide-y">
                  {guestResults.data?.length ? (
                    guestResults.data.slice(0, 8).map((g) => (
                      <button key={g.id} type="button" onClick={() => setGuest(g)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="font-medium text-sm">{guestName(g)}</div>
                        <div className="text-xs text-slate-500">{[g.phone, g.email, g.id_number].filter(Boolean).join(" · ")}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      No match. <button type="button" className="text-blue-600 underline" onClick={() => setCreatingGuest(true)}>Add as new guest</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>Check-in</Label>
              <Input type="date" value={checkIn} disabled={inHouse} onChange={(e) => {
                setCheckIn(e.target.value);
                if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
              }} required />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Check-out</Label>
              <Input type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => setCheckOut(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input type="number" min={0} max={20} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} />
            </div>
          </div>
          {!isEdit && checkIn < today && (
            <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Check-in date is in the past.</p>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Room type</Label>
              <Select value={typeId} disabled={inHouse} onValueChange={(v) => { setTypeId(v); if (!isEdit) setRate(""); }}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {types.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {formatMoney(t.base_rate, hotel.currency)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room {validDates && available.data && <span className="text-slate-400 font-normal">({available.data.length} free)</span>}</Label>
              <Select value={roomId} disabled={inHouse} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROOM}>Assign later</SelectItem>
                  {inHouse && reservation?.rooms && <SelectItem value={reservation.rooms.id}>Room {reservation.rooms.room_number}</SelectItem>}
                  {available.data?.filter((r) => !(inHouse && r.id === reservation?.room_id)).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Room {r.room_number}{r.status !== "available" ? ` · ${ROOM_STATUS[r.status].label.toLowerCase()}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {validDates && available.data && available.data.length === 0 && !inHouse && (
            <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />No {type?.name} rooms are free for all of these nights.</p>
          )}
          {overCapacity && (
            <p className="text-sm text-amber-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{type?.name} rooms take up to {type?.max_occupancy} guests.</p>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="res-rate">{nightly ? `Average rate per night (${hotel.currency})` : `Rate per night (${hotel.currency})`}</Label>
              <Input id="res-rate" type="number" min={0} step="50" value={rate} required
                onChange={(e) => { setRate(e.target.value); setManualRate(true); setNightly(null); }} />
              {manualRate && <button type="button" className="text-xs text-blue-700 underline" onClick={() => setManualRate(false)}>Use season prices</button>}
            </div>
            <div className="space-y-2">
              <Label>Booked via</Label>
              <Select value={source} onValueChange={(v) => setSource(v as BookingSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as BookingSource[]).map((s) => <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Special requests</Label>
            <Textarea name="special_requests" defaultValue={reservation?.special_requests ?? ""} rows={2} placeholder="e.g. Late arrival, extra bed, airport pickup" />
          </div>

          {q && !manualRate && (q.closed_to_arrival || q.min_nights > nights) && (
            <p className="text-sm text-amber-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />
              {q.closed_to_arrival ? `${q.closed_season}: no arrivals on this date for online bookings. ` : ""}
              {q.min_nights > nights ? `Minimum stay is ${q.min_nights} nights for these dates (online bookings must follow it).` : ""}</p>
          )}
          <div className="rounded-lg bg-blue-50 dark:bg-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {nightly ? `${nights} night${nights === 1 ? "" : "s"}, priced night by night` : `${nights} night${nights === 1 ? "" : "s"} × ${formatMoney(Number(rate || 0), hotel.currency)}`}
                {q && !manualRate && q.seasons.length > 0 && <span className="ml-1 inline-flex items-center gap-1 text-xs"><CalendarRange className="h-3 w-3" />{q.seasons.join(", ")}</span>}
              </span>
              <span className="text-lg font-bold" data-testid="res-total">{formatMoney(total, hotel.currency)}</span>
            </div>
            {nightly && (
              <div className="flex flex-wrap gap-1 text-xs">
                {Object.entries(nightly).filter(([d]) => d >= checkIn && d < checkOut).sort().map(([d, v]) => (
                  <span key={d} className="rounded bg-white dark:bg-slate-900 border px-1.5 py-0.5">{format(parseISO(d), "EEE d")}: {formatMoney(Number(v), "")}</span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!guest || !typeId || !validDates || !roomStillFree || save.isPending || rate === ""}>
              {isEdit ? "Save changes" : "Create reservation"}
            </Button>
          </DialogFooter>
          {!guest && <p className="text-xs text-right text-slate-500">Choose or add a guest first.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
};
