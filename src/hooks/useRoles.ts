import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { CustomRole, HotelRole } from "@/lib/db-types";

const rpc = (fn: string, args: Record<string, unknown>) =>
  supabase.rpc(fn as never, args as never) as unknown as Promise<{ data: unknown; error: { message: string } | null }>;

export const useCustomRoles = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["roles", hotel.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("hotel_roles" as never) as unknown as ReturnType<typeof supabase.from>)
        .select("*").eq("hotel_id", hotel.id).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CustomRole[];
    },
  });
};

export interface RoleDraft { id?: string; name: string; description: string; base_role: HotelRole; permissions: string[] }

export const useSaveRole = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: RoleDraft) => {
      const { data, error } = await rpc("role_save", {
        _hotel_id: hotel.id, _id: r.id ?? null, _name: r.name, _description: r.description,
        _base_role: r.base_role, _permissions: r.permissions,
      });
      if (error) throw error;
      return data as CustomRole;
    },
    onSuccess: (_d, r) => {
      ["roles", "team", "my-permissions", "memberships"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(r.id ? `Role "${r.name}" saved` : `Role "${r.name}" created`);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: CustomRole) => {
      const { error } = await rpc("role_delete", { _id: r.id });
      if (error) throw error;
    },
    onSuccess: (_d, r) => {
      ["roles", "team"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Role "${r.name}" deleted`);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

/** Permissions added since the owner last looked at the roles (empty when the hotel has no custom roles). */
export const useNewPermissions = (enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["roles", "new", hotel.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await rpc("roles_new_permissions", { _hotel_id: hotel.id });
      if (error) throw error;
      return (data ?? []) as string[];
    },
  });
};

export const useMarkRolesReviewed = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await rpc("roles_mark_reviewed", { _hotel_id: hotel.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles", "new"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });
};
