// Turns the hotel's website settings into the page's look: colour theme, heading font, section order, offers.
import type { SiteFont, SiteOffer, SiteSectionKey, SiteSettings, SiteTheme } from "@/lib/db-types";

type HSL = [number, number, number];
const hsl = ([h, s, l]: HSL) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l * 10) / 10}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const THEMES: Record<Exclude<SiteTheme, "custom">, { label: string; primary: HSL; accent: HSL; background: HSL }> = {
  lake: { label: "Lake (navy & cream)", primary: [208, 52, 19], accent: [207, 32, 68], background: [40, 33, 96] },
  safari: { label: "Safari (olive & sand)", primary: [85, 22, 20], accent: [38, 45, 68], background: [42, 38, 95] },
  coast: { label: "Coast (teal & white sand)", primary: [188, 60, 18], accent: [175, 35, 66], background: [45, 45, 96] },
  sand: { label: "Desert (umber & terracotta)", primary: [16, 32, 24], accent: [24, 50, 70], background: [36, 40, 95] },
};

export const FONTS: Record<SiteFont, { label: string; css: string }> = {
  cormorant: { label: "Cormorant (elegant serif)", css: `"Cormorant Garamond", "Cormorant", Georgia, serif` },
  marcellus: { label: "Marcellus (classic carved letters)", css: `"Marcellus", Georgia, serif` },
  playfair: { label: "Playfair (bold serif)", css: `"Playfair Display", Georgia, serif` },
  jost: { label: "Jost (clean modern)", css: `"Jost", ui-sans-serif, system-ui, sans-serif` },
};

export const HEX = /^#[0-9a-f]{6}$/i;

export const hexToHsl = (hex: string): HSL | null => {
  if (!HEX.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};

export const hslToHex = ([h, s, l]: HSL) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** The three base colours for a site: from the chosen theme, or the hotel's own (made readable). */
export const baseColors = (site?: SiteSettings) => {
  const theme = site?.theme ?? "lake";
  if (theme !== "custom") return THEMES[theme] ?? THEMES.lake;
  const p = hexToHsl(site?.colors?.primary ?? "") ?? THEMES.lake.primary;
  const a = hexToHsl(site?.colors?.accent ?? "") ?? THEMES.lake.accent;
  const b = hexToHsl(site?.colors?.background ?? "") ?? THEMES.lake.background;
  // Light text sits on the main colour and dark text on the background, so keep them dark and light enough.
  return { label: "Your colours", primary: [p[0], p[1], clamp(p[2], 6, 36)] as HSL, accent: [a[0], a[1], clamp(a[2], 45, 85)] as HSL, background: [b[0], clamp(b[1], 0, 60), clamp(b[2], 90, 99)] as HSL };
};

/** A style sheet for .guest-site with the site's colours and heading font. Only computed numbers go in it. */
export const themeCss = (site?: SiteSettings) => {
  const { primary: p, accent: a, background: b } = baseColors(site);
  const vars: Record<string, string> = {
    "--background": hsl(b),
    "--foreground": hsl([p[0], Math.min(p[1], 45), 17]),
    "--card": hsl([b[0], b[1], Math.min(99.5, b[2] + 2.5)]),
    "--card-foreground": hsl([p[0], Math.min(p[1], 45), 17]),
    "--popover": hsl([b[0], b[1], Math.min(99.5, b[2] + 2.5)]),
    "--popover-foreground": hsl([p[0], Math.min(p[1], 45), 17]),
    "--primary": hsl(p),
    "--primary-foreground": hsl(b),
    "--secondary": hsl(a),
    "--secondary-foreground": hsl([p[0], p[1], 14]),
    "--muted": hsl([b[0], b[1] * 0.65, b[2] - 6]),
    "--muted-foreground": hsl([p[0], 14, 38]),
    "--accent": hsl([b[0], b[1] * 0.65, b[2] - 6]),
    "--accent-foreground": hsl(p),
    "--border": hsl([b[0], b[1] * 0.5, b[2] - 14]),
    "--input": hsl([b[0], b[1] * 0.5, b[2] - 18]),
    "--ring": hsl([p[0], p[1], p[2] + 10]),
  };
  const font = FONTS[site?.heading_font ?? "cormorant"] ?? FONTS.cormorant;
  const body = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join("");
  return `.guest-site{${body}--gs-display-font:${font.css};}`;
};

export const SECTIONS: { key: SiteSectionKey; label: string; hint: string }[] = [
  { key: "about", label: "Welcome", hint: "Headline and about the hotel" },
  { key: "experiences", label: "Experiences", hint: "Your feature blocks" },
  { key: "marquee", label: "Moving words", hint: "Band of words that slowly moves" },
  { key: "rooms", label: "Rooms", hint: "Room types offered online" },
  { key: "offers", label: "Offers & packages", hint: "Shown while their dates are current" },
  { key: "book", label: "Booking", hint: "Always shown" },
  { key: "gallery", label: "Impressions", hint: "Photo gallery" },
  { key: "reviews", label: "Reviews", hint: "Guest reviews you have chosen" },
];

/** The saved order and on/off, with any section added in an update put at the end, switched on. */
export const sectionList = (site?: SiteSettings) => {
  const known = new Set(SECTIONS.map((s) => s.key));
  const saved = (site?.sections ?? []).filter((s, i, all) => known.has(s.key) && all.findIndex((x) => x.key === s.key) === i);
  const missing = SECTIONS.filter((s) => !saved.some((x) => x.key === s.key)).map((s) => ({ key: s.key, on: true }));
  return [...saved, ...missing].map((s) => (s.key === "book" ? { ...s, on: true } : s));
};

/** Offers worth showing today: with a title and not yet ended, soonest first. */
export const currentOffers = (offers: SiteOffer[] | undefined, today: string) =>
  (offers ?? []).filter((o) => o.title?.trim() && (!o.to_date || o.to_date >= today))
    .sort((a, b) => (a.from_date || "9999").localeCompare(b.from_date || "9999"));

/** Only https links are used on the page (the database checks this too). */
export const safeUrl = (u?: string | null) => (u && /^https:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : null);
