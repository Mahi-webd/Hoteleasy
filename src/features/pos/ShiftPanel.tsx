import { useMemo, useState, type FormEvent } from "react";
import { Lock, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import { useCloseShift, useMyShift, useOpenShift, useShiftReport, useShifts } from "@/hooks/usePos";
import { LoadingBlock } from "@/components/common/PageHeader";
import { POS_METHODS, addDays, formatMoney2, todayIn } from "@/lib/format";
import type { PosPaymentMethod, PosShift, ShiftReport } from "@/lib/db-types";

/** Open a cash shift with a float; X report while open; blind count to close → Z report. */
export const ShiftPanel = () => {
  const { hotel, can } = useCurrentHotel();
  const shift = useMyShift();
  const openShift = useOpenShift();
  const [float, setFloat] = useState("2000");
  const [closed, setClosed] = useState<PosShift | null>(null);

  if (shift.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      {closed && <ZReport s={closed} currency={hotel.currency} onDone={() => setClosed(null)} />}
      {closed ? null : !shift.data ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Open your cash shift</CardTitle>
            <CardDescription>Count the float in your drawer before you start. Your payments are counted against this shift.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); openShift.mutate(Number(float || 0)); }}>
              <Input type="number" min={0} step="50" value={float} onChange={(e) => setFloat(e.target.value)} aria-label={`Opening float (${hotel.currency})`} />
              <Button type="submit" disabled={openShift.isPending}>Open shift</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <OpenShift shift={shift.data} currency={hotel.currency} onClosed={setClosed} />
      )}
      {can("owner", "manager", "accountant") && <ShiftHistory />}
    </div>
  );
};

const OpenShift = ({ shift, currency, onClosed }: { shift: PosShift; currency: string; onClosed: (s: PosShift) => void }) => {
  const report = useShiftReport(shift.id);
  const close = useCloseShift();
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    close.mutate({ shiftId: shift.id, counted: Number(counted), notes }, { onSuccess: (s) => onClosed(s) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your shift · open since {new Date(shift.opened_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</CardTitle>
        <CardDescription>Live totals (X report). Nothing is final until you close the shift.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.data && <Totals r={report.data} currency={currency} hideExpected={counting} />}
        {!counting ? (
          <Button variant="outline" onClick={() => setCounting(true)}><Lock className="mr-2 h-4 w-4" />Close shift</Button>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-lg border p-4 max-w-md">
            <p className="text-sm text-slate-600">Count all the cash in your drawer, including the float, and enter the total. The expected amount is shown after you submit.</p>
            <div className="space-y-1">
              <Label htmlFor="cnt">Cash counted ({currency})</Label>
              <Input id="cnt" type="number" min={0} step="1" value={counted} onChange={(e) => setCounted(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cnt-notes">Notes (optional)</Label>
              <Input id="cnt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 500 note given to manager" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCounting(false)}>Back</Button>
              <Button type="submit" disabled={close.isPending || counted === ""}>Close shift</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

const Totals = ({ r, currency, hideExpected }: { r: ShiftReport; currency: string; hideExpected?: boolean }) => {
  const methods = Object.entries(r.by_method) as [PosPaymentMethod, number][];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <Stat label="Opening float" value={formatMoney2(r.opening_float, currency)} />
      {methods.map(([m, v]) => <Stat key={m} label={POS_METHODS[m]} value={formatMoney2(v, currency)} />)}
      <Stat label="Bills settled" value={String(r.bills)} />
      {!hideExpected && <Stat label="Cash expected in drawer" value={formatMoney2(r.expected_cash, currency)} strong />}
    </div>
  );
};

const Stat = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`rounded-lg border p-3 ${strong ? "border-blue-300 bg-blue-50 dark:bg-slate-800" : ""}`}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="font-bold">{value}</div>
  </div>
);

const ZReport = ({ s, currency, onDone }: { s: PosShift; currency: string; onDone: () => void }) => {
  const v = Number(s.variance ?? 0);
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Shift closed · Z report</CardTitle>
        <CardDescription>{new Date(s.opened_at).toLocaleString("en-GB")} → {s.closed_at && new Date(s.closed_at).toLocaleString("en-GB")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.z_report && <Totals r={s.z_report} currency={currency} />}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Expected cash" value={formatMoney2(s.expected_cash, currency)} />
          <Stat label="Counted" value={formatMoney2(s.counted_cash, currency)} />
          <div className={`rounded-lg border p-3 ${Math.abs(v) < 0.01 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="text-xs text-slate-500">{v < 0 ? "Short" : v > 0 ? "Over" : "Balanced"}</div>
            <div className="font-bold">{formatMoney2(Math.abs(v), currency)}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button onClick={onDone}>Done</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ShiftHistory = () => {
  const { hotel } = useCurrentHotel();
  const since = useMemo(() => `${addDays(todayIn(hotel.timezone), -7)}T00:00:00`, [hotel.timezone]);
  const shifts = useShifts(since);
  const team = useTeam();
  const names = new Map(team.data?.map((m) => [m.user_id, m.full_name || m.email]) ?? []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Shifts in the last 7 days</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Cashier</TableHead><TableHead>Opened</TableHead><TableHead>Closed</TableHead><TableHead className="text-right">Expected cash</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Over / short</TableHead></TableRow></TableHeader>
          <TableBody>
            {shifts.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{names.get(s.user_id) ?? "—"}</TableCell>
                <TableCell className="text-sm">{new Date(s.opened_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                <TableCell className="text-sm">{s.closed_at ? new Date(s.closed_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Open"}</TableCell>
                <TableCell className="text-right">{s.expected_cash != null ? formatMoney2(s.expected_cash, currency(hotel)) : "—"}</TableCell>
                <TableCell className="text-right">{s.counted_cash != null ? formatMoney2(s.counted_cash, currency(hotel)) : "—"}</TableCell>
                <TableCell className={`text-right font-medium ${Number(s.variance) < 0 ? "text-red-600" : Number(s.variance) > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {s.variance != null ? formatMoney2(s.variance, currency(hotel)) : ""}
                </TableCell>
              </TableRow>
            ))}
            {!shifts.data?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No shifts yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const currency = (h: { currency: string }) => h.currency;
