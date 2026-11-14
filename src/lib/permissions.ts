// The permission list lives in the database (table permission_catalog, filled by migrations).
// The app reads it from there, so there is one list only. `npm run check:perms` checks that every
// permission named in the code or in SQL role checks exists in that list.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HotelRole } from "@/lib/db-types";

export interface PermRow { key: string; module: string; module_label: string; action: string; label: string; sort: number; default_roles: HotelRole[]; added_at: string }
export interface PermAction { key: string; action: string; label: string; roles: HotelRole[] }
export interface PermModule { module: string; label: string; actions: PermAction[] }
export interface Catalog { modules: PermModule[]; all: string[]; rows: PermRow[] }

export const ACTION_LABELS: Record<string, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete" };

export const toCatalog = (rows: PermRow[]): Catalog => {
  const sorted = [...rows].sort((a, b) => a.sort - b.sort);
  const modules: PermModule[] = [];
  sorted.forEach((r) => {
    let m = modules.find((x) => x.module === r.module);
    if (!m) modules.push((m = { module: r.module, label: r.module_label, actions: [] }));
    m.actions.push({ key: r.key, action: r.action, label: r.label, roles: r.default_roles });
  });
  return { modules, all: sorted.map((r) => r.key), rows: sorted };
};

/** What a built-in role can do. */
export const builtInPerms = (c: Catalog, role: HotelRole): string[] =>
  role === "owner" ? c.all : c.rows.filter((r) => r.default_roles.includes(role)).map((r) => r.key);

export const useCatalog = () =>
  useQuery({
    queryKey: ["permission-catalog"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("permission_catalog" as never) as unknown as ReturnType<typeof supabase.from>).select("*");
      if (error) throw error;
      return toCatalog((data ?? []) as unknown as PermRow[]);
    },
  });
