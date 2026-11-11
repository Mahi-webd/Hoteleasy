import { useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { WrongPinError } from "@/hooks/usePos";

const QUICK_REASONS = ["Wrong item entered", "Guest changed mind", "Spilled / dropped", "Kitchen error", "Long wait", "Complaint"];

/**
 * Asks for a reason, and for a manager PIN unless the signed-in user is a
 * manager. `onSubmit` throws WrongPinError when the PIN is wrong.
 */
export const ApprovalDialog = ({
  title, description, confirmLabel = "Confirm", children, reasons = QUICK_REASONS, needsReason = true, onSubmit, onClose,
}: {
  title: string; description?: string; confirmLabel?: string; children?: ReactNode; reasons?: string[]; needsReason?: boolean;
  onSubmit: (reason: string, pin?: string) => Promise<unknown>; onClose: () => void;
}) => {
  const { can } = useCurrentHotel();
  const isManager = can("owner", "manager");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim(), isManager ? undefined : pin);
      onClose();
    } catch (err) {
      if (err instanceof WrongPinError) { setError("Wrong manager PIN"); setPin(""); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {children}
          {needsReason && (
            <div className="space-y-2">
              <Label htmlFor="ap-reason">Reason</Label>
              <div className="flex flex-wrap gap-1">
                {reasons.map((r) => (
                  <button type="button" key={r} onClick={() => setReason(r)}
                    className={`text-xs rounded-full border px-2 py-1 ${reason === r ? "bg-blue-600 text-white border-blue-600" : "hover:bg-slate-50"}`}>{r}</button>
                ))}
              </div>
              <Input id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason" required />
            </div>
          )}
          {!isManager && (
            <div className="space-y-2">
              <Label htmlFor="ap-pin" className="flex items-center gap-1"><KeyRound className="h-4 w-4" />Manager PIN</Label>
              <Input id="ap-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="A manager types their PIN" required />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || (needsReason && !reason.trim()) || (!isManager && pin.length < 4)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
