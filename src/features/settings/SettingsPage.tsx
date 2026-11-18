import { useState, type FormEvent } from "react";
import { Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import type { CustomRole, HotelRole } from "@/lib/db-types";
import { useCustomRoles } from "@/hooks/useRoles";
import { MpesaSettings } from "./MpesaSettings";

const ASSIGNABLE: HotelRole[] = ["manager", "front_desk", "housekeeping", "maintenance", "restaurant", "accountant", "storekeeper"];

const ROLE_HELP: Record<HotelRole, string> = {
  owner: "Everything, including managing the team",
  manager: "Everything except changing roles",
  front_desk: "Reservations, guests, check-in/out, room status",
  housekeeping: "Cleaning tasks, room status, reporting problems (no guest details or money)",
  maintenance: "Repair tickets and taking rooms out of service (no guest details or money)",
  restaurant: "Waiter / cashier: POS orders, bills, payments, room charges, kitchen screen",
  accountant: "Billing, payments, reports and stock costs",
  storekeeper: "Stores: receiving, purchase orders, transfers, issues and stock counts (no guest details)",
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { hotel, can, allowed } = useCurrentHotel();
  const isOwner = can("owner");
  const canManage = allowed("settings.edit");
  const canInvite = allowed("team.invite");
  const updateHotel = useUpdateHotel();
  const team = useTeam();
  const invites = useInvitations(canInvite);
  const invite = useInvite();
  const revoke = useRevokeInvite();
  const changeRole = useChangeMemberRole();
  const removeMember = useRemoveMember();
  const [inviteRole, setInviteRole] = useState<string>("front_desk");
  const customRoles = useCustomRoles();
  const roleById = new Map((customRoles.data ?? []).map((c) => [c.id, c] as const));
  const inviteCustom = inviteRole.startsWith("custom:") ? roleById.get(inviteRole.slice(7)) : undefined;

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
    invite.mutate(inviteCustom ? { email, role: inviteCustom.base_role, customRoleId: inviteCustom.id } : { email, role: inviteRole },
      { onSuccess: () => form.reset() });
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

      <BillingSettings />

      <MpesaSettings />

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
                          <Select value={m.custom_role_id ? `custom:${m.custom_role_id}` : m.role}
                            onValueChange={(v) => changeRole.mutate(v.startsWith("custom:")
                              ? { memberId: m.member_id, role: null, customRoleId: v.slice(7) }
                              : { memberId: m.member_id, role: v, customRoleId: null })}>
                            <SelectTrigger className="w-48 h-8" aria-label={`Role of ${m.full_name || m.email}`}><SelectValue /></SelectTrigger>
                            <RoleOptions roles={customRoles.data ?? []} owner />
                          </Select>
                        ) : (
                          <Badge variant="secondary">{m.custom_role_name ?? ROLE_LABELS[m.role]}</Badge>
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

          {canInvite && (
            <div className="space-y-3 rounded-lg border p-4 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4" />Invite someone
                <LicenceUsers />
              </div>
              <form onSubmit={sendInvite} className="flex flex-col md:flex-row gap-2">
                <Input name="email" type="email" required placeholder="staff@email.com" className="md:flex-1" />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="md:w-52" aria-label="Role for the invitation"><SelectValue /></SelectTrigger>
                  <RoleOptions roles={customRoles.data ?? []} owner={isOwner} />
                </Select>
                <Button type="submit" disabled={invite.isPending}>Invite</Button>
              </form>
              <p className="text-xs text-slate-500">
                {inviteCustom ? `${inviteCustom.name}: ${inviteCustom.permissions.length} permissions${inviteCustom.description ? `, ${inviteCustom.description}` : ""}` : `${ROLE_LABELS[inviteRole as HotelRole]}: ${ROLE_HELP[inviteRole as HotelRole]}`}. Tell them to create an account at this site with
                that email address; they'll be added automatically when they sign in.
              </p>
              {!!invites.data?.length && (
                <div className="space-y-2 pt-2">
                  <div className="text-sm font-medium">Waiting to join</div>
                  {invites.data.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-sm bg-white dark:bg-slate-900 rounded-md px-3 py-2 border">
                      <span className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{i.email}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{(i.custom_role_id && roleById.get(i.custom_role_id)?.name) || ROLE_LABELS[i.role]}</Badge>
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

const BillingSettings = () => {
  const { hotel, can, allowed } = useCurrentHotel();
  const canManage = allowed("settings.edit");
  const canInvite = allowed("team.invite");
  const updateHotel = useUpdateHotel();
  const [inclusive, setInclusive] = useState(hotel.prices_include_vat);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim() || null;
    updateHotel.mutate({
      kra_pin: s("kra_pin")?.toUpperCase() ?? null,
      prices_include_vat: inclusive,
      tourism_levy_rate: Number(f.get("levy") || 0) / 100,
      invoice_prefix: s("invoice_prefix") ?? "INV",
      next_invoice_number: Number(f.get("next_invoice_number")),
      mpesa_paybill: s("mpesa_paybill"),
      mpesa_account: s("mpesa_account"),
      mpesa_till: s("mpesa_till"),
      bank_details: s("bank_details"),
      invoice_footer: s("invoice_footer"),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & invoices</CardTitle>
        <CardDescription>Tax settings apply to new charges; existing charges keep the rates they were posted with.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <fieldset disabled={!canManage} className="contents">
            <div className="space-y-2">
              <Label>KRA PIN (shown on invoices)</Label>
              <Input name="kra_pin" defaultValue={hotel.kra_pin ?? ""} placeholder="P051234567X" maxLength={11} />
            </div>
            <div className="space-y-2">
              <Label>Tourism / catering levy %</Label>
              <Input name="levy" type="number" step="0.01" min={0} max={19} defaultValue={Number(hotel.tourism_levy_rate) * 100} />
              <p className="text-xs text-slate-500">Usually 2% for hotels registered with the Tourism Fund; 0 if not applicable.</p>
            </div>
            <label className="md:col-span-2 flex items-start gap-3 rounded-md border p-3">
              <Switch checked={inclusive} onCheckedChange={setInclusive} className="mt-0.5" />
              <span className="text-sm">
                <strong>Prices include VAT{Number(hotel.tourism_levy_rate) ? " and levy" : ""}</strong>
                <br />
                <span className="text-slate-500">
                  {inclusive
                    ? "A KES 10,000 room rate means the guest pays KES 10,000; tax is worked out from inside it."
                    : "A KES 10,000 room rate means the guest pays KES 10,000 plus VAT on top."}
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Invoice prefix</Label>
                <Input name="invoice_prefix" defaultValue={hotel.invoice_prefix} pattern="[A-Za-z0-9\-]{1,12}" />
              </div>
              <div className="space-y-2">
                <Label>Next invoice number</Label>
                <Input name="next_invoice_number" type="number" min={hotel.next_invoice_number} defaultValue={hotel.next_invoice_number} />
              </div>
            </div>
            <p className="text-xs text-slate-500 self-end">
              Next invoice: <span className="font-mono">{hotel.invoice_prefix}-{new Date().getFullYear()}-{String(hotel.next_invoice_number).padStart(5, "0")}</span>.
              Numbers can be moved forward (e.g. to continue from your old system) but never back.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>M-Pesa Paybill</Label>
                <Input name="mpesa_paybill" defaultValue={hotel.mpesa_paybill ?? ""} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Paybill account no.</Label>
                <Input name="mpesa_account" defaultValue={hotel.mpesa_account ?? ""} placeholder="e.g. booking code" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>M-Pesa Till (Buy Goods)</Label>
              <Input name="mpesa_till" defaultValue={hotel.mpesa_till ?? ""} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>Bank details</Label>
              <Textarea name="bank_details" rows={2} defaultValue={hotel.bank_details ?? ""} placeholder="Bank, branch, account name & number" />
            </div>
            <div className="space-y-2">
              <Label>Invoice footer</Label>
              <Textarea name="invoice_footer" rows={2} defaultValue={hotel.invoice_footer ?? ""} placeholder="e.g. Asante sana! Check-out time is 11:00." />
            </div>
            {canManage && (
              <div className="md:col-span-2">
                <Button type="submit" disabled={updateHotel.isPending}>Save billing settings</Button>
              </div>
            )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
};

export default SettingsPage;

/** Built-in roles, then the hotel's custom roles (owner only). */
const RoleOptions = ({ roles, owner }: { roles: CustomRole[]; owner: boolean }) => (
  <SelectContent>
    {ASSIGNABLE.filter((r) => owner || r !== "manager").map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
    {owner && roles.length > 0 && <div className="px-2 pt-2 pb-1 text-xs font-medium text-slate-500 border-t mt-1">Custom roles</div>}
    {owner && roles.map((c) => <SelectItem key={c.id} value={`custom:${c.id}`}>{c.name}</SelectItem>)}
  </SelectContent>
);

/** "4 of 5 users" from the hotel's HotelEasy licence (logins, owner and pending invitations included). */
const LicenceUsers = () => {
  const { license } = useCurrentHotel();
  if (!license?.staff_limit) return null;
  const full = license.staff_used >= license.staff_limit;
  return (
    <span className={`ml-auto text-xs font-normal ${full ? "text-red-600" : "text-slate-500"}`}>
      {license.staff_used} of {license.staff_limit} users{full ? ": ask your HotelEasy provider for more" : ""}
    </span>
  );
};
