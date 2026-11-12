import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { EmptyState, LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { WrongPinError } from "@/hooks/usePos";
import { useCancelCount, useCounts, usePostCount, useSaveCountLine, useStartCount } from "@/hooks/useInventory";
import { formatMoney, formatQty } from "@/lib/format";
import type { StockCount } from "@/lib/db-types";
import { StoreSelect, onHand, type InvData } from "./shared";

export const StockCounts = ({ data, admin }: { data: InvData; admin: boolean }) => {
  const counts = useCounts();
  const start = useStartCount();
  const [loc, setLoc] = useState(data.locations[0]?.id ?? "");
  const [view, setView] = useState<string | null>(null);
  if (counts.isLoading) return <LoadingBlock />;
  const list = counts.data ?? [];
  const open = list.filter((c) => c.status === "open");
  const current = list.find((c) => c.id === view) ?? open[0] ?? null;
  const store = (id: string) => data.locations.find((l) => l.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock counts</CardTitle>
          <CardDescription>Count what is physically on the shelves. When posted, differences become adjustments{admin ? "" : " (a manager approves with their PIN)"}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-56"><Label htmlFor="ct-loc">Store</Label><StoreSelect id="ct-loc" locations={data.locations} value={loc} onChange={setLoc} /></div>
          <Button onClick={() => start.mutate({ locationId: loc }, { onSuccess: (id) => setView(id as string) })} disabled={!loc || start.isPending}>
            <ClipboardCheck className="mr-2 h-4 w-4" />Start a count
          </Button>
          {open.length > 0 && (
            <div className="flex gap-2 flex-wrap">{open.map((c) => (
              <Button key={c.id} variant={current?.id === c.id ? "secondary" : "outline"} size="sm" onClick={() => setView(c.id)}>Open: #{c.number} {store(c.location_id)}</Button>
            ))}</div>
          )}
        </CardContent>
      </Card>

      {current && <CountSheet key={current.id} data={data} count={current} admin={admin} onClose={() => setView(null)} />}

      <Card>
        <CardHeader><CardTitle className="text-lg">Past counts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Store</TableHead><TableHead>Started</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Items counted</TableHead><TableHead className="text-right">Difference</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {list.filter((c) => c.status !== "open").map((c) => (
                <TableRow key={c.id}>
                  <TableCell>#{c.number}</TableCell><TableCell>{store(c.location_id)}</TableCell>
                  <TableCell>{format(parseISO(c.created_at), "d MMM yyyy HH:mm")}</TableCell>
                  <TableCell>{c.status === "posted" ? <Badge variant="secondary">Posted</Badge> : <Badge variant="outline">Cancelled</Badge>}</TableCell>
                  <TableCell className="text-right">{(c.stock_count_lines ?? []).filter((l) => l.counted != null).length}</TableCell>
                  <TableCell className={`text-right tabular-nums ${Number(c.variance_value) < 0 ? "text-red-700" : ""}`}>{c.variance_value != null ? formatMoney(Number(c.variance_value), "") : "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setView(c.id)}>View</Button></TableCell>
                </TableRow>
              ))}
              {!list.some((c) => c.status !== "open") && <TableRow><TableCell colSpan={7}><EmptyState icon={ClipboardCheck} title="No counts yet" /></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const CountSheet = ({ data, count, admin, onClose }: { data: InvData; count: StockCount; admin: boolean; onClose: () => void }) => {
  const { hotel } = useCurrentHotel();
  const saveLine = useSaveCountLine();
  const post = usePostCount();
  const cancel = useCancelCount();
  const [q, setQ] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const items = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const isOpen = count.status === "open";
  const lines = (count.stock_count_lines ?? [])
    .map((l) => ({ ...l, item: items.get(l.item_id)! }))
    .filter((l) => l.item && (!q || l.item.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.item.category.localeCompare(b.item.category) || a.item.name.localeCompare(b.item.name));
  const counted = (count.stock_count_lines ?? []).filter((l) => l.counted != null).length;
  // Managers see the system quantity while counting; storekeepers count blind.
  const showExpected = admin || !isOpen;
  const expected = (itemId: string, posted: number | null) => (isOpen ? onHand(data.levels, itemId, count.location_id) : Number(posted ?? 0));

  const doPost = (p?: string) => post.mutate({ countId: count.id, pin: p }, {
    onSuccess: () => { setPinOpen(false); onClose(); },
    onError: (e) => { if (e instanceof WrongPinError) setPinErr("Wrong manager PIN"); },
  });

  let lastCat = "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-lg">Count #{count.number} · {data.locations.find((l) => l.id === count.location_id)?.name}</CardTitle>
          <CardDescription>{isOpen ? `${counted} of ${count.stock_count_lines?.length ?? 0} items counted. Leave an item blank to skip it; enter 0 if there is none.`
            : `Posted ${count.posted_at ? format(parseISO(count.posted_at), "d MMM yyyy HH:mm") : ""}. Difference ${formatMoney(Number(count.variance_value ?? 0), hotel.currency)}.`}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Find item" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" aria-label="Find item in count" />
          {isOpen && <ConfirmButton variant="outline" title="Cancel this count?" description="Nothing changes in stock." onConfirm={() => cancel.mutate(count.id, { onSuccess: onClose })}>Cancel count</ConfirmButton>}
          {isOpen && <Button disabled={!counted || post.isPending} onClick={() => (admin ? doPost() : (setPin(""), setPinErr(""), setPinOpen(true)))}>Post count</Button>}
          {!isOpen && <Button variant="outline" onClick={onClose}>Close</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="w-40">Counted</TableHead>
            {showExpected && <TableHead className="text-right">{isOpen ? "System" : "Expected"}</TableHead>}
            {showExpected && <TableHead className="text-right">Difference</TableHead>}
            {showExpected && <TableHead className="text-right">Value</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {lines.map((l) => {
              const exp = expected(l.item_id, l.expected);
              const diff = l.counted != null ? Number(l.counted) - exp : null;
              const cost = isOpen ? Number(l.item.avg_cost) : Number(l.unit_cost ?? 0);
              const head = l.item.category !== lastCat ? (lastCat = l.item.category) : null;
              return [
                head && <TableRow key={`h-${head}`} className="bg-slate-50 dark:bg-slate-900/50"><TableCell colSpan={5} className="text-xs font-semibold uppercase text-slate-500 py-1.5">{head}</TableCell></TableRow>,
                <TableRow key={l.item_id}>
                  <TableCell>{l.item.name}</TableCell>
                  <TableCell>
                    {isOpen ? (
                      <div className="relative">
                        <Input type="number" min={0} step="any" inputMode="decimal" defaultValue={l.counted ?? ""} aria-label={`Counted ${l.item.name}`} className="pr-12"
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== (l.counted == null ? null : Number(l.counted))) saveLine.mutate({ countId: count.id, itemId: l.item_id, counted: v });
                          }} />
                        <span className="absolute right-2 top-2.5 text-xs text-slate-500">{l.item.unit}</span>
                      </div>
                    ) : formatQty(l.counted, l.item.unit)}
                  </TableCell>
                  {showExpected && <TableCell className="text-right tabular-nums text-slate-500">{formatQty(exp)}</TableCell>}
                  {showExpected && <TableCell className={`text-right tabular-nums ${diff && diff < 0 ? "text-red-700" : diff && diff > 0 ? "text-emerald-700" : ""}`}>{diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatQty(diff)}`}</TableCell>}
                  {showExpected && <TableCell className="text-right tabular-nums">{diff ? formatMoney(diff * cost, "") : "—"}</TableCell>}
                </TableRow>,
              ];
            })}
          </TableBody>
        </Table>
      </CardContent>
      {pinOpen && (
        <Dialog open onOpenChange={setPinOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Manager approval</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">Posting changes stock levels. A manager enters their PIN.</p>
            <form onSubmit={(e) => { e.preventDefault(); doPost(pin); }} className="space-y-3">
              <Input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} aria-label="Manager PIN" placeholder="PIN" />
              {pinErr && <p className="text-sm text-red-600">{pinErr}</p>}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setPinOpen(false)}>Cancel</Button><Button type="submit" disabled={!pin || post.isPending}>Approve and post</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};
