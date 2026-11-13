import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { supabase } from "@/integrations/supabase/client";
import { precheckOf, type Arrival } from "@/hooks/useOnline";
import { PURPOSES } from "../public/PrecheckPage";

const Field = ({ l, v, wide }: { l: string; v?: string | number | null; wide?: boolean }) => (
  <div className={`border-b border-slate-400 pb-0.5 ${wide ? "col-span-2" : ""}`}>
    <div className="text-[10px] uppercase tracking-wide text-slate-500">{l}</div>
    <div className="min-h-[20px]">{v ?? ""}</div>
  </div>
);

/** A4 guest registration card: filled in from online check-in when the guest did it, otherwise blank lines to complete at the desk. */
const RegCardPage = () => {
  const { id } = useParams();
  const { hotel } = useCurrentHotel();
  const q = useQuery({
    queryKey: ["regcard", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservations")
        .select("id, code, status, check_in, check_out, nights, adults, children, special_requests, room_id, room_type_id, total_amount, rate_per_night, source, guests(id, first_name, last_name, phone, email, nationality, id_type, id_number, is_vip, address, date_of_birth), rooms(room_number), room_types(name), prechecks(*)")
        .eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as (Arrival & { rate_per_night: number; guests: Arrival["guests"] & { address: string | null; date_of_birth: string | null } }) | null;
    },
  });
  useEffect(() => { if (q.data) document.title = `Registration card ${q.data.code}`; }, [q.data]);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <div className="p-6">Reservation not found.</div>;
  const r = q.data; const g = r.guests; const p = precheckOf(r); const sub = !!p?.submitted_at;
  const pick = <T,>(a: T | null | undefined, b: T | null | undefined) => (sub && a ? a : b) ?? null;
  const fmt = (d?: string | null) => (d ? format(parseISO(d), "d MMM yyyy") : "");
  const companions = p?.companions ?? [];
  const blanks = Math.max(0, Math.min(4, r.adults + r.children - 1 - companions.length));
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white py-6 print:py-0">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .no-print { display: none !important; } }`}</style>
      <div className="no-print flex justify-center mb-4"><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button></div>
      <div className="bg-white text-black max-w-[190mm] mx-auto p-8 shadow print:shadow-none text-[13px] space-y-5">
        <div className="flex justify-between items-start border-b-2 border-black pb-3">
          <div><div className="text-lg font-bold">{hotel.name}</div>{hotel.address && <div>{hotel.address}{hotel.city ? `, ${hotel.city}` : ""}</div>}{hotel.phone && <div>Tel {hotel.phone}</div>}</div>
          <div className="text-right"><div className="text-lg font-bold">GUEST REGISTRATION CARD</div><div>Booking {r.code}</div>{sub && <div className="text-xs">Completed online {fmt(p!.submitted_at)}</div>}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field l="Surname" v={pick(p?.last_name, g?.last_name)} /><Field l="First name(s)" v={pick(p?.first_name, g?.first_name)} />
          <Field l="Nationality" v={pick(p?.nationality, g?.nationality)} /><Field l="Country of residence" v={p?.residence} />
          <Field l="ID / passport type" v={pick(p?.id_type, g?.id_type)} /><Field l="ID / passport number" v={pick(p?.id_number, g?.id_number)} />
          <Field l="Date of birth" v={fmt(pick(p?.date_of_birth, g?.date_of_birth))} /><Field l="Mobile" v={pick(p?.phone, g?.phone)} />
          <Field l="Email" v={pick(p?.email, g?.email)} /><Field l="Home address" v={pick(p?.address, g?.address)} />
          <Field l="Arriving from" v={p?.coming_from} /><Field l="Next destination" v={p?.going_to} />
          <Field l="Purpose of visit" v={p?.purpose ? PURPOSES[p.purpose] ?? p.purpose : null} /><Field l="Vehicle registration" v={p?.vehicle_reg} />
        </div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-3">
          <Field l="Room" v={r.rooms?.room_number} /><Field l="Room type" v={r.room_types?.name} />
          <Field l="Arrival" v={fmt(r.check_in)} /><Field l="Departure" v={fmt(r.check_out)} />
          <Field l="Nights" v={r.nights} /><Field l="Adults / children" v={`${r.adults} / ${r.children}`} />
          <Field l={`Rate per night (${hotel.currency})`} v={Number(r.rate_per_night).toLocaleString("en-KE")} /><Field l="Expected arrival time" v={p?.arrival_time} />
        </div>
        {(companions.length > 0 || blanks > 0) && (
          <div>
            <div className="font-semibold mb-1">Other guests in the room</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {companions.map((c, i) => <div key={`c${i}`} className="contents"><Field l="Name" v={c.name} /><Field l="ID / passport" v={c.id_number} /></div>)}
              {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} className="contents"><Field l="Name" /><Field l="ID / passport" /></div>)}
            </div>
          </div>
        )}
        {r.special_requests && <div className="whitespace-pre-line"><span className="font-semibold">Requests: </span>{r.special_requests}</div>}
        {hotel.house_rules && <div><div className="font-semibold mb-1">House rules</div><div className="text-[12px] whitespace-pre-line">{hotel.house_rules}</div></div>}
        <p className="text-[12px]">I confirm the details above are correct. I agree to pay for my stay and any extras charged to my room, and to follow the hotel's rules.
          The hotel keeps these details for the guest register as Kenyan law requires and uses them only for my stay (Data Protection Act, 2019).</p>
        <div className="grid grid-cols-2 gap-8 items-end pt-2">
          <div>
            {p?.signature ? <img src={p.signature} alt="Guest signature" className="h-20" /> : <div className="h-20" />}
            <div className="border-t border-black text-[11px] pt-0.5">Guest signature{p?.signed_name ? `: ${p.signed_name}` : ""}{p?.accepted_at ? `, ${format(parseISO(p.accepted_at), "d MMM yyyy HH:mm")}` : ""}</div>
          </div>
          <div><div className="h-20" /><div className="border-t border-black text-[11px] pt-0.5">Checked by (reception) / ID seen</div></div>
        </div>
      </div>
    </div>
  );
};
export default RegCardPage;
