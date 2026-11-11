import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSaveGuest } from "@/hooks/useHotelQueries";
import type { Guest } from "@/lib/db-types";

const ID_TYPES = ["National ID", "Passport", "Alien ID", "Driving licence", "Other"];

/** Create or edit a guest. Calls onSaved with the stored guest. */
export const GuestForm = ({
  guest,
  onSaved,
  onCancel,
  compact,
}: {
  guest?: Partial<Guest>;
  onSaved: (g: Guest) => void;
  onCancel?: () => void;
  compact?: boolean;
}) => {
  const save = useSaveGuest();
  const [vip, setVip] = useState(!!guest?.is_vip);
  const [idType, setIdType] = useState(guest?.id_type ?? "National ID");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "");
    save.mutate(
      {
        id: guest?.id,
        first_name: s("first_name"),
        last_name: s("last_name"),
        phone: s("phone"),
        email: s("email"),
        id_type: idType,
        id_number: s("id_number"),
        nationality: s("nationality"),
        ...(compact ? {} : { address: s("address"), notes: s("notes"), date_of_birth: s("date_of_birth") || null }),
        is_vip: vip,
      },
      { onSuccess: (g) => onSaved(g as Guest) },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>First name *</Label>
          <Input name="first_name" defaultValue={guest?.first_name} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Last name</Label>
          <Input name="last_name" defaultValue={guest?.last_name} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input name="phone" type="tel" defaultValue={guest?.phone ?? ""} placeholder="+254 7…" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={guest?.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>ID type</Label>
          <Select value={idType} onValueChange={setIdType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>ID / passport number</Label>
          <Input name="id_number" defaultValue={guest?.id_number ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Nationality</Label>
          <Input name="nationality" defaultValue={guest?.nationality ?? "Kenyan"} />
        </div>
        {!compact && (
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Input name="date_of_birth" type="date" defaultValue={guest?.date_of_birth ?? ""} />
          </div>
        )}
      </div>
      {!compact && (
        <>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input name="address" defaultValue={guest?.address ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Notes / preferences</Label>
            <Textarea name="notes" defaultValue={guest?.notes ?? ""} rows={2} placeholder="e.g. Prefers ground floor, allergic to nuts" />
          </div>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={vip} onCheckedChange={setVip} /> VIP guest
      </label>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={save.isPending}>Save guest</Button>
      </div>
    </form>
  );
};
