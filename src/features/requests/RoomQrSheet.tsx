import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useResetRoomLink, useRoomLinks } from "@/hooks/useRequests";

/** /room-qr: one card per room with its QR code, to print and put in the rooms. */
export const RoomQrSheet = () => {
  const { hotel, allowed } = useCurrentHotel();
  const links = useRoomLinks(true);
  const reset = useResetRoomLink();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const list = (links.data ?? []).filter((l) => l.rooms).sort((a, b) => a.rooms!.room_number.localeCompare(b.rooms!.room_number, undefined, { numeric: true }));
  useEffect(() => { document.title = `Room QR codes · ${hotel.name}`; }, [hotel.name]);
  useEffect(() => {
    let live = true;
    Promise.all(list.map(async (l) => [l.room_id, await QRCode.toDataURL(`${window.location.origin}/r/${l.token}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })] as const))
      .then((pairs) => { if (live) setCodes(Object.fromEntries(pairs)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links.data]);
  if (links.isLoading) return <LoadingBlock />;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-6 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display: none !important; } .qr-card { break-inside: avoid; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-4">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        <span className="text-sm text-slate-600">{list.length} rooms · cut along the lines and place one in each room</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-0 bg-white max-w-[190mm] mx-auto">
        {list.map((l) => (
          <div key={l.room_id} className="qr-card border border-dashed border-slate-300 p-4 text-center text-black" data-testid="qr-card">
            <div className="text-xs uppercase tracking-wide">{hotel.name}</div>
            <div className="text-xl font-bold">Room {l.rooms!.room_number}</div>
            {codes[l.room_id] ? <img src={codes[l.room_id]} alt={`QR code for room ${l.rooms!.room_number}`} className="mx-auto w-36 h-36 my-2" /> : <div className="w-36 h-36 mx-auto" />}
            <div className="text-sm font-semibold">Need anything?</div>
            <div className="text-[11px] text-slate-600">Scan with your phone camera: towels, cleaning, repairs, taxi, wake-up call…</div>
            {allowed("requests.settings") && (
              <button type="button" className="no-print mt-2 text-[11px] text-slate-500 underline inline-flex items-center gap-1"
                onClick={() => { if (confirm(`Make a new QR code for room ${l.rooms!.room_number}? The old sticker will stop working.`)) reset.mutate(l.room_id); }}>
                <RefreshCw className="h-3 w-3" />new code
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
export default RoomQrSheet;
