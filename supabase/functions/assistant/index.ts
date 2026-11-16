// HotelEasy: "Ask HotelEasy", answers staff questions about using HotelEasy, from the in-app guides.
//
// Secrets (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   from console.anthropic.com (without it, the app shows matching guides instead)
//   ASSISTANT_MODEL     optional, default claude-haiku-5-5
// Keep "Verify JWT" ON: only signed-in staff can ask.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
//   POST { hotel_id, screen, messages: [{ role: "user" | "assistant", content }] }
//   →    { answer, id }  or  { fallback: true, message }

import { GUIDE, SCREENS } from "./guide.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const ROLE: Record<string, string> = {
  owner: "Owner", manager: "Manager", front_desk: "Front desk", housekeeping: "Housekeeping", restaurant: "Restaurant",
  accountant: "Accountant", maintenance: "Maintenance", storekeeper: "Storekeeper",
};

export const RULES = `You are "Ask HotelEasy", the built-in helper of HotelEasy, hotel management software used by hotels, lodges and camps in Kenya.
You help hotel staff use HotelEasy: how to do a task, where to find something, what a message means.

How to answer:
- Use ONLY the HotelEasy guide below. If the guide doesn't cover it, say you're not sure and suggest asking a manager. Never invent buttons, screens or features.
- Be short and practical: numbered steps with the exact button and screen names in **bold**, as written in the guide. Usually under 120 words.
- When a screen is involved, add a link to it written exactly as [[screen:KEY|Label]], using a KEY from the screen list. Only the screens listed under "Screens this person can open" may be linked.
- The person's role and permissions are given below. If they can't do something, say so kindly and that a manager or the owner can do it (or give them the permission in Roles & permissions). Don't give steps for screens they can't open.
- You can't see or change the hotel's data and can't do anything for them: you only explain. Don't promise to do things.
- Reply in the language the person writes in (English or Swahili are common). Plain, friendly words; no technical terms.
- Questions not about using HotelEasy (general chat, other software, tax or legal advice): answer briefly that you only help with HotelEasy, and point to the right screen if one fits.`;

export const buildSystem = (ctx: { hotel: string; first_name: string; role: string; custom_role: string | null; permissions: string[] }, screen: string | null) => {
  const perms = new Set(ctx.permissions);
  const can = (k: string) => ctx.role === "owner" || perms.has(k);
  const viewOf: Record<string, string> = {
    dashboard: "dashboard.view", reservations: "reservations.view", "online-checkin": "precheck.view", requests: "requests.view",
    audit: "audit.view", rates: "rates.view", rooms: "rooms.view", guests: "guests.view", billing: "billing.view",
    companies: "companies.view", online: "online.view", channels: "channels.view", pos: "pos.view", kds: "kds.view",
    owner: "owner.view", reports: "reports.view", finance: "finance.view", housekeeping: "housekeeping.view",
    maintenance: "maintenance.view", inventory: "inventory.view", staff: "staff.view", settings: "settings.view",
  };
  const open = SCREENS.filter((s) => s.key === "my-shifts" || (s.key === "roles" ? ctx.role === "owner" : can(viewOf[s.key] ?? "")));
  const here = SCREENS.find((s) => s.key === screen);
  return [
    { type: "text", text: `${RULES}\n\n# HotelEasy guide\n\n${GUIDE}`, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `# About the person asking
Name: ${ctx.first_name}. Hotel: ${ctx.hotel}.
Role: ${ctx.custom_role ? `${ctx.custom_role} (a custom role)` : ROLE[ctx.role] ?? ctx.role}.
Permissions: ${ctx.role === "owner" ? "everything (owner)" : ctx.permissions.join(", ") || "none"}.
Screens this person can open (KEY = name): ${open.map((s) => `${s.key} = ${s.label}`).join("; ")}.
They are on: ${here ? here.label : "the main screen"}.`,
    },
  ];
};

/** Turns the conversation into what Claude expects: alternating turns, last one from the user, trimmed. */
export const cleanMessages = (messages: unknown): { role: "user" | "assistant"; content: string }[] => {
  const list = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 2000) }))
    .slice(-10);
  while (list.length && list[0].role !== "user") list.shift();
  const out: typeof list = [];
  for (const m of list) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += `\n${m.content}`;
    else out.push(m);
  }
  return out.length && out[out.length - 1].role === "user" ? out : [];
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({}));
    const messages = cleanMessages(body.messages);
    if (!messages.length) return json({ error: "Ask a question" }, 400);

    let ctx;
    try {
      ctx = await rpc("assistant_begin", { _hotel_id: body.hotel_id }, jwt);
    } catch {
      return json({ error: "Please sign in again" }, 401);
    }
    if (!ctx?.ok) return json({ fallback: true, message: ctx?.message ?? "The assistant isn't available." });
    if (!env("ANTHROPIC_API_KEY")) return json({ fallback: true, message: "The assistant isn't switched on yet. Here are the guides that match." });

    const res = await fetch(env("ANTHROPIC_API_URL") || "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env("ASSISTANT_MODEL") || "claude-haiku-5-5",
        max_tokens: 800,
        system: buildSystem(ctx, typeof body.screen === "string" ? body.screen : null),
        messages,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("anthropic", res.status, JSON.stringify(out).slice(0, 500));
      return json({ fallback: true, message: res.status === 429 || res.status === 529 ? "The assistant is busy. Here are the guides that match." : "The assistant couldn't answer just now. Here are the guides that match." });
    }
    const answer = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
    const userId = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub;
    const id = await rpc("assistant_record", {
      _hotel_id: body.hotel_id, _user_id: userId, _screen: body.screen ?? null, _question: messages[messages.length - 1].content,
      _answer: answer, _input_tokens: (out.usage?.input_tokens ?? 0) + (out.usage?.cache_read_input_tokens ?? 0) + (out.usage?.cache_creation_input_tokens ?? 0),
      _output_tokens: out.usage?.output_tokens ?? 0,
    }).catch((e) => { console.error(e); return null; });
    return json({ answer, id });
  } catch (e) {
    console.error(e);
    return json({ fallback: true, message: "The assistant couldn't answer just now. Here are the guides that match." });
  }
};

if (!Deno.env.get("HOTELEASY_NO_SERVE")) Deno.serve(handler);
