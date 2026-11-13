import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Ban, Building2, Download, FileText, Pencil, Plus, Printer, Search, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRoomTypes } from "@/hooks/useHotelQueries";
import { useCompanyAccounts, useCompanyEntry, useCompanyStatement, useSaveCompany, useVoidCompanyEntry } from "@/hooks/useCompanies";
import { BILL_TO, PAYMENT_METHODS, formatMoney, formatMoney2, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { CompanyAccount, PaymentMethod } from "@/lib/db-types";

const n = (v: number | null | undefined) => Number(v ?? 0);
const BUCKETS: [keyof NonNullable<CompanyAccount["ageing"]>, string][] = [["current", "Not yet due"], ["d30", "1–30 days late"], ["d60", "31–60"], ["d90", "61–90"], ["d90p", "Over 90"]];

const CompaniesPage = () => {
  const { hotel, can } = useCurrentHotel();
  const money = can("owner", "manager", "accountant");
  const q = useCompanyAccounts();
  const [search, setSearch] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Partial<CompanyAccount> | null>(null);
  const [open, setOpen] = useState<CompanyAccount | null>(null);
  const [paying, setPaying] = useState<CompanyAccount | null>(null);
  const cur = hotel.currency;
  const list = useMemo(() => (q.data ?? [])
    .filter((c) => showClosed || c.active)
    .filter((c) => !search.trim() || [c.name, c.contact_name, c.kra_pin].some((v) => v?.toLowerCase().includes(search.trim().toLowerCase()))), [q.data, search, showClosed]);
  const all = q.data ?? [];
  const owed = all.reduce((a, c) => a + Math.max(0, n(c.balance)), 0);
  const overdue = all.reduce((a, c) => a + n(c.ageing?.overdue), 0);
  const over = all.filter((c) => c.over_limit).length;
  const late90 = all.reduce((a, c) => a + n(c.ageing?.d90p), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Company accounts" subtitle="Businesses that book on account: negotiated rates, credit limits, what they owe and when it's due"
        actions={money ? <Button onClick={() => setEditing({ terms_days: 30, default_bill_to: "company_all", active: true })}><Plus className="mr-1 h-4 w-4" />Add company</Button> : null} />
      {money && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Owed by companies", formatMoney(owed, cur), ""], ["Overdue", formatMoney(overdue, cur), overdue > 0 ? "text-red-700" : ""],
            ["Over 90 days late", formatMoney(late90, cur), late90 > 0 ? "text-red-700" : ""], ["Over credit limit", String(over), over > 0 ? "text-amber-700" : ""]].map(([l, v, c]) => (
            <Card key={l}><CardContent className="p-4"><div className="text-sm text-slate-500">{l}</div><div className={`text-2xl font-bold tabular-nums ${c}`}>{v}</div></CardContent></Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative sm:w-80 flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Company, contact or KRA PIN" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={showClosed} onCheckedChange={setShowClosed} />Show closed accounts</label>
        {money && all.length > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => downloadCsv(`company_ageing_${todayIn(hotel.timezone)}`,
            ["Company", "KRA PIN", "Balance", "Not yet due", "1-30", "31-60", "61-90", "Over 90", "Credit limit", "Terms (days)", "Last payment"],
            all.map((c) => [c.name, c.kra_pin, n(c.balance), n(c.ageing?.current), n(c.ageing?.d30), n(c.ageing?.d60), n(c.ageing?.d90), n(c.ageing?.d90p),
              c.credit_limit ?? "", c.terms_days, c.last_payment ? `${c.last_payment.date} ${c.last_payment.amount}` : ""]))}><Download className="mr-1 h-4 w-4" />Ageing (CSV)</Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {q.isLoading ? <LoadingBlock /> : !list.length ? (
            <EmptyState icon={Building2} title={all.length ? "No companies match" : "No company accounts yet"}>
              Add the companies, NGOs and government offices that send you guests and pay later. Then choose the company when booking.
            </EmptyState>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Company</TableHead>
                {money && <><TableHead className="text-right">Owes</TableHead>{BUCKETS.map(([k, l]) => <TableHead key={k} className="text-right hidden lg:table-cell">{l}</TableHead>)}</>}
                <TableHead>Credit limit</TableHead><TableHead>Rates</TableHead><TableHead className="text-right" />
              </TableRow></TableHeader>
              <TableBody>
                {list.map((c) => {
                  const used = c.credit_limit ? Math.min(100, Math.max(0, (n(c.credit_limit) - n(c.available)) / n(c.credit_limit) * 100)) : 0;
                  return (
                    <TableRow key={c.id} className={c.active ? "" : "opacity-60"}>
                      <TableCell>
                        <button type="button" className="font-medium hover:underline text-left" disabled={!money} onClick={() => setOpen(c)}>{c.name}</button>
                        {!c.active && <Badge variant="outline" className="ml-2">Closed</Badge>}
                        <div className="text-xs text-slate-500">{[c.kra_pin, c.contact_name, c.phone].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      {money && <>
                        <TableCell className={`text-right tabular-nums font-semibold ${n(c.balance) < 0 ? "text-blue-700" : ""}`}>{n(c.balance) < 0 ? `${formatMoney(-n(c.balance), "")} cr` : formatMoney(n(c.balance), "")}</TableCell>
                        {BUCKETS.map(([k]) => <TableCell key={k} className={`text-right tabular-nums hidden lg:table-cell ${k !== "current" && n(c.ageing?.[k] as number) > 0 ? "text-red-700" : "text-slate-600"}`}>{n(c.ageing?.[k] as number) ? formatMoney(n(c.ageing?.[k] as number), "") : "–"}</TableCell>)}
                      </>}
                      <TableCell className="min-w-[140px]">
                        {c.credit_limit == null ? <span className="text-sm text-slate-500">No limit</span> : (
                          <div className="space-y-1">
                            <div className="text-xs">{c.over_limit ? <span className="text-red-700 font-semibold">Over limit</span> : `${formatMoney(n(c.available), "")} left`} of {formatMoney(n(c.credit_limit), "")}</div>
                            <div className="h-1.5 rounded bg-slate-200 overflow-hidden"><div className={`h-full ${c.over_limit ? "bg-red-600" : used > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${c.over_limit ? 100 : used}%` }} /></div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{Object.keys(c.rates).length ? `${Object.keys(c.rates).length} fixed` : ""}{c.discount_pct ? `${Object.keys(c.rates).length ? ", " : ""}${Number(c.discount_pct)}% off` : ""}{!Object.keys(c.rates).length && !c.discount_pct ? "Normal" : ""}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {money && <>
                          <Button size="sm" variant="outline" onClick={() => setPaying(c)}><Wallet className="mr-1 h-4 w-4" />Payment</Button>
                          <Button size="sm" variant="ghost" onClick={() => setOpen(c)} aria-label={`Statement for ${c.name}`}><FileText className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></Button>
                        </>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">
        When a company-billed guest checks out, the company's share moves to its account here and the hotel invoice is addressed to the company with its KRA PIN.
        Payments clear the oldest stays first. {!money && "Balances are visible to owners, managers and accountants."}
      </p>
      {editing && <CompanyDialog c={editing} onClose={() => setEditing(null)} />}
      {paying && <EntryDialog c={paying} onClose={() => setPaying(null)} />}
      {open && <AccountDialog c={open} onClose={() => setOpen(null)} onPay={() => setPaying(open)} />}
    </div>
  );
};
export default CompaniesPage;

// ---------------------------------------------------------------- add / edit
const CompanyDialog = ({ c, onClose }: { c: Partial<CompanyAccount>; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const types = useRoomTypes();
  const save = useSaveCompany();
  const [f, setF] = useState<Partial<CompanyAccount>>(c);
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(Object.entries(c.rates ?? {}).map(([k, v]) => [k, String(v)])));
  const set = <K extends keyof CompanyAccount>(k: K, v: CompanyAccount[K]) => setF((x) => ({ ...x, [k]: v }));
  const txt = (k: "name" | "kra_pin" | "contact_name" | "email" | "phone" | "address", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1"><Label htmlFor={`co-${k}`}>{label}</Label><Input id={`co-${k}`} value={(f[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} {...props} /></div>
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{c.id ? `Edit ${c.name}` : "Add a company"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {txt("name", "Company name", { placeholder: "Safaricom PLC" })}
            {txt("kra_pin", "KRA PIN", { placeholder: "P051234567X", maxLength: 11 })}
            {txt("contact_name", "Contact person (travel desk, admin…)")}
            {txt("email", "Accounts email (for statements)", { type: "email" })}
            {txt("phone", "Phone", { type: "tel" })}
            {txt("address", "Postal address")}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label htmlFor="co-limit">Credit limit ({hotel.currency})</Label><Input id="co-limit" type="number" min={0} value={f.credit_limit ?? ""} placeholder="No limit"
              onChange={(e) => set("credit_limit", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="co-terms">Pays within (days)</Label><Input id="co-terms" type="number" min={0} max={180} value={f.terms_days ?? 30}
              onChange={(e) => set("terms_days", Number(e.target.value))} /></div>
            <div className="space-y-1"><Label>Usually pays for</Label>
              <Select value={f.default_bill_to ?? "company_all"} onValueChange={(v) => set("default_bill_to", v as CompanyAccount["default_bill_to"])}>
                <SelectTrigger aria-label="Usually pays for"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="company_all">Everything</SelectItem><SelectItem value="company_room">The room only</SelectItem></SelectContent></Select></div>
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div className="font-medium text-sm">Negotiated rates</div>
            <div className="flex items-center gap-2 text-sm"><Label htmlFor="co-disc" className="whitespace-nowrap">Discount on the normal / season price</Label>
              <Input id="co-disc" type="number" min={0} max={90} className="w-24" value={f.discount_pct ?? ""} placeholder="0" onChange={(e) => set("discount_pct", e.target.value === "" ? null : Number(e.target.value))} />%</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {(types.data ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{t.name} <span className="text-slate-500">(normally {formatMoney(t.base_rate, "")})</span></span>
                  <Input type="number" min={0} className="w-28" aria-label={`Fixed rate for ${t.name}`} placeholder="—" value={rates[t.id] ?? ""} onChange={(e) => setRates({ ...rates, [t.id]: e.target.value })} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">A fixed rate applies all year, whatever the season. Room types without one get the discount.</p>
          </div>
          <div className="space-y-1"><Label htmlFor="co-notes">Notes</Label><Textarea id="co-notes" rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Who can authorise bookings, LPO rules, invoice instructions…" /></div>
          {c.id && <label className="flex items-center gap-2 text-sm"><Switch checked={f.active ?? true} onCheckedChange={(v) => set("active", v)} />Account open (close it to stop new bookings; history stays)</label>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!f.name?.trim() || save.isPending} onClick={() => save.mutate({
            company: { id: f.id, name: f.name!.trim(), kra_pin: f.kra_pin?.trim() || null, contact_name: f.contact_name?.trim() || null, email: f.email?.trim() || null,
              phone: f.phone?.trim() || null, address: f.address?.trim() || null, credit_limit: f.credit_limit ?? null, terms_days: f.terms_days ?? 30,
              discount_pct: f.discount_pct || null, default_bill_to: f.default_bill_to ?? "company_all", active: f.active ?? true, notes: f.notes?.trim() || null },
            rates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== "" && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)])),
          }, { onSuccess: onClose })}>Save company</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- payments, credit notes, charges
const EntryDialog = ({ c, onClose }: { c: CompanyAccount; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const entry = useCompanyEntry();
  const [kind, setKind] = useState<"payment" | "credit" | "charge">("payment");
  const [amount, setAmount] = useState(n(c.balance) > 0 ? String(n(c.balance)) : "");
  const [date, setDate] = useState(todayIn(hotel.timezone));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [ref, setRef] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{c.name}</DialogTitle><DialogDescription>Owes {formatMoney2(n(c.balance), hotel.currency)}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger aria-label="Entry type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="payment">Payment received</SelectItem><SelectItem value="credit">Credit note (reduce what they owe)</SelectItem><SelectItem value="charge">Extra charge</SelectItem></SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="ce-amt">Amount ({hotel.currency})</Label><Input id="ce-amt" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="ce-date">Date</Label><Input id="ce-date" type="date" max={todayIn(hotel.timezone)} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {kind === "payment" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Paid by</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}><SelectTrigger aria-label="Paid by"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHODS[m]}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label htmlFor="ce-ref">{method === "mpesa" ? "M-Pesa code" : method === "cheque" ? "Cheque number" : "Reference"}</Label>
                <Input id="ce-ref" value={ref} onChange={(e) => setRef(method === "mpesa" ? e.target.value.toUpperCase() : e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1"><Label htmlFor="ce-desc">{kind === "payment" ? "Note (optional)" : "What it's for"}</Label>
            <Input id="ce-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === "credit" ? "e.g. Rate agreed at 8,000 not 9,000" : kind === "charge" ? "e.g. Conference hall 12 Nov" : "e.g. Remittance for October"} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!(Number(amount) > 0) || entry.isPending} onClick={() => entry.mutate({ companyId: c.id, kind, amount: Number(amount), date, method: kind === "payment" ? method : null, reference: ref, description: desc }, { onSuccess: onClose })}>
            {kind === "payment" ? "Record payment" : kind === "credit" ? "Add credit note" : "Add charge"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- account / statement
const KIND_LABEL = { stay: "Stay", payment: "Payment", credit: "Credit note", charge: "Charge" };
const AccountDialog = ({ c, onClose, onPay }: { c: CompanyAccount; onClose: () => void; onPay: () => void }) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [range, setRange] = useState("90");
  const [from, to] = useMemo(() => {
    const t = parseISO(today);
    if (range === "this") return [format(startOfMonth(t), "yyyy-MM-dd"), today];
    if (range === "last") { const l = subMonths(t, 1); return [format(startOfMonth(l), "yyyy-MM-dd"), format(endOfMonth(l), "yyyy-MM-dd")]; }
    if (range === "year") return [`${today.slice(0, 4)}-01-01`, today];
    return [format(subMonths(t, 3), "yyyy-MM-dd"), today];
  }, [range, today]);
  const st = useCompanyStatement(c.id, from, to);
  const undo = useVoidCompanyEntry();
  const cur = hotel.currency;
  const s = st.data;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{c.name}</DialogTitle>
          <DialogDescription>{[c.kra_pin && `PIN ${c.kra_pin}`, `pays within ${c.terms_days} days`, c.credit_limit != null && `limit ${formatMoney(n(c.credit_limit), cur)}`, BILL_TO[c.default_bill_to]].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}><SelectTrigger className="w-44" aria-label="Statement period"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="this">This month</SelectItem><SelectItem value="last">Last month</SelectItem><SelectItem value="90">Last 3 months</SelectItem><SelectItem value="year">This year</SelectItem></SelectContent></Select>
          <span className="text-sm text-slate-500">{format(parseISO(from), "d MMM yyyy")} – {format(parseISO(to), "d MMM yyyy")}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onPay}><Wallet className="mr-1 h-4 w-4" />Payment / credit</Button>
            <Button size="sm" variant="outline" asChild><a href={`/statement/${c.id}?from=${from}&to=${to}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Print statement</a></Button>
          </div>
        </div>
        {st.isLoading || !s ? <LoadingBlock /> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              {BUCKETS.map(([k, l]) => (
                <div key={k} className={`rounded border p-2 ${k !== "current" && n(s.ageing[k] as number) > 0 ? "border-red-200 bg-red-50" : ""}`}>
                  <div className="text-xs text-slate-500">{l}</div><div className="font-semibold tabular-nums">{formatMoney(n(s.ageing[k] as number), cur)}</div>
                </div>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Charged</TableHead><TableHead className="text-right">Paid / credited</TableHead><TableHead className="text-right">Balance</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50 dark:bg-slate-900"><TableCell colSpan={4} className="text-sm">Brought forward</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(s.opening, "")}</TableCell><TableCell /></TableRow>
                {s.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">{format(parseISO(e.date), "d MMM yyyy")}</TableCell>
                    <TableCell className="text-sm"><span className="font-medium">{KIND_LABEL[e.kind]}</span> · {e.description}
                      <div className="text-xs text-slate-500">{[e.invoice && `Invoice ${e.invoice}`, e.reference && (e.kind === "stay" ? `LPO ${e.reference}` : e.reference),
                        e.method && PAYMENT_METHODS[e.method as PaymentMethod], e.due && `due ${format(parseISO(e.due), "d MMM")}`].filter(Boolean).join(" · ")}</div></TableCell>
                    <TableCell className="text-right tabular-nums">{e.amount > 0 ? formatMoney2(e.amount, "") : ""}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{e.amount < 0 ? formatMoney2(-e.amount, "") : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney2(e.balance, "")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Undo" aria-label={`Undo ${e.description}`} onClick={() => {
                        const reason = prompt(e.kind === "stay" ? "Why undo this? The amount goes back on the guest's bill." : "Why undo this entry?");
                        if (reason?.trim()) undo.mutate({ id: e.id, reason: reason.trim() });
                      }}><Ban className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!s.entries.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Nothing in this period.</TableCell></TableRow>}
              </TableBody>
              <TableFooter><TableRow><TableCell colSpan={4}>{s.closing < 0 ? "In credit" : "Balance owed"} at {format(parseISO(to), "d MMM yyyy")}</TableCell><TableCell className="text-right tabular-nums">{formatMoney2(Math.abs(s.closing), cur)}</TableCell><TableCell /></TableRow></TableFooter>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
