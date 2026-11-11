import { useState, type FormEvent } from "react";
import { Loader2, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import { AuthShell } from "./AuthPage";

/** Shown to a signed-in user who doesn't belong to any hotel yet. */
const Onboarding = () => {
  const { user, signOut } = useAuth();
  const { refresh, switchHotel } = useHotel();
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState(true);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase.rpc("create_hotel", {
      _name: String(f.get("name")),
      _city: String(f.get("city") || "") || null,
      _phone: String(f.get("phone") || "") || null,
      _email: String(f.get("email") || "") || null,
      _with_sample_rooms: samples,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    switchHotel(data as string);
    await refresh();
    toast.success("Your hotel is ready.");
  };

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Set up your hotel</CardTitle>
          <CardDescription>You'll be the owner and can invite your staff afterwards.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="h-name">Hotel name</Label>
              <Input id="h-name" name="name" required placeholder="e.g. Olsupat Lodge" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="h-city">Town / city</Label>
                <Input id="h-city" name="city" placeholder="Nairobi" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-phone">Phone</Label>
                <Input id="h-phone" name="phone" placeholder="+254 7…" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-email">Reservations email</Label>
              <Input id="h-email" name="email" type="email" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={samples} onCheckedChange={(v) => setSamples(v === true)} className="mt-0.5" />
              <span>
                Add sample rooms to start with (12 rooms in Standard, Deluxe and Suite). You can edit or delete them
                later.
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create hotel
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-white/60">
        <CardContent className="pt-6 text-sm text-slate-600 space-y-3">
          <p className="flex gap-2">
            <Mail className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Joining an existing hotel as staff? Ask the manager to invite <strong>{user?.email}</strong> from
              Settings → Team, then sign in again.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
};

export default Onboarding;
