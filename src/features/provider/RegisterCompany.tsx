// Register a hotel company: plan → hotel details → owner (hotel admin) → licence (dates, users) → review.
// The provider is not added to the hotel; the owner gets an invitation and becomes owner when they sign up.
import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";
import { Building2, Check, CheckCircle2, Copy, Crown, KeyRound, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCreateCompany, useModules, usePlans, type CompanyInput } from "@/hooks/useProvider";

const STEPS = [
  { title: "Plan", icon: Crown },
  { title: "Hotel", icon: Building2 },
  { title: "Admin", icon: UserRound },
  { title: "Licence", icon: KeyRound },
  { title: "Review", icon: Check },
];
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const blank = (): CompanyInput => ({
  plan_id: "",
  hotel: { name: "", city: "", address: "", country: "Kenya", phone: "", email: "", currency: "KES", timezone: "Africa/Nairobi" },
  owner: { name: "", email: "", phone: "" },
  license: { starts_on: iso(new Date()), ends_on: "", staff_limit: 5, notes: "" },
  sample_rooms: false,
});

export const RegisterCompany = ({ open, onClose }: { open: boolean; onClose: (createdId?: string) => void }) => {
  const plans = usePlans();
  const modules = useModules();
  const create = useCreateCompany();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<CompanyInput>(blank);
  const [done, setDone] = useState<{ id: string; email: string; name: string } | null>(null);
  useEffect(() => { if (open) { setStep(0); setF(blank()); setDone(null); } }, [open]);

  const active = (plans.data ?? []).filter((p) => p.active);
  const plan = active.find((p) => p.id === f.plan_id);
  const label = useMemo(() => new Map((modules.data ?? []).map((m) => [m.module, m.label])), [modules.data]);

  const choosePlan = (id: string) => {
    const p = active.find((x) => x.id === id);
    const start = f.license.starts_on ? parseISO(f.license.starts_on) : new Date();
    const end = p?.billing_period === "year" ? addDays(addYears(start, 1), -1) : addDays(addMonths(start, 1), -1);
    setF({ ...f, plan_id: id, license: { ...f.license, staff_limit: p?.staff_included ?? f.license.staff_limit, ends_on: iso(end) } });
  };
  const setLen = (months: number) => {
    const start = f.license.starts_on ? parseISO(f.license.starts_on) : new Date();
    setF({ ...f, license: { ...f.license, ends_on: iso(addDays(months >= 12 ? addYears(start, months / 12) : addMonths(start, months), -1)) } });
  };

  const problem = [
    !f.plan_id && "Choose a plan",
    step >= 1 && !f.hotel.name.trim() && "Enter the hotel name",
    step >= 1 && f.hotel.email && !EMAIL.test(f.hotel.email) && "The hotel email doesn't look right",
    step >= 1 && !/^[A-Z]{3}$/.test(f.hotel.currency) && "Currency is 3 letters, e.g. KES",
    step >= 2 && !EMAIL.test(f.owner.email.trim()) && "Enter the admin's email (they sign in with it)",
    step >= 2 && !f.owner.name.trim() && "Enter the admin's name",
    step >= 3 && !f.license.starts_on && "Choose the start date",
    step >= 3 && f.license.ends_on && f.license.ends_on < f.license.starts_on && "The licence must end after it starts",
    step >= 3 && !(f.license.staff_limit >= 1) && "Allow at least 1 user",
  ].find(Boolean) as string | undefined;

  const submit = () => create.mutate({ ...f, owner: { ...f.owner, email: f.owner.email.trim().toLowerCase() } }, {
    onSuccess: (id) => setDone({ id, email: f.owner.email.trim().toLowerCase(), name: f.hotel.name }),
  });
  const signupUrl = `${window.location.origin}/login`;
  const message = done ? `Hello ${f.owner.name.split(" ")[0] || ""}, your HotelEasy account for ${done.name} is ready.\n\n1. Open ${signupUrl}\n2. Choose "Create account" and use this email: ${done.email}\n3. Confirm the email we send you, then sign in.\n\nYou'll be the owner of ${done.name} and can add your staff under Settings → Team.` : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(done?.id)}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register a hotel company</DialogTitle>
          <DialogDescription>Creates the hotel, its licence and an invitation for its admin (owner). You are not added to the hotel.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              <div><p className="font-medium">{done.name} is registered.</p><p className="text-slate-600">Send the admin this message so they can sign in as the owner:</p></div>
            </div>
            <Textarea readOnly rows={8} value={message} className="text-sm" aria-label="Message for the hotel admin" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(message); toast.success("Message copied"); } catch { toast.error("Select and copy it yourself"); } }}><Copy className="mr-1 h-4 w-4" />Copy message</Button>
              {f.owner.phone && <Button variant="outline" asChild><a href={`https://wa.me/${f.owner.phone.replace(/\D/g, "").replace(/^0/, "254")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a></Button>}
              <Button variant="outline" asChild><a href={`mailto:${done.email}?subject=${encodeURIComponent(`Your HotelEasy account for ${done.name}`)}&body=${encodeURIComponent(message)}`}>Send by email</a></Button>
            </div>
            <DialogFooter><Button onClick={() => onClose(done.id)}>Open the company</Button></DialogFooter>
          </div>
        ) : (
          <>
            <ol className="flex items-center gap-1" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-1 items-center gap-1">
                  <button type="button" disabled={i > step} onClick={() => setStep(i)}
                    className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium", i === step ? "bg-indigo-600 text-white" : i < step ? "text-indigo-700" : "text-slate-400")}>
                    <s.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{s.title}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-indigo-300" : "bg-slate-200")} />}
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="space-y-2">
                {!active.length && <p className="rounded-md border border-dashed p-4 text-sm text-slate-500">No active plans yet. Create one under <b>Plans</b> first.</p>}
                {active.map((p) => (
                  <button key={p.id} type="button" onClick={() => choosePlan(p.id)}
                    className={cn("w-full rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900", f.plan_id === p.id && "border-indigo-500 ring-2 ring-indigo-500")}>
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{p.name}</span><span>{formatMoney(Number(p.price), p.currency)} / {p.billing_period}</span></div>
                    <div className="text-xs text-slate-500">{p.staff_included} users · {p.modules.length} pages{p.description ? ` · ${p.description}` : ""}</div>
                    <div className="mt-1 text-xs text-slate-500 line-clamp-2">{p.modules.map((m) => label.get(m) ?? m).join(", ")}</div>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2"><Label htmlFor="rc-name">Hotel / company name <span className="text-red-500">*</span></Label>
                  <Input id="rc-name" value={f.hotel.name} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, name: e.target.value } })} placeholder="XYZ Hotel" /></div>
                <div className="space-y-1"><Label htmlFor="rc-city">Town / city</Label><Input id="rc-city" value={f.hotel.city} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, city: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-country">Country</Label><Input id="rc-country" value={f.hotel.country} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, country: e.target.value } })} /></div>
                <div className="space-y-1 sm:col-span-2"><Label htmlFor="rc-addr">Address</Label><Input id="rc-addr" value={f.hotel.address} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, address: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-phone">Hotel phone</Label><Input id="rc-phone" value={f.hotel.phone} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, phone: e.target.value } })} placeholder="+254 7…" /></div>
                <div className="space-y-1"><Label htmlFor="rc-email">Reservations email</Label><Input id="rc-email" type="email" value={f.hotel.email} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, email: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-cur">Currency</Label><Input id="rc-cur" maxLength={3} value={f.hotel.currency} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-tz">Time zone</Label>
                  <select id="rc-tz" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.hotel.timezone} onChange={(e) => setF({ ...f, hotel: { ...f.hotel, timezone: e.target.value } })}>
                    {["Africa/Nairobi", "Africa/Kampala", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Lagos", "Africa/Johannesburg", "Asia/Kolkata", "Asia/Dubai", "Europe/London"].map((z) => <option key={z}>{z}</option>)}
                  </select></div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={f.sample_rooms} onCheckedChange={(v) => setF({ ...f, sample_rooms: v === true })} />Add 12 sample rooms (Standard, Deluxe, Suite) to start with</label>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="text-sm text-slate-600 sm:col-span-2">The hotel's admin becomes the <b>owner</b>: full control, adds staff, sets up the hotel. They sign in with this email.</p>
                <div className="space-y-1 sm:col-span-2"><Label htmlFor="rc-oname">Full name <span className="text-red-500">*</span></Label><Input id="rc-oname" value={f.owner.name} onChange={(e) => setF({ ...f, owner: { ...f.owner, name: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-oemail">Email (their login) <span className="text-red-500">*</span></Label><Input id="rc-oemail" type="email" value={f.owner.email} onChange={(e) => setF({ ...f, owner: { ...f.owner, email: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-ophone">Phone / WhatsApp</Label><Input id="rc-ophone" value={f.owner.phone} onChange={(e) => setF({ ...f, owner: { ...f.owner, phone: e.target.value } })} placeholder="07…" /></div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="rc-from">Licence from</Label><Input id="rc-from" type="date" value={f.license.starts_on} onChange={(e) => setF({ ...f, license: { ...f.license, starts_on: e.target.value } })} /></div>
                <div className="space-y-1"><Label htmlFor="rc-to">Licence to (last day)</Label><Input id="rc-to" type="date" value={f.license.ends_on} min={f.license.starts_on} onChange={(e) => setF({ ...f, license: { ...f.license, ends_on: e.target.value } })} />
                  <div className="flex flex-wrap gap-1 pt-1">{[1, 3, 6, 12, 24].map((m) => <Button key={m} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setLen(m)}>{m >= 12 ? `${m / 12} yr` : `${m} mo`}</Button>)}
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setF({ ...f, license: { ...f.license, ends_on: "" } })}>No end</Button></div></div>
                <div className="space-y-1"><Label htmlFor="rc-users">Users allowed (logins, owner included)</Label>
                  <Input id="rc-users" type="number" min={1} value={f.license.staff_limit} onChange={(e) => setF({ ...f, license: { ...f.license, staff_limit: Math.max(1, Number(e.target.value) || 1) } })} />
                  {plan && <p className="text-xs text-slate-500">The {plan.name} plan includes {plan.staff_included}.</p>}</div>
                <div className="space-y-1 sm:col-span-2"><Label htmlFor="rc-notes">Notes (only you see these)</Label>
                  <Textarea id="rc-notes" rows={2} value={f.license.notes} onChange={(e) => setF({ ...f, license: { ...f.license, notes: e.target.value } })} placeholder="Invoice no., payment received, agreed discount…" /></div>
              </div>
            )}

            {step === 4 && (
              <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 rounded-lg border p-4 text-sm">
                <dt className="text-slate-500">Plan</dt><dd>{plan?.name} · {plan && `${formatMoney(Number(plan.price), plan.currency)} / ${plan.billing_period}`}</dd>
                <dt className="text-slate-500">Hotel</dt><dd>{f.hotel.name}{f.hotel.city ? `, ${f.hotel.city}` : ""} · {f.hotel.currency} · {f.hotel.timezone}{f.sample_rooms ? " · with sample rooms" : ""}</dd>
                <dt className="text-slate-500">Admin (owner)</dt><dd>{f.owner.name} · {f.owner.email}{f.owner.phone ? ` · ${f.owner.phone}` : ""}</dd>
                <dt className="text-slate-500">Licence</dt><dd>{format(parseISO(f.license.starts_on), "d MMM yyyy")} → {f.license.ends_on ? format(parseISO(f.license.ends_on), "d MMM yyyy") : "no end date"}</dd>
                <dt className="text-slate-500">Users</dt><dd>{f.license.staff_limit}</dd>
                <dt className="text-slate-500">Pages</dt><dd className="text-xs">{plan ? ["Dashboard", "Settings", "Team", ...plan.modules.map((m) => label.get(m) ?? m)].join(", ") : ""}</dd>
              </dl>
            )}

            {problem && step > 0 && <p className="text-sm text-amber-700" role="status">{problem}</p>}
            <DialogFooter className="gap-2">
              {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
              {step < 4
                ? <Button disabled={!!problem && (step === 0 ? !f.plan_id : true)} onClick={() => setStep(step + 1)}>Next</Button>
                : <Button disabled={!!problem || create.isPending} onClick={submit}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register company</Button>}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
