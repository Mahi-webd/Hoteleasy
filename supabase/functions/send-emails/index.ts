// HotelEasy: send queued booking emails through Resend.
//
// Deploy with "Verify JWT" OFF. Secrets (Edge Functions → Secrets):
//   RESEND_API_KEY   your Resend API key
//   EMAIL_FROM       a sender on a domain verified in Resend, e.g. bookings@yourdomain.com
//   CRON_SECRET      any long random string; the cron job sends it in the x-cron-secret header
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

interface Outgoing {
  id: string; to: string; subject: string; html: string; text: string; from_name: string; reply_to: string | null;
}

const env = (k: string) => Deno.env.get(k) ?? "";

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  const body = await res.text();
  return body ? JSON.parse(body) : null;
};

/** Display names can't contain characters that break the From header. */
const cleanName = (s: string) => s.replace(/["<>\r\n]/g, "").slice(0, 80);

export const sendOne = async (m: Outgoing): Promise<{ ok: boolean; id?: string; error?: string }> => {
  try {
    const res = await fetch(env("RESEND_API_URL") || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${cleanName(m.from_name)} <${env("EMAIL_FROM")}>`,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.reply_to ? { reply_to: m.reply_to } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `${res.status}: ${body?.message ?? body?.name ?? "send failed"}` };
    return { ok: true, id: body?.id };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
};

export const handler = async (req: Request): Promise<Response> => {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });
  if (!env("RESEND_API_KEY") || !env("EMAIL_FROM")) return new Response("RESEND_API_KEY and EMAIL_FROM must be set", { status: 500 });

  const batch = (await rpc("email_claim", { _limit: 40 })) as Outgoing[];
  let sent = 0, failed = 0;
  for (const m of batch ?? []) {
    const r = await sendOne(m);
    await rpc("email_mark", { _id: m.id, _ok: r.ok, _provider_id: r.id ?? null, _error: r.error ?? null });
    if (r.ok) sent++; else failed++;
    await new Promise((ok) => setTimeout(ok, 120)); // stay under Resend's rate limit
  }
  return Response.json({ sent, failed });
};

// (HOTELEASY_NO_SERVE lets tests import the handler without starting a server)
if (!Deno.env.get("HOTELEASY_NO_SERVE")) Deno.serve(handler);
