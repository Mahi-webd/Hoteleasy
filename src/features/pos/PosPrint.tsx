import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useOrder } from "@/hooks/usePos";
import { LoadingBlock } from "@/components/common/PageHeader";
import { POS_METHODS, guestName } from "@/lib/format";
import { orderTitle } from "./OrderScreen";

const money = (n: number) => Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 80 mm receipt-printer friendly page. Set the receipt printer as default, or "Save as PDF". */
const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print max-w-[80mm] mx-auto mb-3 flex justify-center">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>
      <div className="max-w-[80mm] mx-auto bg-white text-black p-3 font-mono text-[12px] leading-snug shadow print:shadow-none">{children}</div>
    </div>
  );
};

export const PosBillPage = () => {
  const { id } = useParams();
  const { hotel } = useCurrentHotel();
  const q = useOrder(id);
  useEffect(() => { if (q.data && new URLSearchParams(location.search).has("auto")) setTimeout(() => window.print(), 300); }, [q.data]);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <div className="p-6">Bill not found.</div>;
  const o = q.data;
  const lines = (o.pos_order_items ?? []).filter((i) => i.status !== "void").sort((a, b) => a.added_at.localeCompare(b.added_at));
  const pays = (o.pos_payments ?? []).filter((p) => !p.voided_at);
  const svcGross = Number(o.service_charge) * (1 + Number(hotel.vat_rate));
  return (
    <Shell title={`Bill #${o.number}`}>
      <div className="text-center">
        <div className="text-[14px] font-bold">{hotel.name}</div>
        {hotel.address && <div>{hotel.address}</div>}
        {hotel.phone && <div>Tel {hotel.phone}</div>}
        {hotel.kra_pin && <div>PIN {hotel.kra_pin}</div>}
        <div className="mt-1">{o.pos_outlets?.name}</div>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between"><span>{o.status === "paid" ? "RECEIPT" : "BILL"} #{o.number}</span><span>{new Date(o.closed_at ?? o.opened_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
      <div>{orderTitle(o)} · {o.guests} guest{o.guests === 1 ? "" : "s"}</div>
      {o.reservations && <div>Guest: {guestName(o.reservations.guests)}</div>}
      <div className="border-t border-dashed border-black my-2" />
      {lines.map((l) => (
        <div key={l.id} className="mb-1">
          <div className="flex justify-between gap-2"><span>{Number(l.quantity)} {l.name}</span><span>{l.comped ? "FREE" : money(Number(l.quantity) * Number(l.unit_price))}</span></div>
          {l.modifiers.length > 0 && <div className="pl-3 text-[11px]">{l.modifiers.map((m) => m.name + (Number(m.price_delta) ? ` +${Number(m.price_delta)}` : "")).join(", ")}</div>}
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between"><span>Subtotal</span><span>{money(o.items_gross)}</span></div>
      {Number(o.discount_amount) > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(o.discount_amount)}</span></div>}
      {Number(o.service_charge) > 0 && <div className="flex justify-between"><span>Service {(Number(o.service_charge_rate) * 100).toFixed(1).replace(/\.0$/, "")}%</span><span>{money(svcGross)}</span></div>}
      <div className="flex justify-between text-[14px] font-bold mt-1"><span>TOTAL {hotel.currency}</span><span>{money(o.total)}</span></div>
      <div className="flex justify-between text-[11px]"><span>incl. VAT</span><span>{money(o.vat_amount)}</span></div>
      {Number(o.levy_amount) > 0 && <div className="flex justify-between text-[11px]"><span>incl. tourism levy</span><span>{money(o.levy_amount)}</span></div>}
      {pays.length > 0 && <div className="border-t border-dashed border-black my-2" />}
      {pays.map((p) => (
        <div key={p.id}>
          <div className="flex justify-between"><span>{POS_METHODS[p.method]}{p.reference ? ` ${p.reference}` : ""}</span><span>{money(p.amount)}</span></div>
          {p.method === "cash" && Number(p.change_given) > 0 && <div className="flex justify-between text-[11px]"><span>Cash {money(p.tendered ?? 0)} · change</span><span>{money(p.change_given ?? 0)}</span></div>}
        </div>
      ))}
      {o.status === "open" && (hotel.mpesa_till || hotel.mpesa_paybill) && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          {hotel.mpesa_till && <div>Pay by M-Pesa Till {hotel.mpesa_till}</div>}
          {hotel.mpesa_paybill && <div>Paybill {hotel.mpesa_paybill}{hotel.mpesa_account ? ` acc ${hotel.mpesa_account}` : ""}</div>}
        </>
      )}
      {pays.some((p) => p.method === "room") && <div className="mt-3">Guest signature: ______________</div>}
      <div className="text-center mt-3">{hotel.invoice_footer || "Asante! Karibu tena."}</div>
    </Shell>
  );
};

export const PosTicketPage = () => {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const station = sp.get("station") ?? "all";
  const q = useOrder(id);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <div className="p-6">Order not found.</div>;
  const o = q.data;
  const items = (o.pos_order_items ?? []).filter((i) => ["sent", "preparing"].includes(i.status) && (station === "all" ? i.station !== "none" : i.station === station));
  return (
    <Shell title={`Ticket #${o.number}`}>
      <div className="text-center text-[16px] font-bold">{station === "bar" ? "BAR" : station === "kitchen" ? "KITCHEN" : "ORDER"}</div>
      <div className="text-[18px] font-bold text-center">{orderTitle(o)}</div>
      <div className="text-center">#{o.number} · {o.pos_outlets?.name} · {o.guests} pax</div>
      <div className="text-center">{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
      <div className="border-t border-dashed border-black my-2" />
      {items.map((i) => (
        <div key={i.id} className="mb-2">
          <div className="text-[15px] font-bold">{Number(i.quantity)} x {i.name}</div>
          {i.modifiers.map((m, k) => <div key={k} className="pl-4">- {m.name}</div>)}
          {i.notes && <div className="pl-4 font-bold">** {i.notes} **</div>}
        </div>
      ))}
      {!items.length && <div>No items waiting at this station.</div>}
    </Shell>
  );
};
