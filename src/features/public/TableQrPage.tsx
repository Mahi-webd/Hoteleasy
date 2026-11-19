// /t/:token — the page a diner opens by scanning the QR code on their restaurant table.
// No sign-in: the secret token picks the table (and so the hotel). Menu with prices, and three buttons:
// call the waiter, bring the bill (cash / card / M-Pesa), or ask for something else.
import { useState } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, CreditCard, Hand, Loader2, Receipt, Smartphone, Sparkles, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  PAY_LABEL, publicTableCall, publicTableCancel, usePublicTable, type PayMethod, type PublicTable, type TableCall, type TableCallKind,
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

const BigButton = ({ icon: Icon, label, hint, onClick, disabled, testid }: { icon: React.ComponentType<{ className?: string }>; label: string; hint: string; onClick: () => void; disabled?: boolean; testid: string }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testid}
    className="group flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center shadow-sm transition active:scale-95 hover:border-primary hover:shadow-md disabled:opacity-50">
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition"><Icon className="h-7 w-7" /></span>
    <span className="font-semibold leading-tight">{label}</span>
    <span className="text-xs text-muted-foreground leading-tight">{hint}</span>
  </button>
);

const TableQrPage = () => {
  const { token = "" } = useParams();
  const q = usePublicTable(token);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "bill" | "other">(null);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const send = async (kind: TableCallKind, opts: { note?: string; pay?: PayMethod } = {}) => {
    setBusy(true); setError(null);
    try {
      const call = await publicTableCall(token, kind, opts.note, opts.pay ?? null);
      qc.setQueryData<PublicTable | null>(["public", "table", token], (d) => (d ? { ...d, call } : d));
      setAsk(null); setNote("");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await publicTableCancel(token); await q.refetch(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  if (q.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  const t = q.data;
  if (!t) return <PublicShell><p className="text-center py-24 text-slate-600">This QR code isn't valid. Please ask a waiter.</p></PublicShell>;
  if (t.off) return <PublicShell><p className="text-center py-24 text-slate-600">Ordering help from this table isn't switched on right now. Please wave to a waiter — we'll be right with you.</p></PublicShell>;

  const active = t.call && (t.call.status === "open" || t.call.status === "on_way");
  const cats = t.menu.filter((c) => c.items.length);
  const shown = cat ? cats.filter((c) => c.category === cat) : cats;

  return (
    <PublicShell>
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t.hotel} · {t.outlet}</div>
          <h1 className="gs-display text-4xl" data-testid="table-name">Table {t.table}</h1>
        </div>

        {t.call && <Status call={t.call} onCancel={cancel} busy={busy} />}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          <BigButton icon={Hand} label="Call waiter" hint="Someone comes to your table" testid="btn-waiter" disabled={busy} onClick={() => send("waiter")} />
          <BigButton icon={Receipt} label="Bring the bill" hint="Cash, card or M-Pesa" testid="btn-bill" disabled={busy} onClick={() => setAsk("bill")} />
          <BigButton icon={Sparkles} label="Water / other" hint="Tell us what you need" testid="btn-other" disabled={busy} onClick={() => setAsk("other")} />
        </div>
        {active && <p className="text-center text-xs text-muted-foreground">Need something different? Tap another button — we'll update your request.</p>}

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
                        <li key={i.id} className={cn("flex items-start gap-3 py-2.5", !i.available && "opacity-50")}>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{i.name}{!i.available && <span className="ml-2 text-xs font-normal">(sold out)</span>}</div>
                            {i.description && <div className="text-sm text-muted-foreground">{i.description}</div>}
                          </div>
                          <div className="shrink-0 font-semibold tabular-nums">{money(Number(i.price), t.currency)}</div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
              <p className="text-center text-xs text-muted-foreground">To order, tap "Call waiter".</p>
            </>
          )}
        </section>
      </div>

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
