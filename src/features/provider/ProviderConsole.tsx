// HotelEasy provider console (/provider): for the HotelEasy team, not hotel staff.
// Dashboard · Companies (licences) · Plans (pages, users, price) · Settings (sign-up, trial, support contact).
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { addDays, addMonths, addYears, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  AlertTriangle, Ban, Building2, CalendarClock, CheckCircle2, Crown, Loader2, LogOut, Pencil, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Trash2, Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 as Spinner } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useCompanies, useCompany, useDeletePlan, useIsProvider, useModules, useOverview, usePlans, useProviderSettings, useSaveLicense,
  useSaveOwner, useSavePlan, useSaveProviderSettings,
  type CompanyRow, type CompanyState, type LicensePlan, type PlanInput, type ProviderSettings,
} from "@/hooks/useProvider";
import { RegisterCompany } from "./RegisterCompany";

const day = (d: string | null) => (d ? format(parseISO(d), "d MMM yyyy") : "—");
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const STATE: Record<CompanyState, { label: string; cls: string }> = {
  active: { label: "Active", cls: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40" },
  expiring: { label: "Expiring soon", cls: "border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40" },
  expired: { label: "Expired", cls: "border-red-300 text-red-700 bg-red-50 dark:bg-red-950/40" },
  suspended: { label: "Suspended", cls: "border-slate-400 text-slate-700 bg-slate-100 dark:bg-slate-800" },
  not_started: { label: "Starts later", cls: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/40" },
};
export const StateBadge = ({ s }: { s: CompanyState }) => <Badge variant="outline" className={cn("whitespace-nowrap", STATE[s]?.cls)}>{STATE[s]?.label ?? s}</Badge>;

const ProviderConsole = () => {
  const { user, signOut, loading } = useAuth();
  const isProvider = useIsProvider();
  const [tab, setTab] = useState("dashboard");
  const [registering, setRegistering] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading || isProvider.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!user) return <Navigate to="/provider/login" replace />;
  if (!isProvider.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md"><CardContent className="space-y-3 p-6 text-sm">
          <p className="font-medium">This page is for the HotelEasy provider team.</p>
          <p className="text-slate-600">Your account ({user.email}) isn't on the provider team. If it should be, add it once in the Supabase SQL Editor:</p>
          <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">{`insert into public.platform_admins (user_id)\nselect id from auth.users where email = '${user.email}';`}</pre>
          <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><ShieldCheck className="h-5 w-5" /></div>
          <div className="flex-1 leading-tight"><div className="font-semibold">HotelEasy provider</div><div className="text-xs text-slate-500">{user.email}</div></div>
          <Button size="sm" onClick={() => setRegistering(true)}><Plus className="mr-1 h-4 w-4" />Register company</Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><Dashboard onOpen={setOpenId} onRegister={() => setRegistering(true)} /></TabsContent>
          <TabsContent value="companies"><Companies onOpen={setOpenId} /></TabsContent>
          <TabsContent value="plans"><Plans /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
      <RegisterCompany open={registering} onClose={(id) => { setRegistering(false); if (id) setOpenId(id); }} />
      <CompanyDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};
export default ProviderConsole;

// ---------------------------------------------------------------- dashboard
const Stat = ({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ElementType; tone?: string }) => (
  <Card><CardContent className="flex items-center gap-3 p-4">
    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone ?? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950")}><Icon className="h-5 w-5" /></div>
    <div><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
  </CardContent></Card>
);

const Dashboard = ({ onOpen, onRegister }: { onOpen: (id: string) => void; onRegister: () => void }) => {
  const o = useOverview();
  if (o.isLoading) return <div className="py-16 text-center"><Spinner className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>;
  if (o.isError || !o.data) return <SetupNeeded />;
  const d = o.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hotel companies" value={d.companies} icon={Building2} />
        <Stat label="Active licences" value={d.active} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950" />
        <Stat label="Expiring soon" value={d.expiring} icon={CalendarClock} tone="bg-amber-50 text-amber-600 dark:bg-amber-950" />
        <Stat label="Expired or suspended" value={d.expired + d.suspended} icon={Ban} tone="bg-red-50 text-red-600 dark:bg-red-950" />
        <Stat label="Users (logins)" value={`${d.users}${d.user_limit ? ` / ${d.user_limit}` : ""}`} icon={Users} />
        <Stat label="Monthly revenue (active plans)" value={formatMoney(Number(d.monthly_revenue), "KES")} icon={Crown} tone="bg-violet-50 text-violet-600 dark:bg-violet-950" />
        <Stat label="Active plans" value={d.plans} icon={Settings2} />
        <Card className="flex items-center justify-center"><Button onClick={onRegister}><Plus className="mr-1 h-4 w-4" />Register a company</Button></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Renewals in the next 30 days</CardTitle><CardDescription>And licences that have already ended.</CardDescription></CardHeader>
          <CardContent className="p-0">{d.renew_soon.length ? <CompanyList rows={d.renew_soon} onOpen={onOpen} /> : <p className="p-6 text-sm text-slate-500">Nothing to renew soon.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recently registered</CardTitle></CardHeader>
          <CardContent className="p-0">{d.recent.length ? <CompanyList rows={d.recent} onOpen={onOpen} /> : <p className="p-6 text-sm text-slate-500">No companies yet.</p>}</CardContent>
        </Card>
      </div>
    </div>
  );
};

const SetupNeeded = () => (
  <Card><CardContent className="space-y-2 p-6 text-sm">
    <p className="font-medium">The provider console needs a database update.</p>
    <p className="text-slate-600">Run <code>supabase/migrations/20261118120000_provider_licences.sql</code> in the Supabase SQL Editor, then reload.</p>
  </CardContent></Card>
);

const CompanyList = ({ rows, onOpen }: { rows: CompanyRow[]; onOpen: (id: string) => void }) => (
  <ul className="divide-y">
    {rows.map((c) => (
      <li key={c.hotel.id}>
        <button type="button" onClick={() => onOpen(c.hotel.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{c.hotel.name}</div>
            <div className="truncate text-xs text-slate-500">{c.license.plan_name ?? "No plan"} · {c.license.ends_on ? `ends ${day(c.license.ends_on)}` : "no end date"}</div>
          </div>
          {c.days_left != null && c.days_left >= 0 && c.days_left <= 30 && <span className="text-xs text-slate-500 tabular-nums">{c.days_left} d</span>}
          <StateBadge s={c.state} />
        </button>
      </li>
    ))}
  </ul>
);

// ---------------------------------------------------------------- companies
const Companies = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const list = useCompanies();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | CompanyState>("all");
  const rows = useMemo(() => (list.data ?? []).filter((c) =>
    (f === "all" || c.state === f) &&
    (!q.trim() || [c.hotel.name, c.hotel.city, c.license.owner_email, c.owner?.email, c.license.plan_name].some((x) => x?.toLowerCase().includes(q.trim().toLowerCase())))), [list.data, q, f]);
  if (list.isError) return <SetupNeeded />;
  return (
    <Card>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:space-y-0">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hotel, city, owner, plan" aria-label="Search companies" /></div>
        <div className="flex flex-wrap gap-1">
          {(["all", "active", "expiring", "expired", "suspended", "not_started"] as const).map((k) => (
            <Button key={k} size="sm" variant={f === k ? "default" : "outline"} onClick={() => setF(k)}>{k === "all" ? "All" : STATE[k].label}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {list.isLoading ? <div className="py-12 text-center"><Spinner className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                <tr><th className="px-4 py-2">Hotel</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Licence</th><th className="px-4 py-2">Users</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.hotel.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => onOpen(c.hotel.id)}>
                    <td className="px-4 py-3"><div className="font-medium">{c.hotel.name}</div><div className="text-xs text-slate-500">{c.hotel.city ?? ""}{c.rooms ? ` · ${c.rooms} rooms` : ""}</div></td>
                    <td className="px-4 py-3">{c.license.plan_name ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.license.starts_on || c.license.ends_on ? `${day(c.license.starts_on)} → ${day(c.license.ends_on)}` : <span className="text-slate-400">No end date</span>}</td>
                    <td className="px-4 py-3 tabular-nums">{c.users}{c.license.staff_limit ? ` / ${c.license.staff_limit}` : ""}</td>
                    <td className="px-4 py-3 text-xs">{c.owner ? c.owner.email : c.owner_invite ? <span className="text-amber-700">{c.owner_invite.email} (not joined)</span> : "—"}</td>
                    <td className="px-4 py-3"><StateBadge s={c.state} /></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No companies match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------- one company
const CompanyDialog = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const c = useCompany(id);
  const plans = usePlans();
  const save = useSaveLicense();
  const saveOwner = useSaveOwner();
  const [edit, setEdit] = useState<null | { plan_id: string | null; starts_on: string; ends_on: string; staff_limit: string; notes: string }>(null);
  const [owner, setOwner] = useState<null | { name: string; email: string; phone: string }>(null);
  const d = c.data;
  const l = d?.license;
  const signupUrl = `${window.location.origin}/login`;

  const quick = (months: number) => {
    if (!d || !l) return;
    const base = l.ends_on && parseISO(l.ends_on) > new Date() ? parseISO(l.ends_on) : addDays(new Date(), -1);
    const end = months >= 12 ? addYears(base, months / 12) : addMonths(base, months);
    save.mutate({ hotel_id: d.hotel.id, plan_id: l.plan_id, starts_on: l.starts_on ?? iso(new Date()), ends_on: iso(end), staff_limit: l.staff_limit,
      status: "active", notes: l.notes ?? "", action: `renewed +${months >= 12 ? `${months / 12} year` : `${months} month${months === 1 ? "" : "s"}`}` });
  };
  const setStatus = (status: "active" | "suspended") => {
    if (!d || !l) return;
    if (status === "suspended" && !window.confirm(`Suspend ${d.hotel.name}? Nobody at this hotel can use HotelEasy until you reactivate it.`)) return;
    save.mutate({ hotel_id: d.hotel.id, plan_id: l.plan_id, starts_on: l.starts_on, ends_on: l.ends_on, staff_limit: l.staff_limit, status, notes: l.notes ?? "",
      action: status === "suspended" ? "suspended" : "reactivated" });
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) { setEdit(null); setOwner(null); onClose(); } }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {!d || !l ? <div className="py-12 text-center"><Spinner className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">{d.hotel.name}<StateBadge s={d.state} /></DialogTitle>
              <DialogDescription>{[d.hotel.address, d.hotel.city, d.hotel.country].filter(Boolean).join(", ")} · registered {day(d.hotel.created_at.slice(0, 10))}{d.last_activity ? ` · last activity ${formatDistanceToNowStrict(new Date(d.last_activity), { addSuffix: true })}` : ""}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Licence</CardTitle>
                  {!edit && <Button size="sm" variant="ghost" onClick={() => setEdit({ plan_id: l.plan_id, starts_on: l.starts_on ?? "", ends_on: l.ends_on ?? "", staff_limit: l.staff_limit ? String(l.staff_limit) : "", notes: l.notes ?? "" })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}</CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!edit ? (
                    <>
                      <dl className="grid grid-cols-[110px_1fr] gap-y-1">
                        <dt className="text-slate-500">Plan</dt><dd>{l.plan_name ?? "None (all pages)"}{l.price != null && ` · ${formatMoney(Number(l.price), l.currency ?? "KES")}/${l.billing_period === "year" ? "year" : "month"}`}</dd>
                        <dt className="text-slate-500">From</dt><dd>{day(l.starts_on)}</dd>
                        <dt className="text-slate-500">To</dt><dd>{day(l.ends_on)}{d.days_left != null && d.days_left >= 0 && <span className="text-slate-500"> ({d.days_left} days left)</span>}</dd>
                        <dt className="text-slate-500">Users</dt><dd>{d.users} used of {l.staff_limit ?? "unlimited"}</dd>
                        <dt className="text-slate-500">Source</dt><dd>{{ provider: "Registered by you", self_signup: "Signed up themselves (trial)", existing: "Existing before licences" }[l.source]}</dd>
                        {l.notes && <><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-line">{l.notes}</dd></>}
                      </dl>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="mr-1 self-center text-xs text-slate-500">Renew:</span>
                        {[1, 3, 6, 12].map((m) => <Button key={m} size="sm" variant="outline" disabled={save.isPending} onClick={() => quick(m)}>+{m === 12 ? "1 year" : `${m} mo`}</Button>)}
                      </div>
                      <div className="flex gap-2">
                        {l.status === "active"
                          ? <Button size="sm" variant="outline" className="text-red-600" disabled={save.isPending} onClick={() => setStatus("suspended")}><Ban className="mr-1 h-4 w-4" />Suspend</Button>
                          : <Button size="sm" disabled={save.isPending} onClick={() => setStatus("active")}><RefreshCw className="mr-1 h-4 w-4" />Reactivate</Button>}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1"><Label htmlFor="cl-plan">Plan</Label>
                        <select id="cl-plan" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={edit.plan_id ?? ""}
                          onChange={(e) => {
                            const p = (plans.data ?? []).find((x) => x.id === e.target.value);
                            setEdit({ ...edit, plan_id: e.target.value || null, staff_limit: p && !edit.staff_limit ? String(p.staff_included) : edit.staff_limit });
                          }}>
                          <option value="">No plan (all pages)</option>
                          {(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (off)"}</option>)}
                        </select></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label htmlFor="cl-from">From</Label><Input id="cl-from" type="date" value={edit.starts_on} onChange={(e) => setEdit({ ...edit, starts_on: e.target.value })} /></div>
                        <div className="space-y-1"><Label htmlFor="cl-to">To (last day)</Label><Input id="cl-to" type="date" value={edit.ends_on} min={edit.starts_on || undefined} onChange={(e) => setEdit({ ...edit, ends_on: e.target.value })} /></div>
                      </div>
                      <div className="space-y-1"><Label htmlFor="cl-users">Users allowed (logins incl. owner)</Label>
                        <Input id="cl-users" type="number" min={1} value={edit.staff_limit} placeholder="Unlimited" onChange={(e) => setEdit({ ...edit, staff_limit: e.target.value })} />
                        {edit.staff_limit && Number(edit.staff_limit) < d.users && <p className="text-xs text-amber-700">They already have {d.users} users: nobody is removed, but nobody new can be added.</p>}</div>
                      <div className="space-y-1"><Label htmlFor="cl-notes">Notes</Label><Textarea id="cl-notes" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Invoice no., payment, agreed discount…" /></div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEdit(null)}>Cancel</Button>
                        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ hotel_id: d.hotel.id, plan_id: edit.plan_id, starts_on: edit.starts_on || null,
                          ends_on: edit.ends_on || null, staff_limit: edit.staff_limit ? Number(edit.staff_limit) : null, status: l.status, notes: edit.notes, action: "updated" },
                          { onSuccess: () => setEdit(null) })}>Save licence</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Owner (hotel admin)</CardTitle>
                  {!owner && !d.owner && <Button size="sm" variant="ghost" onClick={() => setOwner({ name: l.owner_name ?? "", email: l.owner_email ?? d.owner_invite?.email ?? "", phone: l.owner_phone ?? "" })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}</CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {!owner ? (
                    <>
                      <p><span className="font-medium">{l.owner_name ?? "—"}</span>{l.owner_phone ? ` · ${l.owner_phone}` : ""}</p>
                      {d.owner ? <p className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />{d.owner.email} has joined</p>
                        : d.owner_invite ? (
                          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2 dark:bg-amber-950/30">
                            <p className="text-amber-800">Waiting for <b>{d.owner_invite.email}</b> to sign up.</p>
                            <p className="text-xs text-slate-600">Send them: “Open <b>{signupUrl}</b>, choose <b>Create account</b> with <b>{d.owner_invite.email}</b>, confirm the email and sign in. You'll be the owner of {d.hotel.name}.” If they already have a HotelEasy login, they just sign in.</p>
                          </div>
                        ) : <p className="text-slate-500">No owner invited.</p>}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Input aria-label="Owner name" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} placeholder="Full name" />
                      <Input aria-label="Owner email" type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} placeholder="Email" />
                      <Input aria-label="Owner phone" value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} placeholder="Phone" />
                      <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOwner(null)}>Cancel</Button>
                        <Button size="sm" disabled={saveOwner.isPending} onClick={() => saveOwner.mutate({ hotel_id: d.hotel.id, ...owner }, { onSuccess: () => setOwner(null) })}>Save owner</Button></div>
                    </div>
                  )}
                  <div className="pt-2 text-xs text-slate-500">Hotel contact: {[d.hotel.phone, d.hotel.email].filter(Boolean).join(" · ") || "—"} · {d.hotel.currency} · {d.hotel.timezone}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Users ({d.users}{l.staff_limit ? ` of ${l.staff_limit}` : ""})</CardTitle></CardHeader>
                <CardContent className="max-h-56 space-y-1 overflow-y-auto text-sm">
                  {d.members.map((m) => <div key={m.email} className="flex justify-between gap-2"><span className="truncate">{m.email}</span><span className="text-xs capitalize text-slate-500">{m.role.replace("_", " ")}</span></div>)}
                  {d.invites.map((m) => <div key={m.email} className="flex justify-between gap-2 text-slate-500"><span className="truncate">{m.email}</span><span className="text-xs">invited · {m.role.replace("_", " ")}</span></div>)}
                  {!d.members.length && !d.invites.length && <p className="text-slate-500">Nobody yet.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">History</CardTitle></CardHeader>
                <CardContent className="max-h-56 space-y-2 overflow-y-auto text-xs">
                  {d.history.map((h, i) => (
                    <div key={i}><span className="font-medium capitalize">{h.action}</span> · {format(new Date(h.at), "d MMM yyyy HH:mm")}{h.by ? ` · ${h.by}` : ""}
                      <div className="text-slate-500">{["plan", "starts_on", "ends_on", "staff_limit", "status", "owner"].filter((k) => h.details?.[k] != null).map((k) => `${k.replace("_", " ")}: ${String(h.details[k])}`).join(" · ")}</div></div>
                  ))}
                  {!d.history.length && <p className="text-slate-500">No changes yet.</p>}
                </CardContent>
              </Card>
            </div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- plans
const blankPlan: PlanInput = { id: null, name: "", description: "", price: 0, currency: "KES", billing_period: "month", staff_included: 5, modules: [], active: true };

const Plans = () => {
  const plans = usePlans();
  const del = useDeletePlan();
  const [edit, setEdit] = useState<PlanInput | null>(null);
  if (plans.isError) return <SetupNeeded />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setEdit({ ...blankPlan })}><Plus className="mr-1 h-4 w-4" />Create plan</Button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(plans.data ?? []).map((p) => (
          <Card key={p.id} className={cn(!p.active && "opacity-60")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4 text-violet-600" />{p.name}{!p.active && <Badge variant="outline">Off</Badge>}</CardTitle>
              <CardDescription>{formatMoney(Number(p.price), p.currency)} / {p.billing_period} · {p.staff_included} users · {p.hotels} hotel{p.hotels === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {p.description && <p className="text-slate-600">{p.description}</p>}
              <p className="text-xs text-slate-500">{p.modules.length} pages + dashboard, settings and team</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, description: p.description ?? "", price: Number(p.price), currency: p.currency,
                  billing_period: p.billing_period, staff_included: p.staff_included, modules: p.modules, active: p.active })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                <Button size="sm" variant="ghost" className="text-red-600" disabled={del.isPending || p.hotels > 0} title={p.hotels ? "Hotels are on this plan" : ""}
                  onClick={() => { if (window.confirm(`Delete the plan ${p.name}?`)) del.mutate(p.id); }}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!plans.isLoading && !(plans.data ?? []).length && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-sm text-slate-500">No plans yet. Create your first plan, then register companies on it.</CardContent></Card>}
      </div>
      <PlanDialog plan={edit} onClose={() => setEdit(null)} />
    </div>
  );
};

const PlanDialog = ({ plan, onClose }: { plan: PlanInput | null; onClose: () => void }) => {
  const modules = useModules();
  const save = useSavePlan();
  const [f, setF] = useState<PlanInput>(blankPlan);
  useEffect(() => { if (plan) setF(plan); }, [plan]);
  const selectable = (modules.data ?? []).filter((m) => !m.core);
  const core = (modules.data ?? []).filter((m) => m.core);
  const toggle = (m: string) => setF((x) => ({ ...x, modules: x.modules.includes(m) ? x.modules.filter((y) => y !== m) : [...x.modules, m] }));
  const all = selectable.length > 0 && selectable.every((m) => f.modules.includes(m.module));

  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><Crown className="h-5 w-5" /></span>
            {f.id ? "Edit plan" : "Create plan"}</DialogTitle>
          <DialogDescription>Hotels on this plan see only the pages you tick. The dashboard, settings and team are always included.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basics</p>
          <div className="space-y-1"><Label htmlFor="pl-name">Plan name <span className="text-red-500">*</span></Label>
            <Input id="pl-name" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Basic, Standard, Premium" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="pl-price">Price</Label><Input id="pl-price" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Math.max(0, Number(e.target.value) || 0) })} /></div>
            <div className="space-y-1"><Label htmlFor="pl-cur">Currency</Label><Input id="pl-cur" maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} /></div>
            <div className="space-y-1"><Label htmlFor="pl-per">Billed</Label>
              <select id="pl-per" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.billing_period} onChange={(e) => setF({ ...f, billing_period: e.target.value as "month" | "year" })}>
                <option value="month">Per month</option><option value="year">Per year</option></select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="pl-users">Users included</Label><Input id="pl-users" type="number" min={1} value={f.staff_included} onChange={(e) => setF({ ...f, staff_included: Math.max(1, Number(e.target.value) || 1) })} />
              <p className="text-xs text-slate-500">People with a HotelEasy login, owner included. You can change it per hotel.</p></div>
            <div className="space-y-1"><Label htmlFor="pl-desc">Description</Label><Input id="pl-desc" maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Small lodges up to 15 rooms" /></div>
          </div>
          <label className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
            <span><span className="font-medium">Active</span><span className="block text-xs text-slate-500">Can be chosen when registering a company</span></span>
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} aria-label="Plan active" />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pages · {f.modules.length}/{selectable.length}</p>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setF({ ...f, modules: all ? [] : selectable.map((m) => m.module) })}>{all ? "Clear all" : "Select all"}</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {core.map((m) => (
              <div key={m.module} className="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-900"><Checkbox checked disabled />{m.label}</div>
            ))}
            {selectable.map((m) => (
              <label key={m.module} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900", f.modules.includes(m.module) && "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40")}>
                <Checkbox checked={f.modules.includes(m.module)} onCheckedChange={() => toggle(m.module)} />{m.label}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending || !f.name.trim()} onClick={() => save.mutate(f, { onSuccess: onClose })}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{f.id ? "Save plan" : "Create plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------- settings
const SettingsTab = () => {
  const s = useProviderSettings();
  const plans = usePlans();
  const save = useSaveProviderSettings();
  const [f, setF] = useState<ProviderSettings | null>(null);
  if (s.isError) return <SetupNeeded />;
  const v = f ?? s.data ?? null;
  if (!v) return <div className="py-12 text-center"><Spinner className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>;
  const set = <K extends keyof ProviderSettings>(k: K, x: ProviderSettings[K]) => setF({ ...v, [k]: x });
  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">New hotels signing up themselves</CardTitle>
          <CardDescription>On /login → Create account. Companies you register here are not affected.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center gap-3 rounded-md border p-3"><Switch checked={v.allow_self_signup} onCheckedChange={(x) => set("allow_self_signup", x)} />
            <span><span className="font-medium">{v.allow_self_signup ? "Hotels can sign up for a trial" : "Only companies I register"}</span>
              <span className="block text-xs text-slate-500">{v.allow_self_signup ? "New accounts can create a hotel with a trial licence." : "New accounts see: contact your provider to open an account."}</span></span></label>
          {v.allow_self_signup && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="ps-days">Trial days</Label><Input id="ps-days" type="number" min={0} max={365} value={v.trial_days} onChange={(e) => set("trial_days", Math.max(0, Number(e.target.value) || 0))} />
                <p className="text-xs text-slate-500">0 = no end date</p></div>
              <div className="space-y-1"><Label htmlFor="ps-users">Trial users</Label><Input id="ps-users" type="number" min={1} value={v.trial_staff_limit} onChange={(e) => set("trial_staff_limit", Math.max(1, Number(e.target.value) || 1))} /></div>
              <div className="col-span-2 space-y-1"><Label htmlFor="ps-plan">Trial plan (pages)</Label>
                <select id="ps-plan" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={v.trial_plan_id ?? ""} onChange={(e) => set("trial_plan_id", e.target.value || null)}>
                  <option value="">All pages</option>{(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Renewal reminders and support</CardTitle>
          <CardDescription>Hotels see this when their licence is about to end or has ended.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1"><Label htmlFor="ps-warn">Warn owners and managers this many days before the end</Label>
            <Input id="ps-warn" type="number" min={1} max={60} value={v.warn_days} onChange={(e) => set("warn_days", Math.min(60, Math.max(1, Number(e.target.value) || 7)))} /></div>
          <div className="space-y-1"><Label htmlFor="ps-name">Support name</Label><Input id="ps-name" value={v.support_name ?? ""} onChange={(e) => set("support_name", e.target.value)} placeholder="HotelEasy support" /></div>
          <div className="space-y-1"><Label htmlFor="ps-email">Support email</Label><Input id="ps-email" type="email" value={v.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ps-phone">Support phone / WhatsApp</Label><Input id="ps-phone" value={v.support_phone ?? ""} onChange={(e) => set("support_phone", e.target.value)} placeholder="+254 7…" /></div>
        </CardContent>
      </Card>
      <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm dark:bg-slate-900">
        <span className="flex items-center gap-2 text-slate-600"><AlertTriangle className="h-4 w-4 text-amber-600" />Changes apply to all hotels straight away.</span>
        <Button disabled={save.isPending || !f} onClick={() => f && save.mutate(f, { onSuccess: () => setF(null) })}>Save settings</Button>
      </div>
    </div>
  );
};
