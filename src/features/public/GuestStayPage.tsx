import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlarmClock, Bed, Bell, Car, CheckCircle2, Clock, Loader2, MessageCircle, Phone, Sparkles, Bath, UtensilsCrossed, Wrench, X, Info, ShowerHead,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelGuestRequest, fetchPublicRoom, sendGuestRequest, unlockRoom, usePublicStay, type PublicStay } from "@/hooks/useRequests";
import { friendlyError } from "@/lib/format";
import { PublicShell } from "./GuestSite";

export const REQUEST_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  towel: ShowerHead, sparkles: Sparkles, bed: Bed, soap: Bath, wrench: Wrench, alarm: AlarmClock, car: Car, clock: Clock,
  utensils: UtensilsCrossed, message: MessageCircle, bell: Bell,
};
const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Sent", cls: "border-slate-300 text-slate-700" },
  acknowledged: { label: "On it", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  done: { label: "Done", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "border-slate-200 text-slate-400" },
};
const KEY = (token: string) => `hoteleasy-stay-${token}`;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

/** /r/:token: the QR code in a room. The guest confirms their last name once. */
export const RoomQrPage = () => {
  const { token = "" } = useParams();
  const nav = useNavigate();
  const [room, setRoom] = useState<Awaited<ReturnType<typeof fetchPublicRoom>> | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const saved = store.get(KEY(token));
    fetchPublicRoom(token).then((r) => {
      setRoom(r);
      if (r) document.title = `${r.hotel} · Room ${r.room}`;
      if (r?.occupied && saved) nav(`/stay/${saved}?r=${token}`, { replace: true });
    }).catch(() => setRoom(null));
  }, [token, nav]);
  if (room === undefined) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  if (!room) return <PublicShell><p className="text-center py-24 text-slate-600">This QR code is not valid. Please ask reception.</p></PublicShell>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await unlockRoom(token, name);
      if (r.key) { store.set(KEY(token), r.key); nav(`/stay/${r.key}?r=${token}`, { replace: true }); }
      else setError(r.error ?? "Please try again");
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  return (
    <PublicShell>
      <Card className="max-w-md mx-auto mt-6">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="text-sm uppercase tracking-wide text-slate-500">{room.hotel}</div>
          <h1 className="gs-display text-3xl">Room {room.room}</h1>
          {!room.occupied ? (
            <p className="text-slate-600">This page works once you've checked in. Please see reception{room.phone ? ` or call ${room.phone}` : ""}.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3 text-left">
              <p className="text-slate-600 text-center">Ask for towels, cleaning, a repair, a taxi and more, straight from your phone.</p>
              <div className="space-y-1"><Label htmlFor="ln">Your last name (as on the booking)</Label>
                <Input id="ln" value={name} onChange={(e) => setName(e.target.value)} autoComplete="family-name" required /></div>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
};

/** /stay/:key: the guest's own page for this stay. */
export const GuestStayPage = () => {
  const { key = "" } = useParams();
  const q = usePublicStay(key);
  const [asking, setAsking] = useState<PublicStay["types"][number] | null>(null);
  const [sent, setSent] = useState("");
  const s = q.data;
  useEffect(() => { if (s) document.title = `${s.hotel.name} · Room ${s.room ?? ""}`; }, [s]);
  if (q.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  if (!s) return <PublicShell><p className="text-center py-24 text-slate-600">This page is for guests during their stay. If you've checked out, thank you for staying with us!</p></PublicShell>;
  const open = s.requests.filter((r) => r.status === "new" || r.status === "acknowledged");
  const past = s.requests.filter((r) => r.status === "done" || r.status === "cancelled").slice(0, 10);
  const RequestRow = ({ r }: { r: PublicStay["requests"][number] }) => (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-1">
        <div className="font-medium text-sm">{r.label}{r.wanted_at ? ` · ${format(parseISO(r.wanted_at), "EEE HH:mm")}` : ""}</div>
        {r.details && <div className="text-xs text-slate-500">{r.details}</div>}
        {r.reply && <div className="text-xs text-blue-700 mt-0.5">Reception: {r.reply}</div>}
        <div className="text-xs text-slate-400">{formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}</div>
      </div>
      <Badge variant="outline" className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
      {r.status === "new" && (
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Cancel ${r.label}`} onClick={async () => {
          try { await cancelGuestRequest(key, r.id); q.refetch(); } catch (e) { alert(friendlyError(e)); }
        }}><X className="h-4 w-4" /></Button>
      )}
    </div>
  );
  return (
    <PublicShell>
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center space-y-1 pt-2">
          <div className="text-sm uppercase tracking-wide text-slate-500">{s.hotel.name}</div>
          <h1 className="gs-display text-3xl">Hello {s.first_name} · Room {s.room}</h1>
          <p className="text-sm text-slate-600">Check-out {format(parseISO(s.check_out), "EEEE d MMMM")} by {s.hotel.checkout_time}{s.plan ? ` · ${s.plan}` : ""}</p>
        </div>
        {sent && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2" role="status"><CheckCircle2 className="h-4 w-4" />{sent}</div>}
        <Card><CardContent className="p-4">
          <div className="font-semibold mb-3">What can we do for you?</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {s.types.map((t) => {
              const Icon = REQUEST_ICONS[t.icon] ?? Bell;
              return (
                <button key={t.id} type="button" onClick={() => setAsking(t)}
                  className="rounded-lg border p-3 flex flex-col items-center gap-2 text-center text-sm hover:bg-muted active:bg-muted min-h-[88px]">
                  <Icon className="h-6 w-6 text-primary" />{t.label}
                </button>
              );
            })}
          </div>
        </CardContent></Card>
        {open.length > 0 && <Card><CardContent className="p-4"><div className="font-semibold">Your requests</div><div className="divide-y">{open.map((r) => <RequestRow key={r.id} r={r} />)}</div></CardContent></Card>}
        {s.hotel.guest_info && <Card><CardContent className="p-4 space-y-1"><div className="font-semibold flex items-center gap-1"><Info className="h-4 w-4" />Good to know</div><div className="text-sm text-slate-700 whitespace-pre-line">{s.hotel.guest_info}</div></CardContent></Card>}
        {past.length > 0 && <Card><CardContent className="p-4"><div className="font-semibold text-sm text-slate-500">Earlier</div><div className="divide-y">{past.map((r) => <RequestRow key={r.id} r={r} />)}</div></CardContent></Card>}
        {s.hotel.phone && <Button variant="outline" className="w-full" asChild><a href={`tel:${s.hotel.phone}`}><Phone className="mr-2 h-4 w-4" />Call reception</a></Button>}
      </div>
      {asking && <AskDialog k={key} t={asking} timezone={s.hotel.timezone} onClose={() => setAsking(null)} onSent={(m) => { setAsking(null); setSent(m); q.refetch(); window.scrollTo(0, 0); }} />}
    </PublicShell>
  );
};

const AskDialog = ({ k, t, onClose, onSent }: { k: string; t: PublicStay["types"][number]; timezone: string; onClose: () => void; onSent: (msg: string) => void }) => {
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needDetails = t.ask_details && t.department === "maintenance";
  const send = async () => {
    setBusy(true); setError("");
    try {
      await sendGuestRequest(k, t.id, details.trim() || null, when ? new Date(when).toISOString() : null);
      onSent(`${t.label}: sent. We'll be with you shortly.`);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t.label}</DialogTitle><DialogDescription>We'll let you know here when it's on the way.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {t.ask_time && <div className="space-y-1"><Label htmlFor="ask-when">When? (optional)</Label><Input id="ask-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>}
          {(t.ask_details || !t.ask_time) && (
            <div className="space-y-1"><Label htmlFor="ask-det">{needDetails ? "What isn't working?" : "Anything to add? (optional)"}</Label>
              <Textarea id="ask-det" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)}
                placeholder={t.icon === "car" ? "Where to, how many people" : t.icon === "utensils" ? "What would you like?" : ""} /></div>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Back</Button>
          <Button disabled={busy || (needDetails && !details.trim())} onClick={send}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send request</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
