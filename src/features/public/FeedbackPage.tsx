import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback, usePublicFeedback } from "@/hooks/useOnline";
import { friendlyError } from "@/lib/format";
import { PublicShell } from "./BookingPage";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

const StarInput = ({ label, value, onChange, required }: { label: string; value: number; onChange: (v: number) => void; required?: boolean }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 py-1.5" role="radiogroup" aria-label={label}>
    <span className="text-sm font-medium">{label}{required && <span className="text-red-600"> *</span>}</span>
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${label}: ${i} star${i === 1 ? "" : "s"}`}
          onClick={() => onChange(value === i && !required ? 0 : i)} className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Star className={`h-7 w-7 ${i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
      <span className="w-20 text-xs text-slate-500 text-right">{RATING_WORDS[value] ?? ""}</span>
    </span>
  </div>
);

const FeedbackPage = () => {
  const { token = "" } = useParams();
  const fb = usePublicFeedback(token);
  const f = fb.data;
  const [r, setR] = useState({ overall: 0, cleanliness: 0, service: 0, comfort: 0, food: 0, value: 0 });
  const [recommend, setRecommend] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => { if (f) document.title = `Your stay at ${f.hotel}`; }, [f]);

  if (fb.isLoading) return <PublicShell><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></PublicShell>;
  if (!f) return <PublicShell><p className="text-center py-24 text-slate-600">This feedback link is not valid.</p></PublicShell>;
  if (sent || f.submitted) {
    return (
      <PublicShell>
        <Card className="max-w-xl mx-auto"><CardContent className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <h1 className="text-2xl font-bold">Thank you{sent ? `, ${f.first_name}` : ""}!</h1>
          <p className="text-slate-600">{sent ? `Your feedback goes straight to the ${f.hotel} team.` : "We already have your feedback for this stay."}</p>
        </CardContent></Card>
      </PublicShell>
    );
  }
  if (f.expired) return <PublicShell><p className="text-center py-24 text-slate-600">This feedback link has expired. Thank you for staying with {f.hotel}.</p></PublicShell>;

  const set = (k: keyof typeof r) => (v: number) => setR({ ...r, [k]: v });
  const send = async () => {
    setBusy(true); setError("");
    try {
      const opt = (v: number) => (v ? v : undefined);
      await submitFeedback(token, { overall: r.overall, cleanliness: opt(r.cleanliness), service: opt(r.service), comfort: opt(r.comfort),
        food: opt(r.food), value: opt(r.value), recommend: recommend ?? undefined, comment, consent });
      setSent(true);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <Card className="max-w-xl mx-auto">
        <CardContent className="p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">How was your stay, {f.first_name}?</h1>
            <p className="text-slate-600">{f.hotel}{f.city ? `, ${f.city}` : ""} · {format(parseISO(f.check_in), "d MMM")} – {format(parseISO(f.check_out), "d MMM yyyy")}</p>
          </div>
          <div className="divide-y">
            <StarInput label="Overall" value={r.overall} onChange={set("overall")} required />
            <StarInput label="Cleanliness" value={r.cleanliness} onChange={set("cleanliness")} />
            <StarInput label="Staff & service" value={r.service} onChange={set("service")} />
            <StarInput label="Room comfort" value={r.comfort} onChange={set("comfort")} />
            {f.has_restaurant && <StarInput label="Food & drinks" value={r.food} onChange={set("food")} />}
            <StarInput label="Value for money" value={r.value} onChange={set("value")} />
          </div>
          <div className="space-y-2">
            <Label>How likely are you to recommend us to a friend?</Label>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Recommend from 0 to 10">
              {Array.from({ length: 11 }, (_, i) => (
                <button key={i} type="button" role="radio" aria-checked={recommend === i} onClick={() => setRecommend(i)}
                  className={`h-9 w-9 rounded-md border text-sm font-medium ${recommend === i ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-50"}`}>{i}</button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 max-w-[440px]"><span>Not likely</span><span>Very likely</span></div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fb-comment">Anything you'd like to tell us?</Label>
            <Textarea id="fb-comment" rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you enjoy? What could we do better?" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>The hotel may show my rating and comment on its booking page, with my first name and initial.</span>
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <Button className="w-full" size="lg" disabled={!r.overall || busy} onClick={send}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send feedback</Button>
        </CardContent>
      </Card>
    </PublicShell>
  );
};
export default FeedbackPage;
