import { useState } from "react";
import { CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney2 } from "@/lib/format";
import { useMpesaPrompt, type PromptState } from "@/hooks/useMpesa";

const pretty = (p: string) => p.replace(/^254/, "0").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
const FAIL: Record<string, string> = {
  cancelled: "The guest cancelled the prompt on their phone.",
  expired: "The guest didn't answer in time (or the phone was off).",
  failed: "M-Pesa didn't take the payment.",
};

/**
 * "Send a pay prompt to this phone", then wait for the guest to enter their M-Pesa PIN.
 * The payment is posted by the server when Safaricom confirms; this only shows progress.
 */
export const MpesaPrompt = ({
  amount, currency, defaultPhone, create, onPaid, invalidate, compact,
}: {
  amount: number; currency: string; defaultPhone?: string | null;
  create: (phone: string, amount: number) => Promise<{ id: string; token: string; phone: string; amount: number }>;
  onPaid?: (p: PromptState) => void; invalidate?: string[]; compact?: boolean;
}) => {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const { prompt, busy, send, stop, reset } = useMpesaPrompt({ onPaid, invalidate });
  const whole = Math.ceil(amount);
  const phoneOk = /^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s-]/g, ""));

  if (prompt?.status === "paid") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-900 p-3 flex items-center gap-3" data-testid="mpesa-paid">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold">Paid {formatMoney2(Number(prompt.paid_amount ?? prompt.amount), currency)}</div>
          <div className="text-slate-600 dark:text-slate-300">M-Pesa receipt <span className="font-mono">{prompt.receipt}</span> · recorded automatically</div>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={reset}>Done</Button>
      </div>
    );
  }
  if (prompt && ["new", "sent", "confirming"].includes(prompt.status)) {
    return (
      <div className="rounded-lg border p-3 flex items-center gap-3 bg-white dark:bg-slate-900" data-testid="mpesa-waiting">
        <Loader2 className="h-6 w-6 animate-spin text-green-600 shrink-0" />
        <div className="text-sm flex-1">
          <div className="font-semibold">{prompt.status === "confirming" ? "Paid, waiting for the receipt…" : `Waiting for ${pretty(prompt.phone)} to enter their PIN…`}</div>
          <div className="text-slate-500">Prompt for {formatMoney2(prompt.amount, currency)} sent. This usually takes under a minute.</div>
        </div>
        <Button size="sm" variant="outline" onClick={stop}>Stop waiting</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {prompt && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-3 flex items-start gap-2 text-sm" data-testid="mpesa-failed">
          <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div><div className="font-semibold">{FAIL[prompt.status] ?? "M-Pesa didn't take the payment."}</div>
            {prompt.message && <div className="text-slate-600 dark:text-slate-300">{prompt.message}</div>}
            <div className="text-slate-500">You can send the prompt again.</div></div>
        </div>
      )}
      <div className={compact ? "flex gap-2 items-end" : "grid md:grid-cols-[1fr_auto] gap-2 items-end"}>
        <div className="space-y-1 flex-1">
          <Label htmlFor="mpesa-phone" className="text-xs">Guest's M-Pesa phone</Label>
          <Input id="mpesa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" inputMode="tel" />
        </div>
        <Button type="button" className="bg-green-600 hover:bg-green-700" disabled={busy || !phoneOk || whole < 1}
          onClick={() => send(() => create(phone, whole))}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
          Send prompt for {formatMoney2(whole, currency)}
        </Button>
      </div>
      {whole !== amount && amount > 0 && <p className="text-xs text-slate-500">M-Pesa takes whole shillings, so the prompt is rounded up.</p>}
    </div>
  );
};
