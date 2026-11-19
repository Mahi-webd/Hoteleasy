import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTableBoard } from "@/hooks/useTableQr";

/** /table-qr (?outlet=id): one tent card per restaurant table with its QR code, to print. */
export const TableQrSheet = () => {
  const { hotel, allowed } = useCurrentHotel();
  const [params] = useSearchParams();
  const only = params.get("outlet");
  const board = useTableBoard();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const cards = (board.data ?? []).filter((o) => !only || o.id === only)
    .flatMap((o) => o.tables.filter((t) => t.token && t.enabled).map((t) => ({ ...t, outlet: o.name })));

  useEffect(() => { document.title = `Table QR codes · ${hotel.name}`; }, [hotel.name]);
  useEffect(() => {
    let live = true;
    Promise.all(cards.map(async (t) => [t.id, await QRCode.toDataURL(`${window.location.origin}/t/${t.token}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })] as const))
      .then((pairs) => { if (live) setCodes(Object.fromEntries(pairs)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.data, only]);

  if (!allowed("tableqr.admin")) return <p className="p-10 text-center text-slate-600">Only managers can print table QR codes.</p>;
  if (board.isLoading) return <LoadingBlock />;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-6 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 10mm; } .no-print { display: none !important; } .qr-card { break-inside: avoid; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-4">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        <span className="text-sm text-slate-600">{cards.length} tables · cut along the lines and put one on each table (switched-off tables are left out)</span>
      </div>
      {cards.length === 0 ? <p className="text-center text-slate-600">No tables with QR switched on.</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-0 bg-white max-w-[190mm] mx-auto">
          {cards.map((t) => (
            <div key={t.id} className="qr-card border border-dashed border-slate-300 p-4 text-center text-black" data-testid="qr-card">
              <div className="text-[11px] uppercase tracking-wide">{hotel.name} · {t.outlet}</div>
              <div className="text-2xl font-bold">Table {t.name}</div>
              {codes[t.id] ? <img src={codes[t.id]} alt={`QR code for table ${t.name}`} className="mx-auto w-36 h-36 my-2" /> : <div className="w-36 h-36 mx-auto" />}
              <div className="text-sm font-semibold">Scan for the menu</div>
              <div className="text-[11px] text-slate-600">Call a waiter or ask for the bill (cash, card, M-Pesa) from your phone</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default TableQrSheet;
