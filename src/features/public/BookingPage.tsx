import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  BedDouble, CalendarCheck, CheckCircle2, Clock, Loader2, MapPin, MessageCircle, Phone, Printer, Search, Star, Users,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  bookRoom, fetchAvailability, findPrecheck, lookupBooking, usePublicHotel, waNumber,
  type BookingLookup, type BookingResult, type Offer,
} from "@/hooks/useOnline";
import { addDays, formatMoney, friendlyError } from "@/lib/format";
import type { PublicHotel, PublicRoomType } from "@/lib/db-types";

const nice = (d: string) => format(parseISO(d), "EEE d MMM yyyy");

export const PublicShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10">{children}</main>
    <footer className="text-center text-xs text-slate-400 pb-8">Bookings powered by HotelEasy</footer>
  </div>
);

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
    ))}
  </span>
);

const BookingPage = () => {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const hotel = usePublicHotel(slug);
  const h = hotel.data;
  const [mode, setMode] = useState<"book" | "manage">(params.get("manage") ? "manage" : "book");

  useEffect(() => { if (h) document.title = `Book · ${h.name}`; }, [h]);

  if (hotel.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  if (!h) {
    return (
      <PublicShell>
        <div className="text-center py-24 space-y-2">
          <h1 className="text-2xl font-bold">Booking page not found</h1>
          <p className="text-slate-600">This hotel's online booking is switched off, or the link is wrong. Please contact the hotel directly.</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Hero h={h} />
      <div className="flex gap-2 my-5">
        <Button variant={mode === "book" ? "default" : "outline"} onClick={() => setMode("book")}><CalendarCheck className="mr-2 h-4 w-4" />Book a room</Button>
        <Button variant={mode === "manage" ? "default" : "outline"} onClick={() => setMode("manage")}>Find my booking</Button>
      </div>
      {mode === "book" ? <BookFlow h={h} slug={slug} /> : <Manage h={h} slug={slug} />}
      <Info h={h} />
    </PublicShell>
  );
};
export default BookingPage;

// ---------------------------------------------------------------------------
const Hero = ({ h }: { h: PublicHotel }) => (
  <Card className="overflow-hidden">
    {h.photo_url && <img src={h.photo_url} alt={h.name} className="w-full h-48 sm:h-64 object-cover" />}
    <CardContent className="p-5 space-y-2">
      <h1 className="text-2xl sm:text-3xl font-bold">{h.name}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {(h.city || h.address) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{[h.address, h.city].filter(Boolean).join(", ")}</span>}
        {h.reviews && h.reviews.count > 0 && h.reviews.average != null && (
          <span className="inline-flex items-center gap-1"><Stars value={Number(h.reviews.average)} /> {Number(h.reviews.average).toFixed(1)} · {h.reviews.count} review{h.reviews.count === 1 ? "" : "s"}</span>
        )}
        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />Check-in from {h.checkin_time} · check-out by {h.checkout_time}</span>
      </div>
      {h.headline && <p className="text-lg font-medium">{h.headline}</p>}
      {h.description && <p className="text-slate-600 whitespace-pre-line">{h.description}</p>}
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
const BookFlow = ({ h, slug }: { h: PublicHotel; slug: string }) => {
  const [checkIn, setCheckIn] = useState(addDays(h.today, 1));
  const [checkOut, setCheckOut] = useState(addDays(h.today, 1 + Math.max(1, h.min_nights)));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<(Offer & { rt: PublicRoomType }) | null>(null);
  const [done, setDone] = useState<BookingResult | null>(null);
  const types = new Map(h.room_types.map((t) => [t.id, t]));

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(""); setSearching(true); setChosen(null);
    try { setOffers(await fetchAvailability(slug, checkIn, checkOut, adults + children)); }
    catch (err) { setOffers(null); setError(friendlyError(err)); }
    finally { setSearching(false); }
  };

  if (done) return <Confirmation h={h} r={done} slug={slug} />;

  const nights = Math.max(0, Math.round((parseISO(checkOut).getTime() - parseISO(checkIn).getTime()) / 86400000));
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={search} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_90px_90px_auto] gap-3 items-end">
            <div className="space-y-1"><Label htmlFor="b-in">Check-in</Label>
              <Input id="b-in" type="date" value={checkIn} min={h.today} max={addDays(h.today, h.max_advance_days)}
                onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, Math.max(1, h.min_nights))); setOffers(null); }} /></div>
            <div className="space-y-1"><Label htmlFor="b-out">Check-out</Label>
              <Input id="b-out" type="date" value={checkOut} min={addDays(checkIn, 1)} onChange={(e) => { setCheckOut(e.target.value); setOffers(null); }} /></div>
            <div className="space-y-1"><Label htmlFor="b-ad">Adults</Label><Input id="b-ad" type="number" min={1} max={20} value={adults} onChange={(e) => { setAdults(Math.max(1, Number(e.target.value))); setOffers(null); }} /></div>
            <div className="space-y-1"><Label htmlFor="b-ch">Children</Label><Input id="b-ch" type="number" min={0} max={20} value={children} onChange={(e) => { setChildren(Math.max(0, Number(e.target.value))); setOffers(null); }} /></div>
            <Button type="submit" disabled={searching} className="col-span-2 sm:col-span-1">
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Check availability
            </Button>
          </form>
          {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}
        </CardContent>
      </Card>

      {!offers && !chosen && <RoomList h={h} />}

      {offers && !chosen && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{nights} night{nights === 1 ? "" : "s"} · {nice(checkIn)} → {nice(checkOut)} · {adults + children} guest{adults + children === 1 ? "" : "s"}</p>
          {offers.filter((o) => types.has(o.room_type_id)).map((o) => {
            const rt = types.get(o.room_type_id)!;
            const ok = o.available > 0 && o.fits;
            return (
              <RoomCard key={o.room_type_id} rt={rt} h={h}>
                <div className="text-right space-y-1">
                  <div className="text-2xl font-bold">{formatMoney(o.total, h.currency)}</div>
                  <div className="text-xs text-slate-500">{o.uniform === false ? `avg ${formatMoney(o.rate, h.currency)}` : formatMoney(o.rate, h.currency)} × {o.nights} night{o.nights === 1 ? "" : "s"} · {h.prices_include_tax ? "taxes included" : "plus taxes"}</div>
                  {o.seasons && o.seasons.length > 0 && <div className="text-xs text-slate-500">{o.seasons.join(", ")}</div>}
                  {!o.fits ? <Badge variant="outline">Sleeps up to {rt.max_occupancy}</Badge>
                    : o.restriction ? <Badge variant="outline" className="text-amber-800 border-amber-300 whitespace-normal">{o.restriction}</Badge>
                    : o.available === 0 ? <Badge variant="outline" className="text-red-700 border-red-200">Sold out</Badge>
                    : o.available <= 2 && <Badge variant="outline" className="text-amber-800 border-amber-300">Only {o.available} left</Badge>}
                  <div><Button disabled={!ok} onClick={() => setChosen({ ...o, rt })} aria-label={`Choose ${rt.name}`}>Choose</Button></div>
                </div>
              </RoomCard>
            );
          })}
          {offers.every((o) => o.available === 0 || !o.fits) && (
            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-md p-3">{offers.some((o) => o.restriction) ? "These dates have a minimum stay or no arrivals that day. Try a longer stay or another arrival date, or contact the hotel." : "Nothing is free for these dates and guests online. Try other dates, or contact the hotel."}</p>
          )}
        </div>
      )}

      {chosen && (
        <GuestForm h={h} slug={slug} offer={chosen} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children}
          onBack={() => setChosen(null)} onDone={setDone} onSoldOut={() => { setChosen(null); search(); }} />
      )}
    </div>
  );
};

const RoomCard = ({ rt, h, children }: { rt: PublicRoomType; h: PublicHotel; children?: React.ReactNode }) => (
  <Card className="overflow-hidden">
    <div className="flex flex-col sm:flex-row">
      {rt.photo_url ? <img src={rt.photo_url} alt={rt.name} className="sm:w-56 h-40 sm:h-auto object-cover" />
        : <div className="sm:w-56 h-24 sm:h-auto bg-slate-100 flex items-center justify-center"><BedDouble className="h-10 w-10 text-slate-300" /></div>}
      <CardContent className="p-4 flex-1 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{rt.name}</h3>
          <p className="text-sm text-slate-600 inline-flex items-center gap-1"><Users className="h-4 w-4" />Sleeps {rt.max_occupancy}</p>
          {rt.description && <p className="text-sm text-slate-600">{rt.description}</p>}
          {rt.amenities?.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{rt.amenities.map((a) => <Badge key={a} variant="secondary" className="font-normal">{a}</Badge>)}</div>}
        </div>
        {children ?? (
          <div className="text-right"><div className="text-sm text-slate-500">from</div><div className="text-xl font-bold">{formatMoney(rt.rate, h.currency)}</div><div className="text-xs text-slate-500">per night</div></div>
        )}
      </CardContent>
    </div>
  </Card>
);

const RoomList = ({ h }: { h: PublicHotel }) => (
  <div className="space-y-3">
    <h2 className="text-lg font-semibold">Rooms</h2>
    {h.room_types.map((rt) => <RoomCard key={rt.id} rt={rt} h={h} />)}
    {!h.room_types.length && <p className="text-slate-600">No rooms are offered online at the moment.</p>}
  </div>
);

const GuestForm = ({ h, slug, offer, checkIn, checkOut, adults, children, onBack, onDone, onSoldOut }: {
  h: PublicHotel; slug: string; offer: Offer & { rt: PublicRoomType }; checkIn: string; checkOut: string; adults: number; children: number;
  onBack: () => void; onDone: (r: BookingResult) => void; onSoldOut: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true); setError("");
    try {
      onDone(await bookRoom({
        slug, roomTypeId: offer.room_type_id, checkIn, checkOut, adults, children,
        firstName: v("first"), lastName: v("last"), email: v("email"), phone: v("phone"), nationality: v("nat"), requests: v("req"), website: v("website"),
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const m = friendlyError(err);
      setError(m);
      if (/no longer available/i.test(m)) setTimeout(onSoldOut, 2500);
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{offer.rt.name}</h2>
            <p className="text-sm text-slate-600">{nice(checkIn)} → {nice(checkOut)} · {offer.nights} night{offer.nights === 1 ? "" : "s"} · {adults} adult{adults === 1 ? "" : "s"}{children ? `, ${children} child${children === 1 ? "" : "ren"}` : ""}</p>
          </div>
          <div className="text-right"><div className="text-2xl font-bold">{formatMoney(offer.total, h.currency)}</div><div className="text-xs text-slate-500">{h.prices_include_tax ? "taxes included" : "plus taxes"} · pay at the hotel</div></div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="g-first">First name</Label><Input id="g-first" name="first" required autoComplete="given-name" maxLength={80} /></div>
            <div className="space-y-1"><Label htmlFor="g-last">Last name</Label><Input id="g-last" name="last" required autoComplete="family-name" maxLength={80} /></div>
            <div className="space-y-1"><Label htmlFor="g-email">Email</Label><Input id="g-email" name="email" type="email" required autoComplete="email" /></div>
            <div className="space-y-1"><Label htmlFor="g-phone">Phone (WhatsApp)</Label><Input id="g-phone" name="phone" type="tel" required autoComplete="tel" placeholder="07XX XXX XXX" /></div>
            <div className="space-y-1"><Label htmlFor="g-nat">Nationality</Label><Input id="g-nat" name="nat" autoComplete="country-name" maxLength={60} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="g-req">Special requests (optional)</Label><Textarea id="g-req" name="req" rows={2} maxLength={1000} placeholder="Arrival time, dietary needs, airport pickup…" /></div>
          {/* Hidden from people; bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          {h.policies && <p className="text-xs text-slate-500 whitespace-pre-line">{h.policies}</p>}
          {h.free_cancel_days != null && <p className="text-xs text-slate-500">Free cancellation online until {h.free_cancel_days} day{h.free_cancel_days === 1 ? "" : "s"} before arrival.</p>}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={onBack}>Back</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm booking</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const Confirmation = ({ h, r, slug }: { h: PublicHotel; r: BookingResult; slug: string }) => (
  <Card className="border-emerald-200">
    <CardContent className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
        <div>
          <h2 className="text-xl font-bold">You're booked, {r.guest.split(" ")[0]}!</h2>
          <p className="text-slate-600">Keep your booking code. You'll need it with your email or last name to look up or change the booking.</p>
        </div>
      </div>
      <div className="rounded-lg bg-slate-100 p-4 text-center">
        <div className="text-sm text-slate-500">Booking code</div>
        <div className="text-3xl font-mono font-bold tracking-wider" data-testid="booking-code">{r.code}</div>
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-500">Room</dt><dd>{r.room_type}</dd>
        <dt className="text-slate-500">Check-in</dt><dd>{nice(r.check_in)} from {h.checkin_time}</dd>
        <dt className="text-slate-500">Check-out</dt><dd>{nice(r.check_out)} by {h.checkout_time}</dd>
        <dt className="text-slate-500">Total</dt><dd className="font-semibold">{formatMoney(r.total, r.currency)} <span className="font-normal text-slate-500">({r.nights} night{r.nights === 1 ? "" : "s"})</span></dd>
      </dl>
      {h.payment_instructions && (
        <div className="rounded-md border p-3 text-sm"><div className="font-medium mb-1">Payment</div><p className="whitespace-pre-line text-slate-700">{h.payment_instructions}</p></div>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <CheckInOnline slug={slug} code={r.code} keyValue={r.email} />
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        {h.whatsapp && (
          <Button variant="outline" asChild>
            <a href={`https://wa.me/${waNumber(h.whatsapp)}?text=${encodeURIComponent(`Hello ${h.name}, I just booked online. My booking code is ${r.code}.`)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />Message the hotel
            </a>
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

/** Opens the guest's online check-in for this booking. */
const CheckInOnline = ({ slug, code, keyValue }: { slug: string; code: string; keyValue: string }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      try { window.location.href = `/checkin/${await findPrecheck(slug, code, keyValue)}`; }
      catch (e) { alert(friendlyError(e)); setBusy(false); }
    }}><Smartphone className="mr-2 h-4 w-4" />Check in online now</Button>
  );
};

// ---------------------------------------------------------------------------
const Manage = ({ h, slug }: { h: PublicHotel; slug: string }) => {
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [b, setB] = useState<BookingLookup | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (cancel = false) => {
    setBusy(true); setError("");
    try { setB(await lookupBooking(slug, code, key, cancel)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(); }} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1"><Label htmlFor="m-code">Booking code</Label><Input id="m-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="HE-XXXXXX" required /></div>
          <div className="space-y-1"><Label htmlFor="m-key">Email or last name</Label><Input id="m-key" value={key} onChange={(e) => setKey(e.target.value)} required /></div>
          <Button type="submit" disabled={busy}>Find booking</Button>
        </form>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {b && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{b.code} · {b.guest}</div>
              <Badge variant="outline" className={b.status === "cancelled" ? "text-red-700 border-red-200" : "text-emerald-700 border-emerald-200"}>
                {({ confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Stay completed", cancelled: "Cancelled", no_show: "No-show" } as Record<string, string>)[b.status] ?? b.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">{b.room_type} · {nice(b.check_in)} → {nice(b.check_out)} · {formatMoney(b.total, b.currency)}</p>
            {b.status === "confirmed" && (b.can_cancel ? (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="text-sm text-slate-600">Free cancellation until {b.cancel_by ? nice(b.cancel_by) : "arrival"}.</span>
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => { if (window.confirm("Cancel this booking?")) run(true); }}>Cancel booking</Button>
              </div>
            ) : <p className="text-sm text-slate-600">To change or cancel this booking, please contact the hotel{h.phone ? ` on ${h.phone}` : ""}.</p>)}
            {b.status === "confirmed" && <div className="pt-1"><CheckInOnline slug={slug} code={b.code} keyValue={key} /></div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
const Info = ({ h }: { h: PublicHotel }) => (
  <div className="grid sm:grid-cols-2 gap-4 mt-6">
    {h.reviews && h.reviews.recent.length > 0 && (
      <Card className="sm:col-span-2">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-lg font-semibold">What guests say</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {h.reviews.recent.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2"><Stars value={r.overall} /><span className="text-sm font-medium">{r.name}</span><span className="text-xs text-slate-500">{r.month}</span></div>
                {r.comment && <p className="text-sm text-slate-700">“{r.comment}”</p>}
                {r.response && <p className="text-xs text-slate-500 border-l-2 pl-2">Reply from the hotel: {r.response}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    <Card>
      <CardContent className="p-5 space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Contact</h2>
        {h.phone && <p className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /><a href={`tel:${h.phone}`} className="underline">{h.phone}</a></p>}
        {h.whatsapp && <p><a className="inline-flex items-center gap-2 underline" href={`https://wa.me/${waNumber(h.whatsapp)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></p>}
        {h.email && <p><a className="underline" href={`mailto:${h.email}`}>{h.email}</a></p>}
      </CardContent>
    </Card>
    {h.policies && (
      <Card><CardContent className="p-5 space-y-2 text-sm"><h2 className="text-lg font-semibold">House rules</h2><p className="whitespace-pre-line text-slate-700">{h.policies}</p></CardContent></Card>
    )}
    <p className="sm:col-span-2 text-center text-xs text-slate-400"><Link to="/login">Hotel staff sign in</Link></p>
  </div>
);
