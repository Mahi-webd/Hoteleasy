import { useMemo, useState } from "react";
import { Crown, FileText, Printer, Receipt, Search, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import { useInvoices, useOpenAccounts, usePaymentsBetween, type ReservationMini } from "@/hooks/useBilling";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { PAYMENT_METHODS, RES_STATUS, addDays, formatDate, formatMoney, formatMoney2, formatShortDate, guestName, todayIn } from "@/lib/format";
import type { PaymentMethod } from "@/lib/db-types";
import { FolioDialog } from "./FolioDialog";

/** Start of a day in the hotel's time zone, as an ISO instant. Nairobi has no DST. */
const dayStartIso = (day: string, tz: string) => {
  const probe = new Date(`${day}T12:00:00Z`);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = local.getTime() - probe.getTime();
  return new Date(new Date(`${day}T00:00:00Z`).getTime() - offsetMs).toISOString();
};

const BillingPage = () => {
  const { hotel } = useCurrentHotel();
  const [open, setOpen] = useState<ReservationMini | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Payments" subtitle="Guest bills, money received and invoices" />
      <Tabs defaultValue="open">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="open"><Receipt className="mr-1 h-4 w-4" />Open bills</TabsTrigger>
          <TabsTrigger value="cashup"><Wallet className="mr-1 h-4 w-4" />Payments & cash-up</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="mr-1 h-4 w-4" />Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="open"><OpenBills currency={hotel.currency} onOpen={setOpen} /></TabsContent>
        <TabsContent value="cashup"><CashUp /></TabsContent>
        <TabsContent value="invoices"><InvoiceList /></TabsContent>
      </Tabs>
      {open && <FolioDialog reservation={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

const OpenBills = ({ currency, onOpen }: { currency: string; onOpen: (r: ReservationMini) => void }) => {
  const accounts = useOpenAccounts();
  const [search, setSearch] = useState("");
  const rows = (accounts.data ?? [])
    .filter(({ reservation: r }) => {
      const q = search.trim().toLowerCase();
      return !q || [r.code, guestName(r.guests), r.rooms?.room_number].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => Number(b.balance.balance) - Number(a.balance.balance));
  const inHouse = rows.filter((x) => x.reservation.status === "checked_in");
  const owing = rows.filter((x) => x.reservation.status !== "checked_in" && Number(x.balance.balance) > 0.009);
  const credit = rows.filter((x) => x.reservation.status !== "checked_in" && Number(x.balance.balance) < -0.009);
  const totalOwed = [...inHouse, ...owing].reduce((s, x) => s + Math.max(0, Number(x.balance.balance)), 0);

  const Section = ({ title, desc, list }: { title: string; desc: string; list: typeof rows }) =>
    list.length ? (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title} <span className="text-slate-400 font-normal">({list.length})</span></CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(({ reservation: r, balance: b }) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r)}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1">{guestName(r.guests)}{r.guests?.is_vip && <Crown className="h-4 w-4 text-amber-500" />}</div>
                    <div className="text-xs text-slate-500">{r.code}</div>
                  </TableCell>
                  <TableCell>{r.rooms?.room_number ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatShortDate(r.check_in)} → {formatShortDate(r.check_out)}
                    <div><Badge variant="outline" className={RES_STATUS[r.status].className}>{RES_STATUS[r.status].label}</Badge></div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMoney(b.charges_total, currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatMoney(b.payments_total, currency)}</TableCell>
                  <TableCell className={`text-right whitespace-nowrap font-semibold ${Number(b.balance) > 0.009 ? "text-red-600" : Number(b.balance) < -0.009 ? "text-blue-600" : "text-green-600"}`}>
                    {Number(b.balance) < -0.009 ? "Credit " : ""}{formatMoney(Math.abs(Number(b.balance)), currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    ) : null;

  if (accounts.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Guests in house</div><div className="text-2xl font-bold">{inHouse.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Total owed to the hotel</div><div className="text-2xl font-bold text-red-600">{formatMoney(totalOwed, currency)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-slate-500">Closed stays still owing</div><div className="text-2xl font-bold">{owing.length}</div></CardContent></Card>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Guest, room or booking code" className="pl-9" />
      </div>
      {!rows.length ? (
        <Card><CardContent><EmptyState icon={Receipt} title="No open bills">Bills appear here when guests check in, and stay until they're fully paid.</EmptyState></CardContent></Card>
      ) : (
        <>
          <Section title="In house" desc="Guests currently staying. Click a row to add charges or take payment." list={inHouse} />
          <Section title="Checked out, still owing" desc="Company accounts and unpaid balances." list={owing} />
          <Section title="Money to refund" desc="Guests who paid more than they were charged (e.g. deposit on a cancelled booking)." list={credit} />
        </>
      )}
    </div>
  );
};

const CashUp = () => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const payments = usePaymentsBetween(dayStartIso(from, hotel.timezone), dayStartIso(addDays(to, 1), hotel.timezone));
  const team = useTeam();
  const names = useMemo(() => new Map(team.data?.map((m) => [m.user_id, m.full_name || m.email]) ?? []), [team.data]);
  const live = (payments.data ?? []).filter((p) => !p.voided_at);

  const byMethod = useMemo(() => {
    const m = new Map<PaymentMethod, { count: number; total: number }>();
    live.forEach((p) => {
      const e = m.get(p.method) ?? { count: 0, total: 0 };
      m.set(p.method, { count: e.count + 1, total: e.total + Number(p.amount) });
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [live]);
  const byStaff = useMemo(() => {
    const m = new Map<string, Map<PaymentMethod, number>>();
    live.forEach((p) => {
      const k = p.received_by ?? "unknown";
      const e = m.get(k) ?? new Map();
      e.set(p.method, (e.get(p.method) ?? 0) + Number(p.amount));
      m.set(k, e);
    });
    return [...m.entries()];
  }, [live]);
  const total = live.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 no-print">
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
        <Button variant="outline" onClick={() => { setFrom(today); setTo(today); }}>Today</Button>
        <Button variant="outline" onClick={() => { const y = addDays(today, -1); setFrom(y); setTo(y); }}>Yesterday</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>

      {payments.isLoading ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="col-span-2 md:col-span-1 border-blue-200"><CardContent className="p-4">
              <div className="text-sm text-slate-500">Total received</div>
              <div className="text-2xl font-bold">{formatMoney2(total, hotel.currency)}</div>
              <div className="text-xs text-slate-500">{live.length} payment{live.length === 1 ? "" : "s"} · {from === to ? formatDate(from) : `${formatShortDate(from)} – ${formatShortDate(to)}`}</div>
            </CardContent></Card>
            {byMethod.map(([m, v]) => (
              <Card key={m}><CardContent className="p-4">
                <div className="text-sm text-slate-500">{PAYMENT_METHODS[m]}</div>
                <div className="text-xl font-bold">{formatMoney2(v.total, hotel.currency)}</div>
                <div className="text-xs text-slate-500">{v.count} payment{v.count === 1 ? "" : "s"}</div>
              </CardContent></Card>
            ))}
          </div>

          {byStaff.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">By staff member</CardTitle><CardDescription>Use this to check each cashier's drawer and M-Pesa at shift end.</CardDescription></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Received by</TableHead>{byMethod.map(([m]) => <TableHead key={m} className="text-right">{PAYMENT_METHODS[m]}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {byStaff.map(([uid, m]) => (
                      <TableRow key={uid}>
                        <TableCell>{names.get(uid) ?? "—"}</TableCell>
                        {byMethod.map(([k]) => <TableCell key={k} className="text-right">{m.get(k) ? formatMoney(m.get(k), "") : "—"}</TableCell>)}
                        <TableCell className="text-right font-semibold">{formatMoney([...m.values()].reduce((a, b) => a + b, 0), "")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">All payments</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {!payments.data?.length ? <EmptyState icon={Wallet} title="No payments in this period" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Guest</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>By</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {payments.data.map((p) => (
                      <TableRow key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                        <TableCell className="whitespace-nowrap text-sm">{new Date(p.received_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: hotel.timezone })}</TableCell>
                        <TableCell>
                          {guestName(p.reservations?.guests)}
                          <div className="text-xs text-slate-500">{p.reservations?.code}{p.reservations?.rooms ? ` · Room ${p.reservations.rooms.room_number}` : ""}</div>
                        </TableCell>
                        <TableCell>{p.amount < 0 ? "Refund · " : ""}{PAYMENT_METHODS[p.method]}{p.voided_at && <div className="text-xs text-red-600">Voided: {p.void_reason}</div>}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference ?? ""}</TableCell>
                        <TableCell className="text-sm">{names.get(p.received_by ?? "") ?? "—"}</TableCell>
                        <TableCell className={`text-right whitespace-nowrap ${p.voided_at ? "line-through" : ""} ${p.amount < 0 ? "text-red-600" : ""}`}>{formatMoney2(p.amount, hotel.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const InvoiceList = () => {
  const { hotel } = useCurrentHotel();
  const [search, setSearch] = useState("");
  const invoices = useInvoices(search);
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice number, guest name or booking code" className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {invoices.isLoading ? <LoadingBlock /> : !invoices.data?.length ? (
            <EmptyState icon={FileText} title="No invoices yet">Invoices are created automatically when a guest checks out.</EmptyState>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {invoices.data.map((i) => (
                  <TableRow key={i.id} className={i.superseded_at ? "opacity-50" : ""}>
                    <TableCell className="font-mono">{i.number}{i.superseded_at && <Badge variant="outline" className="ml-2">replaced</Badge>}</TableCell>
                    <TableCell>{formatDate(i.issued_at.slice(0, 10))}</TableCell>
                    <TableCell>{i.guest.name}</TableCell>
                    <TableCell className="text-sm">{i.stay.code}{i.stay.room ? ` · Room ${i.stay.room}` : ""}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatMoney2(i.total, hotel.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild><a href={`/invoice/${i.id}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /></a></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPage;
