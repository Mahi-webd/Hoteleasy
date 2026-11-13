import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad } from "@/components/common/SignaturePad";
import { submitPrecheck, usePublicPrecheck, type Companion } from "@/hooks/useOnline";
import { friendlyError } from "@/lib/format";
import { PublicShell } from "./BookingPage";

export const NATIONALITIES = ["Kenyan", "Ugandan", "Tanzanian", "Rwandan", "Burundian", "South Sudanese", "Ethiopian", "Somali", "Nigerian", "South African",
  "British", "American", "German", "French", "Italian", "Dutch", "Spanish", "Swiss", "Swedish", "Canadian", "Australian", "Indian", "Chinese", "Japanese"];
export const ID_TYPES = ["National ID", "Passport", "Alien ID", "Driving licence", "Other"];
export const PURPOSES: Record<string, string> = { leisure: "Holiday / leisure", business: "Business", conference: "Conference or event", other: "Other" };
const nice = (d: string) => format(parseISO(d), "EEE d MMM yyyy");

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3"><h2 className="font-semibold text-lg border-b pb-1">{title}</h2>{children}</section>
);

const PrecheckPage = () => {
  const { token = "" } = useParams();
  const q = usePublicPrecheck(token);
  const p = q.data;
  const [f, setF] = useState<Record<string, string>>({});
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!p) return;
    document.title = `Online check-in · ${p.hotel.name}`;
    const fm = p.form;
    setF(Object.fromEntries(Object.entries({
      first_name: fm.first_name, last_name: fm.last_name, email: fm.email, phone: fm.phone, nationality: fm.nationality, residence: fm.residence,
      id_type: fm.id_type ?? (fm.nationality && fm.nationality !== "Kenyan" ? "Passport" : "National ID"), id_number: fm.id_number, date_of_birth: fm.date_of_birth,
      address: fm.address, arrival_time: fm.arrival_time, purpose: fm.purpose, coming_from: fm.coming_from, going_to: fm.going_to,
      vehicle_reg: fm.vehicle_reg, requests: fm.requests, signed_name: fm.signed_name,
    }).map(([k, v]) => [k, v ?? ""])));
    const others = Math.max(0, p.adults + p.children - 1);
    const saved = fm.companions ?? [];
    setCompanions(saved.length ? saved : Array.from({ length: Math.min(others, 6) }, () => ({ name: "", id_number: "" })));
    setMarketing(!!fm.marketing_ok);
  }, [p]);

  if (q.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  if (!p) return <PublicShell><p className="text-center py-24 text-slate-600">This check-in link is not valid. Please check the link the hotel sent you.</p></PublicShell>;

  const h = p.hotel;
  const header = (
    <div className="text-center space-y-1 mb-6">
      <div className="text-sm uppercase tracking-wide text-slate-500">Online check-in</div>
      <h1 className="text-2xl sm:text-3xl font-bold">{h.name}</h1>
      <p className="text-slate-600">{p.room_type} · {nice(p.check_in)} → {nice(p.check_out)} · {p.nights} night{p.nights === 1 ? "" : "s"}</p>
      <p className="text-xs text-slate-500">Booking {p.code}</p>
    </div>
  );
  const message = (title: string, body: React.ReactNode, ok = true) => (
    <PublicShell>{header}
      <Card className="max-w-xl mx-auto"><CardContent className="p-8 text-center space-y-3">
        {ok && <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />}
        <h2 className="text-xl font-bold">{title}</h2><div className="text-slate-600 space-y-2">{body}</div>
      </CardContent></Card>
    </PublicShell>
  );

  if (p.state === "arrived") return message("You're checked in", <p>Enjoy your stay at {h.name}!</p>);
  if (p.state === "closed") return message("This booking is no longer active", <p>Please contact the hotel{h.phone ? ` on ${h.phone}` : ""}.</p>, false);
  if (sent || p.state === "reviewed" || (p.state === "submitted" && !editing)) {
    return message(sent ? `Thank you, ${f.first_name}!` : "You're all set",
      <>
        <p>{p.state === "reviewed" ? "The hotel has your details." : "We have your details."} At reception we'll just look at your {f.id_type?.toLowerCase() || "ID"} and give you your key.</p>
        <p>Check-in from <b>{h.checkin_time}</b> on <b>{nice(p.check_in)}</b>. Check-out by <b>{h.checkout_time}</b>.</p>
        {h.phone && <p>Questions? Call {h.phone}.</p>}
        {p.state !== "reviewed" && <Button variant="outline" onClick={() => { setSent(false); setEditing(true); q.refetch(); }}>Change my details</Button>}
      </>);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await submitPrecheck(token, { ...f, companions: companions.filter((c) => c.name.trim()), signature, accept, marketing_ok: marketing });
      setSent(true); setEditing(false); window.scrollTo(0, 0); q.refetch();
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  };
  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1"><Label htmlFor={`pc-${k}`}>{label}{props.required && <span className="text-red-600"> *</span>}</Label>
      <Input id={`pc-${k}`} value={f[k] ?? ""} onChange={set(k)} {...props} /></div>
  );

  return (
    <PublicShell>
      {header}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-5 sm:p-8">
          <form onSubmit={send} className="space-y-8">
            <p className="text-slate-600">Save time at reception: fill this in before you arrive. It takes about two minutes.</p>
            <Section title="About you">
              <div className="grid sm:grid-cols-2 gap-3">
                {field("first_name", "First name", { required: true, autoComplete: "given-name" })}
                {field("last_name", "Last name", { required: true, autoComplete: "family-name" })}
                {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", placeholder: "07… or +…" })}
                {field("email", "Email", { type: "email", autoComplete: "email" })}
                <div className="space-y-1"><Label htmlFor="pc-nationality">Nationality<span className="text-red-600"> *</span></Label>
                  <Input id="pc-nationality" list="pc-nat" required value={f.nationality ?? ""} onChange={set("nationality")} />
                  <datalist id="pc-nat">{NATIONALITIES.map((n) => <option key={n} value={n} />)}</datalist></div>
                {field("residence", "Country you live in")}
                {field("date_of_birth", "Date of birth", { type: "date", max: new Date().toISOString().slice(0, 10) })}
                {field("address", "Home address or town", { autoComplete: "street-address" })}
              </div>
            </Section>
            <Section title="ID or passport">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Document<span className="text-red-600"> *</span></Label>
                  <Select value={f.id_type || undefined} onValueChange={(v) => setF({ ...f, id_type: v })}>
                    <SelectTrigger aria-label="ID type"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                {field("id_number", "Number", { required: true, autoComplete: "off" })}
              </div>
              <p className="text-xs text-slate-500 flex gap-1"><ShieldCheck className="h-4 w-4 shrink-0" />Kenyan law requires hotels to keep a guest register. Bring the same document; reception will check it on arrival.</p>
            </Section>
            <Section title="Your trip">
              <div className="grid sm:grid-cols-2 gap-3">
                {field("arrival_time", "Expected arrival time", { type: "time" })}
                <div className="space-y-1"><Label>Reason for visit</Label>
                  <Select value={f.purpose || undefined} onValueChange={(v) => setF({ ...f, purpose: v })}>
                    <SelectTrigger aria-label="Reason for visit"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{Object.entries(PURPOSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                {field("coming_from", "Coming from")}
                {field("going_to", "Going to next")}
                {field("vehicle_reg", "Car registration (for parking)", { placeholder: "KDA 123A" })}
              </div>
            </Section>
            <Section title="Who else is staying">
              {companions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1"><Label htmlFor={`pc-cn-${i}`} className="text-xs">Full name</Label>
                    <Input id={`pc-cn-${i}`} value={c.name} onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></div>
                  <div className="space-y-1"><Label htmlFor={`pc-ci-${i}`} className="text-xs">ID / passport (adults)</Label>
                    <Input id={`pc-ci-${i}`} value={c.id_number ?? ""} onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, id_number: e.target.value } : x)))} /></div>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove guest" onClick={() => setCompanions(companions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {companions.length < 12 && <Button type="button" size="sm" variant="outline" onClick={() => setCompanions([...companions, { name: "", id_number: "" }])}><Plus className="mr-1 h-4 w-4" />Add a guest</Button>}
              {!companions.length && <p className="text-sm text-slate-500">Just you? Leave this empty.</p>}
            </Section>
            <Section title="Anything we should know?">
              <Textarea id="pc-requests" aria-label="Requests" rows={3} value={f.requests ?? ""} onChange={set("requests")} placeholder="Late arrival, extra bed, allergies, airport pick-up…" maxLength={1000} />
            </Section>
            <Section title="Registration card">
              {(h.house_rules || h.policies) && (
                <div className="max-h-48 overflow-y-auto rounded-md bg-slate-50 border p-3 text-sm whitespace-pre-line text-slate-700">{[h.house_rules, h.policies].filter(Boolean).join("\n\n")}</div>
              )}
              <p className="text-sm text-slate-600">
                I confirm the details above are correct. I agree to pay for my stay and any extras charged to my room, and to follow the hotel's rules.{" "}
                {h.name} keeps these details for the guest register as Kenyan law requires and uses them only for my stay (Data Protection Act, 2019).
              </p>
              <SignaturePad onChange={setSignature} label="Sign here with your finger or mouse" />
              {field("signed_name", "Your full name", { required: true })}
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} aria-label="I agree" className="mt-0.5" />I agree to the above<span className="text-red-600">*</span></label>
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} aria-label="Offers" className="mt-0.5" />{h.name} may send me occasional offers (optional)</label>
            </Section>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !signature || !accept}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send my check-in details
            </Button>
            {(!signature || !accept) && <p className="text-xs text-center text-slate-500">Sign and tick "I agree" to send.</p>}
          </form>
        </CardContent>
      </Card>
    </PublicShell>
  );
};
export default PrecheckPage;
