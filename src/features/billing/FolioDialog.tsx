import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, FileText, Loader2, LogOut, Plus, Printer, Receipt, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useAddCharge, useAddPayment, useCheckOutSettled, useFolio, useIssueInvoice, useVoidCharge, useVoidPayment } from "@/hooks/useBilling";
import { LoadingBlock } from "@/components/common/PageHeader";
import {
  CHARGE_KINDS, PAYMENT_METHODS, RES_STATUS, addDays, formatDate, formatMoney2, formatShortDate, guestName, todayIn,
} from "@/lib/format";
import type { ChargeKind, PaymentMethod, Reservation } from "@/lib/db-types";

type Mini = Pick<Reservation, "id" | "code" | "status" | "check_in" | "check_out"> & {
  guests?: { first_name: string; last_name: string; phone?: string | null } | null;
  rooms?: { room_number: string } | null;
};

const MANUAL_KINDS = (Object.keys(CHARGE_KINDS) as ChargeKind[]).filter((k) => k !== "room");

/** A guest's bill: charges, payments, balance; optionally the check-out flow. */
export const FolioDialog = ({ reservation: r, checkout, onClose }: { reservation: Mini; checkout?: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const { hotel, can } = useCurrentHotel();
  const cur = hotel.currency;
  const folio = useFolio(r.id);
  const issue = useIssueInvoice();
  const checkOut = useCheckOutSettled();
  const voidCharge = useVoidCharge();
  const voidPayment = useVoidPayment();
  const isManager = can("owner", "manager", "accountant");
  const today = todayIn(hotel.timezone);
  const [tab, setTab] = useState(checkout ? "pay" : "bill");
  const [owing, setOwing] = useState(false);

  // When leaving early, nights from today onwards will be removed at check-out.
  const earliest = addDays(r.check_in, 1);
  const leaveOn = today > earliest ? today : earliest;
  const departure = r.status === "checked_in" && r.check_out > leaveOn ? leaveOn : null;
  const unusedNights = useMemo(
    () =>
      departure
        ? (folio.data?.charges ?? []).filter((c) => c.kind === "room" && !c.voided_at && c.stay_date && c.stay_date >= departure)
        : [],
    [folio.data, departure],
  );
  const unusedTotal = unusedNights.reduce((s, c) => s + Number(c.amount), 0);
  const balance = folio.data?.balance ?? 0;
  const dueAtCheckout = Math.round((balance - (checkout ? unusedTotal : 0)) * 100) / 100;

  const canVoid = (posted_by: string | null, at: string) =>
    isManager || (posted_by === user?.id && Date.now() - new Date(at).getTime() < 15 * 60_000);

  const askVoid = (fn: (a: { id: string; reason: string }) => void, id: string, what: string) => {
    const reason = prompt(`Why are you voiding ${what}? (shown on the audit trail)`);
    if (reason && reason.trim()) fn({ id, reason: reason.trim() });
  };

  const current = folio.data?.invoices.find((i) => !i.superseded_at);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {checkout ? "Check out" : "Bill"} · {guestName(r.guests)}
            <Badge variant="outline" className={RES_STATUS[r.status].className}>{RES_STATUS[r.status].label}</Badge>
          </DialogTitle>
          <DialogDescription>
            {r.code} · {r.rooms ? `Room ${r.rooms.room_number} · ` : ""}{formatShortDate(r.check_in)} → {formatShortDate(r.check_out)}
          </DialogDescription>
        </DialogHeader>

        {folio.isLoading || !folio.data ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Charges" value={formatMoney2(folio.data.chargesTotal, cur)} />
              <Stat label="Paid" value={formatMoney2(folio.data.paymentsTotal, cur)} />
              <Stat
                label={balance < -0.009 ? "In credit" : "Balance"}
                value={formatMoney2(Math.abs(balance), cur)}
                tone={balance > 0.009 ? "due" : balance < -0.009 ? "credit" : "ok"}
              />
            </div>

            {checkout && departure && unusedNights.length > 0 && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Leaving early: {unusedNights.length} unused night{unusedNights.length > 1 ? "s" : ""} (
                {formatMoney2(unusedTotal, cur)}) will be removed when you check out.
                Amount due at check-out: <strong>{formatMoney2(Math.max(dueAtCheckout, 0), cur)}</strong>
                {dueAtCheckout < -0.009 && <> · guest will be in credit {formatMoney2(-dueAtCheckout, cur)}</>}
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="bill"><Receipt className="mr-1 h-4 w-4" />Charges</TabsTrigger>
                <TabsTrigger value="pay"><Wallet className="mr-1 h-4 w-4" />Payments</TabsTrigger>
              </TabsList>

              <TabsContent value="bill" className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folio.data.charges.map((c) => (
                        <TableRow key={c.id} className={c.voided_at ? "opacity-50" : ""}>
                          <TableCell className="whitespace-nowrap text-xs">{formatShortDate(c.stay_date ?? c.posted_at.slice(0, 10))}</TableCell>
                          <TableCell>
                            <div className={c.voided_at ? "line-through" : ""}>
                              {c.description}{Number(c.quantity) !== 1 && <span className="text-slate-500"> × {Number(c.quantity)}</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              {CHARGE_KINDS[c.kind]}
                              {c.voided_at && <> · voided: {c.void_reason}</>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{formatMoney2(c.amount, cur)}</TableCell>
                          <TableCell className="text-right">
                            {!c.voided_at && canVoid(c.posted_by, c.posted_at) && r.status !== "cancelled" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Void"
                                onClick={() => askVoid(voidCharge.mutate, c.id, `"${c.description}"`)}>
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!folio.data.charges.length && (
                        <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">
                          No charges yet. Room nights are added automatically at check-in.
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <AddChargeForm reservationId={r.id} currency={cur} />
              </TabsContent>

              <TabsContent value="pay" className="space-y-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folio.data.payments.map((p) => (
                        <TableRow key={p.id} className={p.voided_at ? "opacity-50" : ""}>
                          <TableCell className="whitespace-nowrap text-xs">{new Date(p.received_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                          <TableCell>
                            <div className={p.voided_at ? "line-through" : ""}>
                              {p.amount < 0 ? "Refund · " : ""}{PAYMENT_METHODS[p.method]} {p.reference && <span className="font-mono text-xs">{p.reference}</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              {[p.payer_phone, p.notes].filter(Boolean).join(" · ")}
                              {p.voided_at && <> voided: {p.void_reason}</>}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap ${p.amount < 0 ? "text-red-600" : ""}`}>{formatMoney2(p.amount, cur)}</TableCell>
                          <TableCell className="text-right">
                            {!p.voided_at && canVoid(p.received_by, p.received_at) && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Void"
                                onClick={() => askVoid(voidPayment.mutate, p.id, "this payment")}>
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!folio.data.payments.length && (
                        <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">No payments yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <PaymentForm
                  reservationId={r.id}
                  currency={cur}
                  suggested={checkout ? dueAtCheckout : balance}
                  canRefund={isManager}
                  phone={r.guests?.phone ?? ""}
                />
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {current && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/invoice/${current.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Invoice {current.number}</a>
                  </Button>
                )}
                {(r.status === "checked_out" || r.status === "cancelled" || r.status === "no_show") && folio.data.charges.some((c) => !c.voided_at) && (
                  <Button variant="outline" size="sm" disabled={issue.isPending}
                    onClick={() => (!current || confirm(`Issue a new invoice? ${current.number} will be marked as replaced.`)) && issue.mutate(r.id)}>
                    <FileText className="mr-1 h-4 w-4" />{current ? "Re-issue invoice" : "Issue invoice"}
                  </Button>
                )}
                {r.status === "checked_in" && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/folio/${r.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Print interim bill</a>
                  </Button>
                )}
              </div>

              {checkout && r.status === "checked_in" && (
                <div className="flex flex-col items-end gap-2">
                  {dueAtCheckout > 0.009 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={owing} onCheckedChange={(v) => setOwing(v === true)} />
                      Check out with {formatMoney2(dueAtCheckout, cur)} owing (company / credit account)
                    </label>
                  )}
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    disabled={checkOut.isPending || (dueAtCheckout > 0.009 && !owing)}
                    onClick={() => checkOut.mutate({ id: r.id, allowBalance: owing }, { onSuccess: onClose })}
                  >
                    {checkOut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    {dueAtCheckout > 0.009 && !owing ? `Take ${formatMoney2(dueAtCheckout, cur)} first` : "Check out & issue invoice"}
                  </Button>
                </div>
              )}
            </div>
            {r.status === "checked_out" && <p className="text-xs text-slate-500">Checked out {formatDate(r.check_out)}. Late charges and payments can still be added.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "due" | "credit" | "ok" }) => (
  <div className={`rounded-lg border p-3 ${tone === "due" ? "border-red-200 bg-red-50" : tone === "credit" ? "border-blue-200 bg-blue-50" : tone === "ok" ? "border-green-200 bg-green-50" : "bg-slate-50 dark:bg-slate-800"}`}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`font-bold ${tone === "due" ? "text-red-700" : tone === "credit" ? "text-blue-700" : ""}`}>{value}</div>
  </div>
);

const AddChargeForm = ({ reservationId, currency }: { reservationId: string; currency: string }) => {
  const add = useAddCharge();
  const [kind, setKind] = useState<ChargeKind>("food");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const total = Number(qty || 0) * Number(price || 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Math.abs(Number(price));
    add.mutate(
      {
        reservation_id: reservationId,
        kind,
        description: desc || CHARGE_KINDS[kind],
        quantity: Number(qty),
        unit_price: kind === "discount" ? -p : p,
      },
      { onSuccess: () => { setDesc(""); setQty("1"); setPrice(""); } },
    );
  };

  return (
    <form onSubmit={submit} className="rounded-lg border p-3 space-y-3 bg-slate-50/60 dark:bg-slate-800/40">
      <div className="font-medium text-sm flex items-center gap-1"><Plus className="h-4 w-4" />Add to bill</div>
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
        <div className="md:col-span-3">
          <Select value={kind} onValueChange={(v) => setKind(v as ChargeKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MANUAL_KINDS.map((k) => <SelectItem key={k} value={k}>{CHARGE_KINDS[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Input className="md:col-span-4" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === "discount" ? "Reason, e.g. Returning guest 10%" : "e.g. Dinner – 2 x nyama choma"} />
        <Input className="md:col-span-1" type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} title="Quantity" required />
        <Input className="md:col-span-2" type="number" min={0.01} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={`Price (${currency})`} required />
        <Button className="md:col-span-2" type="submit" disabled={add.isPending || !price}>
          Add {total > 0 ? formatMoney2(kind === "discount" ? -total : total, currency).replace(`${currency} `, "") : ""}
        </Button>
      </div>
    </form>
  );
};

const PaymentForm = ({
  reservationId, currency, suggested, canRefund, phone,
}: { reservationId: string; currency: string; suggested: number; canRefund: boolean; phone: string }) => {
  const add = useAddPayment();
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [payer, setPayer] = useState(phone);
  const [notes, setNotes] = useState("");
  const [refund, setRefund] = useState(false);
  const [touched, setTouched] = useState(false);

  // Pre-fill the amount due, but never overwrite what staff are typing.
  useEffect(() => {
    if (touched) return;
    if (suggested > 0.009) { setAmount(String(suggested)); setRefund(false); }
    else if (suggested < -0.009 && canRefund) { setAmount(String(-suggested)); setRefund(true); }
    else setAmount("");
  }, [suggested, canRefund, touched]);

  const mpesaOk = method !== "mpesa" || /^[A-Z0-9]{10}$/.test(ref.trim().toUpperCase());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = Math.abs(Number(amount));
    add.mutate(
      { reservation_id: reservationId, method, amount: refund ? -a : a, reference: ref, payer_phone: payer, notes },
      { onSuccess: () => { setRef(""); setNotes(""); setTouched(false); } },
    );
  };

  return (
    <form onSubmit={submit} className="rounded-lg border p-3 space-y-3 bg-slate-50/60 dark:bg-slate-800/40">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm flex items-center gap-1"><Wallet className="h-4 w-4" />{refund ? "Record refund" : "Take payment"}</div>
        {canRefund && (
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={refund} onCheckedChange={(v) => setRefund(v === true)} />Refund to guest
          </label>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHODS[m]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pay-amount-${reservationId}`} className="text-xs">Amount ({currency})</Label>
          <Input id={`pay-amount-${reservationId}`} type="number" min={0.01} step="0.01" value={amount} onChange={(e) => { setTouched(true); setAmount(e.target.value); }} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pay-ref-${reservationId}`} className="text-xs">{method === "mpesa" ? "M-Pesa code *" : method === "card" ? "Card slip / approval no." : "Reference"}</Label>
          <Input
            id={`pay-ref-${reservationId}`}
            value={ref}
            onChange={(e) => setRef(method === "mpesa" ? e.target.value.toUpperCase().replace(/\s/g, "") : e.target.value)}
            placeholder={method === "mpesa" ? "e.g. TK45ABC1XY" : ""}
            maxLength={method === "mpesa" ? 10 : 60}
            className={method === "mpesa" ? "font-mono" : ""}
            required={method === "mpesa"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{method === "mpesa" ? "Paid from phone" : "Notes"}</Label>
          {method === "mpesa" ? (
            <Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="07…" />
          ) : (
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </div>
      </div>
      {method === "mpesa" && ref && !mpesaOk && <p className="text-xs text-amber-700">M-Pesa codes are 10 letters/numbers, from the guest's confirmation SMS.</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={add.isPending || !amount || !mpesaOk} variant={refund ? "destructive" : "default"}>
          {refund ? "Record refund" : "Record payment"} {amount && formatMoney2(Number(amount), currency)}
        </Button>
      </div>
    </form>
  );
};
