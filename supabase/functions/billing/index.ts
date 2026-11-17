// HotelEasy: subscriptions for HotelEasy itself, paid by card through Stripe Checkout.
//
// Deploy with "Verify JWT" OFF (visitors on the website are not signed in, and Stripe
// calls the webhook without a login).
// Secrets (Edge Functions → Secrets):
//   STRIPE_SECRET_KEY       sk_test_… while testing, sk_live_… when you go live
//   STRIPE_WEBHOOK_SECRET   whsec_… from the webhook endpoint you add in Stripe
//   SITE_URL                the marketing website, e.g. https://hoteleasy-website.vercel.app
// Optional: STRIPE_API_URL  point Stripe calls somewhere else (tests)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Calls:
//   POST { action: "checkout", plan, interval: "month" | "year", email?, hotel? }  → { url }  (send the visitor there)
//   POST …/billing/webhook   Stripe events: checkout.session.completed / expired,
//                            customer.subscription.created / updated / deleted
//
// Prices always come from the database (the admin panel), never from the browser.

const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = async (path: string, init: RequestInit = {}) => {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

const stripe = async (method: "GET" | "POST", path: string, form?: Record<string, string>) => {
  const base = env("STRIPE_API_URL") || "https://api.stripe.com";
  const res = await fetch(`${base}/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `Stripe ${res.status}`);
  return body;
};

// a few attempts per address per minute is plenty for a real customer
const hits = new Map<string, number[]>();
const limited = (ip: string) => {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
};

const siteUrl = (req: Request) => {
  const fixed = env("SITE_URL").replace(/\/+$/, "");
  if (fixed) return fixed;
  const origin = req.headers.get("origin") ?? "";
  if (/^https:\/\/[a-z0-9.-]+$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "";
};

async function checkout(req: Request, body: Record<string, unknown>) {
  if (!env("STRIPE_SECRET_KEY")) return json({ error: "Payments are not switched on yet." }, 503);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (limited(ip)) return json({ error: "Too many attempts. Please wait a minute and try again." }, 429);

  const slug = String(body.plan ?? "");
  const interval = body.interval === "year" ? "year" : "month";
  const email = typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ? body.email.slice(0, 200) : "";
  const hotel = typeof body.hotel === "string" ? body.hotel.trim().slice(0, 120) : "";
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return json({ error: "Unknown plan." }, 400);

  const plan = await db("rpc/site_checkout_plan", { method: "POST", body: JSON.stringify({ _slug: slug }) });
  if (!plan) return json({ error: "That plan is not available." }, 404);
  if (plan.price_monthly_cents == null) return json({ error: "This plan is priced on request — please contact us." }, 400);
  const site = siteUrl(req);
  if (!site) return json({ error: "SITE_URL is not set." }, 500);

  const amount = interval === "year" ? plan.price_monthly_cents * plan.yearly_months : plan.price_monthly_cents;
  const [row] = await db("site_subscriptions", {
    method: "POST",
    body: JSON.stringify({ plan_slug: plan.slug, billing_interval: interval, amount_cents: amount, currency: plan.currency, email: email || null, hotel_name: hotel || null }),
  });

  const form: Record<string, string> = {
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": plan.currency,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][recurring][interval]": interval,
    "line_items[0][price_data][product_data][name]": `HotelEasy ${plan.name}`,
    "line_items[0][price_data][product_data][description]": interval === "year" ? `Yearly — ${plan.yearly_months} months' price` : "Monthly",
    success_url: `${site}/?checkout=success`,
    cancel_url: `${site}/?checkout=cancelled#pricing`,
    client_reference_id: row.id,
    allow_promotion_codes: "true",
    billing_address_collection: "auto",
    "metadata[row]": row.id,
    "metadata[plan]": plan.slug,
    "subscription_data[metadata][row]": row.id,
    "subscription_data[metadata][plan]": plan.slug,
  };
  if (hotel) {
    form["metadata[hotel]"] = hotel;
    form["subscription_data[metadata][hotel]"] = hotel;
  }
  if (email) form.customer_email = email;
  if (plan.trial_days > 0) form["subscription_data[trial_period_days]"] = String(plan.trial_days);

  try {
    const session = await stripe("POST", "checkout/sessions", form);
    await db(`site_subscriptions?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ stripe_session_id: session.id }) });
    return json({ url: session.url });
  } catch (e) {
    await db(`site_subscriptions?id=eq.${row.id}`, { method: "DELETE" }).catch(() => {});
    console.error("checkout", e);
    return json({ error: "Could not start the payment. Please try again." }, 502);
  }
}

// ------------------------------------------------------------------ webhook

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sameString = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function verifyStripe(payload: string, header: string, secret: string, now = Date.now() / 1000) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]).filter((p) => p.length === 2));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some((s) => sameString(s, mac));
}

const ts = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);
const STATUSES = new Set(["trialing", "active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"]);

// deno-lint-ignore no-explicit-any
function subFields(sub: any) {
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    status: STATUSES.has(sub.status) ? sub.status : "incomplete",
    trial_end: ts(sub.trial_end),
    current_period_end: ts(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };
}

async function webhook(req: Request) {
  const payload = await req.text();
  const ok = await verifyStripe(payload, req.headers.get("stripe-signature") ?? "", env("STRIPE_WEBHOOK_SECRET"));
  if (!ok) return json({ error: "bad signature" }, 400);
  const event = JSON.parse(payload);
  const obj = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    const rowId = obj.client_reference_id ?? obj.metadata?.row;
    const patch: Record<string, unknown> = {
      stripe_session_id: obj.id,
      stripe_customer_id: obj.customer ?? null,
      email: obj.customer_details?.email ?? obj.customer_email ?? null,
      status: "active",
    };
    if (obj.subscription) {
      const sub = await stripe("GET", `subscriptions/${obj.subscription}`);
      Object.assign(patch, subFields(sub));
    }
    if (rowId) await db(`site_subscriptions?id=eq.${encodeURIComponent(rowId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  } else if (event.type === "checkout.session.expired") {
    await db(`site_subscriptions?stripe_session_id=eq.${encodeURIComponent(obj.id)}&status=eq.checkout`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) });
  } else if (event.type?.startsWith("customer.subscription.")) {
    const patch = subFields(obj);
    const rowId = obj.metadata?.row;
    const filter = rowId ? `id=eq.${encodeURIComponent(rowId)}` : `stripe_subscription_id=eq.${encodeURIComponent(obj.id)}`;
    await db(`site_subscriptions?${filter}`, { method: "PATCH", body: JSON.stringify(patch) });
  }
  return json({ received: true });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith("/webhook")) return await webhook(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "checkout") return await checkout(req, body);
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong." }, 500);
  }
}

if (!Deno.env.get("HOTELEASY_NO_SERVE")) Deno.serve(handler);
