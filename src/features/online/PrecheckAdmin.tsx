import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ClipboardCheck, Copy, Crown, FileSignature, LogIn, Mail, MessageCircle, Printer, Search, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { precheckOf, useAcceptPrecheck, useArrivalsPrecheck, useSaveHouseRules, type Arrival, type Precheck } from "@/hooks/useOnline";
import { addDays, todayIn } from "@/lib/format";
import { usePrecheckShare } from "./precheckShare";
import type { Reservation } from "@/lib/db-types";
import { CheckInDialog } from "../reservations/ReservationsPage";
import { PURPOSES } from "../public/PrecheckPage";

type Range = "today" | "week" | "month";
type Stage = "checked_in" | "accepted" | "review" | "sent" | "not_sent";
const STAGE: Record<Stage, { label: string; cls: string }> = {
  checked_in: { label: "Checked in", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  accepted: { label: "Ready: details accepted", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  review: { label: "Filled in: please review", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  sent: { label: "Link sent", cls: "border-slate-200 text-slate-600" },
  not_sent: { label: "Not sent yet", cls: "border-slate-200 text-slate-400" },
};
export const stageOf = (a: Arrival): Stage => {
  const p = precheckOf(a);
  if (a.status === "checked_in") return "checked_in";
  if (p?.reviewed_at) return "accepted";
  if (p?.submitted_at) return "review";
  if (p?.shared_at) return "sent";
  return "not_sent";
};
const guestLabel = (a: Arrival) => `${a.guests?.first_name ?? ""} ${a.guests?.last_name ?? ""}`.trim();

const PrecheckAdmin = () => {
  const { hotel, can } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [range, setRange] = useState<Range>("week");
  const [search, setSearch] = useState("");
  const to = range === "today" ? today : addDays(today, range === "week" ? 7 : 30);
  const q = useArrivalsPrecheck(addDays(today, -3), to);
  const share = usePrecheckShare();
  const [reviewing, setReviewing] = useState<Arrival | null>(null);
  const [checkingInId, setCheckingIn] = useState<string | null>(null);
  const checkingIn = (q.data ?? []).find((a) => a.id === checkingInId) ?? null;

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((a) => (a.status === "confirmed") || (a.status === "checked_in" && a.check_in >= addDays(today, -1)))
      .filter((a) => !s || [a.code, guestLabel(a), a.guests?.phone].some((v) => v?.toLowerCase().includes(s)));
  }, [q.data, search, today]);
  const count = (st: Stage) => rows.filter((a) => stageOf(a) === st).length;
  const pending = rows.filter((a) => a.status === "confirmed");

  return (
    <div className="space-y-4">
      <PageHeader title="Online check-in" subtitle="Guests fill in the register and sign the registration card on their phone before they arrive" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Arriving", pending.length, "text-slate-900"], ["Filled in, to review", count("review"), "text-amber-700"],
          ["Ready to check in", count("accepted"), "text-blue-700"], ["Link not sent", count("not_sent"), "text-slate-500"]].map(([l, v, c]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-sm text-slate-500">{l}</div><div className={`text-3xl font-bold tabular-nums ${c}`}>{v}</div></CardContent></Card>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList><TabsTrigger value="today">Today</TabsTrigger><TabsTrigger value="week">Next 7 days</TabsTrigger><TabsTrigger value="month">Next 30 days</TabsTrigger></TabsList>
        </Tabs>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, phone or booking code" className="pl-9" />
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {q.isLoading ? <LoadingBlock /> : !rows.length ? (
            <EmptyState icon={Smartphone} title="No arrivals in this period">Every confirmed booking gets its own check-in link. Send it a day or two before the guest arrives.</EmptyState>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead>Arrival</TableHead><TableHead>Room</TableHead><TableHead>Online check-in</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => {
                  const p = precheckOf(a); const st = stageOf(a);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1">{guestLabel(a)}{a.guests?.is_vip && <Crown className="h-4 w-4 text-amber-500" />}</div>
                        <div className="text-xs text-slate-500">{a.code}{a.guests?.phone ? ` · ${a.guests.phone}` : ""}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className={a.status === "confirmed" && a.check_in < today ? "text-red-600" : ""}>{a.check_in === today ? "Today" : format(parseISO(a.check_in), "EEE d MMM")}</div>
                        <div className="text-xs text-slate-500">{p?.arrival_time ? `about ${p.arrival_time} · ` : ""}{a.nights} night{a.nights === 1 ? "" : "s"} · {a.adults + a.children} guest{a.adults + a.children === 1 ? "" : "s"}</div>
                      </TableCell>
                      <TableCell>{a.rooms ? <span className="font-medium">{a.rooms.room_number}</span> : <span className="text-amber-700 text-sm">Not assigned</span>}<div className="text-xs text-slate-500">{a.room_types?.name}</div></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STAGE[st].cls}>{STAGE[st].label}</Badge>
                        {p?.shared_at && st === "sent" && <div className="text-xs text-slate-500 mt-1">{format(parseISO(p.shared_at), "d MMM HH:mm")}</div>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {a.status === "confirmed" && (st === "not_sent" || st === "sent") && <>
                          <Button size="sm" variant="outline" disabled={!a.guests?.phone} onClick={() => share(a, "wa")} aria-label={`WhatsApp check-in link to ${guestLabel(a)}`}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
                          <Button size="sm" variant="ghost" disabled={!a.guests?.email} onClick={() => share(a, "mail")} aria-label={`Email check-in link to ${guestLabel(a)}`}><Mail className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => share(a, "copy")} aria-label={`Copy check-in link for ${guestLabel(a)}`}><Copy className="h-4 w-4" /></Button>
                        </>}
                        {st === "review" && <Button size="sm" onClick={() => setReviewing(a)}><ClipboardCheck className="mr-1 h-4 w-4" />Review</Button>}
                        {st === "accepted" && <Button size="sm" variant="ghost" onClick={() => setReviewing(a)}>Details</Button>}
                        {can("owner", "manager", "front_desk") && a.status === "confirmed" && a.check_in <= today && st !== "review" && (
                          <Button size="sm" className="ml-1 bg-green-600 hover:bg-green-700" onClick={() => setCheckingIn(a.id)}><LogIn className="mr-1 h-4 w-4" />Check in</Button>
                        )}
                        <Button size="sm" variant="ghost" asChild aria-label={`Registration card for ${guestLabel(a)}`}><a href={`/reg-card/${a.id}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /></a></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {can("owner", "manager") && <HouseRules />}
      {reviewing && <ReviewDialog a={reviewing} today={today} onClose={() => setReviewing(null)} onCheckIn={() => { const id = reviewing.id; setReviewing(null); setTimeout(() => setCheckingIn(id), 250); }} />}
      {checkingIn && <CheckInDialog reservation={checkingIn as unknown as Reservation} onClose={() => setCheckingIn(null)} />}
    </div>
  );
};
export default PrecheckAdmin;

// ---------------------------------------------------------------- review
const ROWS: [keyof Precheck, string, keyof NonNullable<Arrival["guests"]> | null][] = [
  ["first_name", "First name", "first_name"], ["last_name", "Last name", "last_name"], ["phone", "Phone", "phone"], ["email", "Email", "email"],
  ["nationality", "Nationality", "nationality"], ["id_type", "Document", "id_type"], ["id_number", "Number", "id_number"],
  ["date_of_birth", "Date of birth", null], ["residence", "Lives in", null], ["address", "Address", null],
];

const ReviewDialog = ({ a, today, onClose, onCheckIn }: { a: Arrival; today: string; onClose: () => void; onCheckIn: () => void }) => {
  const p = precheckOf(a)!;
  const accept = useAcceptPrecheck();
  const done = !!p.reviewed_at;
  const canCheckIn = a.status === "confirmed" && a.check_in <= today;
  const go = (thenCheckIn: boolean) => accept.mutate(p.id, { onSuccess: () => (thenCheckIn ? onCheckIn() : onClose()) });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Online check-in: {p.first_name} {p.last_name}</DialogTitle>
          <DialogDescription>{a.code} · {format(parseISO(a.check_in), "EEE d MMM")} → {format(parseISO(a.check_out), "EEE d MMM")} · sent {p.submitted_at && format(parseISO(p.submitted_at), "d MMM HH:mm")}</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead /><TableHead>From the guest</TableHead><TableHead>On file now</TableHead></TableRow></TableHeader>
          <TableBody>
            {ROWS.map(([k, l, gk]) => {
              const mine = (p[k] as string | null) ?? ""; const file = gk ? ((a.guests?.[gk] as string | null) ?? "") : "";
              const changed = !!gk && !done && mine !== file && !!mine;
              return (
                <TableRow key={k}><TableCell className="text-slate-500 text-sm py-1.5">{l}</TableCell>
                  <TableCell className={`py-1.5 font-medium ${changed ? "bg-amber-50" : ""}`}>{mine || "—"}</TableCell>
                  <TableCell className="py-1.5 text-slate-500">{gk ? file || "—" : ""}</TableCell></TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-semibold">Trip</div>
            <div>Arriving: {p.arrival_time ?? "not given"}</div>
            {p.purpose && <div>Reason: {PURPOSES[p.purpose] ?? p.purpose}</div>}
            {(p.coming_from || p.going_to) && <div>{p.coming_from ?? "?"} → {p.going_to ?? "?"}</div>}
            {p.vehicle_reg && <div>Car: {p.vehicle_reg}</div>}
            {p.requests && <div className="text-blue-700">“{p.requests}”</div>}
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <div className="font-semibold">Other guests ({(p.companions ?? []).length})</div>
            {(p.companions ?? []).map((c, i) => <div key={i}>{c.name}{c.id_number ? ` · ${c.id_number}` : ""}</div>)}
            {!(p.companions ?? []).length && <div className="text-slate-500">None listed ({a.adults + a.children} booked)</div>}
          </div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-semibold mb-1 flex items-center gap-1"><FileSignature className="h-4 w-4" />Signed by {p.signed_name} {p.accepted_at && `on ${format(parseISO(p.accepted_at), "d MMM yyyy HH:mm")}`}</div>
          {p.signature && <img src={p.signature} alt={`Signature of ${p.signed_name}`} className="max-h-24 bg-white" />}
        </div>
        <p className="text-xs text-slate-500">Check the guest's {p.id_type?.toLowerCase() ?? "ID"} against the number above when they arrive. Accepting copies these details onto the guest record and adds the arrival time and requests to the booking.</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" asChild><a href={`/reg-card/${a.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Registration card</a></Button>
          {!done && <Button variant={canCheckIn ? "outline" : "default"} disabled={accept.isPending} onClick={() => go(false)}><Check className="mr-1 h-4 w-4" />Accept details</Button>}
          {!done && canCheckIn && <Button className="bg-green-600 hover:bg-green-700" disabled={accept.isPending} onClick={() => go(true)}><LogIn className="mr-1 h-4 w-4" />Accept and check in</Button>}
          {done && <Button onClick={onClose}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- house rules
const HouseRules = () => {
  const { hotel } = useCurrentHotel();
  const save = useSaveHouseRules();
  const [v, setV] = useState(hotel.house_rules ?? "");
  useEffect(() => setV(hotel.house_rules ?? ""), [hotel.house_rules]);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">House rules on the registration card</CardTitle>
        <CardDescription>Guests read these before they sign, online and on the printed card. Your booking page policies are shown too.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor="house-rules" className="sr-only">House rules</Label>
        <Textarea id="house-rules" rows={5} value={v} onChange={(e) => setV(e.target.value)} maxLength={4000}
          placeholder={"Check-in from 14:00, check-out by 11:00.\nNo smoking in rooms (KES 5,000 cleaning fee).\nVisitors must register at reception and leave by 22:00.\nThe hotel is not responsible for valuables not left in the safe."} />
        <div className="flex justify-end"><Button size="sm" disabled={save.isPending || v === (hotel.house_rules ?? "")} onClick={() => save.mutate(v)}>Save house rules</Button></div>
      </CardContent>
    </Card>
  );
};
