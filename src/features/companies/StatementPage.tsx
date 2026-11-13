import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useCompanyStatement } from "@/hooks/useCompanies";
import { todayIn } from "@/lib/format";

const m = (v: number) => Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (s: string) => format(parseISO(s), "d MMM yyyy");
const KIND = { stay: "Stay", payment: "Payment – thank you", credit: "Credit note", charge: "Charge" };

/** A4 statement of account for a company, ready to print or save as PDF and email. */
const StatementPage = () => {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const from = sp.get("from") ?? `${today.slice(0, 7)}-01`;
  const to = sp.get("to") ?? today;
  const q = useCompanyStatement(id ?? null, from, to);
  useEffect(() => { if (q.data) document.title = `Statement ${q.data.company.name} ${to}`; }, [q.data, to]);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <div className="p-6">Statement not found, or you don't have access to it.</div>;
  const s = q.data; const h = s.hotel; const c = s.company;
  const buckets: [string, number][] = [["Not yet due", s.ageing.current], ["1–30 days", s.ageing.d30], ["31–60 days", s.ageing.d60], ["61–90 days", s.ageing.d90], ["Over 90 days", s.ageing.d90p]];
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print flex justify-center mb-4"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print or save as PDF</Button></div>
      <div className="bg-white text-black max-w-[190mm] mx-auto p-8 shadow print:shadow-none text-[13px] space-y-5">
        <div className="flex justify-between items-start border-b-2 border-black pb-3">
          <div><div className="text-lg font-bold">{h.name}</div>{h.address && <div>{h.address}{h.city ? `, ${h.city}` : ""}</div>}
            {h.phone && <div>Tel {h.phone}</div>}{h.email && <div>{h.email}</div>}{h.kra_pin && <div>PIN {h.kra_pin}</div>}</div>
          <div className="text-right"><div className="text-lg font-bold">STATEMENT OF ACCOUNT</div><div>{d(s.from)} – {d(s.to)}</div><div>Printed {d(today)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div><div className="text-[10px] uppercase tracking-wide text-slate-500">Account</div><div className="font-semibold">{c.name}</div>
            {c.kra_pin && <div>PIN {c.kra_pin}</div>}{c.address && <div>{c.address}</div>}{c.contact_name && <div>Attn: {c.contact_name}</div>}{c.email && <div>{c.email}</div>}</div>
          <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-slate-500">{s.closing < 0 ? "In credit" : "Amount due"}</div>
            <div className="text-2xl font-bold">{h.currency} {m(Math.abs(s.closing))}</div><div>Terms: {c.terms_days} days from date of stay</div></div>
        </div>
        <table className="w-full border-collapse">
          <thead><tr className="border-b-2 border-black text-left">
            <th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2">Details</th><th className="py-1.5 pr-2">Invoice / ref</th><th className="py-1.5 pr-2">Due</th>
            <th className="py-1.5 pr-2 text-right">Charged</th><th className="py-1.5 pr-2 text-right">Paid</th><th className="py-1.5 text-right">Balance</th></tr></thead>
          <tbody>
            <tr className="border-b"><td className="py-1" colSpan={6}>Balance brought forward</td><td className="py-1 text-right">{m(s.opening)}</td></tr>
            {s.entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-2 whitespace-nowrap">{d(e.date)}</td>
                <td className="py-1 pr-2">{KIND[e.kind]}{e.kind !== "payment" || e.description !== "Payment received" ? `: ${e.description}` : ""}</td>
                <td className="py-1 pr-2">{[e.invoice, e.reference].filter(Boolean).join(" · ")}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{e.due ? d(e.due) : ""}</td>
                <td className="py-1 pr-2 text-right">{e.amount > 0 ? m(e.amount) : ""}</td>
                <td className="py-1 pr-2 text-right">{e.amount < 0 ? m(-e.amount) : ""}</td>
                <td className="py-1 text-right">{m(e.balance)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black font-bold"><td className="py-1.5" colSpan={6}>{s.closing < 0 ? "In credit" : "Balance due"} at {d(s.to)}</td><td className="py-1.5 text-right">{m(s.closing)}</td></tr>
          </tbody>
        </table>
        <table className="w-full border-collapse text-center">
          <thead><tr>{buckets.map(([l]) => <th key={l} className="border p-1 text-[11px] font-semibold bg-slate-50">{l}</th>)}</tr></thead>
          <tbody><tr>{buckets.map(([l, v]) => <td key={l} className="border p-1">{m(v)}</td>)}</tr></tbody>
        </table>
        {(h.mpesa_paybill || h.bank_details) && (
          <div className="rounded border p-3"><div className="font-semibold mb-1">How to pay</div>
            {h.mpesa_paybill && <div>M-Pesa Paybill <b>{h.mpesa_paybill}</b>, Account <b>{h.mpesa_account || c.name}</b></div>}
            {h.bank_details && <div className="whitespace-pre-line">{h.bank_details}</div>}
            <div className="text-[12px] text-slate-600 mt-1">Please quote the invoice numbers with your payment.</div></div>
        )}
      </div>
    </div>
  );
};
export default StatementPage;
