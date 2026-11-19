// Table QR & waiter calls: a live map of the restaurant tables. A table that calls turns red with a "!"
// and a sound plays; the waiter taps "On my way", then "Done". Managers switch QR on/off per outlet or
// table, print the QR codes and see how fast tables were answered.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict, parseISO, subDays } from "date-fns";
import { BellRing, Check, ExternalLink, Footprints, Printer, QrCode, RefreshCw, Timer, Volume2, VolumeX } from "lucide-react";
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
  CALL_LABEL, PAY_LABEL, fmtWait, useResetTableLink, useSetOutletQr, useSetTableQr, useTableBoard, useTableCallsRealtime, useTableQrReport,
  useUpdateTableCall, type BoardOutlet, type BoardTable,
} from "@/hooks/useTableQr";

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
const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { addSuffix: false }).replace(" minutes", " min").replace(" minute", " min").replace(" seconds", "s").replace(" second", "s");

/** Re-render every few seconds so the "2 min ago" labels move. */
const useTick = (ms: number) => { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]); };

const TableTile = ({ t, canRespond, outlet }: { t: BoardTable; canRespond: boolean; outlet?: string }) => {
  const upd = useUpdateTableCall();
  const c = t.call;
  const open = c?.status === "open";
  const onWay = c?.status === "on_way";
  const late = open && Date.now() - parseISO(c!.created_at).getTime() > 3 * 60_000;
  return (
    <div data-testid="table-tile"
      className={cn("relative flex min-h-[132px] flex-col rounded-2xl border-2 p-3 transition",
        open ? "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-lg shadow-red-200/60 dark:shadow-none" : onWay ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        !t.enabled && "opacity-50")}>
      {open && <span className={cn("absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-base font-black text-white", late && "animate-bounce")}>!</span>}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.name}</span>
        {outlet ? <span className="truncate text-[11px] text-slate-500">{outlet}</span> : <span className="text-[11px] text-slate-400">{t.seats} seats</span>}
      </div>
      {c ? (
        <>
          <div className={cn("mt-1 text-sm font-semibold", open ? "text-red-700 dark:text-red-300" : "text-sky-700 dark:text-sky-300")}>{what(t)}</div>
          <div className="text-xs text-slate-500">{open ? `${ago(c.created_at)} ago` : `On the way · ${ago(c.acknowledged_at ?? c.created_at)}`}</div>
          {c.kind !== "other" && c.note && <div className="mt-0.5 line-clamp-2 text-xs italic text-slate-600">"{c.note}"</div>}
          {canRespond && (
            <div className="mt-auto flex gap-1.5 pt-2">
              {open && (
                <Button size="sm" className="h-9 flex-1 bg-sky-600 hover:bg-sky-700" disabled={upd.isPending} onClick={() => upd.mutate({ id: c.id, status: "on_way" })}>
                  <Footprints className="mr-1 h-4 w-4" />On my way
                </Button>
              )}
              <Button size="sm" variant={open ? "outline" : "default"} className={cn("h-9 flex-1", !open && "bg-emerald-600 hover:bg-emerald-700")} disabled={upd.isPending}
                onClick={() => upd.mutate({ id: c.id, status: "done" })}>
                <Check className="mr-1 h-4 w-4" />Done
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-auto text-xs text-slate-400">{t.enabled ? "All good" : "QR off"}</div>
      )}
    </div>
  );
};

const LiveTab = ({ board, canRespond }: { board: BoardOutlet[]; canRespond: boolean }) => {
  useTick(10_000);
  const [outlet, setOutlet] = useState<string | "all">("all");
  const shown = board.filter((o) => outlet === "all" || o.id === outlet);
  const waiting = board.flatMap((o) => o.tables.filter((t) => t.call).map((t) => ({ t, o })))
    .sort((a, b) => (a.t.call!.status === b.t.call!.status ? 0 : a.t.call!.status === "open" ? -1 : 1) || a.t.call!.created_at.localeCompare(b.t.call!.created_at));

  if (board.length === 0)
    return <Card><CardContent><EmptyState icon={QrCode} title="No restaurant tables yet">Add outlets and tables in Restaurant &amp; Bar POS → Setup. Each table gets its own QR code.</EmptyState></CardContent></Card>;

  return (
    <div className="space-y-4">
      {waiting.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-red-600" />Needs attention ({waiting.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {waiting.map(({ t, o }) => <TableTile key={t.id} t={t} canRespond={canRespond} outlet={o.name} />)}
          </CardContent>
        </Card>
      )}
      {board.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "all", name: "All outlets" }, ...board].map((o) => (
            <Button key={o.id} size="sm" variant={outlet === o.id ? "default" : "outline"} onClick={() => setOutlet(o.id)}>{o.name}</Button>
          ))}
        </div>
      )}
      {shown.map((o) => (
        <section key={o.id} className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">{o.name}{!o.enabled && <Badge variant="outline">QR off</Badge>}</h3>
          {o.tables.length === 0 ? <p className="text-sm text-slate-500">No tables in this outlet.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {o.tables.map((t) => <TableTile key={t.id} t={t} canRespond={canRespond} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

const SetupTab = ({ board }: { board: BoardOutlet[] }) => {
  const setOutlet = useSetOutletQr();
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
          <CardContent>
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

const TableQrBoard = () => {
  const { allowed } = useCurrentHotel();
  const admin = allowed("tableqr.admin");
  const canRespond = allowed("tableqr.respond");
  const q = useTableBoard();
  const [sound, setSound] = useState(readSound);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const onNew = useCallback(() => { if (soundRef.current) chime(); toast.warning("A table is calling", { duration: 4000 }); }, []);
  useTableCallsRealtime(onNew);

  // keep reminding while a table has waited over 2 minutes with nobody on the way
  const waitingLong = useMemo(() => (q.data ?? []).some((o) => o.tables.some((t) => t.call?.status === "open" && Date.now() - parseISO(t.call.created_at).getTime() > 120_000)), [q.data, q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!waitingLong) return;
    const i = setInterval(() => { if (soundRef.current) chime(); }, 45_000);
    return () => clearInterval(i);
  }, [waitingLong]);

  const openCount = (q.data ?? []).reduce((n, o) => n + o.tables.filter((t) => t.call?.status === "open").length, 0);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = openCount ? `(${openCount}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\) /, ""); };
  }, [openCount]);

  const toggleSound = () => { const v = !sound; setSound(v); saveSound(v); if (v) chime(); };

  return (
    <div className="space-y-4">
      <PageHeader title="Table QR & waiter calls" subtitle="Tables call from the QR code on the table. Red = waiting, blue = someone's on the way."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}{sound ? "Sound on" : "Sound off"}</Button>
            {admin && <Button variant="outline" asChild><a href="/table-qr" target="_blank" rel="noreferrer"><Printer className="mr-2 h-4 w-4" />Print QR codes</a></Button>}
          </div>
        } />
      {q.isLoading ? <LoadingBlock /> : q.isError ? (
        <Card><CardContent className="py-10 text-center text-sm text-slate-600">Table QR isn't ready yet. Ask your manager to run the latest database update (table_qr).</CardContent></Card>
      ) : (
        <Tabs defaultValue="live">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="live">Live tables{openCount ? ` (${openCount})` : ""}</TabsTrigger>
            {admin && <TabsTrigger value="setup">Setup</TabsTrigger>}
            {admin && <TabsTrigger value="report"><Timer className="mr-1 h-4 w-4" />Response times</TabsTrigger>}
          </TabsList>
          <TabsContent value="live"><LiveTab board={q.data ?? []} canRespond={canRespond} /></TabsContent>
          {admin && <TabsContent value="setup"><SetupTab board={q.data ?? []} /></TabsContent>}
          {admin && <TabsContent value="report"><ReportTab /></TabsContent>}
        </Tabs>
      )}
    </div>
  );
};
export default TableQrBoard;
