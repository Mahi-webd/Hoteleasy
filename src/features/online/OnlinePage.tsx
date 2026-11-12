import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Copy, ExternalLink, Globe, Mail, MessageCircle, MessageSquareReply, Star } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRoomTypes } from "@/hooks/useHotelQueries";
import {
  getFeedbackLink, useBookingSettings, useFeedback, useOnlineBookings, useSaveBookingSettings, useSaveRoomTypeOnline, useUpdateFeedback, waNumber,
} from "@/hooks/useOnline";
import { RES_STATUS, formatDate, formatMoney, friendlyError } from "@/lib/format";
import type { BookingSettings, GuestFeedback, ReservationStatus, RoomType } from "@/lib/db-types";

const copy = async (text: string, what = "Link") => {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Could not copy; select and copy it yourself"); }
};

const OnlinePage = () => {
  const { can } = useCurrentHotel();
  const admin = can("owner", "manager");
  const settings = useBookingSettings();
  const [tab, setTab] = useState("bookings");
  if (settings.isLoading) return <LoadingBlock />;
  const s = settings.data;
  const url = s ? `${window.location.origin}/book/${s.slug}` : "";

  return (
    <div className="space-y-4">
      <PageHeader title="Online booking & reviews" subtitle="Your public booking page, bookings it brings in, and what guests say after their stay"
        actions={s?.enabled ? (
          <>
            <Button variant="outline" onClick={() => copy(url)}><Copy className="mr-2 h-4 w-4" />Copy booking link</Button>
            <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open page</a></Button>
          </>
        ) : null} />
      {s && !s.enabled && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex flex-wrap items-center gap-3">
          <Globe className="h-4 w-4 text-amber-700" />
          <span className="flex-1">Your booking page is switched off. {admin ? "Fill in the details under Setup and switch it on." : "Ask the owner or a manager to switch it on."}</span>
          {admin && <Button size="sm" onClick={() => setTab("setup")}>Set it up</Button>}
        </div>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bookings">Online bookings</TabsTrigger>
          <TabsTrigger value="reviews">Guest reviews</TabsTrigger>
          {admin && <TabsTrigger value="setup">Setup</TabsTrigger>}
        </TabsList>
        <TabsContent value="bookings"><Bookings /></TabsContent>
        <TabsContent value="reviews"><Reviews canReply={admin} /></TabsContent>
        {admin && s && <TabsContent value="setup"><Setup s={s} url={url} /></TabsContent>}
      </Tabs>
    </div>
  );
};
export default OnlinePage;

// ---------------------------------------------------------------- bookings
const Bookings = () => {
  const { hotel } = useCurrentHotel();
  const b = useOnlineBookings();
  if (b.isLoading) return <LoadingBlock />;
  const rows = b.data ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Bookings made on your page</CardTitle>
        <CardDescription>They also appear in Reservations, marked "Website", without a room. Assign a room when the guest arrives.</CardDescription></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Booked</TableHead><TableHead>Code</TableHead><TableHead>Guest</TableHead><TableHead>Room type</TableHead>
            <TableHead>Stay</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-sm">{format(parseISO(r.created_at), "d MMM HH:mm")}</TableCell>
                <TableCell className="font-mono text-sm">{r.code}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.guests?.first_name} {r.guests?.last_name}</div>
                  <div className="text-xs text-slate-500 flex gap-2">
                    {r.guests?.phone && <a className="underline" href={`https://wa.me/${waNumber(r.guests.phone)}`} target="_blank" rel="noreferrer">{r.guests.phone}</a>}
                    {r.guests?.email && <a className="underline" href={`mailto:${r.guests.email}`}>{r.guests.email}</a>}
                  </div>
                  {r.special_requests && <div className="text-xs text-slate-600 mt-1">“{r.special_requests}”</div>}
                </TableCell>
                <TableCell>{r.room_types?.name}<div className="text-xs text-slate-500">{r.adults + r.children} guest{r.adults + r.children === 1 ? "" : "s"}</div></TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.check_in)} – {formatDate(r.check_out)}</TableCell>
                <TableCell><Badge variant="outline" className={RES_STATUS[r.status as ReservationStatus]?.className}>{RES_STATUS[r.status as ReservationStatus]?.label ?? r.status}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(Number(r.total_amount), hotel.currency)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7}><EmptyState icon={Globe} title="No online bookings yet">Share your booking link on your website, Google profile, Instagram and WhatsApp.</EmptyState></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- reviews
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

const StarsRow = ({ value }: { value: number }) => (
  <span className="inline-flex" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />)}
  </span>
);

const Reviews = ({ canReply }: { canReply: boolean }) => {
  const { hotel } = useCurrentHotel();
  const fb = useFeedback();
  const upd = useUpdateFeedback();
  const [reply, setReply] = useState<GuestFeedback | null>(null);
  const [filter, setFilter] = useState<"all" | "low">("all");
  const list = fb.data ?? [];
  const done = list.filter((f) => f.submitted_at);
  const waiting = list.filter((f) => !f.submitted_at && new Date(f.expires_at) > new Date())
    .sort((a, b) => (b.reservations?.check_out ?? "").localeCompare(a.reservations?.check_out ?? ""));
  const [more, setMore] = useState(false);
  const stats = useMemo(() => {
    const rec = done.map((f) => f.recommend).filter((x): x is number => x != null);
    const nps = rec.length ? Math.round(((rec.filter((x) => x >= 9).length - rec.filter((x) => x <= 6).length) / rec.length) * 100) : null;
    return {
      overall: avg(done.map((f) => f.overall)), nps,
      sent: list.filter((f) => f.shared_at).length, answered: list.filter((f) => f.shared_at && f.submitted_at).length,
      parts: [["Cleanliness", avg(done.map((f) => f.cleanliness))], ["Service", avg(done.map((f) => f.service))], ["Comfort", avg(done.map((f) => f.comfort))],
        ["Food & drinks", avg(done.map((f) => f.food))], ["Value", avg(done.map((f) => f.value))]] as [string, number | null][],
    };
  }, [done, list.length]);
  if (fb.isLoading) return <LoadingBlock />;
  const shown = filter === "low" ? done.filter((f) => (f.overall ?? 5) <= 3) : done;

  const share = async (f: GuestFeedback, how: "wa" | "mail" | "copy") => {
    try {
      const link = await getFeedbackLink(f.reservation_id);
      const g = f.reservations?.guests;
      const msg = `Hello ${g?.first_name ?? ""}, thank you for staying at ${hotel.name}. We'd love to hear how it went; it takes a minute: ${link}`;
      if (how === "wa") window.open(`https://wa.me/${waNumber(g?.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
      else if (how === "mail") window.location.href = `mailto:${g?.email ?? ""}?subject=${encodeURIComponent(`Your stay at ${hotel.name}`)}&body=${encodeURIComponent(msg)}`;
      else await copy(link);
      if (!f.shared_at) upd.mutate({ id: f.id, shared_at: new Date().toISOString() });
    } catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Average rating</div>
          <div className="text-2xl font-bold">{stats.overall ? stats.overall.toFixed(1) : "—"}<span className="text-base text-slate-500"> / 5</span></div>
          <div className="text-xs text-slate-500">{done.length} review{done.length === 1 ? "" : "s"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Would recommend (NPS)</div>
          <div className="text-2xl font-bold">{stats.nps ?? "—"}</div><div className="text-xs text-slate-500">from −100 to +100</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Guests who answered</div>
          <div className="text-2xl font-bold">{stats.sent ? `${Math.round((stats.answered / stats.sent) * 100)}%` : "—"}</div>
          <div className="text-xs text-slate-500">{stats.sent ? `${stats.answered} of ${stats.sent} links you sent` : "Send links to see this"}</div></CardContent></Card>
        <Card><CardContent className="p-4 space-y-0.5 text-sm">
          {stats.parts.filter(([, v]) => v != null).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium">{v!.toFixed(1)}</span></div>)}
          {stats.parts.every(([, v]) => v == null) && <span className="text-slate-500">Category scores appear here</span>}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div><CardTitle className="text-lg">Reviews</CardTitle>
            <CardDescription>{canReply ? "Reply to guests, and choose which reviews appear on your booking page (only if the guest agreed)." : "Owners and managers reply to reviews."}</CardDescription></div>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>All</Button>
            <Button size="sm" variant={filter === "low" ? "secondary" : "ghost"} onClick={() => setFilter("low")}>3 stars or less</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {shown.map((f) => (
            <div key={f.id} className={`rounded-lg border p-4 space-y-2 ${(f.overall ?? 5) <= 2 ? "border-red-200 bg-red-50/40 dark:bg-red-950/20" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StarsRow value={f.overall ?? 0} />
                <span className="font-medium">{f.reservations?.guests?.first_name} {f.reservations?.guests?.last_name}</span>
                <span className="text-xs text-slate-500">{f.submitted_at && format(parseISO(f.submitted_at), "d MMM yyyy")} · stay {formatDate(f.reservations?.check_in)}{f.reservations?.rooms?.room_number ? ` · Room ${f.reservations.rooms.room_number}` : ""}</span>
                {f.recommend != null && <Badge variant="outline">Recommend {f.recommend}/10</Badge>}
                <span className="ml-auto flex items-center gap-2">
                  {f.consent_publish ? (
                    canReply ? (
                      <label className="flex items-center gap-2 text-xs"><Switch checked={f.published} onCheckedChange={(v) => upd.mutate({ id: f.id, published: v })} aria-label="Show on booking page" />Show on booking page</label>
                    ) : f.published && <Badge variant="secondary">On booking page</Badge>
                  ) : <span className="text-xs text-slate-500">Private (guest didn't agree to publish)</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                {([["Cleanliness", f.cleanliness], ["Service", f.service], ["Comfort", f.comfort], ["Food", f.food], ["Value", f.value]] as [string, number | null][])
                  .filter(([, v]) => v != null).map(([k, v]) => <span key={k}>{k} {v}/5</span>)}
              </div>
              {f.comment && <p className="text-sm whitespace-pre-line">{f.comment}</p>}
              {f.response && <p className="text-sm text-slate-600 border-l-2 pl-3"><b>Your reply:</b> {f.response}</p>}
              {canReply && <Button size="sm" variant="ghost" onClick={() => setReply(f)}><MessageSquareReply className="mr-1 h-4 w-4" />{f.response ? "Edit reply" : "Reply"}</Button>}
            </div>
          ))}
          {!shown.length && <EmptyState icon={Star} title={filter === "low" ? "No low ratings" : "No reviews yet"}>{filter === "all" && "Send feedback links to guests after check-out; their reviews appear here."}</EmptyState>}
        </CardContent>
      </Card>
      {waiting.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Ask for feedback</CardTitle>
            <CardDescription>Guests who checked out recently. Send each one their private link; the best time is the day they leave.</CardDescription></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead>Sent</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {waiting.slice(0, more ? 60 : 8).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.reservations?.guests?.first_name} {f.reservations?.guests?.last_name}
                      {f.reservations?.rooms?.room_number && <span className="text-xs text-slate-500"> · Room {f.reservations.rooms.room_number}</span>}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(f.reservations?.check_in)} – {formatDate(f.reservations?.check_out)}</TableCell>
                    <TableCell>{f.shared_at ? <Badge variant="secondary">Sent {format(parseISO(f.shared_at), "d MMM")}</Badge> : <span className="text-slate-500 text-sm">Not yet</span>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" disabled={!f.reservations?.guests?.phone} onClick={() => share(f, "wa")} aria-label={`WhatsApp feedback link to ${f.reservations?.guests?.first_name}`}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
                      <Button size="sm" variant="ghost" disabled={!f.reservations?.guests?.email} onClick={() => share(f, "mail")} aria-label="Email feedback link"><Mail className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => share(f, "copy")} aria-label="Copy feedback link"><Copy className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {waiting.length > 8 && <div className="p-3 text-center"><Button size="sm" variant="ghost" onClick={() => setMore(!more)}>{more ? "Show fewer" : `Show more (${waiting.length - 8})`}</Button></div>}
          </CardContent>
        </Card>
      )}

      {reply && <ReplyDialog f={reply} onClose={() => setReply(null)} />}
    </div>
  );
};

const ReplyDialog = ({ f, onClose }: { f: GuestFeedback; onClose: () => void }) => {
  const upd = useUpdateFeedback();
  const [text, setText] = useState(f.response ?? "");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reply to {f.reservations?.guests?.first_name}</DialogTitle></DialogHeader>
        {f.comment && <p className="text-sm text-slate-600 border-l-2 pl-3">{f.comment}</p>}
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} aria-label="Reply" placeholder="Thank the guest and say what you are doing about any problem." />
        <p className="text-xs text-slate-500">If the review is shown on your booking page, your reply is shown under it.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={upd.isPending} onClick={() => upd.mutate({ id: f.id, response: text.trim() || null }, { onSuccess: onClose })}>Save reply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- setup
const Setup = ({ s, url }: { s: BookingSettings; url: string }) => {
  const save = useSaveBookingSettings();
  const types = useRoomTypes();
  const [f, setF] = useState<BookingSettings>(s);
  useEffect(() => setF(s), [s]);
  const set = <K extends keyof BookingSettings>(k: K, v: BookingSettings[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (v: string) => (v.trim() ? v : null);
  const embed = `<a href="${url}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#fff;border-radius:8px;font:600 16px system-ui;text-decoration:none">Book now</a>`;

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <Card>
        <CardHeader><CardTitle className="text-lg">Booking page</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 rounded-md border p-3">
            <Switch checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="Booking page on" />
            <span><span className="font-medium">{f.enabled ? "Taking bookings online" : "Switched off"}</span>
              <span className="block text-xs text-slate-500">Bookings arrive as confirmed reservations. Guests pay at the hotel.</span></span>
          </label>
          <div className="space-y-1">
            <Label htmlFor="bs-slug">Page address</Label>
            <div className="flex items-center gap-1 text-sm"><span className="text-slate-500 whitespace-nowrap">{window.location.origin}/book/</span>
              <Input id="bs-slug" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
            <p className="text-xs text-slate-500">Lowercase letters, numbers and dashes. Changing it breaks links you have already shared.</p>
          </div>
          <div className="space-y-1"><Label htmlFor="bs-head">Headline</Label><Input id="bs-head" value={f.headline ?? ""} onChange={(e) => set("headline", e.target.value)} placeholder="Riverside cottages 10 minutes from the Mara gate" /></div>
          <div className="space-y-1"><Label htmlFor="bs-desc">About the hotel</Label><Textarea id="bs-desc" rows={4} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bs-photo">Main photo link (https://…)</Label><Input id="bs-photo" value={f.photo_url ?? ""} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…/hotel.jpg" />
            <p className="text-xs text-slate-500">Paste the link of a photo already online (your website, Google Photos shared link, Instagram image link).</p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="bs-wa">WhatsApp number</Label><Input id="bs-wa" value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="0712 345 678" /></div>
            <div className="space-y-1"><Label htmlFor="bs-cancel">Free online cancellation until (days before arrival)</Label>
              <Input id="bs-cancel" type="number" min={0} max={60} value={f.free_cancel_days ?? ""} placeholder="Blank = guests must call"
                onChange={(e) => set("free_cancel_days", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="bs-min">Minimum nights</Label><Input id="bs-min" type="number" min={1} max={30} value={f.min_nights} onChange={(e) => set("min_nights", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="bs-max">Maximum nights</Label><Input id="bs-max" type="number" min={1} max={90} value={f.max_nights} onChange={(e) => set("max_nights", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="bs-adv">Book up to (days ahead)</Label><Input id="bs-adv" type="number" min={1} max={730} value={f.max_advance_days} onChange={(e) => set("max_advance_days", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="bs-cut">Same-day bookings close at</Label><Input id="bs-cut" type="time" value={f.same_day_cutoff?.slice(0, 5)} onChange={(e) => set("same_day_cutoff", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="bs-pay">Payment instructions (shown after booking)</Label><Textarea id="bs-pay" rows={3} value={f.payment_instructions ?? ""} onChange={(e) => set("payment_instructions", e.target.value)}
            placeholder="Pay on arrival by cash, card or M-Pesa. To secure your room, pay a deposit to Paybill 123456, account = your booking code." /></div>
          <div className="space-y-1"><Label htmlFor="bs-pol">House rules and policies</Label><Textarea id="bs-pol" rows={3} value={f.policies ?? ""} onChange={(e) => set("policies", e.target.value)} placeholder="No smoking in rooms. Children under 5 stay free. ID required at check-in." /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.show_reviews} onCheckedChange={(v) => set("show_reviews", v)} />Show guest reviews you have chosen on the page</label>
          <div className="flex justify-end">
            <Button disabled={save.isPending} onClick={() => save.mutate({
              enabled: f.enabled, slug: f.slug.replace(/^-+|-+$/g, ""), headline: text(f.headline ?? ""), description: text(f.description ?? ""), photo_url: text(f.photo_url ?? ""),
              whatsapp: text(f.whatsapp ?? ""), free_cancel_days: f.free_cancel_days, min_nights: f.min_nights, max_nights: f.max_nights, max_advance_days: f.max_advance_days,
              same_day_cutoff: f.same_day_cutoff, payment_instructions: text(f.payment_instructions ?? ""), policies: text(f.policies ?? ""), show_reviews: f.show_reviews,
            })}>Save</Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Share your page</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2"><Input readOnly value={url} aria-label="Booking link" /><Button variant="outline" size="icon" onClick={() => copy(url)} aria-label="Copy booking link"><Copy className="h-4 w-4" /></Button></div>
            <p className="text-slate-500">Put it on your Google Business profile, Instagram bio, Facebook page and WhatsApp Business.</p>
            <Label>“Book now” button for your website</Label>
            <Textarea readOnly rows={4} value={embed} className="font-mono text-xs" aria-label="Website button code" />
            <Button variant="outline" size="sm" onClick={() => copy(embed, "Button code")}><Copy className="mr-1 h-4 w-4" />Copy button code</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Rooms offered online</CardTitle>
            <CardDescription>Room types need at least one room. Leave the online price empty to use the normal rate.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {(types.data ?? []).map((t) => <RoomTypeOnline key={t.id} t={t} />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const RoomTypeOnline = ({ t }: { t: RoomType }) => {
  const save = useSaveRoomTypeOnline();
  const { hotel } = useCurrentHotel();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState(t.photo_url ?? "");
  const [rate, setRate] = useState(t.online_rate != null ? String(t.online_rate) : "");
  const [desc, setDesc] = useState(t.description ?? "");
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-medium">{t.name}</div><div className="text-xs text-slate-500">{formatMoney(Number(t.online_rate ?? t.base_rate), hotel.currency)} a night online</div></div>
        <div className="flex items-center gap-2">
          <Switch checked={t.online_bookable ?? true} onCheckedChange={(v) => save.mutate({ id: t.id, online_bookable: v })} aria-label={`Offer ${t.name} online`} />
          <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</Button>
        </div>
      </div>
      {open && (
        <div className="space-y-2">
          <div className="space-y-1"><Label htmlFor={`rt-rate-${t.id}`} className="text-xs">Online price per night (normal rate {formatMoney(Number(t.base_rate), "")})</Label>
            <Input id={`rt-rate-${t.id}`} type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Same as normal rate" /></div>
          <div className="space-y-1"><Label htmlFor={`rt-photo-${t.id}`} className="text-xs">Photo link (https://…)</Label><Input id={`rt-photo-${t.id}`} value={photo} onChange={(e) => setPhoto(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor={`rt-desc-${t.id}`} className="text-xs">Description</Label><Textarea id={`rt-desc-${t.id}`} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: t.id, online_rate: rate === "" ? null : Number(rate), photo_url: photo.trim() || null, description: desc.trim() || null }, { onSuccess: () => setOpen(false) })}>Save</Button>
        </div>
      )}
    </div>
  );
};
