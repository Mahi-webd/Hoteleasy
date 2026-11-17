// The guest website look: cream and deep navy, thin wide capitals, big photos, moving water between
// sections, a "Book" button that is always on screen and a full-screen menu.
// Used by the booking page (/book/<slug>, and / for visitors) and, through PublicShell, by the other guest pages.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  ArrowRight, BedDouble, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Facebook, Instagram, Mail, MapPin, Menu,
  MessageCircle, Moon, Phone, Star, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { waNumber } from "@/hooks/useOnline";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicHotel, PublicRoomType, SiteFeature, SiteOffer } from "@/lib/db-types";
import { HeroSlides, ParallaxImage, Reveal, WaveMark, Waves } from "./GuestMotion";
import { safeUrl } from "./siteTheme";

/** The hotel's logo (when set) or its name in the heading letters. */
const Brand = ({ h, className, imgClassName }: { h: PublicHotel; className?: string; imgClassName?: string }) => {
  const logo = safeUrl(h.site?.logo_url);
  return logo ? <img src={logo} alt={h.name} className={cn("object-contain", imgClassName)} /> : <span className={cn("gs-display", className)}>{h.name}</span>;
};

/** One line across the top of the page, set by the hotel. Can be closed for this visit. */
export const NoticeBar = ({ h }: { h: PublicHotel }) => {
  const text = h.site?.notice?.text?.trim();
  const link = safeUrl(h.site?.notice?.link);
  const key = `gs-notice:${text}`;
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(key) === "1"; } catch { return false; } });
  if (!text || hidden) return null;
  const close = () => { setHidden(true); try { sessionStorage.setItem(key, "1"); } catch { /* private mode */ } };
  return (
    <div className="relative z-30 bg-secondary px-10 py-2 text-center text-sm text-secondary-foreground print:hidden">
      {link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">{text}<ArrowRight className="h-3.5 w-3.5" /></a> : text}
      <button type="button" onClick={close} aria-label="Close notice" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
    </div>
  );
};

/** Simple page frame for guest pages without the full website (check-in, feedback, guest stay). */
export const PublicShell = ({ children }: { children: React.ReactNode }) => (
  <div className="guest-site min-h-screen">
    <div className="relative h-14 bg-primary" aria-hidden="true"><Waves fill="background" className="bottom-[-1px]" height={28} /></div>
    <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">{children}</main>
    <footer className="text-center text-xs text-muted-foreground pb-8">Powered by HotelEasy</footer>
  </div>
);

export const Stars = ({ value, className }: { value: number; className?: string }) => (
  <span className={cn("inline-flex", className)} aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-4 w-4 ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-current opacity-30"}`} />
    ))}
  </span>
);

export const SectionTitle = ({ eyebrow, title, className, big }: { eyebrow?: string; title: string; className?: string; big?: boolean }) => (
  <Reveal className={cn("text-center space-y-4", className)}>
    <WaveMark />
    {eyebrow && <p className="gs-eyebrow opacity-70">{eyebrow}</p>}
    <h2 className={cn("gs-display", big ? "text-4xl sm:text-6xl md:text-7xl" : "text-3xl sm:text-5xl")}>{title}</h2>
  </Reveal>
);

export const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** How a guest asks a question: WhatsApp first, then phone, then email. */
const enquireHref = (h: PublicHotel) =>
  h.whatsapp ? `https://wa.me/${waNumber(h.whatsapp)}?text=${encodeURIComponent(`Hello ${h.name}, I have a question about a stay.`)}`
    : h.phone ? `tel:${h.phone}` : h.email ? `mailto:${h.email}` : null;

// ---------------------------------------------------------------------------
/** Slim bar with the hotel's name that slides in once the visitor has scrolled past the big photo. */
const TopBar = ({ h, onBook }: { h: PublicHotel; onBook: () => void }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => setOn(window.scrollY > window.innerHeight * 0.85);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <div className={cn("fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-background/[0.97] shadow-sm backdrop-blur-md transition-transform duration-500 print:hidden",
      on ? "translate-y-0" : "-translate-y-full")} aria-hidden={!on}>
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8">
        {h.phone ? <a href={`tel:${h.phone}`} tabIndex={on ? 0 : -1} className="hidden sm:block text-xs tracking-wider text-muted-foreground hover:text-foreground">T {h.phone}</a> : <span />}
        <button type="button" tabIndex={on ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={`${h.name}, back to top`}
          className="col-start-2 flex h-10 items-center justify-center truncate"><Brand h={h} className="truncate text-base sm:text-lg" imgClassName="h-9 max-w-[180px]" /></button>
        <div className="flex justify-end">
          <Button size="sm" tabIndex={on ? 0 : -1} className="rounded-full px-5" onClick={onBook}>Book</Button>
        </div>
      </div>
    </div>
  );
};

/** Floating Enquire / Book buttons, the top bar and the full-screen menu. */
export const SiteChrome = ({ h, links, onBook }: { h: PublicHotel; links: { id: string; label: string }[]; onBook: () => void }) => {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const enquire = enquireHref(h);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (id: string) => { setOpen(false); setTimeout(() => (id === "book" ? onBook() : scrollToId(id)), 50); };

  return (
    <>
      <TopBar h={h} onBook={onBook} />
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-full bg-card/95 p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur print:hidden">
        {enquire && (
          <Button asChild className="rounded-full px-5">
            <a href={enquire} target={enquire.startsWith("http") ? "_blank" : undefined} rel="noreferrer">Enquire</a>
          </Button>
        )}
        <Button variant="secondary" className="rounded-full px-6" onClick={onBook}>Book</Button>
      </div>

      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary-foreground/30 transition hover:scale-105 print:hidden">
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="guest-menu fixed inset-0 z-50 flex flex-col overflow-y-auto bg-primary text-primary-foreground">
          <div className="flex items-center justify-between p-5 sm:p-8">
            <Brand h={h} className="text-lg" imgClassName="h-10 max-w-[200px]" />
            {h.phone && <a href={`tel:${h.phone}`} className="hidden sm:inline text-sm tracking-wider opacity-80 hover:opacity-100">T {h.phone}</a>}
          </div>
          <nav className="relative z-20 flex-1 px-6 sm:px-16 pb-40">
            <ul className="space-y-2 sm:space-y-3">
              {links.map((l, i) => (
                <li key={l.id} className="gs-rise" style={{ animationDelay: `${80 + i * 70}ms` }}>
                  <button type="button" onClick={() => go(l.id)}
                    className="gs-display text-4xl sm:text-6xl text-left opacity-80 transition duration-300 hover:opacity-100 hover:translate-x-3">{l.label}</button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40" aria-hidden="true">
            <Waves fill="primary-foreground" soft className="bottom-0" height={160} />
          </div>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close menu"
            className="fixed bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-lg transition hover:rotate-90">
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
/** The hero photos: the main photo, then a few gallery photos. */
const heroPhotos = (h: PublicHotel) => {
  const chosen = (h.site?.hero?.photos ?? []).map(safeUrl).filter((u): u is string => !!u);
  return chosen.length ? chosen : [...new Set([h.photo_url, ...(h.gallery ?? []).slice(0, 4)].filter((u): u is string => !!u))];
};

export const Hero = ({ h }: { h: PublicHotel }) => {
  const words = h.name.split(/\s+/);
  const logo = safeUrl(h.site?.logo_url);
  const tagline = h.site?.hero?.tagline?.trim();
  return (
    <section className="relative h-[100svh] min-h-[560px] overflow-hidden bg-primary text-primary-foreground">
      <HeroSlides photos={heroPhotos(h)} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/55" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-5 sm:p-8 text-sm tracking-wider text-white">
        {h.phone ? <a href={`tel:${h.phone}`} className="hover:underline">T {h.phone}</a> : <span />}
        {h.city && <span className="gs-eyebrow">{h.city}</span>}
      </div>
      <div className="relative z-20 flex h-full flex-col items-center justify-center px-6 pb-16 text-center text-white">
        {logo ? (
          <h1 className="gs-rise" style={{ animationDelay: "250ms" }}><img src={logo} alt={h.name} className="mx-auto max-h-36 sm:max-h-48 max-w-[80vw] object-contain drop-shadow" /></h1>
        ) : (
          <h1 className="gs-display text-4xl sm:text-6xl md:text-8xl max-w-5xl drop-shadow-sm">
            {words.map((w, i) => (
              <span key={i} className="gs-rise" style={{ animationDelay: `${250 + i * 180}ms` }}>{w}{i < words.length - 1 ? " " : ""}</span>
            ))}
          </h1>
        )}
        {tagline && <p className="gs-rise gs-eyebrow mt-5" style={{ animationDelay: `${350 + words.length * 180}ms` }}>{tagline}</p>}
        <div className="gs-rise mt-6" style={{ animationDelay: `${400 + words.length * 180}ms` }}><WaveMark className="text-white" /></div>
        {h.reviews && h.reviews.count > 0 && h.reviews.average != null && (
          <p className="gs-rise mt-4 inline-flex items-center gap-2 text-sm" style={{ animationDelay: `${700 + words.length * 180}ms` }}>
            <Stars value={Number(h.reviews.average)} /> {Number(h.reviews.average).toFixed(1)} · {h.reviews.count} guest review{h.reviews.count === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
        <button type="button" onClick={() => scrollToId("about")} aria-label="Scroll down"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 text-white transition hover:bg-white/10 motion-safe:animate-bounce">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
      <Waves fill="background" className="bottom-[-1px]" height={90} />
    </section>
  );
};

export const Intro = ({ h }: { h: PublicHotel }) => (
  <section id="about" className="relative scroll-mt-16 px-6 py-20 sm:py-28">
    <div className="mx-auto max-w-3xl text-center space-y-8">
      <SectionTitle eyebrow={h.city ?? undefined} title={h.headline || `Welcome to ${h.name}`} />
      {h.description && (
        <Reveal delay={150}><p className="text-base sm:text-xl leading-relaxed text-muted-foreground font-light whitespace-pre-line">{h.description}</p></Reveal>
      )}
      <Reveal delay={250} className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
        {(h.address || h.city) && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{[h.address, h.city].filter(Boolean).join(", ")}</span>}
        <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />Check-in from {h.checkin_time} · check-out by {h.checkout_time}</span>
      </Reveal>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
export const Features = ({ items }: { items: SiteFeature[] }) => (
  <section id="experiences" className="relative scroll-mt-16 px-4 sm:px-8 pb-20 sm:pb-28">
    <div className="mx-auto max-w-6xl space-y-20 sm:space-y-32">
      {items.map((f, i) => (
        <article key={i} className={cn("grid items-center gap-8 md:gap-16", f.photo_url && "md:grid-cols-2")}>
          {f.photo_url && (
            <Reveal className={cn(i % 2 === 1 && "md:order-2")}>
              <ParallaxImage src={f.photo_url} alt={f.title} frameClassName="aspect-[4/5] w-full rounded-[2rem]" />
            </Reveal>
          )}
          <Reveal delay={150} className={cn("space-y-5", !f.photo_url && "text-center mx-auto max-w-2xl")}>
            <p className="gs-eyebrow text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="gs-display text-3xl sm:text-5xl">{f.title}</h3>
            <span className={cn("block h-px w-16 bg-foreground/30", !f.photo_url && "mx-auto")} aria-hidden="true" />
            {f.text && <p className="text-base sm:text-lg leading-relaxed text-muted-foreground font-light whitespace-pre-line">{f.text}</p>}
          </Reveal>
        </article>
      ))}
    </div>
  </section>
);

/** Two slow bands of words moving in opposite directions, e.g. the feature titles. */
export const Marquee = ({ words }: { words: string[] }) => {
  const line = words.join("   ·   ");
  const Row = ({ reverse }: { reverse?: boolean }) => (
    <div className={cn("gs-marquee flex w-max whitespace-pre", reverse && "[animation-direction:reverse]")}>
      {[0, 1].map((k) => <span key={k} className="gs-display px-4 text-2xl sm:text-4xl">{line}   ·   {line}   ·   </span>)}
    </div>
  );
  return (
    <div className="space-y-2 overflow-hidden border-y border-border py-6" aria-hidden="true">
      <div className="opacity-60"><Row /></div>
      <div className="opacity-25"><Row reverse /></div>
    </div>
  );
};

// ---------------------------------------------------------------------------
const roomPhotos = (rt: PublicRoomType) => [rt.photo_url, ...(rt.gallery ?? [])].filter((u): u is string => !!u);

export const RoomsCarousel = ({ h, onBook }: { h: PublicHotel; onBook: () => void }) => {
  const track = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<PublicRoomType | null>(null);
  const move = (dir: number) => track.current?.scrollBy({ left: dir * Math.min(460, track.current.clientWidth * 0.85), behavior: "smooth" });
  if (!h.room_types.length) return null;
  return (
    <section id="rooms" className="relative scroll-mt-16 py-20 sm:py-28 pb-32 sm:pb-40">
      <SectionTitle eyebrow="Stay" title="Rooms & suites" className="px-6" />
      <div className="mx-auto mt-10 flex max-w-6xl justify-end gap-2 px-4 sm:px-8">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => move(-1)} aria-label="Previous rooms"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => move(1)} aria-label="More rooms"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div ref={track} className="gs-no-scrollbar mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [--gs-pad:1rem] sm:[--gs-pad:max(2rem,calc((100vw-72rem)/2+2rem))] px-[var(--gs-pad)] scroll-px-[var(--gs-pad)]">
        {h.room_types.map((rt, i) => (
          <Reveal key={rt.id} delay={Math.min(i, 3) * 120} className="w-[82vw] max-w-[440px] shrink-0 snap-start">
            <article className="group">
              <div className="relative overflow-hidden rounded-[2rem] bg-muted shadow-sm transition duration-500 group-hover:shadow-xl">
                {rt.photo_url ? <img src={rt.photo_url} alt={rt.name} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-[1200ms] group-hover:scale-105" />
                  : <div className="flex aspect-[4/5] items-center justify-center"><BedDouble className="h-14 w-14 text-muted-foreground/40" /></div>}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" aria-hidden="true" />
                <div className="absolute right-3 top-3 flex gap-1 rounded-full bg-card/90 p-1 backdrop-blur">
                  <Button size="sm" className="rounded-full" onClick={() => setDetails(rt)}>Details</Button>
                  <Button size="sm" variant="secondary" className="rounded-full" onClick={onBook}>Book</Button>
                </div>
                <p className="absolute bottom-4 left-5 text-sm text-white"><span className="text-xs uppercase tracking-[0.2em] opacity-80">From </span><span className="font-medium">{formatMoney(rt.rate, h.currency)}</span></p>
              </div>
              <h3 className="gs-display mt-5 text-2xl sm:text-3xl">{rt.name}</h3>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Sleeps {rt.max_occupancy}</span>
                <span>per night · {h.prices_include_tax ? "taxes included" : "plus taxes"}</span>
              </p>
            </article>
          </Reveal>
        ))}
      </div>
      <RoomDetails h={h} rt={details} onClose={() => setDetails(null)} onBook={() => { setDetails(null); onBook(); }} />
    </section>
  );
};

const RoomDetails = ({ h, rt, onClose, onBook }: { h: PublicHotel; rt: PublicRoomType | null; onClose: () => void; onBook: () => void }) => {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [rt?.id]);
  const photos = rt ? roomPhotos(rt) : [];
  return (
    <Dialog open={!!rt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="guest-site max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {rt && (
          <>
            {photos.length > 0 && (
              <div className="space-y-2 p-2">
                <img key={photos[idx]} src={photos[idx]} alt={`${rt.name}, photo ${idx + 1}`} className="aspect-[16/10] w-full rounded-[1.25rem] object-cover animate-in fade-in duration-500" />
                {photos.length > 1 && (
                  <div className="gs-no-scrollbar flex gap-2 overflow-x-auto">
                    {photos.map((p, i) => (
                      <button key={p + i} type="button" onClick={() => setIdx(i)} aria-label={`Show photo ${i + 1}`}
                        className={cn("h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-1 transition", i === idx ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")}>
                        <img src={p} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-5 p-6 sm:p-8">
              <DialogTitle className="gs-display text-3xl sm:text-4xl font-normal">{rt.name}</DialogTitle>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Sleeps {rt.max_occupancy}</span>
                <span>From <span className="font-semibold">{formatMoney(rt.rate, h.currency)}</span> per night · {h.prices_include_tax ? "taxes included" : "plus taxes"}</span>
              </div>
              <DialogDescription className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">{rt.description || "Choose your dates to see the price for your stay."}</DialogDescription>
              {rt.amenities?.length > 0 && (
                <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 md:grid-cols-3">
                  {rt.amenities.map((a) => <li key={a} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-secondary-foreground" />{a}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button className="rounded-full px-6" onClick={onBook}>Check availability</Button>
                <Button variant="outline" className="rounded-full px-6" onClick={onClose}>Close</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
const day = (d: string) => format(parseISO(d), "d MMM yyyy");
const offerDates = (o: SiteOffer) =>
  o.from_date && o.to_date ? `${day(o.from_date)} – ${day(o.to_date)}` : o.to_date ? `Until ${day(o.to_date)}` : o.from_date ? `From ${day(o.from_date)}` : null;

export const OffersSlider = ({ h, offers, onBook }: { h: PublicHotel; offers: SiteOffer[]; onBook: () => void }) => {
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: number) => track.current?.scrollBy({ left: dir * Math.min(460, track.current.clientWidth * 0.85), behavior: "smooth" });
  if (!offers.length) return null;
  return (
    <section id="offers" className="relative scroll-mt-16 py-20 sm:py-28">
      <SectionTitle eyebrow="Special offers" title="Offers & packages" className="px-6" />
      {offers.length > 1 && (
        <div className="mx-auto mt-10 flex max-w-6xl justify-end gap-2 px-4 sm:px-8">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => move(-1)} aria-label="Previous offers"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => move(1)} aria-label="More offers"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
      <div ref={track} className={cn("gs-no-scrollbar mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [--gs-pad:1rem] sm:[--gs-pad:max(2rem,calc((100vw-72rem)/2+2rem))] px-[var(--gs-pad)] scroll-px-[var(--gs-pad)]",
        offers.length === 1 && "justify-center")}>
        {offers.map((o, i) => {
          const photo = safeUrl(o.photo_url);
          const dates = offerDates(o);
          const ask = h.whatsapp ? `https://wa.me/${waNumber(h.whatsapp)}?text=${encodeURIComponent(`Hello ${h.name}, I'm interested in the "${o.title}" offer.`)}` : null;
          return (
            <Reveal key={i} delay={Math.min(i, 3) * 120} className="w-[82vw] max-w-[400px] shrink-0 snap-start">
              <article className="group flex h-full flex-col overflow-hidden rounded-[2rem] bg-card shadow-sm ring-1 ring-border/60 transition duration-500 hover:shadow-xl">
                <div className="relative overflow-hidden">
                  {photo ? <img src={photo} alt={o.title} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-[1200ms] group-hover:scale-105" />
                    : <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary to-secondary" aria-hidden="true" />}
                  {o.min_nights ? <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-card/90 px-3 py-1 text-xs backdrop-blur"><Moon className="h-3.5 w-3.5" />from {o.min_nights} night{o.min_nights === 1 ? "" : "s"}</span> : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <h3 className="gs-display text-2xl">{o.title}</h3>
                  {dates && <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{dates}</p>}
                  {o.text && <p className="text-sm leading-relaxed text-muted-foreground">{o.text}</p>}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
                    {o.price ? (
                      <p><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From </span><span className="text-lg font-medium">{formatMoney(o.price, h.currency)}</span>
                        {o.price_label && <span className="block text-xs text-muted-foreground">{o.price_label}</span>}</p>
                    ) : <span />}
                    <div className="flex gap-1">
                      {ask && <Button asChild size="sm" variant="outline" className="rounded-full"><a href={ask} target="_blank" rel="noreferrer">Enquire</a></Button>}
                      <Button size="sm" className="rounded-full" onClick={onBook}>Book</Button>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
export const Gallery = ({ h, photos }: { h: PublicHotel; photos: string[] }) => {
  const [open, setOpen] = useState<number | null>(null);
  const step = (d: number) => setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length));
  return (
    <section id="gallery" className="relative scroll-mt-16 bg-primary text-primary-foreground px-4 sm:px-8 py-20 sm:py-28 pb-32 sm:pb-40">
      <Waves fill="primary" edge="top" />
      <SectionTitle eyebrow={h.name} title="Impressions" big />
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {photos.map((p, i) => (
          <Reveal key={p + i} delay={(i % 4) * 90} className={cn(i === 0 && "col-span-2 row-span-2")}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}`} className="group block h-full w-full overflow-hidden rounded-2xl">
              <img src={p} alt="" loading="lazy" className="aspect-square h-full w-full object-cover transition duration-[1200ms] group-hover:scale-110" />
            </button>
          </Reveal>
        ))}
      </div>
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="guest-site max-w-5xl border-0 bg-transparent p-0 shadow-none"
          onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}>
          <DialogTitle className="sr-only">Photo {open != null ? open + 1 : ""} of {photos.length}</DialogTitle>
          {open != null && <img key={open} src={photos[open]} alt={`Photo ${open + 1} of ${photos.length}`} className="max-h-[85vh] w-full rounded-2xl object-contain animate-in fade-in zoom-in-95 duration-500" />}
          {photos.length > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="secondary" size="icon" className="rounded-full" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="secondary" size="icon" className="rounded-full" onClick={() => step(1)} aria-label="Next photo"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Waves fill="primary" edge="bottom" />
    </section>
  );
};

// ---------------------------------------------------------------------------
export const Reviews = ({ h }: { h: PublicHotel }) => {
  const [i, setI] = useState(0);
  const list = h.reviews?.recent.filter((r) => r.comment) ?? [];
  if (!list.length) return null;
  const r = list[i % list.length];
  return (
    <section id="reviews" className="relative scroll-mt-16 px-6 py-24 sm:py-32">
      <SectionTitle eyebrow={h.reviews?.average != null ? `${Number(h.reviews.average).toFixed(1)} out of 5 · ${h.reviews.count} reviews` : undefined} title="What guests say" />
      <Reveal delay={150}>
        <figure key={i} className="mx-auto mt-12 max-w-3xl text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <Stars value={r.overall} className="justify-center" />
          <blockquote className="font-['Cormorant_Garamond',Georgia,serif] text-2xl sm:text-4xl leading-snug italic">“{r.comment}”</blockquote>
          <figcaption className="gs-eyebrow text-muted-foreground">{r.name} · {r.month}</figcaption>
          {r.response && <p className="mx-auto max-w-xl text-sm text-muted-foreground border-t border-border pt-4">Reply from the hotel: {r.response}</p>}
        </figure>
      </Reveal>
      {list.length > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setI((x) => (x - 1 + list.length) % list.length)} aria-label="Previous review"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setI((x) => (x + 1) % list.length)} aria-label="Next review"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
const Social = ({ h }: { h: PublicHotel }) => {
  const s = h.site?.social ?? {};
  const items = [
    { url: safeUrl(s.instagram), label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
    { url: safeUrl(s.facebook), label: "Facebook", icon: <Facebook className="h-4 w-4" /> },
    { url: safeUrl(s.tiktok), label: "TikTok", icon: <span className="text-[10px] font-semibold">TT</span> },
    { url: safeUrl(s.tripadvisor), label: "Tripadvisor", icon: <span className="text-[10px] font-semibold">TA</span> },
  ].filter((x) => x.url);
  if (!items.length) return null;
  return (
    <div className="flex gap-2 pt-2">
      {items.map((x) => (
        <a key={x.label} href={x.url!} target="_blank" rel="noreferrer" aria-label={x.label} title={x.label}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-foreground/30 transition hover:bg-primary-foreground hover:text-primary">{x.icon}</a>
      ))}
    </div>
  );
};

export const Footer = ({ h }: { h: PublicHotel }) => (
  <footer id="contact" className="relative scroll-mt-16 bg-primary text-primary-foreground px-6 pt-24 pb-28 sm:pb-20">
    <Waves fill="primary" edge="top" height={90} />
    <Reveal className="mx-auto max-w-6xl grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
      <div className="space-y-4">
        <Brand h={h} className="text-3xl sm:text-4xl" imgClassName="h-16 max-w-[220px]" />
        <WaveMark className="justify-start opacity-70" />
        {(h.address || h.city) && <p className="inline-flex items-start gap-2 text-sm opacity-80"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{[h.address, h.city, h.country].filter(Boolean).join(", ")}</p>}
      </div>
      <div className="space-y-3 text-sm">
        <p className="gs-eyebrow opacity-70">Contact</p>
        {h.phone && <p><a href={`tel:${h.phone}`} className="inline-flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" />{h.phone}</a></p>}
        {h.whatsapp && <p><a href={`https://wa.me/${waNumber(h.whatsapp)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline"><MessageCircle className="h-4 w-4" />WhatsApp</a></p>}
        {h.email && <p><a href={`mailto:${h.email}`} className="inline-flex items-center gap-2 hover:underline"><Mail className="h-4 w-4" />{h.email}</a></p>}
        <Social h={h} />
      </div>
      <div className="space-y-3 text-sm">
        <p className="gs-eyebrow opacity-70">Your stay</p>
        <p className="opacity-80">Check-in from {h.checkin_time}<br />Check-out by {h.checkout_time}</p>
        {h.policies && (
          <details className="opacity-80">
            <summary className="cursor-pointer hover:opacity-100">House rules</summary>
            <p className="mt-2 whitespace-pre-line">{h.policies}</p>
          </details>
        )}
      </div>
    </Reveal>
    <div className="mx-auto mt-16 flex max-w-6xl flex-wrap justify-between gap-4 border-t border-primary-foreground/20 pt-6 text-xs opacity-60">
      <span>Bookings powered by HotelEasy</span>
      <Link to="/login" className="hover:underline">Hotel staff sign in</Link>
    </div>
  </footer>
);
