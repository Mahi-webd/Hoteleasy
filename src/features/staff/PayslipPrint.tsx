import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { usePayslips } from "@/hooks/useStaff";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollRun, Payslip } from "@/lib/db-types";

const money = (n: number) => Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Row = ({ l, v, bold, neg }: { l: string; v: number; bold?: boolean; neg?: boolean }) => (
  <div className={`flex justify-between py-0.5 ${bold ? "font-semibold border-t border-slate-400 mt-1 pt-1" : ""}`}><span>{l}</span><span className="tabular-nums">{neg && v ? "-" : ""}{money(v)}</span></div>
);

const Slip = ({ p, month, hotel }: { p: Payslip; month: string; hotel: { name: string; address: string | null; kra_pin: string | null; phone: string | null } }) => {
  const deductions = +p.nssf_tier1 + +p.nssf_tier2 + +p.shif + +p.ahl + +p.paye + +p.advances + +p.other_deductions;
  const basisNote = p.pay_type === "daily" ? `${Number(p.days_worked)} day(s) at ${money(p.rate)}` : p.pay_type === "hourly" ? `${Number(p.hours_worked)} hour(s) at ${money(p.rate)}` : "Monthly salary";
  return (
    <div className="payslip bg-white text-black p-8 shadow print:shadow-none text-[13px] max-w-[190mm] mx-auto mb-6 print:mb-0">
      <div className="flex justify-between items-start border-b-2 border-black pb-3">
        <div><div className="text-lg font-bold">{hotel.name}</div>{hotel.address && <div>{hotel.address}</div>}{hotel.phone && <div>Tel {hotel.phone}</div>}{hotel.kra_pin && <div>Employer PIN {hotel.kra_pin}</div>}</div>
        <div className="text-right"><div className="text-lg font-bold">PAYSLIP</div><div>{format(parseISO(month), "MMMM yyyy")}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 py-3 border-b">
        <div><b>{p.full_name}</b></div><div>{[p.job_title, p.department].filter(Boolean).join(", ")}</div>
        <div>KRA PIN: {p.kra_pin || "—"}</div><div>ID: {p.id_no || "—"}</div>
        <div>NSSF: {p.nssf_no || "—"}</div><div>SHA: {p.sha_no || "—"}</div>
      </div>
      <div className="grid grid-cols-2 gap-8 pt-3">
        <div>
          <div className="font-semibold mb-1">Earnings</div>
          <Row l={`Basic pay (${basisNote})`} v={p.basic} />
          {+p.house_allowance > 0 && <Row l="House allowance" v={p.house_allowance} />}
          {+p.other_allowance > 0 && <Row l="Other allowances" v={p.other_allowance} />}
          {+p.overtime_pay > 0 && <Row l={`Overtime (${Number(p.overtime_hours)} h)`} v={p.overtime_pay} />}
          {+p.bonus > 0 && <Row l="Bonus" v={p.bonus} />}
          <Row l="Gross pay" v={p.gross} bold />
        </div>
        <div>
          <div className="font-semibold mb-1">Deductions</div>
          {p.statutory ? <>
            <Row l="NSSF Tier I" v={p.nssf_tier1} /><Row l="NSSF Tier II" v={p.nssf_tier2} />
            <Row l="SHIF" v={p.shif} /><Row l="Affordable housing levy" v={p.ahl} /><Row l="PAYE" v={p.paye} />
          </> : <div className="text-slate-600 py-0.5">No statutory deductions (casual)</div>}
          {+p.advances > 0 && <Row l="Salary advances" v={p.advances} />}
          {+p.other_deductions > 0 && <Row l="Other deductions" v={p.other_deductions} />}
          <Row l="Total deductions" v={deductions} bold />
        </div>
      </div>
      {p.statutory && (
        <div className="mt-4 text-[12px] text-slate-700 border rounded p-2">
          <div className="font-semibold mb-1">Tax workings</div>
          <div className="grid grid-cols-2 gap-x-8">
            <Row l="Taxable pay (gross less NSSF, SHIF, levy)" v={p.taxable} /><Row l="Tax charged" v={p.tax_before_relief} />
            <Row l="Personal relief" v={p.personal_relief} /><Row l="PAYE" v={p.paye} />
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-between items-center border-2 border-black p-3 text-base font-bold">
        <span>NET PAY</span><span className="tabular-nums">KES {money(p.net)}</span>
      </div>
      <div className="mt-2 text-[12px] text-slate-600">
        Paid by {p.pay_method === "bank" ? "bank transfer" : p.pay_method === "cash" ? "cash" : "M-Pesa"}{p.pay_account ? ` to ${p.pay_account}` : ""}.
        {p.note ? ` Note: ${p.note}` : ""} Employer contributions: NSSF {money(p.employer_nssf)}, housing levy {money(p.employer_ahl)}.
      </div>
    </div>
  );
};

export const PayslipPage = () => {
  const { runId } = useParams();
  const [sp] = useSearchParams();
  const only = sp.get("staff");
  const { hotel } = useCurrentHotel();
  const run = useQuery({
    queryKey: ["staff", "run", runId],
    enabled: !!runId,
    queryFn: async () => { const { data, error } = await supabase.from("payroll_runs").select("*").eq("id", runId!).maybeSingle(); if (error) throw error; return data as PayrollRun | null; },
  });
  const slips = usePayslips(runId);
  const list = (slips.data ?? []).filter((p) => !only || p.staff_id === only);
  const title = run.data ? `Payslips ${format(parseISO(run.data.month), "MMM yyyy")}` : "Payslips";
  useEffect(() => { document.title = title; }, [title]);
  if (run.isLoading || slips.isLoading) return <LoadingBlock />;
  if (!run.data || !list.length) return <div className="p-6">Payslip not found, or not approved yet.</div>;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .no-print { display: none !important; } .payslip { page-break-after: always; } .payslip:last-child { page-break-after: auto; } }`}</style>
      <div className="no-print flex justify-center gap-3 mb-4 items-center">
        {run.data.status === "draft" && <span className="text-amber-700 text-sm font-medium">DRAFT: not yet approved</span>}
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print {list.length > 1 ? `${list.length} payslips` : "payslip"}</Button>
      </div>
      {list.map((p) => <Slip key={p.id} p={p} month={run.data!.month} hotel={hotel} />)}
    </div>
  );
};
