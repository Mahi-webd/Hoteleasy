import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useDayReport } from "@/hooks/useAudit";
import { PAYMENT_METHODS } from "@/lib/format";

const m = (v: number) => Number(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (n: number) => `${(Number(n) * 100).toFixed(1)}%`;
const METHOD: Record<string, string> = { ...PAYMENT_METHODS, other: "Other" };
const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => (
  <tr className={b ? "font-semibold border-t border-black" : ""}><td className="py-0.5 pr-4">{l}</td><td className="py-0.5 text-right tabular-nums">{v}</td></tr>
);

/** /day-report/:day: the daily manager's report, A4. */
const DayReportPage = () => {
  const { day = "" } = useParams();
  const q = useDayReport(day);
  useEffect(() => { document.title = `Manager's report ${day}`; }, [day]);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <div className="p-6">Report not available.</div>;
  const r = q.data; const k = r.kpis; const cur = r.hotel.currency;
  const taken = r.payments.reduce((a, p) => a + Number(p.amount), 0);
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print flex justify-center mb-4"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print or save as PDF</Button></div>
      <div className="bg-white text-black max-w-[190mm] mx-auto p-8 shadow print:shadow-none text-[13px] space-y-5">
        <div className="flex justify-between items-start border-b-2 border-black pb-3">
          <div><div className="text-lg font-bold">{r.hotel.name}</div><div>{r.hotel.city}</div></div>
          <div className="text-right"><div className="text-lg font-bold">DAILY MANAGER'S REPORT</div><div>{format(parseISO(r.day), "EEEE d MMMM yyyy")}</div>
            <div className="text-xs">{r.closed ? `Closed ${format(parseISO(r.closed_at!), "d MMM HH:mm")}${r.closed_by ? ` by ${r.closed_by}` : ""}` : "PROVISIONAL: day not closed yet"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="font-semibold mb-1">Rooms</div>
            <table className="w-full"><tbody>
              <Row l="Rooms in the hotel" v={String(r.rooms)} /><Row l="Out of service" v={String(r.out_of_service)} />
              <Row l="Room nights sold" v={String(k.room_nights_sold)} /><Row l="Occupancy" v={pct(k.occupancy)} />
              <Row l="Guests in house" v={String(r.guests)} /><Row l="Arrivals" v={String(r.arrivals)} /><Row l="Departures" v={String(r.departures)} />
              <Row l="No-shows" v={String(r.no_shows)} /><Row l="Cancellations" v={String(r.cancellations)} /><Row l="New bookings taken" v={String(r.new_bookings)} />
            </tbody></table>
          </div>
          <div>
            <div className="font-semibold mb-1">Revenue ({cur}, before VAT and levy)</div>
            <table className="w-full"><tbody>
              <Row l="Rooms" v={m(k.room_revenue)} /><Row l="Food & drink" v={m(k.fnb_revenue)} /><Row l="Other" v={m(k.other_revenue)} />
              <Row l="Total revenue" v={m(k.total_revenue)} b /><Row l="VAT" v={m(k.vat)} /><Row l="Tourism levy" v={m(k.levy)} />
              <Row l="Average room rate (ADR)" v={m(k.adr)} /><Row l="RevPAR" v={m(k.revpar)} />
              <Row l="Month to date revenue" v={m(r.mtd.total_revenue)} b /><Row l="Month to date occupancy" v={pct(r.mtd.occupancy)} />
            </tbody></table>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="font-semibold mb-1">Money taken ({cur})</div>
            <table className="w-full"><tbody>
              {r.payments.map((p) => <Row key={p.method} l={METHOD[p.method] ?? p.method} v={m(p.amount)} />)}
              {!r.payments.length && <Row l="None" v="0" />}
              <Row l="Total" v={m(taken)} b />
            </tbody></table>
          </div>
          <div>
            <div className="font-semibold mb-1">Balances at end of day ({cur})</div>
            <table className="w-full"><tbody>
              <Row l="Owed by guests in house" v={m(r.guest_ledger)} /><Row l="Deposits held for future stays" v={m(r.deposits)} />
              <Row l="Owed by guests who left" v={m(r.guest_debts)} /><Row l="Owed by companies" v={m(r.city_ledger)} />
            </tbody></table>
          </div>
        </div>
        {r.pos.length > 0 && (
          <div><div className="font-semibold mb-1">Restaurant & bar ({cur}, incl. tax)</div>
            <table className="w-full"><thead><tr className="text-left border-b"><th>Outlet</th><th className="text-right">Bills</th><th className="text-right">Sales</th></tr></thead>
              <tbody>{r.pos.map((p) => <tr key={p.outlet}><td>{p.outlet}</td><td className="text-right">{p.bills}</td><td className="text-right tabular-nums">{m(p.sales)}</td></tr>)}</tbody></table></div>
        )}
        {r.shifts.length > 0 && (
          <div><div className="font-semibold mb-1">Cash shifts closed</div>
            <table className="w-full"><thead><tr className="text-left border-b"><th>Cashier</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="text-right">Over / short</th></tr></thead>
              <tbody>{r.shifts.map((s, i) => <tr key={i}><td>{s.by ?? "?"}</td><td className="text-right">{m(s.expected ?? 0)}</td><td className="text-right">{m(s.counted ?? 0)}</td>
                <td className={`text-right ${Number(s.variance) < 0 ? "font-semibold" : ""}`}>{m(s.variance ?? 0)}</td></tr>)}</tbody></table></div>
        )}
        {r.voids > 0 && <div>Voided charges and payments today: <b>{r.voids}</b> (see Billing for reasons).</div>}
        {r.notes && <div className="border rounded p-2"><div className="font-semibold">Night audit notes</div><div className="whitespace-pre-line">{r.notes}</div></div>}
        <div className="grid grid-cols-2 gap-8 pt-6"><div className="border-t border-black pt-1 text-xs">Night auditor</div><div className="border-t border-black pt-1 text-xs">General manager</div></div>
      </div>
    </div>
  );
};
export default DayReportPage;
