// Online → Website: what the hotel's guest website looks like and shows.
// Saved in booking_settings (site, gallery, features); the public page reads them through public_hotel().
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PhotoField, PhotoList } from "@/components/common/PhotoInput";
import { useSaveBookingSettings } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";
import type { BookingSettings, SiteFeature, SiteFont, SiteOffer, SiteSettings, SiteTheme } from "@/lib/db-types";
import { FONTS, HEX, SECTIONS, THEMES, baseColors, hexToHsl, hslToHex, sectionList } from "@/features/public/siteTheme";

const NL = String.fromCharCode(10);
const lines = (v: string) => v.split(NL);
const isHttps = (u: string) => /^https:\/\/[^\s"'<>]+$/i.test(u);
const t = (v?: string | null) => (v?.trim() ? v.trim() : null);

interface Draft { site: SiteSettings; gallery: string[]; features: SiteFeature[] }

const Field = ({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

export const WebsiteTab = ({ s, url }: { s: BookingSettings; url: string }) => {
  const save = useSaveBookingSettings();
  const ready = "site" in s && "gallery" in s && "features" in s;
  const initial = useMemo<Draft>(() => ({ site: s.site ?? {}, gallery: s.gallery ?? [], features: s.features ?? [] }), [s]);
  const [d, setD] = useState<Draft>(initial);
  useEffect(() => setD(initial), [initial]);
  const site = d.site;
  const setSite = (patch: Partial<SiteSettings>) => setD((x) => ({ ...x, site: { ...x.site, ...patch } }));

  if (!ready) {
    return (
      <Card><CardContent className="p-6 text-sm space-y-2">
        <p className="font-medium">The website settings need a database update first.</p>
        <p className="text-slate-600">Run <code>20261117140000_guest_site.sql</code> and then <code>20261117160000_guest_site_settings.sql</code> from <code>supabase/migrations</code> in the Supabase SQL Editor, then reload this page.</p>
      </CardContent></Card>
    );
  }

  // every link on the page, to check before saving
  const links: [string, string][] = [
    ["Logo", site.logo_url ?? ""],
    ...(site.hero?.photos ?? []).map((u, i) => [`Hero photo ${i + 1}`, u] as [string, string]),
    ...d.gallery.map((u, i) => [`Gallery photo ${i + 1}`, u] as [string, string]),
    ...d.features.map((f, i) => [`Experience ${i + 1} photo`, f.photo_url ?? ""] as [string, string]),
    ...(site.offers ?? []).map((o, i) => [`Offer ${i + 1} photo`, o.photo_url ?? ""] as [string, string]),
    ...Object.entries(site.social ?? {}).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v ?? ""] as [string, string]),
    ["Notice link", site.notice?.link ?? ""],
  ];
  const bad = links.filter(([, u]) => u.trim() && !isHttps(u.trim()));
  const offerProblems = (site.offers ?? []).some((o) => !o.title.trim()) ? ["Every offer needs a title"] : [];
  const customProblem = site.theme === "custom" && Object.values(site.colors ?? {}).some((c) => c && !HEX.test(c)) ? ["Colours must look like #1a2b3c"] : [];
  const problems = [...bad.map(([w]) => `${w}: links must start with https://`), ...offerProblems, ...customProblem];

  const doSave = () => {
    const clean: SiteSettings = {
      theme: site.theme ?? "lake",
      colors: site.theme === "custom" ? site.colors : undefined,
      heading_font: site.heading_font ?? "cormorant",
      logo_url: t(site.logo_url),
      hero: { photos: (site.hero?.photos ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 6), tagline: t(site.hero?.tagline), waves: site.hero?.waves !== false },
      sections: sectionList(site),
      offers: (site.offers ?? []).map((o) => ({
        title: o.title.trim(), text: t(o.text), photo_url: t(o.photo_url), from_date: o.from_date || null, to_date: o.to_date || null,
        min_nights: o.min_nights ? Number(o.min_nights) : null, price: o.price ? Number(o.price) : null, price_label: t(o.price_label),
      })),
      marquee: (site.marquee ?? []).map((w) => w.trim()).filter(Boolean).slice(0, 8),
      social: Object.fromEntries(Object.entries(site.social ?? {}).map(([k, v]) => [k, t(v)]).filter(([, v]) => v)),
      notice: t(site.notice?.text) ? { text: t(site.notice?.text), link: t(site.notice?.link) } : {},
      seo: { title: t(site.seo?.title), description: t(site.seo?.description) },
    };
    save.mutate({
      site: JSON.parse(JSON.stringify(clean)),
      gallery: d.gallery.map((u) => u.trim()).filter(Boolean).slice(0, 12),
      features: d.features.filter((f) => f.title.trim()).map((f) => ({ title: f.title.trim(), text: t(f.text), photo_url: t(f.photo_url) })),
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <Look site={site} setSite={setSite} />
      <Hero site={site} setSite={setSite} />
      <Sections site={site} setSite={setSite} />
      <Experiences features={d.features} onChange={(features) => setD((x) => ({ ...x, features }))} />
      <Offers site={site} setSite={setSite} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Photo gallery</CardTitle><CardDescription>The “Impressions” section, up to 12 photos. The first one is shown large.</CardDescription></CardHeader>
          <CardContent>
            <PhotoList kind="gallery" max={12} label="Gallery photos" value={d.gallery} onChange={(gallery) => setD((x) => ({ ...x, gallery }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Moving words</CardTitle><CardDescription>A slow band of words, e.g. “Riverside · Quiet · Local food”. One per line, up to 8. Empty = your experience titles.</CardDescription></CardHeader>
          <CardContent>
            <Textarea aria-label="Moving words" rows={6} value={(site.marquee ?? []).join(NL)} onChange={(e) => setSite({ marquee: lines(e.target.value).slice(0, 8) })}
              placeholder={["Adults only", "Local cuisine", "Lake views"].join(NL)} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Social links</CardTitle><CardDescription>Shown in the footer. Full https:// links.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(["instagram", "facebook", "tiktok", "tripadvisor"] as const).map((k) => (
              <Field key={k} id={`ws-${k}`} label={{ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", tripadvisor: "Tripadvisor" }[k]}>
                <Input id={`ws-${k}`} value={site.social?.[k] ?? ""} onChange={(e) => setSite({ social: { ...site.social, [k]: e.target.value } })} placeholder={`https://www.${k}.com/…`} />
              </Field>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Notice bar</CardTitle><CardDescription>One line across the top of the page. Leave empty to hide it.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Field id="ws-notice" label="Message"><Input id="ws-notice" maxLength={120} value={site.notice?.text ?? ""} onChange={(e) => setSite({ notice: { ...site.notice, text: e.target.value } })} placeholder="Festive packages are now open" /></Field>
            <Field id="ws-notice-link" label="Link (optional)"><Input id="ws-notice-link" value={site.notice?.link ?? ""} onChange={(e) => setSite({ notice: { ...site.notice, link: e.target.value } })} placeholder="https://…" /></Field>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Search engines</CardTitle><CardDescription>How the page is named in the browser tab and in Google results.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field id="ws-seo-title" label="Page title" hint={`${(site.seo?.title ?? "").length}/60. Empty = hotel name.`}>
            <Input id="ws-seo-title" maxLength={70} value={site.seo?.title ?? ""} onChange={(e) => setSite({ seo: { ...site.seo, title: e.target.value } })} placeholder="Lakeside Lodge · Naivasha" /></Field>
          <Field id="ws-seo-desc" label="Description" hint={`${(site.seo?.description ?? "").length}/160`}>
            <Textarea id="ws-seo-desc" rows={2} maxLength={200} value={site.seo?.description ?? ""} onChange={(e) => setSite({ seo: { ...site.seo, description: e.target.value } })} /></Field>
        </CardContent>
      </Card>

      {/* Right padding keeps the buttons clear of the floating Help button in the corner. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-lg border bg-background/95 p-3 pr-36 shadow-lg backdrop-blur">
        {problems.length ? <p className="flex-1 text-sm text-red-600" role="alert">{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ""}</p>
          : <p className="flex-1 text-sm text-slate-500">Changes show on your website as soon as you save.</p>}
        <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open website</a></Button>
        <Button disabled={save.isPending || problems.length > 0} onClick={doSave}>Save website</Button>
      </div>
    </div>
  );
};

type SiteProps = { site: SiteSettings; setSite: (p: Partial<SiteSettings>) => void };

// ---------------------------------------------------------------- look
const Swatch = ({ colors }: { colors: string[] }) => (
  <span className="flex overflow-hidden rounded-md border">{colors.map((c, i) => <span key={i} className="h-8 w-6" style={{ background: c }} />)}</span>
);

const Look = ({ site, setSite }: SiteProps) => {
  const theme = site.theme ?? "lake";
  const custom = baseColors({ ...site, theme: "custom" });
  const colorVal = (k: "primary" | "accent" | "background") => site.colors?.[k] ?? hslToHex(custom[k]);
  const tooLight = theme === "custom" && (hexToHsl(site.colors?.primary ?? "")?.[2] ?? 0) > 36;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Look</CardTitle><CardDescription>Colours, heading letters and your logo.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Colour theme">
          {(Object.keys(THEMES) as Exclude<SiteTheme, "custom">[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={theme === k} onClick={() => setSite({ theme: k })}
              className={cn("flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900", theme === k && "ring-2 ring-primary")}>
              <Swatch colors={[THEMES[k].primary, THEMES[k].accent, THEMES[k].background].map(hslToHex)} />{THEMES[k].label}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={theme === "custom"} onClick={() => setSite({ theme: "custom", colors: { primary: colorVal("primary"), accent: colorVal("accent"), background: colorVal("background") } })}
            className={cn("flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900", theme === "custom" && "ring-2 ring-primary")}>
            <Swatch colors={[colorVal("primary"), colorVal("accent"), colorVal("background")]} />Your own colours
          </button>
        </div>
        {theme === "custom" && (
          <div className="grid gap-3 sm:grid-cols-3">
            {([["primary", "Main colour (dark)"], ["accent", "Accent (buttons, soft)"], ["background", "Background (light)"]] as const).map(([k, label]) => (
              <Field key={k} id={`ws-c-${k}`} label={label}>
                <div className="flex gap-2">
                  <input type="color" aria-label={`${label} picker`} value={HEX.test(colorVal(k)) ? colorVal(k) : "#000000"}
                    onChange={(e) => setSite({ colors: { ...site.colors, [k]: e.target.value } })} className="h-10 w-12 cursor-pointer rounded border bg-transparent" />
                  <Input id={`ws-c-${k}`} value={colorVal(k)} maxLength={7} onChange={(e) => setSite({ colors: { ...site.colors, [k]: e.target.value.trim() } })} className="font-mono" />
                </div>
              </Field>
            ))}
            {tooLight && <p className="sm:col-span-3 text-xs text-amber-700">Your main colour is light, so it will be shown darker to keep text readable.</p>}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ws-font" label="Heading letters">
            <div className="grid gap-2" role="radiogroup" aria-label="Heading letters">
              {(Object.keys(FONTS) as SiteFont[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={(site.heading_font ?? "cormorant") === k} onClick={() => setSite({ heading_font: k })}
                  className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900", (site.heading_font ?? "cormorant") === k && "ring-2 ring-primary")}>
                  <span className="text-xl uppercase tracking-[0.14em]" style={{ fontFamily: FONTS[k].css, fontWeight: 300 }}>Rooms & suites</span>
                  <span className="text-xs text-slate-500">{FONTS[k].label}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field id="ws-logo" label="Logo (optional)" hint="A light-coloured PNG with a transparent background works best (it sits on photos and dark colours). Without one, your hotel name is shown in the heading letters.">
            <PhotoField id="ws-logo" kind="logo" value={site.logo_url ?? ""} onChange={(v) => setSite({ logo_url: v })} placeholder="Upload, or paste https://…/logo.png" />
            {site.logo_url && isHttps(site.logo_url) && (
              <div className="mt-2 flex h-24 items-center justify-center rounded-md bg-slate-800 p-3"><img src={site.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" /></div>
            )}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- hero
const Hero = ({ site, setSite }: SiteProps) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-lg">Top of the page</CardTitle><CardDescription>The big photo area people see first.</CardDescription></CardHeader>
    <CardContent className="grid gap-4 lg:grid-cols-2">
      <Field label="Slideshow photos (up to 6)" hint="Empty = your main photo and the first gallery photos. Wide landscape photos work best.">
        <PhotoList kind="hero" max={6} label="Slideshow photos" value={site.hero?.photos ?? []} onChange={(photos) => setSite({ hero: { ...site.hero, photos } })} />
      </Field>
      <div className="space-y-4">
        <Field id="ws-tagline" label="Line under the name (optional)" hint="Short, e.g. “Lakeside lodge · Naivasha”.">
          <Input id="ws-tagline" maxLength={90} value={site.hero?.tagline ?? ""} onChange={(e) => setSite({ hero: { ...site.hero, tagline: e.target.value } })} />
        </Field>
        <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
          <Switch checked={site.hero?.waves !== false} onCheckedChange={(v) => setSite({ hero: { ...site.hero, waves: v } })} />
          <span><span className="font-medium">Moving water waves</span><span className="block text-xs text-slate-500">Gentle waves between sections. Switch off for straight edges.</span></span>
        </label>
      </div>
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------- sections
const Sections = ({ site, setSite }: SiteProps) => {
  const list = sectionList(site);
  const move = (i: number, dir: number) => {
    const next = [...list];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSite({ sections: next });
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Sections</CardTitle><CardDescription>Switch parts of the page on or off and put them in the order you like. The menu follows this order.</CardDescription></CardHeader>
      <CardContent>
        <ol className="divide-y rounded-md border">
          {list.map((x, i) => {
            const meta = SECTIONS.find((m) => m.key === x.key)!;
            return (
              <li key={x.key} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 text-xs text-slate-400 tabular-nums">{i + 1}</span>
                <div className="flex-1"><div className="text-sm font-medium">{meta.label}</div><div className="text-xs text-slate-500">{meta.hint}</div></div>
                <Switch checked={x.on} disabled={x.key === "book"} aria-label={`Show ${meta.label}`}
                  onCheckedChange={(v) => setSite({ sections: list.map((y) => (y.key === x.key ? { ...y, on: v } : y)) })} />
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${meta.label} up`}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${meta.label} down`}><ArrowDown className="h-4 w-4" /></Button>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- experiences
const Experiences = ({ features, onChange }: { features: SiteFeature[]; onChange: (f: SiteFeature[]) => void }) => {
  const rows: SiteFeature[] = [0, 1, 2].map((i) => features[i] ?? { title: "", text: "", photo_url: "" });
  const set = (i: number, patch: Partial<SiteFeature>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Experiences</CardTitle><CardDescription>Up to 3 blocks with a big photo, e.g. restaurant, pool, things to do. Leave a title empty to hide that block.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        {rows.map((x, i) => (
          <div key={i} className="space-y-2 rounded-md border p-3">
            <Input aria-label={`Experience ${i + 1} title`} value={x.title} maxLength={80} onChange={(e) => set(i, { title: e.target.value })} placeholder={["Restaurant", "Pool & spa", "Things to do"][i]} />
            <PhotoField kind="feature" value={x.photo_url ?? ""} onChange={(v) => set(i, { photo_url: v })} placeholder="Photo: upload or https://…" />
            <Textarea aria-label={`Experience ${i + 1} text`} rows={3} maxLength={600} value={x.text ?? ""} onChange={(e) => set(i, { text: e.target.value })} placeholder="A sentence or two." />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- offers
const Offers = ({ site, setSite }: SiteProps) => {
  const offers = site.offers ?? [];
  const set = (i: number, patch: Partial<SiteOffer>) => setSite({ offers: offers.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5"><CardTitle className="text-lg">Offers & packages</CardTitle>
          <CardDescription>Shown in a slider while they are current; they disappear by themselves after the end date. Guests book them through the normal booking (meal plans and packages are chosen there).</CardDescription></div>
        <Button variant="outline" size="sm" disabled={offers.length >= 8} onClick={() => setSite({ offers: [...offers, { title: "" }] })}><Plus className="mr-1 h-4 w-4" />Add offer</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!offers.length && <p className="text-sm text-slate-500">No offers yet.</p>}
        {offers.map((o, i) => (
          <div key={i} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
            <Field id={`of-t-${i}`} label="Title"><Input id={`of-t-${i}`} maxLength={80} value={o.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Long weekend escape" /></Field>
            <Field id={`of-f-${i}`} label="From"><Input id={`of-f-${i}`} type="date" value={o.from_date ?? ""} onChange={(e) => set(i, { from_date: e.target.value })} /></Field>
            <Field id={`of-to-${i}`} label="Until"><Input id={`of-to-${i}`} type="date" value={o.to_date ?? ""} min={o.from_date ?? undefined} onChange={(e) => set(i, { to_date: e.target.value })} /></Field>
            <Field id={`of-n-${i}`} label="Minimum nights"><Input id={`of-n-${i}`} type="number" min={1} max={30} value={o.min_nights ?? ""} onChange={(e) => set(i, { min_nights: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field id={`of-p-${i}`} label="From price"><Input id={`of-p-${i}`} type="number" min={0} value={o.price ?? ""} onChange={(e) => set(i, { price: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field id={`of-pl-${i}`} label="Price note"><Input id={`of-pl-${i}`} maxLength={60} value={o.price_label ?? ""} onChange={(e) => set(i, { price_label: e.target.value })} placeholder="2 adults per night, breakfast included" /></Field>
            <div className="md:col-span-2"><Field id={`of-ph-${i}`} label="Photo"><PhotoField id={`of-ph-${i}`} kind="offer" value={o.photo_url ?? ""} onChange={(v) => set(i, { photo_url: v })} /></Field></div>
            <div className="flex items-end justify-end md:col-span-4">
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setSite({ offers: offers.filter((_, j) => j !== i) })}><Trash2 className="mr-1 h-4 w-4" />Remove offer</Button>
            </div>
            <div className="md:col-span-4"><Field id={`of-x-${i}`} label="Description"><Textarea id={`of-x-${i}`} rows={2} maxLength={400} value={o.text ?? ""} onChange={(e) => set(i, { text: e.target.value })} /></Field></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
