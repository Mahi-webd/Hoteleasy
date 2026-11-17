// Which hotel's website opens at "/" for visitors, decided from the web address in the browser.
//
//   VITE_HOME_HOTEL=lakeside-lodge          one hotel's website at "/" on every address (single-hotel installs)
//   VITE_SITE_ROOT_DOMAIN=hoteleasy.co.ke   lakeside-lodge.hoteleasy.co.ke opens that hotel's website
//   VITE_APP_HOSTS=app.hoteleasy.co.ke      addresses that always open the staff app (comma separated)
//   anything else                           looked up as a hotel's own domain (Online → Setup → Own web address)
//
// localhost, *.vercel.app previews and the root domain itself always open the staff app
// (in development "/" shows the sample hotel instead).

export type HostSite =
  | { kind: "app" }                      // staff app (sign-in page for visitors)
  | { kind: "slug"; slug: string }       // a known hotel page address
  | { kind: "lookup"; host: string };    // ask the database whose own domain this is

const env = import.meta.env;
const list = (v: unknown) => String(v ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const HOME = String(env.VITE_HOME_HOTEL ?? "").trim().toLowerCase();
const ROOT = String(env.VITE_SITE_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
const APP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", ...list(env.VITE_APP_HOSTS)]);
const NOT_HOTELS = new Set(["www", "app", "admin", "api", "mail"]);
const SLUG = /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$/;

export const hostSite = (hostname: string = window.location.hostname): HostSite => {
  if (HOME) return { kind: "slug", slug: HOME };
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (APP_HOSTS.has(h) || h.endsWith(".localhost") || h.endsWith(".vercel.app") || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return { kind: "app" };
  if (ROOT) {
    if (h === ROOT || h === `www.${ROOT}`) return { kind: "app" };
    if (h.endsWith(`.${ROOT}`)) {
      const sub = h.slice(0, -(ROOT.length + 1));
      if (!sub.includes(".") && !NOT_HOTELS.has(sub) && SLUG.test(sub)) return { kind: "slug", slug: sub };
      return { kind: "app" };
    }
  }
  return { kind: "lookup", host: h };
};

/** The site's root domain for hotel subdomains (empty when not used). */
export const SITE_ROOT = ROOT;

/** Words that can't be a hotel's page address (same list as public.is_reserved_slug in the database). */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "assets", "auth", "billing", "book", "booking", "checkin", "dashboard", "demo", "docs",
  "feedback", "help", "hoteleasy", "invoice", "login", "logout", "mail", "null", "pricing", "register",
  "reset-password", "settings", "signin", "signup", "static", "stay", "support", "test", "undefined", "www",
]);
