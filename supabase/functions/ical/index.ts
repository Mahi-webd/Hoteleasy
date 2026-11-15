// HotelEasy: calendar sync with Booking.com, Airbnb, Expedia, Vrbo (iCal).
//
// Deploy with "Verify JWT" OFF (the OTAs read the feed without a login).
// Secret (Edge Functions → Secrets), only for the scheduled sync:
//   CRON_SECRET   any long random string; supabase/channel_cron.sql sends it in the x-cron-secret header
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
//   GET  …/ical/<token>.ics                 our calendar for one room (paste this link into the OTA)
//   POST { action: "sync", link_id }        read one OTA calendar now (needs a staff login)
//   POST { action: "sync_due", hotel_id }   read this hotel's calendars not read for 10 minutes (staff login)
//   POST { action: "sync_due" } + x-cron-secret   every hotel (the scheduled job)

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const rpc = async (fn: string, args: Record<string, unknown>, jwt?: string) => {
  const key = jwt ? env("SUPABASE_ANON_KEY") : env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${jwt ?? key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

export interface IcsEvent { uid: string; start: string; end: string | null; summary: string; description: string; cancelled: boolean }

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
/** "20261201", "20261201T140000Z", "20261201T140000" → "2026-12-01" */
const day = (v: string | undefined) => {
  const m = v?.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Minimal, forgiving iCal reader: VEVENTs with UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, STATUS. */
export const parseIcs = (text: string): IcsEvent[] => {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const start = day(cur.DTSTART);
        if (start) {
          out.push({
            uid: cur.UID || `${start}-${day(cur.DTEND) ?? ""}-${cur.SUMMARY ?? ""}`,
            start, end: day(cur.DTEND), summary: unescape(cur.SUMMARY ?? ""), description: unescape(cur.DESCRIPTION ?? ""),
            cancelled: /^CANCELLED$/i.test(cur.STATUS ?? ""),
          });
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const name = line.slice(0, i).split(";")[0].toUpperCase();
    if (!(name in cur)) cur[name] = line.slice(i + 1).trim();
  }
  return out;
};

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i;

/** Read the OTA's calendar (https only, public hosts, ≤3 MB, 20 s). */
export const fetchCalendar = async (url: string): Promise<string> => {
  // tests only: ICAL_TEST_REWRITE="https://ota.test/=>http://127.0.0.1:9915/"
  const [from, to] = env("ICAL_TEST_REWRITE").split("=>");
  if (from && to && url.startsWith(from)) url = to + url.slice(from.length);
  const u = new URL(url);
  if (u.protocol !== "https:" && !env("ICAL_ALLOW_HTTP")) throw new Error("The link must start with https://");
  if (PRIVATE.test(u.hostname) && !env("ICAL_ALLOW_PRIVATE")) throw new Error("That link points to a private address");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(u, { signal: ctrl.signal, headers: { "User-Agent": "HotelEasy-Calendar-Sync/1.0", Accept: "text/calendar, */*" } });
    if (!res.ok) throw new Error(res.status === 404 ? "The site says this calendar link doesn't exist (404). Copy it again." : `The site answered ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 3_000_000) throw new Error("The calendar is too big");
    const text = new TextDecoder().decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That link is not a calendar (iCal) link");
    return text;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("The site took too long to answer");
    throw e;
  } finally {
    clearTimeout(t);
  }
};

export const syncLink = async (id: string, url?: string) => {
  const link = url ?? (await rpc("channel_link_url", { _id: id }));
  if (!link) return { ok: false, message: "This link has no calendar to read" };
  let events: IcsEvent[];
  try {
    events = parseIcs(await fetchCalendar(link)).filter((e) => !e.cancelled);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await rpc("channel_apply", { _link_id: id, _events: [], _ok: false, _message: msg });
  }
  return await rpc("channel_apply", {
    _link_id: id, _ok: true, _message: null,
    _events: events.map((e) => ({ uid: e.uid, start: e.start, end: e.end, summary: e.summary, description: e.description.slice(0, 400) })),
  });
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  try {
    const feed = url.pathname.match(/\/([a-f0-9]{32,80})(?:\.ics)?\/?$/);
    if (req.method === "GET" && feed) {
      const ics = await rpc("channel_export", { _token: feed[1] });
      if (!ics) return new Response("Not found", { status: 404, headers: CORS });
      return new Response(ics, { headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
    }
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    const body = await req.json().catch(() => ({}));
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isCron = !!env("CRON_SECRET") && req.headers.get("x-cron-secret") === env("CRON_SECRET");

    if (body.action === "sync") {
      const ok = await rpc("channel_can_sync", { _id: body.link_id }, jwt).catch(() => false);
      if (!ok) return json({ ok: false, message: "You can't sync this calendar" }, 403);
      return json(await syncLink(body.link_id));
    }
    if (body.action === "sync_due") {
      if (!isCron) {
        const ok = body.hotel_id && (await rpc("channel_can_view", { _hotel_id: body.hotel_id }, jwt).catch(() => false));
        if (!ok) return json({ ok: false }, 403);
      }
      const due = (await rpc("channel_due", { _minutes: isCron ? 5 : 10, _hotel_id: isCron ? null : body.hotel_id })) as { id: string; import_url: string }[];
      const results = [];
      for (const d of due) results.push({ id: d.id, ...(await syncLink(d.id, d.import_url).catch((e) => ({ ok: false, message: String(e) }))) });
      return json({ ok: true, synced: results.length, results });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
};

if (!Deno.env.get("HOTELEASY_NO_SERVE")) Deno.serve(handler);
