import { AlertTriangle, Bell, ChevronRight, CircleAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAlerts } from "@/hooks/useAlerts";
import type { HotelAlert } from "@/lib/db-types";

export const SEV = {
  high: { icon: CircleAlert, cls: "text-red-600", dot: "bg-red-500", row: "border-red-200 bg-red-50/60 dark:bg-red-950/20" },
  medium: { icon: AlertTriangle, cls: "text-amber-600", dot: "bg-amber-500", row: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20" },
  low: { icon: Info, cls: "text-slate-500", dot: "bg-slate-400", row: "" },
};

export const AlertRow = ({ a, onOpen }: { a: HotelAlert; onOpen?: () => void }) => {
  const S = SEV[a.severity];
  return (
    <button type="button" onClick={onOpen} className={`w-full text-left rounded-md border px-3 py-2 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 ${S.row}`} data-testid="alert-row">
      <S.icon className={`h-5 w-5 mt-0.5 shrink-0 ${S.cls}`} />
      <span className="flex-1 min-w-0"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-slate-500">{a.detail}</span></span>
      <ChevronRight className="h-4 w-4 mt-1 text-slate-400" />
    </button>
  );
};

/** Bell in the header: what needs attention in this hotel, for this person's job. */
export const AlertsBell = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const q = useAlerts();
  const list = q.data ?? [];
  const high = list.filter((a) => a.severity === "high").length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Alerts${list.length ? ` (${list.length})` : ""}`}>
          <Bell className="h-5 w-5" />
          {list.length > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center ${high ? "bg-red-600" : "bg-amber-500"}`} data-testid="alert-count">{list.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[92vw]">
        <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!list.length ? <div className="px-2 py-4 text-sm text-slate-500 text-center">All good. Nothing needs attention right now.</div>
          : list.map((a) => {
            const S = SEV[a.severity];
            return (
              <DropdownMenuItem key={a.key} onClick={() => onNavigate(a.page)} className="items-start gap-2 py-2">
                <S.icon className={`h-4 w-4 mt-0.5 shrink-0 ${S.cls}`} />
                <span className="flex-1"><span className="block text-sm">{a.title}</span><span className="block text-xs text-slate-500">{a.detail}</span></span>
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** "Needs attention" card for the dashboard. */
export const AlertsCard = ({ onNavigate }: { onNavigate?: (page: string) => void }) => {
  const q = useAlerts();
  const list = q.data ?? [];
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5" />Needs attention</CardTitle></CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-2">
        {list.slice(0, 8).map((a) => <AlertRow key={a.key} a={a} onOpen={() => onNavigate?.(a.page)} />)}
      </CardContent>
    </Card>
  );
};
