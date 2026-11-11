import { useState, type FormEvent } from "react";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import {
  useChangeMemberRole, useInvitations, useInvite, useRemoveMember, useRevokeInvite, useTeam, useUpdateHotel,
} from "@/hooks/useHotelQueries";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { PageHeader } from "@/components/common/PageHeader";
import { ROLE_LABELS, formatDate } from "@/lib/format";
import type { HotelRole } from "@/lib/db-types";

const ASSIGNABLE: HotelRole[] = ["manager", "front_desk", "housekeeping", "restaurant", "accountant"];

const ROLE_HELP: Record<HotelRole, string> = {
  owner: "Everything, including managing the team",
  manager: "Everything except changing roles",
  front_desk: "Reservations, guests, check-in/out, room status",
  housekeeping: "Room status and arrivals/departures",
  restaurant: "Restaurant POS and guest lookup",
  accountant: "Billing, payments and reports",
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { hotel, can } = useCurrentHotel();
  const isOwner = can("owner");
  const canManage = can("owner", "manager");
  const updateHotel = useUpdateHotel();
  const team = useTeam();
  const invites = useInvitations(canManage);
  const invite = useInvite();
  const revoke = useRevokeInvite();
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const [inviteRole, setInviteRole] = useState<HotelRole>("front_desk");

  const saveHotel = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim() || null;
    updateHotel.mutate({
      name: s("name") ?? hotel.name,
      address: s("address"),
      city: s("city"),
      phone: s("phone"),
      email: s("email"),
      checkin_time: s("checkin_time") ?? "14:00",
      checkout_time: s("checkout_time") ?? "11:00",
      vat_rate: Number(f.get("vat")) / 100,
    });
  };

  const sendInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email")).trim();
    invite.mutate({ email, role: inviteRole }, { onSuccess: () => form.reset() });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings & Team" subtitle="Hotel details and who can use HotelEasy" />

      <Card>
        <CardHeader>
          <CardTitle>Hotel details</CardTitle>
          <CardDescription>Shown on reservations and, later, on invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveHotel} className="grid gap-4 md:grid-cols-2">
            <fieldset disabled={!canManage} className="contents">
              <div className="space-y-2">
                <Label>Hotel name</Label>
                <Input name="name" defaultValue={hotel.name} required />
              </div>
              <div className="space-y-2">
                <Label>Town / city</Label>
                <Input name="city" defaultValue={hotel.city ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input name="address" defaultValue={hotel.address ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" defaultValue={hotel.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={hotel.email ?? ""} />
              </div>
              <div className="grid grid-cols-3 gap-3 md:col-span-2">
                <div className="space-y-2">
                  <Label>Check-in from</Label>
                  <Input name="checkin_time" type="time" defaultValue={hotel.checkin_time.slice(0, 5)} />
                </div>
                <div className="space-y-2">
                  <Label>Check-out by</Label>
                  <Input name="checkout_time" type="time" defaultValue={hotel.checkout_time.slice(0, 5)} />
                </div>
                <div className="space-y-2">
                  <Label>VAT %</Label>
                  <Input name="vat" type="number" step="0.01" min={0} max={50} defaultValue={Number(hotel.vat_rate) * 100} />
                </div>
              </div>
              {canManage && (
                <div className="md:col-span-2">
                  <Button type="submit" disabled={updateHotel.isPending}>
                    {updateHotel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save details
                  </Button>
                </div>
              )}
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {isOwner ? "Change roles or remove people. " : ""}Each person only sees the hotels they've been added to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isOwner && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.data?.map((m) => {
                  const editable = isOwner && m.user_id !== user?.id && m.role !== "owner";
                  return (
                    <TableRow key={m.member_id}>
                      <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>
                        {editable ? (
                          <Select value={m.role} onValueChange={(role) => changeRole.mutate({ memberId: m.member_id, role })}>
                            <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(m.joined_at)}</TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {editable && (
                            <ConfirmButton
                              title={`Remove ${m.full_name || m.email}?`}
                              description="They will immediately lose access to this hotel."
                              onConfirm={() => removeMember.mutate(m.member_id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Trash2 className="h-4 w-4" />
                            </ConfirmButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {canManage && (
            <div className="space-y-3 rounded-lg border p-4 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />Invite someone
              </div>
              <form onSubmit={sendInvite} className="flex flex-col md:flex-row gap-2">
                <Input name="email" type="email" required placeholder="staff@email.com" className="md:flex-1" />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as HotelRole)}>
                  <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.filter((r) => isOwner || r !== "manager").map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={invite.isPending}>Invite</Button>
              </form>
              <p className="text-xs text-slate-500">
                {ROLE_LABELS[inviteRole]}: {ROLE_HELP[inviteRole]}. Tell them to create an account at this site with
                that email address; they'll be added automatically when they sign in.
              </p>
              {!!invites.data?.length && (
                <div className="space-y-2 pt-2">
                  <div className="text-sm font-medium">Waiting to join</div>
                  {invites.data.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-sm bg-white dark:bg-slate-900 rounded-md px-3 py-2 border">
                      <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{i.email}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{ROLE_LABELS[i.role]}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
