import { useMemo, useState } from "react";
import { BedDouble, Crown, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useChargeToRoom, useInHouseGuests, usePay } from "@/hooks/usePos";
import { POS_METHODS, formatMoney2, formatShortDate, guestName } from "@/lib/format";
import type { PosOrder, PosPaymentMethod } from "@/lib/db-types";

/** Take payment for what's left on a bill; several payments can settle one bill. */
export const PayDialog = ({ order, onPaid, onClose }: { order: PosOrder; onPaid: () => void; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const cur = hotel.currency;
  const due = Math.round((Number(order.total) - Number(order.paid_total)) * 100) / 100;
  const pay = usePay();
  const charge = useChargeToRoom();
  const guests = useInHouseGuests();
  const [method, setMethod] = useState<PosPaymentMethod | "room">(order.order_type === "room_service" && order.reservation_id ? "room" : "cash");
  const [split, setSplit] = useState(1);
  const [amount, setAmount] = useState(String(due));
  const [tendered, setTendered] = useState("");
  const [ref, setRef] = useState("");
  const [search, setSearch] = useState("");
  const [roomRes, setRoomRes] = useState<string | null>(order.reservation_id);

  const amt = Math.min(Number(amount || 0), due);
  const change = method === "cash" && Number(tendered) > amt ? Number(tendered) - amt : 0;
  const mpesaOk = /^[A-Z0-9]{10}$/.test(ref.trim().toUpperCase());
  const roomList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (guests.data ?? [])
      .filter((g) => !q || g.rooms?.room_number.toLowerCase().includes(q) || guestName(g.guests).toLowerCase().includes(q))
      .sort((a, b) => (a.rooms?.room_number ?? "").localeCompare(b.rooms?.room_number ?? "", undefined, { numeric: true }));
  }, [guests.data, search]);
  const chosen = guests.data?.find((g) => g.id === roomRes);

  const setSplitN = (n: number) => {
    setSplit(n);
    setAmount(String(Math.ceil((due / n) * 100) / 100));
  };

  const submit = () => {
    if (method === "room") {
      if (!chosen) return;
      charge.mutate({ orderId: order.id, reservationId: chosen.id, room: chosen.rooms?.room_number ?? "" }, { onSuccess: () => { onPaid(); onClose(); } });
      return;
    }
    pay.mutate(
      { orderId: order.id, method, amount: amt, tendered: method === "cash" && tendered ? Number(tendered) : null, reference: ref || null },
      {
        onSuccess: (o) => {
          if (o.status === "paid") { onPaid(); onClose(); }
          else { setAmount(String(Math.round((Number(o.total) - Number(o.paid_total)) * 100) / 100)); setTendered(""); setRef(""); }
        },
      },
    );
  };

  const busy = pay.isPending || charge.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Take payment · bill #{order.number}</DialogTitle>
          <DialogDescription>
            Total {formatMoney2(order.total, cur)}{Number(order.paid_total) > 0 && <> · paid {formatMoney2(order.paid_total, cur)}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-blue-50 dark:bg-slate-800 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-300">Still to pay</span>
          <span className="text-2xl font-bold">{formatMoney2(due, cur)}</span>
        </div>

        <Tabs value={method} onValueChange={(v) => setMethod(v as PosPaymentMethod)}>
          <TabsList className="grid grid-cols-4">
            {(["cash", "mpesa", "card", "room"] as const).map((m) => <TabsTrigger key={m} value={m}>{m === "room" ? "Room" : POS_METHODS[m]}</TabsTrigger>)}
          </TabsList>

          {method !== "room" && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Split evenly:</span>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" onClick={() => setSplitN(n)}
                    className={`h-8 w-8 rounded-md border ${split === n ? "bg-blue-600 text-white border-blue-600" : ""}`}>{n}</button>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-amt">Amount for this payment ({cur})</Label>
                <Input id="pay-amt" type="number" min={0.01} step="0.01" max={due} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg" />
                {split > 1 && <p className="text-xs text-slate-500">{split} people × {formatMoney2(Number(amount), cur)}. Take each person's payment in turn.</p>}
              </div>
            </div>
          )}

          <TabsContent value="cash" className="space-y-2">
            <Label htmlFor="pay-tendered">Cash received</Label>
            <Input id="pay-tendered" type="number" min={0} step="50" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(amt)} />
            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000].filter((n) => n >= amt).slice(0, 3).map((n) => (
                <Button key={n} type="button" size="sm" variant="outline" onClick={() => setTendered(String(n))}>{n.toLocaleString()}</Button>
              ))}
            </div>
            {change > 0 && <div className="text-lg font-semibold text-green-700">Change: {formatMoney2(change, cur)}</div>}
          </TabsContent>
          <TabsContent value="mpesa" className="space-y-2">
            <Label htmlFor="pay-ref">M-Pesa code (from the guest's SMS)</Label>
            <Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={10} placeholder="e.g. TK45ABC1XY" className="font-mono text-lg" />
            {hotel.mpesa_till && <p className="text-xs text-slate-500">Till number: {hotel.mpesa_till}</p>}
            {hotel.mpesa_paybill && <p className="text-xs text-slate-500">Paybill {hotel.mpesa_paybill}{hotel.mpesa_account ? `, account ${hotel.mpesa_account}` : ""}</p>}
          </TabsContent>
          <TabsContent value="card" className="space-y-2">
            <Label htmlFor="pay-card">Card slip / approval number (optional)</Label>
            <Input id="pay-card" value={ref} onChange={(e) => setRef(e.target.value)} />
          </TabsContent>
          <TabsContent value="room" className="space-y-2">
            <p className="text-sm text-slate-600">Adds the remaining {formatMoney2(due, cur)} to the guest's room bill, paid at check-out.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Room number or guest name" className="pl-9" />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {guests.isLoading ? <div className="p-3 text-sm text-slate-500">Loading…</div> : !roomList.length ? (
                <div className="p-3 text-sm text-slate-500">No checked-in guest matches.</div>
              ) : roomList.map((g) => (
                <button key={g.id} type="button" onClick={() => setRoomRes(g.id)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between ${roomRes === g.id ? "bg-blue-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                  <span className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-slate-400" />
                    <strong>Room {g.rooms?.room_number}</strong> · {guestName(g.guests)} {g.guests?.is_vip && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </span>
                  <span className="text-xs text-slate-500">until {formatShortDate(g.check_out)}</span>
                </button>
              ))}
            </div>
            {chosen && <p className="text-sm">Confirm with the guest: <strong>{guestName(chosen.guests)}, room {chosen.rooms?.room_number}</strong>.</p>}
          </TabsContent>
        </Tabs>

        <Button className="w-full h-12 text-base bg-green-600 hover:bg-green-700" disabled={busy || (method === "room" ? !chosen : amt <= 0 || (method === "mpesa" && !mpesaOk))} onClick={submit}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {method === "room" ? (chosen ? `Charge ${formatMoney2(due, cur)} to room ${chosen.rooms?.room_number}` : "Choose a guest") : `Record ${POS_METHODS[method]} ${formatMoney2(amt, cur)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
