// Makes the public hotel data safe to render whatever shape it arrives in (older database versions,
// half-filled settings, a hotel that saved something unusual), so one hotel's data can never crash its page.
import type { PublicHotel, PublicRoomType, SiteFeature, SiteSettings } from "@/lib/db-types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : d);

const roomType = (v: unknown): PublicRoomType | null => {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  return {
    id: v.id, name: v.name, description: str(v.description), max_occupancy: Math.max(1, num(v.max_occupancy, 2)),
    amenities: strs(v.amenities), photo_url: str(v.photo_url), gallery: strs(v.gallery), rate: num(v.rate),
  };
};

const feature = (v: unknown): SiteFeature | null =>
  isObj(v) && typeof v.title === "string" && v.title.trim() ? { title: v.title, text: str(v.text), photo_url: str(v.photo_url) } : null;

const site = (v: unknown): SiteSettings => {
  if (!isObj(v)) return {};
  const s = v as SiteSettings & Obj;
  return {
    ...s,
    hero: isObj(s.hero) ? { ...s.hero, photos: strs((s.hero as Obj).photos) } : undefined,
    sections: Array.isArray(s.sections) ? s.sections.filter((x) => isObj(x) && typeof x.key === "string") as SiteSettings["sections"] : undefined,
    offers: Array.isArray(s.offers) ? s.offers.filter((o) => isObj(o) && typeof o.title === "string") as SiteSettings["offers"] : undefined,
    marquee: strs(s.marquee),
    social: isObj(s.social) ? s.social as SiteSettings["social"] : undefined,
    notice: isObj(s.notice) ? s.notice as SiteSettings["notice"] : undefined,
    seo: isObj(s.seo) ? s.seo as SiteSettings["seo"] : undefined,
    colors: isObj(s.colors) ? s.colors as SiteSettings["colors"] : undefined,
  };
};

/** null = no such page; { redirect } = the page moved to a new address. */
export const normalizePublicHotel = (raw: unknown): PublicHotel | { redirect: string } | null => {
  if (!isObj(raw)) return null;
  if (typeof raw.redirect === "string" && raw.redirect) return { redirect: raw.redirect };
  if (typeof raw.name !== "string") return null;
  const reviews = isObj(raw.reviews) ? raw.reviews : null;
  return {
    ...(raw as unknown as PublicHotel),
    currency: str(raw.currency) ?? "KES",
    checkin_time: str(raw.checkin_time) ?? "14:00",
    checkout_time: str(raw.checkout_time) ?? "10:00",
    today: str(raw.today) ?? new Date().toISOString().slice(0, 10),
    min_nights: Math.max(1, num(raw.min_nights, 1)),
    max_nights: Math.max(1, num(raw.max_nights, 30)),
    max_advance_days: Math.max(1, num(raw.max_advance_days, 365)),
    room_types: (Array.isArray(raw.room_types) ? raw.room_types : []).map(roomType).filter((x): x is PublicRoomType => !!x),
    gallery: strs(raw.gallery),
    features: (Array.isArray(raw.features) ? raw.features : []).map(feature).filter((x): x is SiteFeature => !!x),
    site: site(raw.site),
    reviews: reviews ? {
      count: num(reviews.count), average: reviews.average == null ? null : num(reviews.average),
      recent: (Array.isArray(reviews.recent) ? reviews.recent : []).filter(isObj).map((r) => ({
        name: str(r.name) ?? "Guest", overall: Math.min(5, Math.max(1, num(r.overall, 5))), comment: str(r.comment), month: str(r.month) ?? "", response: str(r.response),
      })),
    } : null,
  };
};
