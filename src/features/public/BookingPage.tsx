import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  BedDouble, CalendarCheck, CheckCircle2, Loader2, MessageCircle, Printer, Search, Users, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  bookRoom, fetchAvailability, findPrecheck, lookupBooking, usePublicHotel, waNumber,
  type BookingLookup, type BookingResult, type Offer, type OfferPlan,
} from "@/hooks/useOnline";
import { addDays, formatMoney, friendlyError } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MpesaPrompt } from "@/components/common/MpesaPrompt";
import { createOnlinePrompt } from "@/hooks/useMpesa";
import { mealsOf, planPrice } from "@/lib/db-types";
import type { PublicHotel, PublicRoomType } from "@/lib/db-types";
import type { SiteFont, SiteSectionKey, SiteSettings, SiteTheme } from "@/lib/db-types";
import {
  Features, Footer, Gallery, Hero, Intro, Marquee, NoticeBar, OffersSlider, PublicShell, Reviews, RoomsCarousel, SectionTitle, SiteChrome, scrollToId,
} from "./GuestSite";
import { Waves, WavesOn } from "./GuestMotion";
import { FONTS, SECTIONS, THEMES, currentOffers, sectionList, themeCss } from "./siteTheme";

export { PublicShell } from "./GuestSite";

const nice = (d: string) => format(parseISO(d), "EEE d MMM yyyy");

/** The hotel website. `slug` is set when it is shown as the home page (/); otherwise it comes from /book/<slug>. */
const BookingPage = ({ slug: fixedSlug }: { slug?: string }) => {
  const params0 = useParams();
  const slug = fixedSlug ?? params0.slug ?? "";
  const [params] = useSearchParams();
  const hotel = usePublicHotel(slug);
  const moved = hotel.data && "redirect" in hotel.data ? hotel.data.redirect : null;
  const h = hotel.data && !("redirect" in hotel.data) ? hotel.data : undefined;
  const [mode, setMode] = useState<"book" | "manage">(params.get("manage") ? "manage" : "book");

  // Local preview only: /book/demo?theme=safari&font=marcellus tries a look without saving anything.
  const site: SiteSettings | undefined = h && import.meta.env.DEV && slug === "demo" ? {
    ...h.site,
    ...(params.get("theme") && params.get("theme")! in THEMES ? { theme: params.get("theme") as SiteTheme } : {}),
    ...(params.get("font") && params.get("font")! in FONTS ? { heading_font: params.get("font") as SiteFont } : {}),
  } : h?.site;

  useEffect(() => {
    if (!h) return;
    const titleBefore = document.title;
    document.title = site?.seo?.title?.trim() || h.name;
    const desc = site?.seo?.description?.trim() || h.headline || "";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const before = meta?.content;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    if (desc) meta.content = desc;
    return () => { document.title = titleBefore; if (meta && before !== undefined) meta.content = before; };
  }, [h, site?.seo?.title, site?.seo?.description]);
  // Links like ?manage=1 open straight at "Find my booking".
  useEffect(() => { if (h && params.get("manage")) setTimeout(() => scrollToId("book"), 100); }, [h, params]);

  if (hotel.isLoading) return <PublicShell><div className="flex justify-center py-24" role="status" aria-label="Loading"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></PublicShell>;
  // The hotel changed its page address: send guests (and their ?manage=… etc.) to the new one.
  if (moved) return <Navigate to={`/book/${moved}${params.toString() ? `?${params}` : ""}`} replace />;
  if (hotel.isError) {
    return (
      <PublicShell>
        <div className="text-center py-24 space-y-4" role="alert">
          <h1 className="gs-display text-3xl">We couldn't load this page</h1>
          <p className="text-muted-foreground">Please check your internet connection and try again.</p>
          <Button className="rounded-full px-6" onClick={() => hotel.refetch()} disabled={hotel.isFetching}>
            {hotel.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Try again
          </Button>
        </div>
      </PublicShell>
    );
  }
  if (!h) {
    return (
      <PublicShell>
        <div className="text-center py-24 space-y-4">
          <h1 className="gs-display text-3xl">Page not found</h1>
          <p className="text-muted-foreground">This hotel's online booking is switched off, or the link is wrong. Please contact the hotel directly.</p>
          <p className="text-xs text-muted-foreground">Hotel staff: <Link to="/login" className="underline">sign in</Link> and switch the booking page on under Online → Setup.</p>
        </div>
      </PublicShell>
    );
  }

  const hs = { ...h, site };
  const features = (h.features ?? []).filter((f) => f.title?.trim());
  const gallery = (h.gallery ?? []).filter(Boolean);
  const offers = currentOffers(site?.offers, h.today);
  const words = (site?.marquee ?? []).map((w) => w.trim()).filter(Boolean);
  const marquee = words.length ? words : features.length > 1 ? features.map((f) => f.title) : [];
  const book = (m: "book" | "manage" = "book") => { setMode(m); scrollToId("book"); };

  // What each section needs to be worth showing.
  const has: Record<SiteSectionKey, boolean> = {
    about: true, experiences: features.length > 0, marquee: marquee.length > 0, rooms: h.room_types.length > 0,
    offers: offers.length > 0, book: true, gallery: gallery.length > 0, reviews: !!h.reviews?.recent.some((r) => r.comment),
  };
  const order = sectionList(site).filter((x) => x.on && has[x.key]).map((x) => x.key);
  const menuLabel: Partial<Record<SiteSectionKey, string>> = { about: "Welcome", book: "Book" };
  const links = [
    ...order.filter((k) => k !== "marquee").map((k) => ({ id: k, label: menuLabel[k] ?? SECTIONS.find((x) => x.key === k)!.label })),
    { id: "contact", label: "Contact" },
  ];

  const render = (k: SiteSectionKey) => {
    switch (k) {
      case "about": return <Intro key={k} h={hs} />;
      case "experiences": return <Features key={k} items={features} />;
      case "marquee": return <Marquee key={k} words={marquee} />;
      case "rooms": return <RoomsCarousel key={k} h={hs} onBook={() => book()} />;
      case "offers": return <OffersSlider key={k} h={hs} offers={offers} onBook={() => book()} />;
      case "gallery": return <Gallery key={k} h={hs} photos={gallery} />;
      case "reviews": return <Reviews key={k} h={hs} />;
      case "book": return (
        <section key={k} id="book" className="relative scroll-mt-0 bg-primary text-primary-foreground px-4 sm:px-8 py-20 sm:py-28 pb-32 sm:pb-40">
          <Waves fill="primary" edge="top" />
          <SectionTitle eyebrow="Book direct" title={mode === "book" ? "Plan your stay" : "Your booking"} />
          <div className="mx-auto mt-10 max-w-4xl">
            <div className="mb-5 flex justify-center gap-2">
              <Button variant={mode === "book" ? "secondary" : "ghost"} className="rounded-full px-6 text-inherit data-[on=true]:text-secondary-foreground hover:bg-primary-foreground/10"
                data-on={mode === "book"} onClick={() => setMode("book")}><CalendarCheck className="mr-2 h-4 w-4" />Book a room</Button>
              <Button variant={mode === "manage" ? "secondary" : "ghost"} className="rounded-full px-6 text-inherit data-[on=true]:text-secondary-foreground hover:bg-primary-foreground/10"
                data-on={mode === "manage"} onClick={() => setMode("manage")}>Find my booking</Button>
            </div>
            {mode === "book" ? <BookFlow h={hs} slug={slug} /> : <Manage h={hs} slug={slug} />}
          </div>
          <Waves fill="primary" edge="bottom" />
        </section>
      );
    }
  };

  return (
    <WavesOn.Provider value={site?.hero?.waves !== false}>
      {/* Colours and heading letters from Online → Website. Built from checked numbers only. */}
      <style>{themeCss(site)}</style>
      <div className="guest-site min-h-screen">
        <NoticeBar h={hs} />
        <Hero h={hs} />
        {order.map(render)}
        <Footer h={hs} />
        <SiteChrome h={hs} links={links} onBook={() => book()} />
      </div>
    </WavesOn.Provider>
  );
};
export default BookingPage;

// ---------------------------------------------------------------------------
const BookFlow = ({ h, slug }: { h: PublicHotel; slug: string }) => {
  const [checkIn, setCheckIn] = useState(addDays(h.today, 1));
  const [checkOut, setCheckOut] = useState(addDays(h.today, 1 + Math.max(1, h.min_nights)));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<(Offer & { rt: PublicRoomType; plan: OfferPlan | null; grand: number }) | null>(null);
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

      {!offers && !chosen && <p className="text-center text-sm text-primary-foreground/70">Choose your dates to see prices and which rooms are free.</p>}

      {offers && !chosen && (
        <div className="space-y-3">
          <p className="text-sm text-primary-foreground/80">{nights} night{nights === 1 ? "" : "s"} · {nice(checkIn)} → {nice(checkOut)} · {adults + children} guest{adults + children === 1 ? "" : "s"}</p>
          {offers.filter((o) => types.has(o.room_type_id)).map((o) => {
            const rt = types.get(o.room_type_id)!;
            const ok = o.available > 0 && o.fits;
            return (
              <RoomCard key={o.room_type_id} rt={rt} h={h} extra={!!o.plans?.length && (

                  <div className="border-t p-3 space-y-2">
                    {[null, ...o.plans].map((p) => {
                      const grand = o.total + (p ? planPrice(p, o.nights, adults, children) : 0);
                      const short = !!p?.too_short;
                      return (
                        <div key={p?.id ?? "ro"} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                          <div className="flex-1 min-w-[180px]">
                            <div className="font-medium text-sm">{p ? p.name : "Room only"}</div>
                            <div className="text-xs text-slate-500">{p ? mealsOf(p) : "no meals"}{p?.stay_label && Number(p.adult_stay) > 0 ? ` · includes ${p.stay_label}` : ""}{short ? ` · min ${p!.min_nights} nights` : ""}</div>
                            {p?.description && <div className="text-xs text-slate-500">{p.description}</div>}
                          </div>
                          <div className="font-semibold tabular-nums">{formatMoney(grand, h.currency)}</div>
                          <Button size="sm" disabled={!ok || short} onClick={() => setChosen({ ...o, rt, plan: p, grand })}
                            aria-label={`Choose ${rt.name}${p ? `, ${p.name}` : ", room only"}`}>Choose</Button>
                        </div>
                      );
                    })}
                  </div>
                )}>
                <div className="text-right space-y-1">
                  {!!o.plans?.length && <div className="text-xs text-slate-500">Room only from</div>}
                  <div className="text-2xl font-bold">{formatMoney(o.total, h.currency)}</div>
                  <div className="text-xs text-slate-500">{o.uniform === false ? `avg ${formatMoney(o.rate, h.currency)}` : formatMoney(o.rate, h.currency)} × {o.nights} night{o.nights === 1 ? "" : "s"} · {h.prices_include_tax ? "taxes included" : "plus taxes"}</div>
                  {o.seasons && o.seasons.length > 0 && <div className="text-xs text-slate-500">{o.seasons.join(", ")}</div>}
                  {!o.fits ? <Badge variant="outline">Sleeps up to {rt.max_occupancy}</Badge>
                    : o.restriction ? <Badge variant="outline" className="text-amber-800 border-amber-300 whitespace-normal">{o.restriction}</Badge>
                    : o.available === 0 ? <Badge variant="outline" className="text-red-700 border-red-200">Sold out</Badge>
                    : o.available <= 2 && <Badge variant="outline" className="text-amber-800 border-amber-300">Only {o.available} left</Badge>}
                  {!o.plans?.length && <div><Button disabled={!ok} onClick={() => setChosen({ ...o, rt, plan: null, grand: o.total })} aria-label={`Choose ${rt.name}`}>Choose</Button></div>}
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

const RoomCard = ({ rt, h, children, extra }: { rt: PublicRoomType; h: PublicHotel; children?: React.ReactNode; extra?: React.ReactNode }) => (
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
    {extra}
  </Card>
);

const GuestForm = ({ h, slug, offer, checkIn, checkOut, adults, children, onBack, onDone, onSoldOut }: {
  h: PublicHotel; slug: string; offer: Offer & { rt: PublicRoomType; plan: OfferPlan | null; grand: number }; checkIn: string; checkOut: string; adults: number; children: number;
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
      onDone({ ...(await bookRoom({
        slug, roomTypeId: offer.room_type_id, checkIn, checkOut, adults, children, ratePlanId: offer.plan?.id ?? null,
        firstName: v("first"), lastName: v("last"), email: v("email"), phone: v("phone"), nationality: v("nat"), requests: v("req"), website: v("website"),
      })), phone: v("phone") });
      scrollToId("book");
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
            <h2 className="text-lg font-semibold">{offer.rt.name}{offer.plan ? `, ${offer.plan.name}` : offer.plans?.length ? ", room only" : ""}</h2>
            <p className="text-sm text-slate-600">{nice(checkIn)} → {nice(checkOut)} · {offer.nights} night{offer.nights === 1 ? "" : "s"} · {adults} adult{adults === 1 ? "" : "s"}{children ? `, ${children} child${children === 1 ? "" : "ren"}` : ""}</p>
          </div>
          <div className="text-right"><div className="text-2xl font-bold">{formatMoney(offer.grand, h.currency)}</div><div className="text-xs text-slate-500">{h.prices_include_tax ? "taxes included" : "plus taxes"} · pay at the hotel</div></div>
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
        {r.plan && <><dt className="text-slate-500">Meal plan</dt><dd>{r.plan}</dd></>}
        <dt className="text-slate-500">Check-in</dt><dd>{nice(r.check_in)} from {h.checkin_time}</dd>
        <dt className="text-slate-500">Check-out</dt><dd>{nice(r.check_out)} by {h.checkout_time}</dd>
        <dt className="text-slate-500">Total</dt><dd className="font-semibold">{formatMoney(r.total, r.currency)} <span className="font-normal text-slate-500">({r.nights} night{r.nights === 1 ? "" : "s"})</span></dd>
      </dl>
      <OnlineDeposit slug={slug} code={r.code} keyValue={r.email} phone={r.phone} />
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

/** "Pay the deposit now with M-Pesa", when the hotel takes it online. */
const OnlineDeposit = ({ slug, code, keyValue, phone }: { slug: string; code: string; keyValue: string; phone?: string | null }) => {
  const info = useQuery({
    queryKey: ["public-mpesa", slug, code, keyValue],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_mpesa_info" as never, { _slug: slug, _code: code, _email_or_last_name: keyValue } as never);
      if (error) throw error;
      return data as unknown as { available: boolean; amount: number; paid: number; deposit: string };
    },
  });
  const [paid, setPaid] = useState<string | null>(null);
  if (paid) return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm" data-testid="deposit-paid">
      <div className="font-medium">Payment received, thank you.</div><div className="text-slate-600">M-Pesa receipt <span className="font-mono">{paid}</span>. The hotel has it on your booking.</div>
    </div>
  );
  if (!info.data?.available) return null;
  return (
    <div className="rounded-md border p-3 space-y-2 print:hidden" data-testid="online-deposit">
      <div className="font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-green-600" />
        {info.data.deposit === "full" ? "Pay for your stay now with M-Pesa" : "Secure your booking: pay the first night with M-Pesa"}</div>
      <p className="text-sm text-slate-600">We'll send a prompt to your phone. Enter your M-Pesa PIN to pay {formatMoney(info.data.amount, "KES")}.</p>
      <MpesaPrompt compact amount={info.data.amount} currency="KES" defaultPhone={phone}
        create={(ph) => createOnlinePrompt(slug, code, keyValue, ph)} onPaid={(p) => setPaid(p.receipt ?? "")} />
    </div>
  );
};

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
            {b.status === "confirmed" && <OnlineDeposit slug={slug} code={b.code} keyValue={key} />}
            {b.status === "confirmed" && <div className="pt-1"><CheckInOnline slug={slug} code={b.code} keyValue={key} /></div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
