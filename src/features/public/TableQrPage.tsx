// /t/:token — the page a diner opens by scanning the QR code on their restaurant table.
// No sign-in: the secret token picks the table (and so the hotel). Menu with prices, and three buttons:
// call the waiter, bring the bill (cash / card / M-Pesa), or ask for something else.
// Where the manager has switched it on: order from the phone (a waiter confirms it before the kitchen
// gets it), see the bill, and pay it with an M-Pesa prompt on this phone.
// The food tracker follows every dish and drink live, as the kitchen / bar screen and the waiter move it on.
import { useState } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Banknote, Check, ChefHat, CreditCard, Flame, Hand, Loader2, Minus, Plus, Receipt, ShoppingBag, Smartphone, Sparkles, UtensilsCrossed, Wine, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MpesaPrompt } from "@/components/common/MpesaPrompt";
import { friendlyError } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  PAY_LABEL, createTablePrompt, publicTableCall, publicTableCancel, publicTableOrder, publicTableOrderCancel, usePublicTable,
  type BillLine, type ItemStatus, type PayMethod, type PublicMenuItem, type PublicTable, type TableBill, type TableCall, type TableCallKind, type TableOrder,
} from "@/hooks/useTableQr";
import { PublicShell } from "./GuestSite";

const QUICK = ["Water", "Extra napkins", "Salt & pepper", "Clean the table", "Ketchup / sauce", "Menu for kids"];

const money = (n: number, cur: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
  catch { return `${cur} ${n.toLocaleString()}`; }
};

const Status = ({ call, onCancel, busy }: { call: TableCall; onCancel: () => void; busy: boolean }) => {
  const what = call.kind === "bill" ? `The bill${call.pay_method ? ` (${PAY_LABEL[call.pay_method]})` : ""}` : call.kind === "waiter" ? "A waiter" : call.note || "Your request";
  if (call.status === "open")
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900" role="status" data-testid="call-status">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" /></span>
          <div className="flex-1">
            <div className="font-semibold">{what} — we've let the team know</div>
            <div className="text-sm opacity-80">Asked {formatDistanceToNow(parseISO(call.created_at), { addSuffix: true })}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy} className="text-amber-900"><X className="mr-1 h-4 w-4" />Cancel</Button>
        </div>
      </div>
    );
  if (call.status === "on_way")
    return (
      <div className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4 text-sky-900" role="status" data-testid="call-status">
        <div className="font-semibold">🏃 On the way to your table</div>
        <div className="text-sm opacity-80">{what} is coming.</div>
      </div>
    );
  if (call.status === "done")
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status" data-testid="call-status">
        <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" />Done — thank you! Tap a button if you need anything else.</div>
      </div>
    );
  return null;
};

const OrderStatus = ({ order, cur, onCancel, busy }: { order: TableOrder; cur: string; onCancel: () => void; busy: boolean }) => {
  const count = order.lines.reduce((n, l) => n + l.qty, 0);
  const summary = order.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
  if (order.status === "pending")
    return (
      <div className="rounded-2xl border-2 border-violet-300 bg-violet-50 p-4 text-violet-900" role="status" data-testid="order-status">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Order sent — a waiter is checking it</div>
            <div className="text-sm opacity-80 truncate">{count} item{count === 1 ? "" : "s"} · {money(order.total, cur)} · {summary}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy} className="text-violet-900"><X className="mr-1 h-4 w-4" />Cancel</Button>
        </div>
      </div>
    );
  if (order.status === "confirmed")
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status" data-testid="order-status">
        <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" />Order confirmed — the kitchen is on it</div>
        <div className="text-sm opacity-80 truncate">{summary}</div>
      </div>
    );
  if (order.status === "rejected")
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="status" data-testid="order-status">
        <div className="font-semibold">Your order couldn't be accepted</div>
        <div className="text-sm">{order.reason || "Please call a waiter."}</div>
      </div>
    );
  return null;
};

// ---------------------------------------------------------------- food tracker
const STAGE: Record<ItemStatus, number> = { new: 0, sent: 1, preparing: 2, ready: 3, served: 4 };
const STEPS = ["Received", "Preparing", "Ready", "Served"];
const LONG_WAIT_MS = 25 * 60_000;
const mins = (iso?: string | null) => (iso ? Math.max(0, Math.round((Date.now() - parseISO(iso).getTime()) / 60_000)) : 0);

const LineStatus = ({ l }: { l: BillLine }) => {
  const bar = l.station === "bar";
  const cls = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";
  switch (l.status) {
    case "new": return <span className={cn(cls, "bg-slate-100 text-slate-600")}>Being added</span>;
    case "sent": return <span className={cn(cls, "bg-amber-100 text-amber-800")}>Waiting for the {bar ? "bar" : "kitchen"}</span>;
    case "preparing": return <span className={cn(cls, "bg-orange-100 text-orange-800")}><Flame className="h-3 w-3 animate-pulse" />Being prepared</span>;
    case "ready": return <span className={cn(cls, "bg-green-100 text-green-800")}>Ready — coming to you</span>;
    case "served": return <span className={cn(cls, "text-muted-foreground")}><Check className="h-3 w-3" />Served</span>;
    default: return null;
  }
};

/** Where each dish and drink is: waiting → being prepared → ready → served. */
const FoodTracker = ({ lines }: { lines: BillLine[] }) => {
  const [showServed, setShowServed] = useState(false);
  const tracked = lines.filter((l) => l.status);
  if (!tracked.length) return null;
  const open = tracked.filter((l) => l.status !== "served");
  const served = tracked.filter((l) => l.status === "served");
  if (!open.length)
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" data-testid="food-tracker">
        <div className="font-semibold">🍽️ Everything is served — enjoy your meal!</div>
        <div className="text-sm opacity-80">Want something else? Add it from the menu below or tap "Call waiter".</div>
      </div>
    );
  // the step the whole order has reached = the least advanced dish still to come
  const step = Math.max(0, Math.min(...open.map((l) => STAGE[l.status!])) - 1);
  const slow = open.some((l) => (l.status === "sent" || l.status === "preparing") && mins(l.sent_at) * 60_000 > LONG_WAIT_MS);
  const ready = open.filter((l) => l.status === "ready").length;
  return (
    <Card data-testid="food-tracker">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold"><ChefHat className="h-5 w-5 text-primary" />Your food &amp; drinks</h2>
          {ready > 0 && <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">{ready} ready</span>}
        </div>
        <ol className="grid grid-cols-4 gap-1" aria-label="Order progress">
          {STEPS.map((label, i) => (
            <li key={label} className="space-y-1 text-center">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <div className={cn("text-[11px]", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</div>
            </li>
          ))}
        </ol>
        <ul className="divide-y text-sm">
          {open.map((l, i) => (
            <li key={l.id ?? i} className="flex items-center gap-2 py-2">
              {l.station === "bar" ? <Wine className="h-4 w-4 shrink-0 text-muted-foreground" /> : <UtensilsCrossed className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="flex-1 min-w-0 truncate">{Number(l.qty)}× {l.name}</span>
              <span className="flex flex-col items-end gap-0.5">
                <LineStatus l={l} />
                {l.sent_at && (l.status === "sent" || l.status === "preparing") && <span className="text-[10px] text-muted-foreground">{mins(l.sent_at)} min</span>}
              </span>
            </li>
          ))}
        </ul>
        {served.length > 0 && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowServed((v) => !v)}>
            {showServed ? "Hide" : "Show"} {served.length} served item{served.length === 1 ? "" : "s"}
          </button>
        )}
        {showServed && (
          <ul className="text-sm text-muted-foreground">
            {served.map((l, i) => <li key={l.id ?? i} className="flex justify-between py-0.5"><span>{Number(l.qty)}× {l.name}</span><span className="inline-flex items-center gap-1 text-xs"><Check className="h-3 w-3" />Served</span></li>)}
          </ul>
        )}
        {slow && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">This is taking a little longer than usual. Tap "Call waiter" if you'd like an update.</p>}
      </CardContent>
    </Card>
  );
};

const BillCard = ({ bill, cur, canPay, token, onPaid }: { bill: TableBill; cur: string; canPay: boolean; token: string; onPaid: () => void }) => (
  <Card data-testid="bill">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><Receipt className="h-5 w-5 text-primary" />Your bill</h2>
        <span className="text-xs text-muted-foreground">No. {bill.number}</span>
      </div>
      <ul className="divide-y text-sm">
        {bill.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 py-1.5">
            <span>{Number(l.qty)}× {l.name}{l.comped && <span className="ml-1 text-xs text-emerald-700">(on the house)</span>}</span>
            <span className="tabular-nums">{money(Number(l.amount), cur)}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t pt-2 text-sm">
        {Number(bill.discount) > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{money(Number(bill.discount), cur)}</span></div>}
        {Number(bill.service_charge) > 0 && <div className="flex justify-between"><span>Service charge</span><span>{money(Number(bill.service_charge), cur)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Total</span><span>{money(Number(bill.total), cur)}</span></div>
        {Number(bill.paid) > 0 && <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{money(Number(bill.paid), cur)}</span></div>}
        <div className="flex justify-between text-base font-bold"><span>To pay</span><span data-testid="bill-due">{money(Number(bill.due), cur)}</span></div>
      </div>
      {canPay && Number(bill.due) >= 1 && (
        bill.unsent
          ? <p className="text-xs text-muted-foreground">Your waiter is still adding items. You can pay in a moment.</p>
          : <div className="rounded-xl border border-green-200 bg-green-50/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4 text-green-700" />Pay now with M-Pesa</div>
              <MpesaPrompt guest compact amount={Number(bill.due)} currency={cur} create={(phone) => createTablePrompt(token, phone)} onPaid={onPaid} />
            </div>
      )}
    </CardContent>
  </Card>
);

const BigButton = ({ icon: Icon, label, hint, onClick, disabled, testid }: { icon: React.ComponentType<{ className?: string }>; label: string; hint: string; onClick: () => void; disabled?: boolean; testid: string }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testid}
    className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm transition active:scale-95 hover:border-primary hover:shadow-md disabled:opacity-50">
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition"><Icon className="h-7 w-7" /></span>
    <span className="font-semibold leading-tight">{label}</span>
    <span className="text-xs text-muted-foreground leading-tight">{hint}</span>
  </button>
);

const Stepper = ({ qty, onChange, name }: { qty: number; onChange: (n: number) => void; name: string }) => (
  qty === 0 ? (
    <Button size="sm" variant="outline" className="h-8 rounded-full px-3" onClick={() => onChange(1)} aria-label={`Add ${name}`}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
  ) : (
    <div className="flex items-center gap-1 rounded-full border bg-card">
      <button type="button" className="flex h-8 w-8 items-center justify-center" onClick={() => onChange(qty - 1)} aria-label={`One less ${name}`}><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
      <button type="button" className="flex h-8 w-8 items-center justify-center disabled:opacity-40" disabled={qty >= 20} onClick={() => onChange(qty + 1)} aria-label={`One more ${name}`}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  )
);

const TableQrPage = () => {
  const { token = "" } = useParams();
  const q = usePublicTable(token);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "bill" | "other" | "cart">(null);
  const [note, setNote] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const patch = (p: Partial<PublicTable>) => qc.setQueryData<PublicTable | null>(["public", "table", token], (d) => (d ? { ...d, ...p } : d));
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await f(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const send = (kind: TableCallKind, opts: { note?: string; pay?: PayMethod } = {}) => run(async () => {
    const call = await publicTableCall(token, kind, opts.note, opts.pay ?? null);
    patch({ call }); setAsk(null); setNote("");
  });
  const cancel = () => run(async () => { await publicTableCancel(token); await q.refetch(); });
  const sendOrder = () => run(async () => {
    const items = Object.entries(cart).filter(([, n]) => n > 0).map(([menu_item_id, qty]) => ({ menu_item_id, qty }));
    const order = await publicTableOrder(token, items, orderNote);
    patch({ order }); setCart({}); setOrderNote(""); setAsk(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  const cancelOrder = () => run(async () => { await publicTableOrderCancel(token); await q.refetch(); });

  if (q.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  const t = q.data;
  if (!t) return <PublicShell><p className="text-center py-24 text-slate-600">This QR code isn't valid. Please ask a waiter.</p></PublicShell>;
  if (t.off) return <PublicShell><p className="text-center py-24 text-slate-600">Ordering help from this table isn't switched on right now. Please wave to a waiter — we'll be right with you.</p></PublicShell>;

  const active = t.call && (t.call.status === "open" || t.call.status === "on_way");
  const cats = t.menu.filter((c) => c.items.length);
  const shown = cat ? cats.filter((c) => c.category === cat) : cats;
  const items = new Map<string, PublicMenuItem>(cats.flatMap((c) => c.items.map((i) => [i.id, i] as const)));
  const lines = Object.entries(cart).filter(([id, n]) => n > 0 && items.has(id)).map(([id, n]) => ({ item: items.get(id)!, qty: n }));
  const cartCount = lines.reduce((n, l) => n + l.qty, 0);
  const cartTotal = lines.reduce((n, l) => n + l.qty * Number(l.item.price), 0);
  const pending = t.order?.status === "pending";
  const canOrder = !!t.can_order;
  const tracking = !!t.bill?.lines.some((l) => l.status);
  const setQty = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, n)) }));

  return (
    <PublicShell>
      <div className={cn("max-w-lg mx-auto space-y-5", cartCount > 0 && "pb-24")}>
        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t.hotel} · {t.outlet}</div>
          <h1 className="gs-display text-4xl" data-testid="table-name">Table {t.table}</h1>
        </div>

        {t.order && !(t.order.status === "confirmed" && tracking) && <OrderStatus order={t.order} cur={t.currency} onCancel={cancelOrder} busy={busy} />}
        {t.call && <Status call={t.call} onCancel={cancel} busy={busy} />}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          <BigButton icon={Hand} label="Call waiter" hint="Someone comes to your table" testid="btn-waiter" disabled={busy} onClick={() => send("waiter")} />
          <BigButton icon={Receipt} label="Bring the bill" hint="Cash, card or M-Pesa" testid="btn-bill" disabled={busy} onClick={() => setAsk("bill")} />
          <BigButton icon={Sparkles} label="Water / other" hint="Tell us what you need" testid="btn-other" disabled={busy} onClick={() => setAsk("other")} />
        </div>
        {active && <p className="text-center text-xs text-muted-foreground">Need something different? Tap another button — we'll update your request.</p>}

        {t.bill && <FoodTracker lines={t.bill.lines} />}
        {t.bill && <BillCard bill={t.bill} cur={t.currency} canPay={!!t.can_pay} token={token} onPaid={() => q.refetch()} />}

        <section aria-labelledby="menu-h" className="space-y-3 pt-2">
          <h2 id="menu-h" className="flex items-center gap-2 text-lg font-semibold"><UtensilsCrossed className="h-5 w-5 text-primary" />Menu</h2>
          {cats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ask your waiter for today's menu.</p>
          ) : (
            <>
              {cats.length > 1 && (
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                  {[null, ...cats.map((c) => c.category)].map((c) => (
                    <button key={c ?? "all"} type="button" onClick={() => setCat(c)}
                      className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
                      {c ?? "All"}
                    </button>
                  ))}
                </div>
              )}
              {shown.map((c) => (
                <Card key={c.category}>
                  <CardContent className="p-4">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{c.category}</h3>
                    <ul className="divide-y">
                      {c.items.map((i) => (
                        <li key={i.id} className={cn("flex items-start gap-3 py-2.5", !i.available && "opacity-50")} data-testid="menu-item">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{i.name}{!i.available && <span className="ml-2 text-xs font-normal">(sold out)</span>}</div>
                            {i.description && <div className="text-sm text-muted-foreground">{i.description}</div>}
                            <div className="mt-0.5 font-semibold tabular-nums sm:hidden">{money(Number(i.price), t.currency)}</div>
                            {canOrder && i.available && i.self_order === false && <div className="text-xs text-muted-foreground">Order this through your waiter (needs a choice)</div>}
                          </div>
                          <div className="hidden shrink-0 font-semibold tabular-nums sm:block">{money(Number(i.price), t.currency)}</div>
                          {canOrder && i.available && i.self_order !== false && (
                            <div className="shrink-0"><Stepper qty={cart[i.id] ?? 0} onChange={(n) => setQty(i.id, n)} name={i.name} /></div>
                          )}                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
              <p className="text-center text-xs text-muted-foreground">{canOrder ? "Add dishes, then send your order. A waiter confirms it before the kitchen starts." : "To order, tap \"Call waiter\"."}</p>
            </>
          )}
        </section>
      </div>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
          <Button className="mx-auto flex h-12 w-full max-w-lg justify-between text-base" onClick={() => setAsk("cart")} data-testid="view-order">
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" />View order ({cartCount})</span>
            <span className="tabular-nums">{money(cartTotal, t.currency)}</span>
          </Button>
        </div>
      )}

      <Dialog open={ask === "cart"} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Your order</DialogTitle><DialogDescription>Table {t.table}. A waiter confirms it, then the kitchen starts.</DialogDescription></DialogHeader>
          <ul className="max-h-[45vh] divide-y overflow-y-auto">
            {lines.map(({ item, qty }) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0"><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground tabular-nums">{money(qty * Number(item.price), t.currency)}</div></div>
                <Stepper qty={qty} onChange={(n) => setQty(item.id, n)} name={item.name} />
              </li>
            ))}
          </ul>
          <Textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value.slice(0, 300))} placeholder="Anything the kitchen should know? (no onions, allergies…)" rows={2} aria-label="Note for the kitchen" />
          <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{money(cartTotal, t.currency)}</span></div>
          {pending && <p className="text-xs text-amber-700">Your last order is still with the waiter. Cancel it first, or wait a moment.</p>}
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <DialogFooter>
            <Button className="w-full" disabled={busy || cartCount === 0 || pending} onClick={sendOrder} data-testid="send-order">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send order to the waiter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ask === "bill"} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>How would you like to pay?</DialogTitle><DialogDescription>We'll bring the bill to table {t.table}.</DialogDescription></DialogHeader>
          <div className="grid gap-2">
            {([["cash", Banknote], ["card", CreditCard], ["mpesa", Smartphone]] as const).map(([m, Icon]) => (
              <Button key={m} variant="outline" className="h-14 justify-start text-base" disabled={busy} onClick={() => send("bill", { pay: m })} data-testid={`pay-${m}`}>
                <Icon className="mr-3 h-5 w-5" />{PAY_LABEL[m]}
              </Button>
            ))}
          </div>
          {t.can_pay && t.bill && Number(t.bill.due) >= 1 && <p className="text-xs text-muted-foreground">Or pay with M-Pesa yourself under "Your bill" on this page.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={ask === "other"} onOpenChange={(o) => !o && setAsk(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>What do you need?</DialogTitle><DialogDescription>Tap one or write a short note.</DialogDescription></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((x) => (
              <button key={x} type="button" onClick={() => setNote(x)} className={cn("rounded-full border px-3 py-1 text-sm", note === x && "border-primary bg-primary/10")}>{x}</button>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="e.g. 2 bottles of still water" rows={2} aria-label="Your note" />
          <DialogFooter>
            <Button className="w-full" disabled={busy || !note.trim()} onClick={() => send("other", { note })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send to the waiter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
};
export default TableQrPage;
