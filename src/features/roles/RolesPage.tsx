import { useMemo, useState } from "react";
import { Copy, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, LoadingBlock } from "@/components/common/PageHeader";
import { ConfirmButton } from "@/components/common/ConfirmButton";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useTeam } from "@/hooks/useHotelQueries";
import { useCustomRoles, useDeleteRole, useSaveRole, type RoleDraft } from "@/hooks/useRoles";
import { ACTION_LABELS, ALL_PERMS, PERMISSIONS, builtInPerms } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/format";
import type { CustomRole, HotelRole } from "@/lib/db-types";

const BUILT_IN: HotelRole[] = ["owner", "manager", "front_desk", "housekeeping", "restaurant", "accountant", "maintenance", "storekeeper"];
const JOB_TYPES: HotelRole[] = BUILT_IN.filter((r) => r !== "owner");
const COLUMNS = ["view", "create", "edit", "delete"];

type Editing = { draft: RoleDraft; readOnly?: string } | null;

/** Owner-only: make custom roles and decide exactly what each can see and do. */
const RolesPage = () => {
  const { role } = useCurrentHotel();
  const roles = useCustomRoles();
  const team = useTeam();
  const del = useDeleteRole();
  const [editing, setEditing] = useState<Editing>(null);

  const people = useMemo(() => {
    const m = new Map<string, number>();
    (team.data ?? []).forEach((t) => {
      const k = t.custom_role_id ? `custom:${t.custom_role_id}` : t.role;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [team.data]);

  if (role !== "owner") return <div className="p-6 text-slate-600">Only the hotel owner can manage roles.</div>;
  if (roles.isLoading) return <LoadingBlock />;

  const startNew = (from?: HotelRole | CustomRole) =>
    setEditing({ draft: {
      name: from ? `${typeof from === "string" ? ROLE_LABELS[from] : from.name} (copy)` : "",
      description: typeof from === "object" ? from.description ?? "" : "",
      base_role: typeof from === "string" ? (from === "owner" ? "manager" : from) : from?.base_role ?? "front_desk",
      permissions: typeof from === "string" ? builtInPerms(from) : from?.permissions ?? ["dashboard.view", "settings.view"],
    } });

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & permissions"
        subtitle="Make your own roles and tick exactly what each one can see and do. Give them to people under Settings & Team."
        actions={<Button onClick={() => startNew()}><Plus className="mr-1 h-4 w-4" />New role</Button>} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your roles</CardTitle>
          <CardDescription>Changes apply straight away to everyone on the role.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!roles.data?.length ? (
            <div className="px-6 pb-6 text-sm text-slate-500">
              No custom roles yet. Start with <b>New role</b>, or copy a built-in role below and change what it can do.
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Job type</TableHead><TableHead className="text-right">Permissions</TableHead>
                <TableHead className="text-right">People</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {roles.data.map((r) => {
                  const n = people.get(`custom:${r.id}`) ?? 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell><div className="font-medium">{r.name}</div>{r.description && <div className="text-xs text-slate-500">{r.description}</div>}</TableCell>
                      <TableCell>{ROLE_LABELS[r.base_role]}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.permissions.length} of {ALL_PERMS.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{n}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ draft: { id: r.id, name: r.name, description: r.description ?? "", base_role: r.base_role, permissions: r.permissions } })}
                          aria-label={`Edit ${r.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => startNew(r)} aria-label={`Copy ${r.name}`}><Copy className="h-4 w-4" /></Button>
                        <ConfirmButton size="sm" variant="ghost" aria-label={`Delete ${r.name}`} disabled={n > 0}
                          title={`Delete the role "${r.name}"?`} description="Pending invitations with this role are cancelled."
                          onConfirm={() => del.mutate(r)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Built-in roles</CardTitle>
          <CardDescription>These can't be changed. Copy one to make a role that starts from it.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Role</TableHead><TableHead className="text-right">Permissions</TableHead><TableHead className="text-right">People</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {BUILT_IN.map((r) => (
                <TableRow key={r}>
                  <TableCell className="font-medium"><span className="inline-flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-slate-400" />{ROLE_LABELS[r]}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{r === "owner" ? "All, plus roles and team" : `${builtInPerms(r).length} of ${ALL_PERMS.length}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{people.get(r) ?? 0}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ readOnly: ROLE_LABELS[r], draft: { name: ROLE_LABELS[r], description: "", base_role: r, permissions: builtInPerms(r) } })}>See</Button>
                    {r !== "owner" && <Button size="sm" variant="ghost" onClick={() => startNew(r)} aria-label={`Copy ${ROLE_LABELS[r]}`}><Copy className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />
        Permissions are checked by the database too, not just hidden on screen. Only the owner can make roles and give them to people.</p>

      {editing && <RoleDialog key={editing.draft.id ?? editing.readOnly ?? "new"} editing={editing} people={editing.draft.id ? people.get(`custom:${editing.draft.id}`) ?? 0 : 0}
        onClose={() => setEditing(null)} />}
    </div>
  );
};

const RoleDialog = ({ editing, people, onClose }: { editing: NonNullable<Editing>; people: number; onClose: () => void }) => {
  const save = useSaveRole();
  const ro = !!editing.readOnly;
  const [d, setD] = useState<RoleDraft>(editing.draft);
  const has = new Set(d.permissions);

  const set = (keys: string[], on: boolean) => {
    const next = new Set(d.permissions);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    // anything in an area needs "view" of that area; taking "view" away takes the rest
    PERMISSIONS.forEach((m) => {
      const view = `${m.module}.view`;
      const hasView = m.actions.some((a) => a.key === view);
      if (!hasView) return;
      const others = m.actions.filter((a) => a.key !== view).map((a) => a.key);
      if (keys.includes(view) && !on) others.forEach((k) => next.delete(k));
      else if (others.some((k) => next.has(k))) next.add(view);
    });
    setD({ ...d, permissions: ALL_PERMS.filter((k) => next.has(k)) });
  };

  const submit = () => save.mutate(d, { onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ro ? `${editing.readOnly} (built-in)` : d.id ? `Edit role` : "New role"}</DialogTitle>
          <DialogDescription>
            {ro ? "What this built-in role can do. Copy it to make your own version."
              : people > 0 ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{people} {people === 1 ? "person is" : "people are"} on this role. Saving changes what they can do straight away.</span>
              : "Tick what people on this role can see and do."}
          </DialogDescription>
        </DialogHeader>

        {!ro && (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Night auditor" /></div>
            <div className="space-y-1.5"><Label>Job type</Label>
              <Select value={d.base_role} onValueChange={(v) => setD({ ...d, base_role: v as HotelRole })}>
                <SelectTrigger aria-label="Job type"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_TYPES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 leading-tight">Decides which alerts they get and the task lists they appear in. It gives no access by itself.</p></div>
            <div className="space-y-1.5"><Label>Start from</Label>
              <Select value="" onValueChange={(v) => setD({ ...d, permissions: v === "none" ? [] : builtInPerms(v as HotelRole) })}>
                <SelectTrigger aria-label="Start from"><SelectValue placeholder="Copy ticks from a built-in role" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nothing ticked</SelectItem>
                  {JOB_TYPES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="md:col-span-3 space-y-1.5"><Label htmlFor="role-desc">Description (optional)</Label>
              <Textarea id="role-desc" rows={1} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="e.g. Front desk at night: closes the day, no refunds" /></div>
          </div>
        )}

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                {COLUMNS.map((c) => <TableHead key={c} className="text-center w-16">{ACTION_LABELS[c]}</TableHead>)}
                <TableHead>Also allowed to</TableHead>
                {!ro && <TableHead className="w-12 text-center">All</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((m) => {
                const keys = m.actions.map((a) => a.key);
                const all = keys.every((k) => has.has(k));
                const extra = m.actions.filter((a) => !COLUMNS.includes(a.action));
                return (
                  <TableRow key={m.module} data-testid={`perm-row-${m.module}`}>
                    <TableCell className="font-medium whitespace-nowrap">{m.label}</TableCell>
                    {COLUMNS.map((c) => {
                      const a = m.actions.find((x) => x.action === c);
                      return (
                        <TableCell key={c} className="text-center">
                          {a ? <Checkbox checked={has.has(a.key)} disabled={ro} title={a.label} aria-label={`${m.label}: ${a.label}`}
                            onCheckedChange={(v) => set([a.key], v === true)} /> : <span className="text-slate-300">·</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {m.actions.filter((a) => COLUMNS.includes(a.action)).length < m.actions.length && extra.map((a) => (
                          <label key={a.key} className="flex items-center gap-2 text-xs">
                            <Checkbox checked={has.has(a.key)} disabled={ro} aria-label={`${m.label}: ${a.label}`} onCheckedChange={(v) => set([a.key], v === true)} />
                            {a.label}
                          </label>
                        ))}
                        {!extra.length && <span className="text-xs text-slate-400">{m.actions.filter((a) => a.action !== "view").map((a) => a.label).join("; ")}</span>}
                      </div>
                    </TableCell>
                    {!ro && <TableCell className="text-center"><Checkbox checked={all} aria-label={`${m.label}: everything`} onCheckedChange={(v) => set(keys, v === true)} /></TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="items-center">
          <span className="text-sm text-slate-500 mr-auto">{d.permissions.length} of {ALL_PERMS.length} ticked</span>
          {ro ? <Button variant="outline" onClick={onClose}>Close</Button> : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={save.isPending || d.name.trim().length < 2}>{d.id ? "Save role" : "Create role"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RolesPage;
