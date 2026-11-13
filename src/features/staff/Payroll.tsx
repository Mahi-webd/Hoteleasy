import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Banknote, Check, Download, FileText, Plus, Printer, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  useDeleteRun, useGeneratePayroll, usePayrollAction, usePayrollRates, usePayrollRuns, usePayslips, useSaveRates, useUpdatePayslip,
} from "@/hooks/useStaff";
import { formatMoney, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { PayeBand, PayrollRates, Payslip } from "@/lib/db-types";

const m = (v: number) => formatMoney(Number(v), "");
const sum = (xs: Payslip[], f: (p: Payslip) => number) => xs.reduce((s, p) => s + Number(f(p)), 0);
const STATUS = {
  draft: { label: "Draft", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  approved: { label: "Approved", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  paid: { label: "Paid", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

export const Payroll = () => {
  const { hotel, can } = useCurrentHotel();
  const approver = can("owner", "manager");
  const owner = can("owner");
  const today = todayIn(hotel.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const monthDate = `${month}-01`;
  const runs = usePayrollRuns();
  const run = (runs.data ?? []).find((r) => r.month === monthDate);
  const slips = usePayslips(run?.id);
  const gen = useGeneratePayroll();
  const act = usePayrollAction();
  const del = useDeleteRun();
  const upd = useUpdatePayslip();
  const [paying, setPaying] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [showRates, setShowRates] = useState(false);
  const label = format(parseISO(monthDate), "MMMM yyyy");
  const list = slips.data ?? [];
  const draft = run?.status === "draft";
  const deductions = (p: Payslip) => Number(p.nssf_tier1) + Number(p.nssf_tier2) + Number(p.shif) + Number(p.ahl) + Number(p.paye);
  const employerCost = sum(list, (p) => Number(p.gross) + Number(p.employer_nssf) + Number(p.employer_ahl) + Number(p.nita));
  const stem = `payroll_${month}`;

  const num = (p: Payslip, k: "overtime_hours" | "bonus" | "advances" | "other_deductions" | "days_worked", w = "w-20") =>
    draft ? (
      <Input key={`${p.id}-${k}-${p[k]}`} type="number" min={0} step="any" defaultValue={Number(p[k]) || ""} placeholder="0" className={`h-8 ${w} text-right px-1 ml-auto`}
        aria-label={`${k.replace("_", " ")} for ${p.full_name}`}
        onBlur={(e) => { const v = Number(e.target.value || 0); if (v !== Number(p[k])) upd.mutate({ id: p.id, [k]: v }); }} />
    ) : <span className="tabular-nums">{Number(p[k]) ? m(Number(p[k])) : "–"}</span>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" aria-label="Payroll month" />
          {run && <Badge variant="outline" className={STATUS[run.status].cls}>{STATUS[run.status].label}{run.paid_on ? ` ${format(parseISO(run.paid_on), "d MMM")}` : ""}</Badge>}
          <div className="ml-auto flex flex-wrap gap-2">
            {owner && <Button size="sm" variant="ghost" onClick={() => setShowRates(true)}>Tax rates</Button>}
            {(!run || draft) && <Button size="sm" variant={run ? "outline" : "default"} disabled={gen.isPending} onClick={() => gen.mutate(monthDate)}>
              {run ? <><RefreshCw className="mr-1 h-4 w-4" />Refresh from time clock</> : <><Plus className="mr-1 h-4 w-4" />Prepare {label} payroll</>}</Button>}
            {run && draft && approver && <Button size="sm" disabled={!list.length || act.isPending} onClick={() => act.mutate({ id: run.id, action: "approve" })}><Check className="mr-1 h-4 w-4" />Approve</Button>}
            {run && draft && <ConfirmButton size="sm" variant="ghost" title={`Delete the ${label} draft?`} onConfirm={() => del.mutate(run.id)} aria-label="Delete draft payroll"><Trash2 className="h-4 w-4" /></ConfirmButton>}
            {run?.status === "approved" && approver && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: run.id, action: "reopen" })}><RotateCcw className="mr-1 h-4 w-4" />Reopen</Button>}
            {run?.status === "approved" && <Button size="sm" onClick={() => setPaying(true)}><Banknote className="mr-1 h-4 w-4" />Mark paid</Button>}
            {run && list.length > 0 && <Button size="sm" variant="outline" asChild><a href={`/payslips/${run.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Payslips</a></Button>}
          </div>
        </CardContent>
      </Card>

      {!run ? (
        <Card><CardContent><EmptyState icon={FileText} title={`No payroll for ${label} yet`}>
          Payroll uses each person's pay rate and payroll details (Staff tab) and the days and hours from the time clock. You can adjust overtime, bonuses and advances before approving.
        </EmptyState></CardContent></Card>
      ) : slips.isLoading ? <LoadingBlock /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[["Gross pay", sum(list, (p) => p.gross)], ["Deductions (NSSF, SHIF, levy, PAYE)", sum(list, deductions)],
              ["Net pay to staff", sum(list, (p) => p.net)], ["Total cost to the hotel", employerCost]].map(([l, v]) => (
              <Card key={l as string}><CardContent className="p-4"><div className="text-sm text-slate-500">{l}</div><div className="text-2xl font-bold tabular-nums">{formatMoney(v as number, hotel.currency)}</div></CardContent></Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
              <div><CardTitle className="text-lg">{label}: {list.length} payslip{list.length === 1 ? "" : "s"}</CardTitle>
                <CardDescription>{draft ? "Type overtime hours, bonuses, advances already paid, and other deductions; everything else is worked out. Approve when it's right." : run.status === "approved" ? "Approved: staff can see their payslips. Pay, then mark it paid." : "Paid: wages and statutory bills are in Expenses & profit."}</CardDescription></div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => downloadCsv(`${stem}_PAYE`, ["Employee PIN", "Name", "Gross pay", "NSSF", "SHIF", "Housing levy", "Taxable pay", "Tax charged", "Personal relief", "PAYE"],
                  list.map((p) => [p.kra_pin, p.full_name, +p.gross, +p.nssf_tier1 + +p.nssf_tier2, +p.shif, +p.ahl, +p.taxable, +p.tax_before_relief, +p.personal_relief, +p.paye]))}><Download className="mr-1 h-4 w-4" />PAYE</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadCsv(`${stem}_NSSF`, ["Name", "ID number", "NSSF number", "Gross pay", "Tier I employee", "Tier II employee", "Employer", "Total"],
                  list.filter((p) => p.statutory).map((p) => [p.full_name, p.id_no, p.nssf_no, +p.gross, +p.nssf_tier1, +p.nssf_tier2, +p.employer_nssf, +p.nssf_tier1 + +p.nssf_tier2 + +p.employer_nssf]))}><Download className="mr-1 h-4 w-4" />NSSF</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadCsv(`${stem}_SHIF`, ["Name", "ID number", "SHA number", "Gross pay", "SHIF"],
                  list.filter((p) => p.statutory).map((p) => [p.full_name, p.id_no, p.sha_no, +p.gross, +p.shif]))}><Download className="mr-1 h-4 w-4" />SHIF</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadCsv(`${stem}_housing_levy`, ["Employee PIN", "Name", "Gross pay", "Employee 1.5%", "Employer 1.5%", "Total"],
                  list.filter((p) => p.statutory).map((p) => [p.kra_pin, p.full_name, +p.gross, +p.ahl, +p.employer_ahl, +p.ahl + +p.employer_ahl]))}><Download className="mr-1 h-4 w-4" />Housing levy</Button>
                <Button size="sm" variant="ghost" onClick={() => downloadCsv(`${stem}_payments`, ["Name", "Pay by", "Phone / account", "Net pay"],
                  list.map((p) => [p.full_name, p.pay_method === "bank" ? "Bank" : p.pay_method === "cash" ? "Cash" : "M-Pesa", p.pay_account, +p.net]))}><Download className="mr-1 h-4 w-4" />Payment list</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="min-w-[160px]">Staff</TableHead><TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Overtime h</TableHead><TableHead className="text-right">Bonus</TableHead><TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">NSSF</TableHead><TableHead className="text-right">SHIF</TableHead><TableHead className="text-right">Levy</TableHead><TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">Advances</TableHead><TableHead className="text-right">Other</TableHead><TableHead className="text-right">Net pay</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {list.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium"><a className="hover:underline" href={`/payslips/${run.id}?staff=${p.staff_id}`} target="_blank" rel="noreferrer">{p.full_name}</a></div>
                        <div className="text-xs text-slate-500">{p.pay_type === "monthly" ? "Monthly" : p.pay_type === "daily" ? `${Number(p.days_worked)} day(s) × ${m(p.rate)}` : `${Number(p.hours_worked)} h × ${m(p.rate)}`}
                          {!p.statutory && " · no statutory deductions"}{!p.kra_pin && p.statutory && <span className="text-amber-700"> · no KRA PIN</span>}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m(Number(p.basic) + Number(p.house_allowance) + Number(p.other_allowance))}</TableCell>
                      <TableCell className="text-right">{num(p, "overtime_hours", "w-16")}{Number(p.overtime_pay) > 0 && <div className="text-[11px] text-slate-500">{m(p.overtime_pay)}</div>}</TableCell>
                      <TableCell className="text-right">{num(p, "bonus")}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{m(p.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m(Number(p.nssf_tier1) + Number(p.nssf_tier2))}</TableCell>
                      <TableCell className="text-right tabular-nums">{m(p.shif)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m(p.ahl)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m(p.paye)}</TableCell>
                      <TableCell className="text-right">{num(p, "advances")}</TableCell>
                      <TableCell className="text-right">{num(p, "other_deductions")}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{m(p.net)}</TableCell>
                    </TableRow>
                  ))}
                  {!list.length && <TableRow><TableCell colSpan={12}><EmptyState icon={FileText} title="Nobody to pay">Add pay rates under the Staff tab, then refresh.</EmptyState></TableCell></TableRow>}
                </TableBody>
                {list.length > 0 && (
                  <TableFooter><TableRow>
                    <TableCell>Total</TableCell><TableCell className="text-right">{m(sum(list, (p) => +p.basic + +p.house_allowance + +p.other_allowance))}</TableCell>
                    <TableCell /><TableCell className="text-right">{m(sum(list, (p) => p.bonus))}</TableCell><TableCell className="text-right">{m(sum(list, (p) => p.gross))}</TableCell>
                    <TableCell className="text-right">{m(sum(list, (p) => +p.nssf_tier1 + +p.nssf_tier2))}</TableCell><TableCell className="text-right">{m(sum(list, (p) => p.shif))}</TableCell>
                    <TableCell className="text-right">{m(sum(list, (p) => p.ahl))}</TableCell><TableCell className="text-right">{m(sum(list, (p) => p.paye))}</TableCell>
                    <TableCell className="text-right">{m(sum(list, (p) => p.advances))}</TableCell><TableCell className="text-right">{m(sum(list, (p) => p.other_deductions))}</TableCell>
                    <TableCell className="text-right">{m(sum(list, (p) => p.net))}</TableCell>
                  </TableRow></TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-slate-500">
            Employer also pays NSSF {formatMoney(sum(list, (p) => p.employer_nssf), "")}, housing levy {formatMoney(sum(list, (p) => p.employer_ahl), "")} and NITA {formatMoney(sum(list, (p) => p.nita), "")}.
            Statutory payments are due by the 9th of next month (PAYE and housing levy on iTax, NSSF on the NSSF portal, SHIF on the SHA employer portal). Check the figures against KRA's rules before filing; HotelEasy is not tax advice.
          </p>
        </>
      )}
      {paying && run && (
        <Dialog open onOpenChange={setPaying}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Mark {label} payroll paid</DialogTitle>
              <DialogDescription>Adds net wages as a paid expense, and PAYE, NSSF, SHIF, housing levy and NITA as bills due on the 9th.</DialogDescription></DialogHeader>
            <div className="space-y-1"><Label htmlFor="pr-paid">Paid on</Label><Input id="pr-paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setPaying(false)}>Cancel</Button>
              <Button disabled={act.isPending} onClick={() => act.mutate({ id: run.id, action: "paid", paidOn }, { onSuccess: () => setPaying(false) })}>Mark paid</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {showRates && <RatesDialog onClose={() => setShowRates(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------- statutory rates (owner)
const pct = (r: number) => `${+(Number(r) * 100).toFixed(3)}%`;

const RatesDialog = ({ onClose }: { onClose: () => void }) => {
  const rates = usePayrollRates();
  const save = useSaveRates();
  const [draft, setDraft] = useState<Partial<PayrollRates> | null>(null);
  const cur = rates.data?.[0];
  const startNew = () => setDraft({ ...cur, id: undefined, effective_from: "", note: "", paye_bands: cur?.paye_bands.map((b) => ({ ...b })) ?? [] });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Statutory rates</DialogTitle>
          <DialogDescription>Payroll uses the latest rates that start on or before the payroll month. When the law changes, add new rates with the date they start; old payrolls keep their rates.</DialogDescription></DialogHeader>
        {!draft ? (
          <div className="space-y-3">
            {(rates.data ?? []).map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="font-semibold">From {format(parseISO(r.effective_from), "d MMMM yyyy")}{r === cur && <Badge variant="secondary" className="ml-2">Latest</Badge>}</div>
                <div>PAYE: {r.paye_bands.map((b, i) => `${pct(b.rate)} ${b.upto ? `to ${m(b.upto)}` : "above"}${i < r.paye_bands.length - 1 ? " · " : ""}`)}; personal relief {m(r.personal_relief)}</div>
                <div>NSSF {pct(r.nssf_rate)} + {pct(r.nssf_rate)} (limits {m(r.nssf_lel)} / {m(r.nssf_uel)}) · SHIF {pct(r.shif_rate)} (min {m(r.shif_min)}) · Housing levy {pct(r.ahl_rate)} + {pct(r.ahl_employer_rate)} · NITA {m(r.nita_per_employee)}</div>
                <div className="text-slate-500">Overtime ×{Number(r.overtime_multiplier)} of hourly pay (monthly pay ÷ {Number(r.hours_per_month)} h){r.note ? ` · ${r.note}` : ""}</div>
              </div>
            ))}
            <p className="text-xs text-slate-500">The government has proposed that pay up to KES 32,333 a month be free of PAYE, possibly from January 2027. It is not law yet. If it passes, add rates from the start date with the first band at 0%.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="rt-from">Starts on</Label><Input id="rt-from" type="date" value={draft.effective_from ?? ""} onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="rt-rel">Personal relief / month</Label><Input id="rt-rel" type="number" value={draft.personal_relief ?? 0} onChange={(e) => setDraft({ ...draft, personal_relief: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-1">
              <Label>PAYE bands (monthly taxable pay)</Label>
              {(draft.paye_bands ?? []).map((b: PayeBand, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-12">Up to</span>
                  <Input className="w-32" type="number" value={b.upto ?? ""} placeholder="no limit" aria-label={`Band ${i + 1} up to`}
                    onChange={(e) => setDraft({ ...draft, paye_bands: draft.paye_bands!.map((x, j) => (j === i ? { ...x, upto: e.target.value === "" ? null : Number(e.target.value) } : x)) })} />
                  <span>at</span>
                  <Input className="w-24" type="number" step="0.1" value={+(b.rate * 100).toFixed(3)} aria-label={`Band ${i + 1} rate percent`}
                    onChange={(e) => setDraft({ ...draft, paye_bands: draft.paye_bands!.map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) / 100 } : x)) })} /><span>%</span>
                  <Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, paye_bands: draft.paye_bands!.filter((_, j) => j !== i) })} aria-label="Remove band"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, paye_bands: [...(draft.paye_bands ?? []), { upto: null, rate: 0 }] })}>Add band</Button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {([["nssf_lel", "NSSF lower limit"], ["nssf_uel", "NSSF upper limit"], ["shif_min", "SHIF minimum"], ["nita_per_employee", "NITA per employee"], ["hours_per_month", "Hours per month"], ["overtime_multiplier", "Overtime ×"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" step="any" value={Number(draft[k] ?? 0)} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} /></div>
              ))}
              {([["nssf_rate", "NSSF %"], ["shif_rate", "SHIF %"], ["ahl_rate", "Levy % (staff)"], ["ahl_employer_rate", "Levy % (employer)"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{l}</Label><Input type="number" step="0.01" value={+(Number(draft[k] ?? 0) * 100).toFixed(3)} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) / 100 })} /></div>
              ))}
            </div>
            <div className="space-y-1"><Label htmlFor="rt-note">Note (e.g. the law or notice)</Label><Input id="rt-note" value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></div>
          </div>
        )}
        <DialogFooter>
          {!draft ? <><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={startNew}>Add new rates</Button></> : <>
            <Button variant="outline" onClick={() => setDraft(null)}>Back</Button>
            <Button disabled={!draft.effective_from || !(draft.paye_bands ?? []).length || save.isPending} onClick={() => {
              const { id: _id, hotel_id: _h, created_at: _c, ...rest } = draft as PayrollRates & { created_at?: string };
              void _id; void _h; void _c;
              save.mutate(rest, { onSuccess: () => setDraft(null) });
            }}>Save rates</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
