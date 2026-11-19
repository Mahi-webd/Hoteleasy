// Table QR & waiter calls: a live map of the restaurant tables. A table that calls turns red with a "!"
// and a sound plays; the waiter taps "On my way", then "Done". Managers switch QR on/off per outlet or
// table, print the QR codes and see how fast tables were answered.
// Step 2: orders sent from the phone wait here (violet) until a waiter confirms them onto the POS bill.
// "My outlets" (saved on each device): a waiter sees and hears only the outlets they serve; tables left
// waiting in other outlets still show in a banner, and after 3 minutes they sound for everyone, so no table
// is ever forgotten. Tiles say who is on the way ("Ravi on the way").
// Kitchen: when the kitchen / bar screen marks food ready, the table turns green with a sound ("T3: food
// ready"); the waiter collects it and taps "Served" here. Tiles also show what the kitchen is still making.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict, parseISO, subDays } from "date-fns";
import { BellRing, Check, CheckCheck, ChefHat, ChevronDown, ExternalLink, Footprints, MapPin, Printer, QrCode, RefreshCw, ShoppingBag, Timer, Volume2, VolumeX, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { cn } from "@/lib/utils";
import {
  CALL_LABEL, PAY_LABEL, fmtWait, useDecideTableOrder, useServeItems, useResetTableLink, useSetOutletOptions, useSetOutletQr, useSetTableQr, useTableBoard,
  useTableCallsRealtime, useTableQrReport, useUpdateTableCall, type BoardOutlet, type BoardTable, type TableAlert, type TableOrder,
} from "@/hooks/useTableQr";

// ---------------------------------------------------------------- "My outlets" (per hotel, per device)
interface Prefs { outlets: string[] | null; helpOthers: boolean; chosen: boolean }
const PREFS_KEY = (hotelId: string) => `hoteleasy-tableqr-prefs-${hotelId}`;
const readPrefs = (hotelId: string): Prefs => {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY(hotelId)) ?? "null");
    if (v && typeof v === "object") return { outlets: Array.isArray(v.outlets) ? v.outlets : null, helpOthers: v.helpOthers !== false, chosen: !!v.chosen };
  } catch { /* private mode or bad value */ }
  return { outlets: null, helpOthers: true, chosen: false };
};
const savePrefs = (hotelId: string, p: Prefs) => { try { localStorage.setItem(PREFS_KEY(hotelId), JSON.stringify(p)); } catch { /* private mode */ } };

/** Waiting = a call nobody has answered, a phone order nobody has confirmed, or food ready at the pass. */
const waitingSince = (t: BoardTable) =>
  [t.call?.status === "open" ? t.call.created_at : undefined, t.order?.status === "pending" ? t.order.created_at : undefined,
   t.kitchen?.ready?.length ? (t.kitchen.ready_since ?? undefined) : undefined].filter(Boolean).sort()[0] as string | undefined;
const hasReady = (t: BoardTable) => !!t.kitchen?.ready?.length;
const HELP_AFTER_MS = 3 * 60_000;

const REFUSE = ["Sold out", "Kitchen is closed", "Please call a waiter"];

/** A phone order waiting for a waiter: what was ordered, Confirm (onto the POS bill, to the kitchen) or Refuse. */
const PendingOrder = ({ order, canConfirm, canRespond, currency }: { order: TableOrder; canConfirm: boolean; canRespond: boolean; currency: string }) => {
  const decide = useDecideTableOrder();
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="mt-1 space-y-1" data-testid="pending-order">
      <div className="flex items-center gap-1 text-sm font-semibold text-violet-700 dark:text-violet-300"><ShoppingBag className="h-4 w-4" />New order · {money(order.total, currency)}</div>
      <ul className="text-xs text-slate-700 dark:text-slate-200">
        {order.lines.map((l, i) => <li key={i}>{l.qty}× {l.name}{l.notes ? <span className="italic text-slate-500"> — {l.notes}</span> : null}</li>)}
      </ul>
      {order.note && <div className="text-xs italic text-slate-600">"{order.note}"</div>}
      <div className="text-xs text-slate-500">{ago(order.created_at)} ago</div>
      {canRespond && !refusing && (
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" className="h-9 flex-1 bg-violet-600 hover:bg-violet-700" disabled={decide.isPending || !canConfirm}
            title={canConfirm ? undefined : "You need the POS (take orders) permission"} onClick={() => decide.mutate({ id: order.id, accept: true })}>
            <Check className="mr-1 h-4 w-4" />Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-9" disabled={decide.isPending} onClick={() => setRefusing(true)}><X className="mr-1 h-4 w-4" />Refuse</Button>
        </div>
      )}
      {refusing && (
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap gap-1">
            {REFUSE.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-2 py-0.5 text-[11px]", reason === r && "border-violet-500 bg-violet-100")}>{r}</button>)}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="Reason the table will see" className="h-8 text-xs" />
          <div className="flex gap-1.5">
            <Button size="sm" variant="destructive" className="h-8 flex-1" disabled={decide.isPending || !reason.trim()}
              onClick={() => decide.mutate({ id: order.id, accept: false, reason }, { onSuccess: () => setRefusing(false) })}>Refuse order</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setRefusing(false)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
};

const SOUND_KEY = "hoteleasy-tableqr-sound";
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
const saveSound = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* private mode */ } };

let audio: AudioContext | null = null;
const chime = () => {
  try {
    audio = audio ?? new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    [0, 0.18].forEach((at, i) => {
      const o = audio!.createOscillator(); const g = audio!.createGain();
      o.connect(g); g.connect(audio!.destination); o.frequency.value = i ? 1175 : 880;
      g.gain.setValueAtTime(0.1, audio!.currentTime + at); g.gain.exponentialRampToValueAtTime(0.001, audio!.currentTime + at + 0.25);
      o.start(audio!.currentTime + at); o.stop(audio!.currentTime + at + 0.26);
    });
  } catch { /* no audio on this device */ }
};

const what = (t: BoardTable) => {
  const c = t.call!;
  if (c.kind === "bill") return `Bill${c.pay_method ? ` · ${PAY_LABEL[c.pay_method]}` : ""}`;
  if (c.kind === "other") return c.note || "Request";
  return CALL_LABEL[c.kind];
};
const money = (n: number, cur: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return `${cur} ${Math.round(n).toLocaleString()}`; }
};
const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: false }).replace(" minutes", " min").replace(" minute", " min").replace(" seconds", "s").replace(" second", "s");

/** Re-render every few seconds so the "2 min ago" labels move. */
const useTick = (ms: number) => { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]); };

/** Food the kitchen / bar has made ready for this table: collect it, then tap Served. */
const ReadyToServe = ({ t, canServe }: { t: BoardTable; canServe: boolean }) => {
  const serve = useServeItems();
  const items = t.kitchen?.ready ?? [];
  if (!items.length) return null;
  const bar = items.some((i) => i.station === "bar");
  const kitchen = items.some((i) => i.station !== "bar");
  const where = bar && kitchen ? "kitchen & bar" : bar ? "bar" : "kitchen";
  return (
    <div className="mt-1 space-y-1 rounded-lg bg-green-100/70 p-2 dark:bg-green-900/30" data-testid="ready-to-serve">
      <div className="flex items-center gap-1 text-sm font-semibold text-green-800 dark:text-green-200">
        <CheckCheck className="h-4 w-4" />Ready at the {where}{t.kitchen?.ready_since ? ` · ${ago(t.kitchen.ready_since)}` : ""}
      </div>
      <ul className="text-xs text-green-900 dark:text-green-100">{items.map((i) => <li key={i.id}>{Number(i.qty)}× {i.name}</li>)}</ul>
      <Button size="sm" className="h-9 w-full bg-green-600 hover:bg-green-700" disabled={serve.isPending || !canServe}
        title={canServe ? undefined : "You need the POS (take orders) permission"} onClick={() => serve.mutate({ ids: items.map((i) => i.id), table: t.name })}>
        <Check className="mr-1 h-4 w-4" />Served
      </Button>
    </div>
  );
};

const TableTile = ({ t, canRespond, canConfirm, currency, outlet, me }: { t: BoardTable; canRespond: boolean; canConfirm: boolean; currency: string; outlet?: string; me?: string }) => {
  const upd = useUpdateTableCall();
  const ready = hasReady(t);
  const cooking = (t.kitchen?.waiting ?? 0) + (t.kitchen?.preparing ?? 0);
  const c = t.call;
  const ord = t.order?.status === "pending" ? t.order : null;
  const open = c?.status === "open";
  const onWay = c?.status === "on_way";
  const firstAt = [open ? c!.created_at : null, ord?.created_at ?? null].filter(Boolean).sort()[0] as string | undefined;
  const late = !!firstAt && Date.now() - parseISO(firstAt).getTime() > 3 * 60_000;
  const mine = onWay && !!me && c?.by_id === me;
  const who = mine ? "You're" : c?.by_name ? `${c.by_name} is` : "Someone is";
  const slowWay = onWay && Date.now() - parseISO(c!.acknowledged_at ?? c!.created_at).getTime() > 5 * 60_000;
  return (
    <div data-testid="table-tile"
      className={cn("relative flex min-h-[132px] flex-col rounded-2xl border-2 p-3 transition",
        open ? "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-lg shadow-red-200/60 dark:shadow-none"
          : ord ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 shadow-lg shadow-violet-200/60 dark:shadow-none"
          : ready ? "border-green-500 bg-green-50 dark:bg-green-950/40 shadow-lg shadow-green-200/60 dark:shadow-none" : onWay ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        !t.enabled && "opacity-50")}>
      {(open || ord || ready) && <span className={cn("absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-base font-black text-white", open ? "bg-red-600" : ord ? "bg-violet-600" : "bg-green-600", late && "animate-bounce")}>!</span>}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.name}</span>
        {outlet ? <span className="truncate text-[11px] text-slate-500">{outlet}</span> : <span className="text-[11px] text-slate-400">{t.seats} seats</span>}
      </div>
      {t.bill && <div className="text-[11px] text-slate-500" data-testid="tile-bill">Bill {t.bill.number} · {money(Number(t.bill.total), currency)}{Number(t.bill.paid) > 0 ? ` · paid ${money(Number(t.bill.paid), currency)}` : ""}</div>}
      {cooking > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-orange-700 dark:text-orange-300" data-testid="tile-kitchen">
          <ChefHat className="h-3 w-3" />Kitchen: {[t.kitchen?.waiting ? `${t.kitchen.waiting} waiting` : "", t.kitchen?.preparing ? `${t.kitchen.preparing} preparing` : ""].filter(Boolean).join(" · ")}{!t.bill ? " (paid)" : ""}
        </div>
      )}
      <ReadyToServe t={t} canServe={canConfirm} />
      {ord && <PendingOrder order={ord} canConfirm={canConfirm} canRespond={canRespond} currency={currency} />}
      {c ? (
        <>
          <div className={cn("mt-1 text-sm font-semibold", open ? "text-red-700 dark:text-red-300" : "text-sky-700 dark:text-sky-300")}>{what(t)}</div>
          {open ? <div className="text-xs text-slate-500">{ago(c.created_at)} ago</div> : (
            <div className={cn("text-xs", slowWay ? "font-medium text-amber-700" : mine ? "font-medium text-sky-700" : "text-slate-500")} data-testid="on-the-way">
              {who} on the way · {ago(c.acknowledged_at ?? c.created_at)}{slowWay ? " — not done yet?" : ""}
            </div>
          )}
          {c.kind !== "other" && c.note && <div className="mt-0.5 line-clamp-2 text-xs italic text-slate-600">"{c.note}"</div>}
          {canRespond && (
            <div className="mt-auto flex gap-1.5 pt-2">
              {open && (
                <Button size="sm" className="h-9 flex-1 bg-sky-600 hover:bg-sky-700" disabled={upd.isPending} onClick={() => upd.mutate({ id: c.id, status: "on_way" })}>
                  <Footprints className="mr-1 h-4 w-4" />On my way
                </Button>
              )}
              <Button size="sm" variant={open || (!mine && !slowWay) ? "outline" : "default"} className={cn("h-9 flex-1", !open && (mine || slowWay) && "bg-emerald-600 hover:bg-emerald-700")} disabled={upd.isPending}
                onClick={() => upd.mutate({ id: c.id, status: "done" })}>
                <Check className="mr-1 h-4 w-4" />Done
              </Button>
            </div>
          )}
        </>
      ) : !ord && !ready && (
        <div className="mt-auto text-xs text-slate-400">{t.enabled ? (cooking ? "" : "All good") : "QR off"}</div>
      )}
    </div>
  );
};

const LiveTab = ({ board, mineIds, helpOthers, canRespond, canConfirm, currency, me, onChooseOutlets }: {
  board: BoardOutlet[]; mineIds: Set<string> | null; helpOthers: boolean; canRespond: boolean; canConfirm: boolean; currency: string; me?: string;
  onChooseOutlets: (ids: string[] | null) => void;
}) => {
  useTick(10_000);
  const [showOthers, setShowOthers] = useState(false);
  const isMine = (id: string) => !mineIds || mineIds.has(id);
  const mineOutlets = board.filter((o) => isMine(o.id));
  // waiting first (a call nobody answered or an order to confirm), oldest first; then "on the way"
  const rank = (t: BoardTable) => (waitingSince(t) ? 0 : 1);
  const order = (a: { t: BoardTable }, b: { t: BoardTable }) =>
    rank(a.t) - rank(b.t) || (waitingSince(a.t) ?? a.t.call?.created_at ?? "").localeCompare(waitingSince(b.t) ?? b.t.call?.created_at ?? "");
  const active = (o: BoardOutlet) => o.tables.filter((t) => t.call || t.order?.status === "pending" || hasReady(t)).map((t) => ({ t, o }));
  const attention = mineOutlets.flatMap(active).sort(order);
  const others = board.filter((o) => !isMine(o.id)).flatMap(active).filter(({ t }) => waitingSince(t)).sort(order);
  const othersLate = others.filter(({ t }) => Date.now() - parseISO(waitingSince(t)!).getTime() > HELP_AFTER_MS);

  if (board.length === 0)
    return <Card><CardContent><EmptyState icon={QrCode} title="No restaurant tables yet">Add outlets and tables in Restaurant &amp; Bar POS → Setup. Each table gets its own QR code.</EmptyState></CardContent></Card>;

  return (
    <div className="space-y-4">
      {attention.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-red-600" />Needs attention ({attention.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attention.map(({ t, o }) => <TableTile key={t.id} t={t} canRespond={canRespond} canConfirm={canConfirm} currency={currency} outlet={o.name} me={me} />)}
          </CardContent>
        </Card>
      )}

      {others.length > 0 && (
        <Card className={cn(othersLate.length > 0 ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-slate-200")} data-testid="other-outlets">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-sm font-semibold", othersLate.length > 0 ? "text-amber-800 dark:text-amber-200" : "text-slate-700 dark:text-slate-200")}>
                {othersLate.length > 0
                  ? `No one has answered ${othersLate.length === 1 ? "a table" : `${othersLate.length} tables`} in other outlets for over 3 minutes`
                  : `${others.length} table${others.length === 1 ? "" : "s"} waiting in other outlets`}
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setShowOthers((v) => !v)}>{showOthers ? "Hide" : "Show and help"}</Button>
            </div>
            {!showOthers && (
              <div className="flex flex-wrap gap-1.5">
                {others.map(({ t, o }) => (
                  <Badge key={t.id} variant="outline" className="bg-white dark:bg-slate-900">{o.name} · {t.name} · {t.call?.status === "open" ? what(t) : t.order?.status === "pending" ? "Order" : "Food ready"} · {ago(waitingSince(t)!)}</Badge>
                ))}
              </div>
            )}
            {showOthers && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {others.map(({ t, o }) => <TableTile key={t.id} t={t} canRespond={canRespond} canConfirm={canConfirm} currency={currency} outlet={o.name} me={me} />)}
              </div>
            )}
            {!helpOthers && othersLate.length > 0 && <p className="text-xs text-amber-800">You've turned off sounds for other outlets in "My outlets".</p>}
          </CardContent>
        </Card>
      )}

      {mineOutlets.map((o) => (
        <section key={o.id} className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">{o.name}{!o.enabled && <Badge variant="outline">QR off</Badge>}</h3>
          {o.tables.length === 0 ? <p className="text-sm text-slate-500">No tables in this outlet.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {o.tables.map((t) => <TableTile key={t.id} t={t} canRespond={canRespond} canConfirm={canConfirm} currency={currency} me={me} />)}
            </div>
          )}
        </section>
      ))}
      {mineIds && board.length > mineOutlets.length && (
        <p className="text-center text-xs text-slate-500">
          Showing only your outlets. <button type="button" className="underline" onClick={() => onChooseOutlets(null)}>Show all outlets</button>
        </p>
      )}
    </div>
  );
};

const SetupTab = ({ board }: { board: BoardOutlet[] }) => {
  const setOutlet = useSetOutletQr();
  const setOptions = useSetOutletOptions();
  const setTable = useSetTableQr();
  const reset = useResetTableLink();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR codes for the tables</CardTitle>
          <CardDescription>Print one card per table. Diners scan it to see the menu and call a waiter. Each code is secret to its table; make a new one if a sticker is copied or lost.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><a href="/table-qr" target="_blank" rel="noreferrer"><Printer className="mr-2 h-4 w-4" />Print all QR codes</a></Button>
          {board.map((o) => (
            <Button key={o.id} variant="outline" asChild><a href={`/table-qr?outlet=${o.id}`} target="_blank" rel="noreferrer"><Printer className="mr-2 h-4 w-4" />{o.name}</a></Button>
          ))}
        </CardContent>
      </Card>
      {board.map((o) => (
        <Card key={o.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div><CardTitle className="text-base">{o.name}</CardTitle><CardDescription>{o.enabled ? "Diners can call from these tables" : "Switched off: QR codes here show a polite \"wave to a waiter\" message"}</CardDescription></div>
            <div className="flex items-center gap-2"><Label htmlFor={`o-${o.id}`} className="text-sm">On</Label>
              <Switch id={`o-${o.id}`} checked={o.enabled} disabled={setOutlet.isPending} onCheckedChange={(v) => setOutlet.mutate({ id: o.id, enabled: v })} /></div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 dark:bg-slate-900/50 sm:grid-cols-2">
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={!!o.order_enabled} disabled={setOptions.isPending || !o.enabled} aria-label={`Phone ordering in ${o.name}`}
                  onCheckedChange={(v) => setOptions.mutate({ id: o.id, order: v, pay: !!o.pay_enabled })} />
                <span><span className="font-medium">Order from the phone</span><br /><span className="text-xs text-slate-500">Diners send their order; a waiter confirms it before the kitchen gets it.</span></span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={!!o.pay_enabled} disabled={setOptions.isPending || !o.enabled} aria-label={`M-Pesa from the phone in ${o.name}`}
                  onCheckedChange={(v) => setOptions.mutate({ id: o.id, order: !!o.order_enabled, pay: v })} />
                <span><span className="font-medium">Pay the bill by M-Pesa from the phone</span><br /><span className="text-xs text-slate-500">Diners see their bill and get an M-Pesa prompt. Needs M-Pesa set up in Settings.</span></span>
              </label>
            </div>
            <ul className="divide-y">
              {o.tables.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-20 font-medium">{t.name}</span>
                  <Switch checked={t.enabled} aria-label={`QR for table ${t.name}`} disabled={setTable.isPending || !o.enabled} onCheckedChange={(v) => setTable.mutate({ id: t.id, enabled: v })} />
                  <span className="text-xs text-slate-500">{t.enabled ? "On" : "Off"}</span>
                  <span className="flex-1" />
                  {t.token && <Button variant="ghost" size="sm" asChild><a href={`/t/${t.token}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" />Try it</a></Button>}
                  <Button variant="ghost" size="sm" disabled={reset.isPending}
                    onClick={() => { if (confirm(`Make a new QR code for table ${t.name}? The old sticker will stop working.`)) reset.mutate(t.id); }}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />New code
                  </Button>
                </li>
              ))}
              {o.tables.length === 0 && <li className="py-2 text-sm text-slate-500">No tables yet: add them in Restaurant &amp; Bar POS → Setup.</li>}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const ReportTab = () => {
  const [from, setFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const r = useTableQrReport(from, to, true);
  const d = r.data;
  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="text-2xl font-bold">{value}</div>{hint && <div className="text-xs text-slate-500">{hint}</div>}</CardContent></Card>
  );
  const Rows = ({ title, rows }: { title: string; rows: { name: string; calls: number; avg_response_s: number | null }[] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1 font-medium">Name</th><th className="font-medium text-right">Calls</th><th className="font-medium text-right">Avg. answer</th></tr></thead>
            <tbody>{rows.map((x) => <tr key={x.name} className="border-t"><td className="py-1.5">{x.name}</td><td className="text-right tabular-nums">{x.calls}</td><td className="text-right tabular-nums">{fmtWait(x.avg_response_s)}</td></tr>)}</tbody></table>
        )}
      </CardContent>
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="rf">From</Label><Input id="rf" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="rt">To</Label><Input id="rt" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {r.isLoading || !d ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Calls" value={String(d.calls)} hint={`${d.answered} answered`} />
            <Stat label="Avg. time to answer" value={fmtWait(d.avg_response_s)} hint="call → On my way" />
            <Stat label="Avg. time to done" value={fmtWait(d.avg_done_s)} />
            <Stat label="Waited over 5 min" value={String(d.slow)} hint={d.calls ? `${Math.round((d.slow / d.calls) * 100)}% of calls` : undefined} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Rows title="By request" rows={d.by_kind.map((k) => ({ name: CALL_LABEL[k.kind], calls: k.calls, avg_response_s: k.avg_response_s }))} />
            <Rows title="By outlet" rows={d.by_outlet.map((k) => ({ name: k.outlet, calls: k.calls, avg_response_s: k.avg_response_s }))} />
            <Rows title="By staff member" rows={d.by_staff} />
          </div>
        </>
      )}
    </div>
  );
};

/** "My outlets" picker: what this device shows and rings for. */
const OutletPicker = ({ board, prefs, onChange }: { board: BoardOutlet[]; prefs: Prefs; onChange: (p: Prefs) => void }) => {
  const sel = prefs.outlets;
  const all = !sel;
  const label = all ? "All outlets" : board.filter((o) => sel!.includes(o.id)).map((o) => o.name).join(", ") || "All outlets";
  const toggle = (id: string, on: boolean) => {
    const cur = new Set(sel ?? board.map((o) => o.id));
    if (on) cur.add(id); else cur.delete(id);
    const ids = board.map((o) => o.id).filter((x) => cur.has(x));
    // every outlet (or none) ticked means "all": nothing is ever silently hidden
    onChange({ ...prefs, chosen: true, outlets: ids.length === 0 || ids.length === board.length ? null : ids });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[260px]" data-testid="my-outlets"><MapPin className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">My outlets: {label}</span><ChevronDown className="ml-1 h-4 w-4 shrink-0" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-slate-500">What this device shows and rings for (saved on this device)</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={all} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onChange({ ...prefs, chosen: true, outlets: null })}>All outlets</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {board.map((o) => (
          <DropdownMenuCheckboxItem key={o.id} checked={all || sel!.includes(o.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => toggle(o.id, !!v)}>{o.name}</DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={prefs.helpOthers} disabled={all} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => onChange({ ...prefs, chosen: true, helpOthers: !!v })}>
          <span>Ring for other outlets after 3 min<br /><span className="text-[11px] text-slate-500">if nobody has answered there</span></span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TableQrBoard = () => {
  const { allowed, hotel } = useCurrentHotel();
  const { user } = useAuth();
  const admin = allowed("tableqr.admin");
  const canRespond = allowed("tableqr.respond");
  const canConfirm = canRespond && allowed("pos.create");
  const q = useTableBoard();
  const board = useMemo(() => q.data ?? [], [q.data]);
  const [sound, setSound] = useState(readSound);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const [prefs, setPrefsState] = useState<Prefs>(() => readPrefs(hotel.id));
  useEffect(() => { setPrefsState(readPrefs(hotel.id)); }, [hotel.id]);
  const setPrefs = (p: Prefs) => { setPrefsState(p); savePrefs(hotel.id, p); };
  // outlets saved earlier that no longer exist are ignored; if none are left, show everything
  const mineIds = useMemo(() => {
    if (!prefs.outlets) return null;
    const ids = prefs.outlets.filter((id) => board.some((o) => o.id === id));
    return board.length && ids.length === 0 ? null : new Set(ids);
  }, [prefs.outlets, board]);
  const isMine = useCallback((id: string | null) => !mineIds || !id || mineIds.has(id), [mineIds]);

  // a new call or order: sound + message only for my outlets (others show in the banner)
  const ctx = useRef({ isMine, board });
  ctx.current = { isMine, board };
  const readySeen = useRef<Record<string, number>>({});
  const onNew = useCallback((a: TableAlert) => {
    if (a.what === "ready") {
      // which table is this bill for? (bills that aren't at a QR table, e.g. takeaway, don't ring here)
      const hit = ctx.current.board.flatMap((o) => o.tables.map((t) => ({ o, t })))
        .find(({ t }) => a.orderId && (t.bill?.id === a.orderId || t.kitchen?.order_ids?.includes(a.orderId)));
      if (!hit || !ctx.current.isMine(hit.o.id)) return;
      const now = Date.now();
      if (now - (readySeen.current[a.orderId!] ?? 0) < 8_000) return; // several dishes ready at once: one alert
      readySeen.current[a.orderId!] = now;
      if (soundRef.current) chime();
      toast.success(`Table ${hit.t.name}${ctx.current.board.length > 1 ? ` (${hit.o.name})` : ""}: food ready to serve`, { duration: 6000 });
      return;
    }
    if (!ctx.current.isMine(a.outletId)) return;
    if (soundRef.current) chime();
    const o = ctx.current.board.find((x) => x.id === a.outletId);
    const t = o?.tables.find((x) => x.id === a.tableId);
    const where = t ? `Table ${t.name}${o && ctx.current.board.length > 1 ? ` (${o.name})` : ""}` : "A table";
    toast.warning(a.what === "order" ? `${where} sent an order` : `${where} is calling`, { duration: 5000 });
  }, []);
  useTableCallsRealtime(onNew);

  // keep reminding: my tables waiting over 2 min; other outlets' tables nobody answered for 3 min.
  // Checked every 10 s; rings at once when a table crosses the line, then every 45 s while it waits.
  useTick(10_000);
  const all = board.flatMap((o) => o.tables.map((t) => ({ t, o })));
  const waitedMs = (t: BoardTable) => { const w = waitingSince(t); return w ? Date.now() - parseISO(w).getTime() : -1; };
  const remind = all.some(({ t, o }) => isMine(o.id) ? waitedMs(t) > 120_000 : prefs.helpOthers && waitedMs(t) > HELP_AFTER_MS);
  useEffect(() => {
    if (!remind) return;
    if (soundRef.current) chime();
    const i = setInterval(() => { if (soundRef.current) chime(); }, 45_000);
    return () => clearInterval(i);
  }, [remind]);

  const openCount = all.filter(({ t, o }) => isMine(o.id) && waitingSince(t)).length;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = openCount ? `(${openCount}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\) /, ""); };
  }, [openCount]);

  const toggleSound = () => { const v = !sound; setSound(v); saveSound(v); if (v) chime(); };
  const multi = board.length > 1;

  return (
    <div className="space-y-4">
      <PageHeader title="Table QR & waiter calls" subtitle="Red = table waiting, violet = order to confirm, green = food ready to serve, blue = someone's on the way."
        actions={
          <div className="flex flex-wrap gap-2">
            {multi && <OutletPicker board={board} prefs={prefs} onChange={setPrefs} />}
            <Button variant="outline" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}{sound ? "Sound on" : "Sound off"}</Button>
            {admin && <Button variant="outline" asChild><a href="/table-qr" target="_blank" rel="noreferrer"><Printer className="mr-2 h-4 w-4" />Print QR codes</a></Button>}
          </div>
        } />
      {q.isLoading ? <LoadingBlock /> : q.isError ? (
        <Card><CardContent className="py-10 text-center text-sm text-slate-600">Table QR isn't ready yet. Ask your manager to run the latest database update (table_qr).</CardContent></Card>
      ) : (
        <>
          {multi && !prefs.chosen && (
            <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30" data-testid="choose-outlets">
              <CardContent className="flex flex-wrap items-center gap-2 p-4">
                <MapPin className="h-4 w-4 text-sky-700" />
                <span className="text-sm font-medium text-sky-900 dark:text-sky-100">Which outlet do you serve? This device will only show and ring for it.</span>
                <span className="flex-1" />
                {board.map((o) => <Button key={o.id} size="sm" variant="outline" onClick={() => setPrefs({ ...prefs, chosen: true, outlets: [o.id] })}>{o.name}</Button>)}
                <Button size="sm" onClick={() => setPrefs({ ...prefs, chosen: true, outlets: null })}>All outlets</Button>
              </CardContent>
            </Card>
          )}
          <Tabs defaultValue="live">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="live">Live tables{openCount ? ` (${openCount})` : ""}</TabsTrigger>
              {admin && <TabsTrigger value="setup">Setup</TabsTrigger>}
              {admin && <TabsTrigger value="report"><Timer className="mr-1 h-4 w-4" />Response times</TabsTrigger>}
            </TabsList>
            <TabsContent value="live">
              <LiveTab board={board} mineIds={mineIds} helpOthers={prefs.helpOthers} canRespond={canRespond} canConfirm={canConfirm}
                currency={hotel.currency ?? "KES"} me={user?.id} onChooseOutlets={(ids) => setPrefs({ ...prefs, chosen: true, outlets: ids })} />
            </TabsContent>
            {admin && <TabsContent value="setup"><SetupTab board={board} /></TabsContent>}
            {admin && <TabsContent value="report"><ReportTab /></TabsContent>}
          </Tabs>
        </>
      )}
    </div>
  );
};
export default TableQrBoard;
