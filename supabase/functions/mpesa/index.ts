// HotelEasy: M-Pesa STK push (Lipa na M-Pesa Online) through Safaricom Daraja.
//
// Deploy with "Verify JWT" OFF (Safaricom calls the callback without a login).
// Each hotel's Daraja keys are saved in the app (Settings → M-Pesa), not here.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Optional: MPESA_CALLBACK_BASE  the public URL of this function if it differs from SUPABASE_URL/functions/v1/mpesa
//           MPESA_API_URL        point all Daraja calls somewhere else (tests)
//
// Calls (POST, JSON):
//   { action: "push",  id, token }   send the prompt to the guest's phone
//   { action: "check", id, token }   ask Safaricom how a prompt went (if the callback is slow)
//   { action: "test",  hotel_id }    check the hotel's keys (needs a manager's login)
//   POST …/mpesa/callback/<token>    Safaricom's answer

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

interface Keys {
  environment: "sandbox" | "production"; kind: "paybill" | "till"; shortcode: string; till_number: string | null;
  consumer_key: string; consumer_secret: string; passkey: string;
}
interface Job extends Keys {
  id: string; hotel_id: string; status: string; phone: string; amount: number; account_ref: string; description: string;
  token: string; checkout_request_id: string | null; ready: boolean;
}

export const darajaBase = (k: Pick<Keys, "environment">) =>
  env("MPESA_API_URL") || (k.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

/** yyyyMMddHHmmss in Kenya time (Daraja checks it against its own clock). */
export const timestamp = (d = new Date()) => {
  const t = new Date(d.getTime() + 3 * 3600_000).toISOString();
  return t.slice(0, 19).replace(/[-T:]/g, "");
};

const tokens = new Map<string, { token: string; until: number }>();
export const accessToken = async (k: Keys): Promise<string> => {
  const cacheKey = `${k.environment}:${k.consumer_key}`;
  const hit = tokens.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await fetch(`${darajaBase(k)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${k.consumer_key}:${k.consumer_secret}`)}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(res.status === 400 || res.status === 401 ? "Safaricom did not accept the consumer key and secret" : `Safaricom login failed (${res.status})`);
  }
  tokens.set(cacheKey, { token: body.access_token, until: Date.now() + (Number(body.expires_in ?? 3599) - 120) * 1000 });
  return body.access_token;
};

const password = (k: Keys, ts: string) => btoa(`${k.shortcode}${k.passkey}${ts}`);

const callbackUrl = (token: string) =>
  `${env("MPESA_CALLBACK_BASE") || `${env("SUPABASE_URL")}/functions/v1/mpesa`}/callback/${token}`;

export const push = async (job: Job) => {
  if (job.status !== "new") return { status: job.status };
  if (!job.ready) {
    await rpc("mpesa_mark_failed", { _id: job.id, _code: -1, _desc: "M-Pesa is not set up for this hotel" });
    return { status: "failed", message: "M-Pesa is not set up for this hotel" };
  }
  try {
    const ts = timestamp();
    const res = await fetch(`${darajaBase(job)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(job)}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: job.shortcode,
        Password: password(job, ts),
        Timestamp: ts,
        TransactionType: job.kind === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
        Amount: Math.round(Number(job.amount)),
        PartyA: job.phone,
        PartyB: job.kind === "till" ? job.till_number : job.shortcode,
        PhoneNumber: job.phone,
        CallBackURL: callbackUrl(job.token),
        AccountReference: job.account_ref.slice(0, 12),
        TransactionDesc: job.description.slice(0, 13),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && String(body.ResponseCode) === "0" && body.CheckoutRequestID) {
      await rpc("mpesa_mark_sent", { _id: job.id, _merchant: body.MerchantRequestID ?? null, _checkout: body.CheckoutRequestID, _desc: body.CustomerMessage ?? null });
      return { status: "sent", message: body.CustomerMessage ?? "Prompt sent" };
    }
    const msg = body.errorMessage ?? body.ResponseDescription ?? `Safaricom refused the request (${res.status})`;
    await rpc("mpesa_mark_failed", { _id: job.id, _code: -1, _desc: msg });
    return { status: "failed", message: msg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await rpc("mpesa_mark_failed", { _id: job.id, _code: -1, _desc: msg.slice(0, 300) });
    return { status: "failed", message: msg };
  }
};

/** Ask Safaricom about a prompt. The query has no receipt number, so a "paid" answer waits for the callback. */
export const check = async (job: Job) => {
  if (job.status !== "sent" || !job.checkout_request_id) return { status: job.status };
  const ts = timestamp();
  const res = await fetch(`${darajaBase(job)}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(job)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: job.shortcode, Password: password(job, ts), Timestamp: ts, CheckoutRequestID: job.checkout_request_id }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.ResultCode === undefined || body.ResultCode === null) return { status: "sent", message: "Still waiting for the guest" };
  const code = Number(body.ResultCode);
  if (code === 0) return { status: "confirming", message: "Safaricom says it is paid. Waiting for the receipt." };
  await rpc("mpesa_mark_failed", { _id: job.id, _code: code, _desc: body.ResultDesc ?? "Not paid" });
  return { status: code === 1032 ? "cancelled" : code === 1037 ? "expired" : "failed", message: body.ResultDesc };
};

/** Safaricom's callback: { Body: { stkCallback: { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata: { Item: [...] } } } } */
export const callback = async (token: string, payload: unknown) => {
  // deno-lint-ignore no-explicit-any
  const cb = (payload as any)?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return { ok: false, error: "not an STK callback" };
  // deno-lint-ignore no-explicit-any
  const items: Record<string, unknown> = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i: any) => [i.Name, i.Value]));
  return await rpc("mpesa_result", {
    _checkout: cb.CheckoutRequestID, _token: token, _code: Number(cb.ResultCode), _desc: cb.ResultDesc ?? null,
    _receipt: items.MpesaReceiptNumber ?? null, _amount: items.Amount ?? null,
    _phone: items.PhoneNumber != null ? String(items.PhoneNumber) : null,
  });
};

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = new URL(req.url);
  const cb = url.pathname.match(/\/callback\/([a-f0-9]{32,80})\/?$/);
  try {
    if (cb) {
      const result = await callback(cb[1], await req.json().catch(() => null));
      if (!result?.ok) console.error("mpesa callback", result);
      return json({ ResultCode: 0, ResultDesc: "Accepted" });   // Safaricom only needs to know we got it
    }
    const body = await req.json().catch(() => ({}));
    if (body.action === "push" || body.action === "check") {
      const job = (await rpc("mpesa_job", { _id: body.id, _token: body.token })) as Job | null;
      if (!job) return json({ error: "Payment request not found" }, 404);
      return json(body.action === "push" ? await push(job) : await check(job));
    }
    if (body.action === "test") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const allowed = jwt && (await rpc("has_perm", { _hotel_id: body.hotel_id, _perm: "settings.edit" }, jwt).catch(() => false));
      if (!allowed) return json({ ok: false, message: "Only a manager can test M-Pesa" }, 403);
      const keys = (await rpc("mpesa_hotel_keys", { _hotel_id: body.hotel_id })) as Keys | null;
      if (!keys?.consumer_key || !keys?.consumer_secret) return json({ ok: false, message: "Save the consumer key and secret first" });
      try {
        tokens.delete(`${keys.environment}:${keys.consumer_key}`);
        await accessToken(keys);
        return json({ ok: true, message: `Safaricom ${keys.environment === "production" ? "live" : "sandbox"} accepted the keys` });
      } catch (e) {
        return json({ ok: false, message: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
};

if (!Deno.env.get("HOTELEASY_NO_SERVE")) Deno.serve(handler);
