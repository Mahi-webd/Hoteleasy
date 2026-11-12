import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRightLeft, Download, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingBlock } from "@/components/common/PageHeader";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useMove, useMovements } from "@/hooks/useInventory";
import { MOVE_KINDS, addDays, formatMoney, formatQty, todayIn } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { StockMoveKind } from "@/lib/db-types";
import { ItemPicker, LinesEditor, StoreSelect, newLine, toMoveLines, type InvData, type Line } from "./shared";

type Kind = "transfer" | "issue" | "waste" | "return";
const KIND_HELP: Record<Kind, string> = {
  transfer: "Move stock between stores, e.g. from the main store to the kitchen or bar.",
  issue: "Hand stock to a department that uses it up: housekeeping supplies, staff meals, maintenance.",
  waste: "Spoiled, broken or expired stock. Always give a reason.",
  return: "Send goods back to the supplier.",
};
const DEPARTMENTS = ["Housekeeping", "Kitchen", "Bar", "Front office", "Maintenance", "Staff meals", "Laundry", "Conference", "Management"];

export const MoveStock = ({ data, wasteOnly }: { data: InvData; wasteOnly: boolean }) => {
  const { hotel } = useCurrentHotel();
  const move = useMove();
  const [kind, setKind] = useState<Kind>(wasteOnly ? "waste" : "transfer");
  const [from, setFrom] = useState(
    (wasteOnly ? data.locations.find((l) => l.kind === "kitchen") : data.locations.find((l) => l.kind === "main"))?.id ?? data.locations[0]?.id ?? "");
  const [to, setTo] = useState(data.locations.find((l) => l.kind === "kitchen")?.id ?? "");
  const [dept, setDept] = useState("");
  const [sup, setSup] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const ok = !!from && toMoveLines(lines).length > 0 && (kind !== "transfer" || (!!to && to !== from)) && (kind !== "issue" || !!dept.trim())
    && (kind !== "waste" || !!note.trim()) && (kind !== "return" || !!sup);
  const submit = () => move.mutate({ kind, locationId: from, lines: toMoveLines(lines), toLocationId: to, department: dept, note, supplierId: sup },
    { onSuccess: () => { setLines([newLine()]); setNote(""); } });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" />{wasteOnly ? "Record waste" : "Move stock"}</CardTitle>
        <CardDescription>{KIND_HELP[kind]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!wasteOnly && (
          <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as Kind)} className="justify-start flex-wrap">
            <ToggleGroupItem value="transfer">Transfer</ToggleGroupItem>
            <ToggleGroupItem value="issue">Issue to department</ToggleGroupItem>
            <ToggleGroupItem value="waste">Waste</ToggleGroupItem>
            <ToggleGroupItem value="return">Return to supplier</ToggleGroupItem>
          </ToggleGroup>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1"><Label htmlFor="mv-from">From store</Label><StoreSelect id="mv-from" locations={data.locations} value={from} onChange={setFrom} /></div>
          {kind === "transfer" && <div className="space-y-1"><Label htmlFor="mv-to">To store</Label><StoreSelect id="mv-to" locations={data.locations.filter((l) => l.id !== from)} value={to} onChange={setTo} label="Destination" /></div>}
          {kind === "issue" && (
            <div className="space-y-1">
              <Label htmlFor="mv-dept">Department</Label>
              <Input id="mv-dept" list="mv-depts" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="e.g. Housekeeping" />
              <datalist id="mv-depts">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
            </div>
          )}
          {kind === "return" && (
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={sup} onValueChange={setSup}>
                <SelectTrigger aria-label="Supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                <SelectContent>{data.suppliers.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <LinesEditor lines={lines} setLines={setLines} items={data.items} levels={data.levels} locationId={from} currency={hotel.currency} />
        <div className="space-y-1">
          <Label htmlFor="mv-note">{kind === "waste" ? "Reason (required)" : "Note"}</Label>
          <Textarea id="mv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "waste" ? "e.g. Milk expired, broken bottle" : kind === "return" ? "e.g. Damaged on delivery, credit note 123" : ""} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={!ok || move.isPending}>
            {{ transfer: "Move stock", issue: "Issue stock", waste: "Record waste", return: "Record return" }[kind]}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- history
export const MovementHistory = ({ data, seesCost }: { data: InvData; seesCost: boolean }) => {
  const { hotel } = useCurrentHotel();
  const today = todayIn(hotel.timezone);
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [item, setItem] = useState("");
  const [loc, setLoc] = useState("");
  const [kind, setKind] = useState("");
  const moves = useMovements({ from, to, itemId: item || undefined, locationId: loc || undefined, kind: kind || undefined });
  const items = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const locs = useMemo(() => new Map(data.locations.map((l) => [l.id, l.name])), [data.locations]);
  const sups = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s.name])), [data.suppliers]);
  const rows = moves.data ?? [];
  const detail = (m: (typeof rows)[number]) =>
    [m.department && `to ${m.department}`, m.supplier_id && sups.get(m.supplier_id), m.reference, m.note].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <div><CardTitle className="text-lg">Stock history</CardTitle><CardDescription>Every change to stock, newest first. Nothing here can be edited.</CardDescription></div>
          <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => downloadCsv(`stock-history_${from}_${to}`,
            ["Date", "Item", "Unit", "Store", "Type", "Quantity", ...(seesCost ? ["Unit cost", "Value"] : []), "Details"],
            rows.map((m) => [m.created_at.replace("T", " ").slice(0, 16), items.get(m.item_id)?.name, items.get(m.item_id)?.unit, locs.get(m.location_id),
              MOVE_KINDS[m.kind], Number(m.qty), ...(seesCost ? [Number(m.unit_cost), Number(m.value)] : []), detail(m)]))}>
            <Download className="mr-1 h-4 w-4" />CSV
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1"><Label htmlFor="mh-from" className="text-xs">From</Label><Input id="mh-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div className="space-y-1"><Label htmlFor="mh-to" className="text-xs">To</Label><Input id="mh-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <div className="w-44"><StoreSelect locations={data.locations} value={loc} onChange={setLoc} allowAll /></div>
          <Select value={kind || "all"} onValueChange={(v) => setKind(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48" aria-label="Type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{(Object.keys(MOVE_KINDS) as StockMoveKind[]).map((k) => <SelectItem key={k} value={k}>{MOVE_KINDS[k]}</SelectItem>)}</SelectContent>
          </Select>
          <div className="w-56"><ItemPicker items={data.items} value={item} onChange={setItem} label="All items" /></div>
          {item && <Button size="sm" variant="ghost" onClick={() => setItem("")}>Clear item</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {moves.isLoading ? <LoadingBlock /> : (
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Item</TableHead><TableHead>Store</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>{seesCost && <TableHead className="text-right">Value</TableHead>}<TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((m) => {
                const it = items.get(m.item_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">{format(parseISO(m.created_at), "d MMM HH:mm")}</TableCell>
                    <TableCell>{it?.name}</TableCell><TableCell>{locs.get(m.location_id)}</TableCell><TableCell>{MOVE_KINDS[m.kind]}</TableCell>
                    <TableCell className={`text-right tabular-nums ${Number(m.qty) < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      {Number(m.qty) > 0 ? "+" : ""}{formatQty(m.qty, it?.unit)}
                    </TableCell>
                    {seesCost && <TableCell className="text-right tabular-nums">{formatMoney(Number(m.value), "")}</TableCell>}
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={detail(m)}>{detail(m) || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && <TableRow><TableCell colSpan={7}><EmptyState icon={History} title="No stock changes in this period" /></TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
