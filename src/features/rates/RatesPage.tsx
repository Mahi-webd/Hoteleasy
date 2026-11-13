import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Ban, CalendarRange, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRoomTypes } from "@/hooks/useHotelQueries";
import { useDeleteSeason, useRateCalendar, useSaveSeason, useSeasons, useToggleSeason } from "@/hooks/useRates";
import { addDays, formatMoney, todayIn } from "@/lib/format";
import type { RateSeason, SeasonColor } from "@/lib/db-types";

export const SEASON_BG: Record<SeasonColor, string> = {
  amber: "bg-amber-100 dark:bg-amber-900/40", rose: "bg-rose-100 dark:bg-rose-900/40", emerald: "bg-emerald-100 dark:bg-emerald-900/40",
  sky: "bg-sky-100 dark:bg-sky-900/40", violet: "bg-violet-100 dark:bg-violet-900/40", slate: "bg-slate-200 dark:bg-slate-700",
  orange: "bg-orange-100 dark:bg-orange-900/40", teal: "bg-teal-100 dark:bg-teal-900/40",
};
const SEASON_DOT: Record<SeasonColor, string> = {
  amber: "bg-amber-500", rose: "bg-rose-500", emerald: "bg-emerald-500", sky: "bg-sky-500", violet: "bg-violet-500", slate: "bg-slate-500", orange: "bg-orange-500", teal: "bg-teal-500",
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRIORITY: Record<string, string> = { "0": "Normal", "5": "Higher", "10": "Highest" };
const short = (n: number) => Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 });

const RatesPage = () => {
  const { can } = useCurrentHotel();
  const admin = can("owner", "manager");
  return (
    <div className="space-y-4">
      <PageHeader title="Rates & seasons" subtitle="Prices per night by season, weekend and holiday, used by front desk and your booking page" />
      <Tabs defaultValue="calendar">
        <TabsList><TabsTrigger value="calendar">Rate calendar</TabsTrigger><TabsTrigger value="seasons">Seasons</TabsTrigger></TabsList>
        <TabsContent value="calendar"><RateCalendar /></TabsContent>
        <TabsContent value="seasons"><Seasons admin={admin} /></TabsContent>
      </Tabs>
    </div>
  );
};
export default RatesPage;

// ---------------------------------------------------------------- calendar
const RateCalendar = () => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(today);
  const [span, setSpan] = useState(14);
  const [online, setOnline] = useState(false);
  const cal = useRateCalendar(from, span);
  const rows = cal.data ?? [];
  const days = rows[0]?.days.map((d) => d.date) ?? [];
  const legend = new Map<string, SeasonColor>();
  rows.forEach((r) => r.days.forEach((d) => d.season && d.color && legend.set(d.season, d.color)));
  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setFrom(addDays(from, -span))} aria-label="Earlier"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setFrom(today)}>Today</Button>
          <Button size="icon" variant="outline" onClick={() => setFrom(addDays(from, span))} aria-label="Later"><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" aria-label="Start date" />
          <Select value={String(span)} onValueChange={(v) => setSpan(Number(v))}>
            <SelectTrigger className="w-32" aria-label="Days shown"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="14">2 weeks</SelectItem><SelectItem value="31">1 month</SelectItem><SelectItem value="62">2 months</SelectItem></SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm ml-auto"><Switch checked={online} onCheckedChange={setOnline} aria-label="Show online prices" />Booking page prices</label>
        </div>
        {cal.isLoading ? <LoadingBlock /> : !rows.length ? <EmptyState icon={CalendarRange} title="No room types yet">Add room types under Rooms first.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-0 min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white dark:bg-slate-950 text-left p-2 min-w-[140px]">Room type</th>
                  {days.map((d) => {
                    const dow = parseISO(d).getDay();
                    return (
                      <th key={d} className={`p-1 text-center font-medium min-w-[58px] ${dow === 5 || dow === 6 ? "text-slate-900 dark:text-white" : "text-slate-500"} ${d === today ? "border-b-2 border-blue-600" : ""}`}>
                        <div>{format(parseISO(d), "EEE")}</div><div className="text-sm">{format(parseISO(d), "d")}</div>
                        {(d === days[0] || d.endsWith("-01")) && <div className="text-[10px] text-slate-400">{format(parseISO(d), "MMM")}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.room_type_id}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-950 p-2 border-t">
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-slate-500">{r.rooms} room{r.rooms === 1 ? "" : "s"} · normally {short(online ? r.online_rate ?? r.base_rate : r.base_rate)}</div>
                    </td>
                    {r.days.map((d) => {
                      const price = online ? d.online : d.rate;
                      const base = online ? r.online_rate ?? r.base_rate : r.base_rate;
                      return (
                        <td key={d.date} className={`p-1 border-t border-l text-center align-top ${d.color ? SEASON_BG[d.color] : ""}`}
                          title={[d.season ?? "Normal rate", `Front desk ${formatMoney(d.rate, hotel.currency)}`, `Online ${formatMoney(d.online, hotel.currency)}`,
                            d.min_nights ? `Min stay ${d.min_nights}` : "", d.cta ? "No arrivals" : "", `${d.free} free`].filter(Boolean).join(" · ")}>
                          <div className={`font-semibold tabular-nums text-[13px] ${Number(price) > Number(base) ? "text-rose-700 dark:text-rose-300" : Number(price) < Number(base) ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{short(price)}</div>
                          <div className={`${d.free <= 0 ? "text-red-600 font-semibold" : "text-slate-500"}`}>{d.free <= 0 ? "full" : `${d.free} free`}</div>
                          <div className="flex justify-center gap-0.5 min-h-[14px]">
                            {d.cta && <Ban className="h-3 w-3 text-red-600" aria-label="No arrivals" />}
                            {d.min_nights && d.min_nights > 1 && <span className="text-[10px] font-semibold">{d.min_nights}n+</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-slate-600 items-center">
          {[...legend].map(([n, c]) => <span key={n} className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${SEASON_DOT[c]}`} />{n}</span>)}
          <span className="flex items-center gap-1"><Ban className="h-3 w-3 text-red-600" />no arrivals online</span>
          <span><b>3n+</b> minimum stay</span>
          <span className="text-rose-700">higher</span>/<span className="text-emerald-700">lower</span> than normal
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- seasons
const TEMPLATES: { label: string; make: (y: number) => Partial<RateSeason> }[] = [
  { label: "Weekends (+10%)", make: (y) => ({ name: "Weekend", starts_on: `${y}-01-01`, ends_on: `${y + 1}-12-31`, weekdays: [5, 6], adjust_pct: 10, priority: 0, color: "sky" }) },
  { label: "Christmas & New Year", make: (y) => ({ name: "Christmas & New Year", starts_on: `${y}-12-20`, ends_on: `${y + 1}-01-02`, adjust_pct: 30, min_nights: 3, priority: 10, color: "rose" }) },
  { label: "Migration high season", make: (y) => ({ name: "High season", starts_on: `${y}-07-01`, ends_on: `${y}-10-31`, adjust_pct: 25, min_nights: 2, priority: 5, color: "amber" }) },
  { label: "Long rains low season", make: (y) => ({ name: "Low season", starts_on: `${y}-04-01`, ends_on: `${y}-06-15`, adjust_pct: -15, priority: 5, color: "emerald" }) },
];
const ruleText = (s: RateSeason) => {
  const parts: string[] = [];
  if (s.rate_season_prices?.length) parts.push(`set prices for ${s.rate_season_prices.length} room type${s.rate_season_prices.length === 1 ? "" : "s"}`);
  if (s.adjust_pct != null && Number(s.adjust_pct) !== 0) parts.push(`${Number(s.adjust_pct) > 0 ? "+" : ""}${Number(s.adjust_pct)}%${s.rate_season_prices?.length ? " on the others" : ""}`);
  if (!parts.length) parts.push("normal prices");
  return parts.join(", ");
};

const Seasons = ({ admin }: { admin: boolean }) => {
  const { hotel } = useCurrentHotel();
  const seasons = useSeasons();
  const del = useDeleteSeason();
  const toggle = useToggleSeason();
  const [editing, setEditing] = useState<Partial<RateSeason> | null>(null);
  const year = Number(todayIn(hotel.timezone).slice(0, 4));
  const list = seasons.data ?? [];
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-lg">Seasons</CardTitle>
          <CardDescription>Each night uses the season that covers it; if several do, the higher priority wins, then the shorter one. Nights outside any season use the room type's normal rate.</CardDescription></div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={(v) => setEditing(TEMPLATES[Number(v)].make(year))}>
              <SelectTrigger className="w-52" aria-label="Start from a template"><SelectValue placeholder="Start from a template…" /></SelectTrigger>
              <SelectContent>{TEMPLATES.map((t, i) => <SelectItem key={t.label} value={String(i)}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => setEditing({ starts_on: todayIn(hotel.timezone), ends_on: addDays(todayIn(hotel.timezone), 30) })}><Plus className="mr-1 h-4 w-4" />New season</Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {seasons.isLoading ? <LoadingBlock /> : !list.length ? (
          <EmptyState icon={CalendarRange} title="No seasons yet">Every night is sold at the room type's normal rate. Add weekends, holidays or high and low seasons to price them differently.</EmptyState>
        ) : list.map((s) => (
          <div key={s.id} className={`rounded-md border p-3 flex flex-wrap items-center gap-3 ${s.active ? "" : "opacity-60"}`}>
            <span className={`h-3 w-3 rounded-full ${SEASON_DOT[s.color]}`} />
            <div className="min-w-[200px] flex-1">
              <div className="font-medium">{s.name}{!s.active && <Badge variant="outline" className="ml-2">Off</Badge>}</div>
              <div className="text-sm text-slate-500">
                {format(parseISO(s.starts_on), "d MMM yyyy")} – {format(parseISO(s.ends_on), "d MMM yyyy")}
                {s.weekdays.length < 7 && ` · ${s.weekdays.map((d) => DAYS[d - 1]).join(", ")} nights`}
              </div>
            </div>
            <div className="text-sm">{ruleText(s)}</div>
            <div className="flex gap-1 flex-wrap">
              {s.min_nights && s.min_nights > 1 && <Badge variant="secondary">min {s.min_nights} nights</Badge>}
              {s.closed_to_arrival && <Badge variant="outline" className="border-red-200 text-red-700">no arrivals</Badge>}
              <Badge variant="outline">{PRIORITY[String(s.priority)] ?? `Priority ${s.priority}`}</Badge>
            </div>
            {admin && (
              <div className="flex items-center gap-1 ml-auto">
                <Switch checked={s.active} onCheckedChange={(v) => toggle.mutate({ id: s.id, active: v })} aria-label={`${s.name} on`} />
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil className="h-4 w-4" /></Button>
                <ConfirmButton size="icon" variant="ghost" title={`Delete ${s.name}?`} description="Existing bookings keep their prices." onConfirm={() => del.mutate(s.id)} aria-label={`Delete ${s.name}`}><Trash2 className="h-4 w-4" /></ConfirmButton>
              </div>
            )}
          </div>
        ))}
        <p className="text-xs text-slate-500">Changing a season doesn't change bookings already made; they keep the prices they were quoted. Minimum stays and "no arrivals" apply to online bookings; front desk sees a warning.</p>
      </CardContent>
      {editing && <SeasonDialog s={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
};

const SeasonDialog = ({ s, onClose }: { s: Partial<RateSeason>; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const types = useRoomTypes();
  const save = useSaveSeason();
  const [f, setF] = useState<Partial<RateSeason>>({ weekdays: [1, 2, 3, 4, 5, 6, 7], priority: 5, color: "amber", active: true, closed_to_arrival: false, ...s });
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries((s.rate_season_prices ?? []).map((p) => [p.room_type_id, String(p.rate)])));
  const set = <K extends keyof RateSeason>(k: K, v: RateSeason[K]) => setF((x) => ({ ...x, [k]: v }));
  const wd = f.weekdays ?? [];
  const pct = f.adjust_pct == null ? null : Number(f.adjust_pct);
  const valid = !!f.name?.trim() && !!f.starts_on && !!f.ends_on && f.ends_on >= f.starts_on && wd.length > 0;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{s.id ? `Edit ${s.name}` : "New season"}</DialogTitle>
          <DialogDescription>Set a % change on the normal rates, and/or a fixed price for particular room types.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1"><Label htmlFor="ss-name">Name</Label><Input id="ss-name" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="High season, Easter, Weekend…" /></div>
            <div className="space-y-1"><Label>Colour</Label>
              <div className="flex gap-1 pt-1">{(Object.keys(SEASON_DOT) as SeasonColor[]).map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => set("color", c)} className={`h-7 w-7 rounded-full ${SEASON_DOT[c]} ${f.color === c ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
              ))}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="ss-from">First night</Label><Input id="ss-from" type="date" value={f.starts_on ?? ""} onChange={(e) => set("starts_on", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="ss-to">Last night</Label><Input id="ss-to" type="date" value={f.ends_on ?? ""} onChange={(e) => set("ends_on", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Nights of the week</Label>
            <div className="flex flex-wrap gap-1">{DAYS.map((d, i) => {
              const on = wd.includes(i + 1);
              return <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("weekdays", on ? wd.filter((x) => x !== i + 1) : [...wd, i + 1].sort())}>{d}</Button>;
            })}</div>
            <p className="text-xs text-slate-500">A Friday night is the night from Friday to Saturday. For a weekend uplift choose Fri and Sat.</p>
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label htmlFor="ss-pct">Change normal rates by (%)</Label>
                <Input id="ss-pct" type="number" step="1" className="w-32" value={pct ?? ""} placeholder="e.g. 20 or -15" onChange={(e) => set("adjust_pct", e.target.value === "" ? null : Number(e.target.value))} /></div>
              <p className="text-xs text-slate-500 pb-2">Prices are rounded to whole {hotel.currency}. Leave blank to keep normal prices except those set below.</p>
            </div>
            <div className="space-y-1">
              <Label>Fixed price per night (optional)</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {(types.data ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{t.name} <span className="text-slate-500">({short(t.base_rate)}{pct ? ` → ${short(Math.round(t.base_rate * (1 + pct / 100)))}` : ""})</span></span>
                    <Input type="number" min={0} className="w-28" aria-label={`Season price for ${t.name}`} value={prices[t.id] ?? ""} placeholder="—"
                      onChange={(e) => setPrices({ ...prices, [t.id]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label htmlFor="ss-min">Minimum stay (nights)</Label><Input id="ss-min" type="number" min={1} max={30} value={f.min_nights ?? ""} placeholder="none"
              onChange={(e) => set("min_nights", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Priority</Label>
              <Select value={String(f.priority ?? 5)} onValueChange={(v) => set("priority", Number(v))}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITY).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <label className="flex items-center gap-2 text-sm pt-6"><Switch checked={!!f.closed_to_arrival} onCheckedChange={(v) => set("closed_to_arrival", v)} />No arrivals (online)</label>
          </div>
          <p className="text-xs text-slate-500">Use "Normal" for weekends, "Higher" for seasons and "Highest" for holidays, so Christmas beats a weekend that falls inside it.</p>
          <div className="space-y-1"><Label htmlFor="ss-note">Note</Label><Textarea id="ss-note" rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate({
            season: { id: f.id, name: f.name!.trim(), starts_on: f.starts_on, ends_on: f.ends_on, weekdays: wd, adjust_pct: pct, min_nights: f.min_nights || null,
              closed_to_arrival: !!f.closed_to_arrival, priority: f.priority ?? 5, color: f.color ?? "amber", active: f.active ?? true, note: f.note?.trim() || null },
            prices: Object.entries(prices).filter(([, v]) => v !== "" && !Number.isNaN(Number(v))).map(([room_type_id, v]) => ({ room_type_id, rate: Number(v) })),
          }, { onSuccess: onClose })}>Save season</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
