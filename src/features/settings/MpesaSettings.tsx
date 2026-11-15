import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Loader2, PlugZap, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMpesaSettings, useSaveMpesa, useTestMpesa, type MpesaSave } from "@/hooks/useMpesa";

// Safaricom's public sandbox test shortcode and passkey (the same for everyone; not secret)
const SANDBOX = { shortcode: "174379", passkey: "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" };

/** Settings → M-Pesa prompts (STK push). Keys are write-only: the app only ever shows whether they are saved. */
export const MpesaSettings = () => {
  const q = useMpesaSettings();
  const save = useSaveMpesa();
  const test = useTestMpesa();
  const [f, setF] = useState<MpesaSave>({ enabled: false, environment: "sandbox", kind: "paybill", shortcode: "", till_number: "", online_deposit: "none" });
  useEffect(() => {
    if (!q.data) return;
    setF({ enabled: q.data.enabled, environment: q.data.environment, kind: q.data.kind, shortcode: q.data.shortcode ?? "",
      till_number: q.data.till_number ?? "", online_deposit: q.data.online_deposit, consumer_key: "", consumer_secret: "", passkey: "" });
  }, [q.data]);
  if (!q.data) return null;
  const d = q.data; const ro = !d.can_edit;
  const set = (k: keyof MpesaSave, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(f); };
  const secret = (k: "consumer_key" | "consumer_secret" | "passkey", label: string, saved: boolean) => (
    <div className="space-y-1.5">
      <Label htmlFor={`mp-${k}`} className="flex items-center gap-2">{label}{saved && <Badge variant="secondary" className="text-[10px]">saved</Badge>}</Label>
      <Input id={`mp-${k}`} type="password" autoComplete="off" disabled={ro} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)}
        placeholder={saved ? "•••••••• (leave empty to keep)" : "Paste from the Daraja portal"} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-green-600" />M-Pesa prompts
          {d.ready ? <Badge className="bg-green-600 hover:bg-green-600">On{d.environment === "sandbox" ? " (test mode)" : ""}</Badge> : <Badge variant="outline">Off</Badge>}</CardTitle>
        <CardDescription>
          Send a pay prompt to the guest's phone from a bill or the POS. The guest enters their M-Pesa PIN and the payment is recorded by itself, with the receipt number.
          You need a Daraja app from Safaricom (developer.safaricom.co.ke) linked to your paybill or till.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-center gap-3"><Switch checked={f.enabled} disabled={ro} onCheckedChange={(v) => set("enabled", v)} aria-label="M-Pesa prompts on" />
            <span className="text-sm font-medium">Use M-Pesa prompts</span></label>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Mode</Label>
              <Select value={f.environment} disabled={ro} onValueChange={(v) => set("environment", v)}>
                <SelectTrigger aria-label="Mode"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sandbox">Test (sandbox: no real money)</SelectItem><SelectItem value="production">Live (real payments)</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Guests pay to</Label>
              <Select value={f.kind} disabled={ro} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger aria-label="Guests pay to"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="paybill">Paybill</SelectItem><SelectItem value="till">Till (Buy Goods)</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label htmlFor="mp-short">{f.kind === "till" ? "Store number (head office)" : "Paybill number"}</Label>
              <Input id="mp-short" inputMode="numeric" disabled={ro} value={f.shortcode} onChange={(e) => set("shortcode", e.target.value)} placeholder={f.environment === "sandbox" ? SANDBOX.shortcode : ""} /></div>
            {f.kind === "till" && (
              <div className="space-y-1.5"><Label htmlFor="mp-till">Till number</Label>
                <Input id="mp-till" inputMode="numeric" disabled={ro} value={f.till_number} onChange={(e) => set("till_number", e.target.value)} /></div>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {secret("consumer_key", "Consumer key", d.has_consumer_key)}
            {secret("consumer_secret", "Consumer secret", d.has_consumer_secret)}
            {secret("passkey", "Passkey (Lipa na M-Pesa Online)", d.has_passkey)}
          </div>
          {f.environment === "sandbox" && !ro && (
            <p className="text-xs text-slate-500 flex items-start gap-1.5"><KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Trying it out? Use your Daraja sandbox app's key and secret with Safaricom's test paybill.
                <button type="button" className="ml-1 text-blue-700 underline" onClick={() => setF((x) => ({ ...x, kind: "paybill", shortcode: SANDBOX.shortcode, passkey: SANDBOX.passkey }))}>Fill in the test paybill and passkey</button></span></p>
          )}
          <div className="space-y-1.5 md:w-1/2"><Label>Online booking deposit</Label>
            <Select value={f.online_deposit} disabled={ro} onValueChange={(v) => set("online_deposit", v)}>
              <SelectTrigger aria-label="Online booking deposit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Don't ask online guests to pay</SelectItem>
                <SelectItem value="first_night">Guests can pay the first night online</SelectItem>
                <SelectItem value="full">Guests can pay the whole stay online</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Shown on the booking confirmation and on "Manage my booking".</p></div>
          {!ro && (
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save M-Pesa settings</Button>
              <Button type="button" variant="outline" disabled={test.isPending || !d.has_consumer_key} onClick={() => test.mutate()}>
                {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Test the keys</Button>
              {test.data?.ok && <span className="text-sm text-green-700 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{test.data.message}</span>}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
