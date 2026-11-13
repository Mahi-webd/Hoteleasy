import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useFolio, useInvoice, useReservationPaid } from "@/hooks/useBilling";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LoadingBlock } from "@/components/common/PageHeader";
import { PAYMENT_METHODS, formatDate, formatMoney2, guestName } from "@/lib/format";
import type { Invoice, InvoiceLine, Payment, Reservation } from "@/lib/db-types";

/**
 * Printable A4 pages. Opened in a new tab from the bill dialog; "Print" uses
 * the browser's print dialog, where staff can also "Save as PDF".
 */

const PrintShell = ({ title, children }: { title: string; children: React.ReactNode }) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print max-w-[210mm] mx-auto mb-3 flex justify-end gap-2 px-2">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save as PDF</Button>
      </div>
      <div className="max-w-[210mm] mx-auto bg-white text-slate-900 shadow print:shadow-none p-10 print:p-0 text-[13px] leading-relaxed">
        {children}
      </div>
    </div>
  );
};

const HotelHeader = ({ h, docTitle, docNo, date }: { h: Invoice["hotel"]; docTitle: string; docNo?: string; date: string }) => (
  <div className="flex justify-between gap-6 border-b pb-5 mb-5">
    <div>
      <div className="text-2xl font-bold">{h.name}</div>
      <div className="text-slate-600 whitespace-pre-line">
        {[h.address, h.city, h.country].filter(Boolean).join(", ")}
        {h.phone && <><br />Tel: {h.phone}</>}
        {h.email && <><br />{h.email}</>}
        {h.kra_pin && <><br />KRA PIN: <strong>{h.kra_pin}</strong></>}
      </div>
    </div>
    <div className="text-right">
      <div className="text-xl font-bold uppercase tracking-wide">{docTitle}</div>
      {docNo && <div className="font-mono">{docNo}</div>}
      <div className="text-slate-600">{date}</div>
    </div>
  </div>
);

const Lines = ({ lines, currency, totals }: {
  lines: InvoiceLine[]; currency: string;
  totals: { net: number; vat: number; levy: number; total: number; vatRate: number; levyRate: number };
}) => (
  <>
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-slate-800 text-left">
          <th className="py-2 pr-2">Date</th>
          <th className="py-2 pr-2">Description</th>
          <th className="py-2 pr-2 text-right">Qty</th>
          <th className="py-2 pr-2 text-right">Unit price</th>
          <th className="py-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-b border-slate-200 align-top">
            <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(l.date)}</td>
            <td className="py-1.5 pr-2">{l.description}</td>
            <td className="py-1.5 pr-2 text-right">{Number(l.quantity)}</td>
            <td className="py-1.5 pr-2 text-right whitespace-nowrap">{Number(l.unit_price).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
            <td className="py-1.5 text-right whitespace-nowrap">{Number(l.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="flex justify-end mt-4">
      <table className="min-w-[280px]">
        <tbody>
          <tr><td className="py-0.5 pr-6 text-slate-600">Amount before tax</td><td className="text-right">{formatMoney2(totals.net, currency)}</td></tr>
          <tr><td className="py-0.5 pr-6 text-slate-600">VAT ({(totals.vatRate * 100).toFixed(0)}%)</td><td className="text-right">{formatMoney2(totals.vat, currency)}</td></tr>
          {Number(totals.levy) !== 0 && (
            <tr><td className="py-0.5 pr-6 text-slate-600">Tourism levy ({(totals.levyRate * 100).toFixed(0)}%)</td><td className="text-right">{formatMoney2(totals.levy, currency)}</td></tr>
          )}
          <tr className="border-t-2 border-slate-800 font-bold text-base"><td className="py-1 pr-6">Total</td><td className="text-right">{formatMoney2(totals.total, currency)}</td></tr>
        </tbody>
      </table>
    </div>
  </>
);

const PayInstructions = ({ h }: { h: Invoice["hotel"] }) =>
  h.mpesa_paybill || h.mpesa_till || h.bank_details ? (
    <div className="mt-6 rounded border p-3 text-slate-700">
      <div className="font-semibold mb-1">How to pay</div>
      {h.mpesa_paybill && <div>M-Pesa Paybill <strong>{h.mpesa_paybill}</strong>{h.mpesa_account ? <>, Account <strong>{h.mpesa_account}</strong></> : null}</div>}
      {h.mpesa_till && <div>M-Pesa Buy Goods Till <strong>{h.mpesa_till}</strong></div>}
      {h.bank_details && <div className="whitespace-pre-line">{h.bank_details}</div>}
    </div>
  ) : null;

const GuestBlock = ({ g, s, b }: { g: Invoice["guest"]; s: Invoice["stay"]; b?: Invoice["bill_to"] }) => (
  <div className="grid grid-cols-2 gap-6 mb-6">
    {b ? (
      <div>
        <div className="text-xs uppercase text-slate-500">Bill to</div>
        <div className="font-semibold">{b.company}</div>
        <div className="text-slate-600">
          {b.kra_pin && <>KRA PIN: <strong>{b.kra_pin}</strong><br /></>}
          {b.address && <>{b.address}<br /></>}
          {b.email}{b.order_ref && <><br />Order / LPO: <strong>{b.order_ref}</strong></>}
          <br />Guest: {g.name}{b.scope === "room" && <> (extras paid by the guest)</>}
        </div>
      </div>
    ) : (
    <div>
      <div className="text-xs uppercase text-slate-500">Bill to</div>
      <div className="font-semibold">{g.name}</div>
      <div className="text-slate-600">
        {g.phone}{g.email && <><br />{g.email}</>}
        {g.id_number && <><br />{g.id_type ?? "ID"}: {g.id_number}</>}
        {g.address && <><br />{g.address}</>}
      </div>
    </div>
    )}
    <div>
      <div className="text-xs uppercase text-slate-500">Stay</div>
      <div>Booking <strong>{s.code}</strong>{s.room && <> · Room <strong>{s.room}</strong></>}</div>
      <div className="text-slate-600">
        {formatDate(s.check_in)} → {formatDate(s.check_out)} ({s.nights} night{s.nights === 1 ? "" : "s"})<br />
        {s.adults} adult{s.adults === 1 ? "" : "s"}{s.children ? `, ${s.children} child${s.children === 1 ? "" : "ren"}` : ""}
      </div>
    </div>
  </div>
);

export const InvoicePrintPage = () => {
  const { id } = useParams();
  const inv = useInvoice(id);
  const paid = useReservationPaid(inv.data?.reservation_id);
  if (inv.isLoading) return <LoadingBlock />;
  if (!inv.data) return <div className="p-10">Invoice not found, or you don't have access to it.</div>;
  const i = inv.data;
  const cur = i.hotel.currency;
  const balance = paid.data ? Number(paid.data.balance) : null;
  return (
    <PrintShell title={`Invoice ${i.number}`}>
      {i.superseded_at && (
        <div className="mb-4 rounded border-2 border-red-500 p-2 text-center font-bold text-red-600">REPLACED — this invoice was superseded on {formatDate(i.superseded_at.slice(0, 10))}</div>
      )}
      <HotelHeader h={i.hotel} docTitle="Tax invoice" docNo={i.number} date={formatDate(i.issued_at.slice(0, 10))} />
      <GuestBlock g={i.guest} s={i.stay} b={i.bill_to} />
      <Lines lines={i.lines} currency={cur} totals={{ net: i.net_total, vat: i.vat_total, levy: i.levy_total, total: i.total, vatRate: i.hotel.vat_rate, levyRate: i.hotel.levy_rate }} />
      {paid.data && !i.superseded_at && (
        <div className="flex justify-end mt-2">
          <table className="min-w-[280px]">
            <tbody>
              <tr><td className="py-0.5 pr-6 text-slate-600">Paid</td><td className="text-right">{formatMoney2(paid.data.payments_total, cur)}</td></tr>
              {Number(paid.data.transferred_total ?? 0) > 0 && (
                <tr><td className="py-0.5 pr-6 text-slate-600">Charged to {i.bill_to?.company ?? "company"} account{i.bill_to ? `, due in ${i.bill_to.terms_days} days` : ""}</td><td className="text-right">{formatMoney2(Number(paid.data.transferred_total), cur)}</td></tr>
              )}
              <tr className="font-semibold"><td className="py-0.5 pr-6">{balance! < 0 ? "Credit" : "Balance due"}</td><td className="text-right">{formatMoney2(Math.abs(balance!), cur)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {balance !== null && (balance > 0.009 || Number(paid.data?.transferred_total ?? 0) > 0) && <PayInstructions h={i.hotel} />}
      {i.hotel.footer && <div className="mt-8 text-center text-slate-500 whitespace-pre-line">{i.hotel.footer}</div>}
      <div className="mt-8 text-center text-xs text-slate-400">Thank you for staying with us.</div>
    </PrintShell>
  );
};

/** Interim bill for an in-house guest (not a tax invoice). */
export const FolioPrintPage = () => {
  const { id } = useParams();
  const { hotel } = useCurrentHotel();
  const folio = useFolio(id);
  const res = useQuery({
    queryKey: ["reservations", "one", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, guests(*), rooms(room_number)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as Reservation & { guests: Invoice["guest"] & { first_name: string; last_name: string; id_type: string | null; id_number: string | null }; rooms: { room_number: string } | null };
    },
  });
  if (folio.isLoading || res.isLoading) return <LoadingBlock />;
  if (!folio.data || !res.data) return <div className="p-10">Bill not found.</div>;
  const r = res.data;
  const live = folio.data.charges.filter((c) => !c.voided_at);
  const h: Invoice["hotel"] = {
    name: hotel.name, address: hotel.address, city: hotel.city, country: hotel.country, phone: hotel.phone, email: hotel.email,
    kra_pin: hotel.kra_pin, currency: hotel.currency, mpesa_paybill: hotel.mpesa_paybill, mpesa_account: hotel.mpesa_account,
    mpesa_till: hotel.mpesa_till, bank_details: hotel.bank_details, footer: hotel.invoice_footer, vat_rate: Number(hotel.vat_rate),
    levy_rate: Number(hotel.tourism_levy_rate),
  };
  const sum = (k: "net_amount" | "vat_amount" | "levy_amount" | "amount") => live.reduce((s, c) => s + Number(c[k]), 0);
  return (
    <PrintShell title={`Bill ${r.code}`}>
      <HotelHeader h={h} docTitle="Interim bill" docNo={r.code} date={formatDate(new Date().toISOString().slice(0, 10))} />
      <GuestBlock
        g={{ name: guestName(r.guests), phone: r.guests?.phone ?? null, email: r.guests?.email ?? null, id_type: r.guests?.id_type ?? null, id_number: r.guests?.id_number ?? null, address: null }}
        s={{ code: r.code, room: r.rooms?.room_number ?? null, check_in: r.check_in, check_out: r.check_out, nights: r.nights, adults: r.adults, children: r.children }}
      />
      <Lines
        lines={live.map((c) => ({ kind: c.kind, description: c.description, date: c.stay_date ?? c.posted_at.slice(0, 10), quantity: c.quantity, unit_price: c.unit_price, net: c.net_amount, vat: c.vat_amount, levy: c.levy_amount, amount: c.amount }))}
        currency={hotel.currency}
        totals={{ net: sum("net_amount"), vat: sum("vat_amount"), levy: sum("levy_amount"), total: sum("amount"), vatRate: h.vat_rate, levyRate: h.levy_rate }}
      />
      {folio.data.payments.filter((p) => !p.voided_at).length > 0 && (
        <div className="mt-6">
          <div className="font-semibold mb-1">Payments received</div>
          {folio.data.payments.filter((p: Payment) => !p.voided_at).map((p) => (
            <div key={p.id} className="flex justify-between border-b border-slate-100 py-1">
              <span>{formatDate(p.received_at.slice(0, 10))} · {PAYMENT_METHODS[p.method]} {p.reference ?? ""}</span>
              <span>{formatMoney2(p.amount, hotel.currency)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end mt-4 text-base font-bold">
        {folio.data.balance < 0 ? "Credit" : "Balance due"}: {formatMoney2(Math.abs(folio.data.balance), hotel.currency)}
      </div>
      {folio.data.balance > 0.009 && <PayInstructions h={h} />}
      <div className="mt-8 text-center text-xs text-slate-400">This is not a tax invoice. A tax invoice is issued at check-out.</div>
    </PrintShell>
  );
};
