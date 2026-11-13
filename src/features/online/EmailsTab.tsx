import { useEffect, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Eye, Mail, RotateCcw, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { fetchEmailPreview, useEmailSettings, useOutbox, useRetryEmail, useSaveEmailSettings, useSendTestEmail } from "@/hooks/useRates";
import { friendlyError } from "@/lib/format";
import type { EmailKind, EmailSettings, OutboxEmail } from "@/lib/db-types";

export const EMAIL_KIND: Record<EmailKind, string> = {
  confirmation: "Booking confirmation", prearrival: "Before arrival", thankyou: "Thank you + review", cancellation: "Cancellation", test: "Test",
};
const STATUS: Record<OutboxEmail["status"], { label: string; cls: string }> = {
  queued: { label: "Waiting", cls: "border-slate-200 text-slate-600" },
  sending: { label: "Sending", cls: "border-blue-200 text-blue-700" },
  sent: { label: "Sent", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  failed: { label: "Failed", cls: "border-red-200 bg-red-50 text-red-700" },
  skipped: { label: "Not sent", cls: "border-slate-200 text-slate-500" },
  cancelled: { label: "Cancelled", cls: "border-slate-200 text-slate-400" },
};

export const EmailsTab = ({ admin }: { admin: boolean }) => {
  const settings = useEmailSettings();
  const outbox = useOutbox();
  const s = settings.data;
  if (settings.isLoading || outbox.isLoading) return <LoadingBlock />;
  const list = outbox.data ?? [];
  const lastSent = list.filter((o) => o.sent_at).sort((a, b) => b.sent_at!.localeCompare(a.sent_at!))[0];
  const stuck = list.filter((o) => o.status === "queued" && Date.parse(o.send_after) < Date.now() - 10 * 60_000).length;
  return (
    <div className="space-y-4">
      {s && !s.enabled ? (
        <Banner tone="amber" icon={<Mail className="h-4 w-4" />}>Guest emails are switched off. {admin ? "Fill in the settings below and switch them on." : "Ask the owner or a manager to switch them on."}</Banner>
      ) : stuck > 0 ? (
        <Banner tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
          {stuck} email{stuck === 1 ? " is" : "s are"} waiting longer than expected. {lastSent ? "Sending may have stopped" : "The email sender hasn't been set up yet"}; see "Setting up sending" in the README, or ask whoever manages your HotelEasy account.
        </Banner>
      ) : lastSent ? (
        <Banner tone="green" icon={<CheckCircle2 className="h-4 w-4" />}>Emails are going out. Last one sent {formatDistanceToNow(parseISO(lastSent.sent_at!), { addSuffix: true })}.</Banner>
      ) : null}
      {s && <SettingsCard s={s} admin={admin} />}
      <Outbox list={list} />
    </div>
  );
};

const Banner = ({ tone, icon, children }: { tone: "amber" | "red" | "green"; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-900" : tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
    <span className="mt-0.5">{icon}</span><span>{children}</span>
  </div>
);

const SettingsCard = ({ s, admin }: { s: EmailSettings; admin: boolean }) => {
  const { hotel } = useCurrentHotel();
  const save = useSaveEmailSettings();
  const test = useSendTestEmail();
  const [f, setF] = useState<EmailSettings>(s);
  const [testTo, setTestTo] = useState(hotel.email ?? "");
  useEffect(() => setF(s), [s]);
  const set = <K extends keyof EmailSettings>(k: K, v: EmailSettings[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(s);
  const origin = window.location.origin;
  const kinds: [keyof EmailSettings, string, string][] = [
    ["send_confirmation", "Booking confirmation", "Straight after a booking is made for a future date, with the online check-in link."],
    ["send_prearrival", "Before arrival", "A few days before the stay, at 9am: arrival details and the check-in link if they haven't checked in online."],
    ["send_thankyou", "Thank you + review", "Three hours after check-out, with the review link (skipped if they've already reviewed)."],
    ["send_cancellation", "Cancellation", "When a confirmed booking is cancelled."],
  ];
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap">
        <div><CardTitle className="text-lg">Guest emails</CardTitle>
          <CardDescription>Sent automatically to guests who have an email address on their booking.</CardDescription></div>
        <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={f.enabled} disabled={!admin} onCheckedChange={(v) => set("enabled", v)} aria-label="Send guest emails" />Send guest emails</label>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="em-from">Sender name</Label><Input id="em-from" disabled={!admin} value={f.from_name ?? ""} placeholder={hotel.name} onChange={(e) => set("from_name", e.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="em-reply">Replies go to</Label><Input id="em-reply" type="email" disabled={!admin} value={f.reply_to ?? ""} placeholder={hotel.email ?? "reservations@yourhotel.co.ke"} onChange={(e) => set("reply_to", e.target.value || null)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="em-url">Links in emails open</Label>
            <div className="flex gap-2"><Input id="em-url" disabled={!admin} value={f.app_url} onChange={(e) => set("app_url", e.target.value)} />
              {admin && f.app_url !== origin && !origin.includes("localhost") && <Button type="button" variant="outline" onClick={() => set("app_url", origin)}>Use this site</Button>}</div></div>
        </div>
        <div className="divide-y rounded-md border">
          {kinds.map(([k, l, d]) => (
            <div key={k} className="flex items-start gap-3 p-3">
              <Switch checked={!!f[k]} disabled={!admin} onCheckedChange={(v) => set(k, v as never)} aria-label={l} className="mt-0.5" />
              <div className="flex-1"><div className="font-medium text-sm">{l}</div><div className="text-xs text-slate-500">{d}</div>
                {k === "send_prearrival" && f.send_prearrival && (
                  <div className="flex items-center gap-2 mt-2 text-sm"><Input type="number" min={1} max={14} className="w-20 h-8" disabled={!admin} value={f.prearrival_days} aria-label="Days before arrival"
                    onChange={(e) => set("prearrival_days", Math.min(14, Math.max(1, Number(e.target.value) || 2)))} />days before arrival</div>
                )}</div>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="em-cn">Extra text in confirmations</Label><Textarea id="em-cn" rows={3} disabled={!admin} value={f.confirmation_note ?? ""} placeholder="e.g. Airport transfers available on request." onChange={(e) => set("confirmation_note", e.target.value || null)} /></div>
          <div className="space-y-1"><Label htmlFor="em-pn">Extra text before arrival</Label><Textarea id="em-pn" rows={3} disabled={!admin} value={f.prearrival_note ?? ""} placeholder="Directions, parking, what to bring…" onChange={(e) => set("prearrival_note", e.target.value || null)} /></div>
        </div>
        {admin && (
          <div className="flex flex-wrap items-end gap-2 justify-between">
            <div className="flex items-end gap-2">
              <div className="space-y-1"><Label htmlFor="em-test">Send a test to</Label><Input id="em-test" type="email" className="w-64" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></div>
              <Button variant="outline" disabled={!testTo || test.isPending} onClick={() => test.mutate(testTo)}><Send className="mr-1 h-4 w-4" />Send test</Button>
            </div>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(f)}>Save email settings</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Outbox = ({ list }: { list: OutboxEmail[] }) => {
  const retry = useRetryEmail();
  const [preview, setPreview] = useState<{ title: string; html?: string; subject?: string; error?: string } | null>(null);
  const show = async (o: OutboxEmail) => {
    if (!o.reservation_id) return;
    try {
      const p = await fetchEmailPreview(o.reservation_id, o.kind);
      setPreview({ title: `${EMAIL_KIND[o.kind]} · ${o.reservations?.code ?? ""}`, html: p.html, subject: p.subject, error: p.skip });
    } catch (e) { setPreview({ title: EMAIL_KIND[o.kind], error: friendlyError(e) }); }
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Email log</CardTitle><CardDescription>Waiting, sent and skipped emails, newest first.</CardDescription></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {!list.length ? <EmptyState icon={Mail} title="No emails yet">They appear here when bookings are made.</EmptyState> : (
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Email</TableHead><TableHead>Guest</TableHead><TableHead>Status</TableHead><TableHead className="text-right" /></TableRow></TableHeader>
            <TableBody>
              {list.map((o) => {
                const g = o.reservations?.guests;
                const when = o.sent_at ?? o.send_after;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-sm">{format(parseISO(when), "d MMM HH:mm")}{o.status === "queued" && Date.parse(o.send_after) > Date.now() && <div className="text-xs text-slate-500">scheduled</div>}</TableCell>
                    <TableCell><div className="text-sm font-medium">{EMAIL_KIND[o.kind]}</div>{o.subject && <div className="text-xs text-slate-500 truncate max-w-[260px]">{o.subject}</div>}</TableCell>
                    <TableCell className="text-sm">{g ? `${g.first_name} ${g.last_name}` : "—"}<div className="text-xs text-slate-500">{o.to_email ?? g?.email ?? "no email address"}{o.reservations ? ` · ${o.reservations.code}` : ""}</div></TableCell>
                    <TableCell><Badge variant="outline" className={STATUS[o.status].cls}>{STATUS[o.status].label}</Badge>{o.last_error && <div className="text-xs text-slate-500 mt-1 max-w-[220px]">{o.last_error}</div>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {o.reservation_id && <Button size="sm" variant="ghost" onClick={() => show(o)} aria-label={`Preview ${EMAIL_KIND[o.kind]} for ${g?.first_name ?? ""}`}><Eye className="h-4 w-4" /></Button>}
                      {(o.status === "failed" || o.status === "skipped" || (o.status === "sent" && o.kind !== "test")) && (
                        <Button size="sm" variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(o.id)}><RotateCcw className="mr-1 h-4 w-4" />{o.status === "sent" ? "Send again" : "Try again"}</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {preview && (
        <Dialog open onOpenChange={(v) => !v && setPreview(null)}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{preview.title}</DialogTitle>{preview.subject && <DialogDescription>Subject: {preview.subject}</DialogDescription>}</DialogHeader>
            {preview.error ? <p className="text-sm text-slate-600">{preview.error}</p>
              : <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[60vh] rounded border bg-white" />}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
