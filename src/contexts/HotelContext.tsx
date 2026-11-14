import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Hotel, HotelRole, Membership } from "@/lib/db-types";

const STORAGE_KEY = "hoteleasy.currentHotel";

interface HotelState {
  memberships: Membership[];
  hotel: Hotel | null;
  role: HotelRole | null;
  loading: boolean;
  switchHotel: (hotelId: string) => void;
  refresh: () => Promise<void>;
  /** True if the current user has one of these built-in roles. Always false on a custom role. */
  can: (...roles: HotelRole[]) => boolean;
  /** True if the current user has any of these permissions (e.g. "billing.void"). The owner has them all. */
  allowed: (...perms: string[]) => boolean;
  /** The custom role the user is on in this hotel, if any. */
  customRole: { id: string; name: string } | null;
  perms: Set<string>;
  /** False while a custom role's permissions are still loading. */
  permsReady: boolean;
}

const HotelContext = createContext<HotelState | undefined>(undefined);

export const HotelProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Pick up any invitations sent to this email before listing hotels.
      await supabase.rpc("accept_pending_invitations");
      const { data, error } = await supabase
        .from("hotel_members")
        .select("id, hotel_id, role, custom_role_id, hotels(*)")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const current = useMemo(
    () => memberships.find((m) => m.hotel_id === currentId) ?? memberships[0] ?? null,
    [memberships, currentId],
  );

  const { data: mine } = useQuery({
    queryKey: ["my-permissions", current?.hotel_id, current?.role, current?.custom_role_id],
    enabled: !!current,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_permissions", { _hotel_id: current!.hotel_id });
      if (error) throw error;
      return data as unknown as { permissions: string[]; custom_role_id: string | null; custom_role_name: string | null } | null;
    },
  });
  const perms = useMemo(() => new Set<string>(mine?.permissions ?? []), [mine]);
  const customRole = current?.custom_role_id ? { id: current.custom_role_id, name: mine?.custom_role_name ?? "" } : null;

  useEffect(() => {
    if (current) localStorage.setItem(STORAGE_KEY, current.hotel_id);
  }, [current]);

  const value: HotelState = {
    memberships,
    hotel: current?.hotels ?? null,
    role: current?.role ?? null,
    loading: !!user && isLoading,
    switchHotel: (id) => {
      setCurrentId(id);
      localStorage.setItem(STORAGE_KEY, id);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
    },
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ["memberships"] });
    },
    can: (...roles) => !!current && !current.custom_role_id && roles.includes(current.role),
    allowed: (...ps) => !!current && (current.role === "owner" || ps.some((p) => p.split("|").some((x) => perms.has(x)))),
    customRole,
    perms,
    permsReady: !current || current.role === "owner" || !!mine,
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
};

export const useHotel = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used inside HotelProvider");
  return ctx;
};

/** For screens that only render once a hotel is selected. */
export const useCurrentHotel = () => {
  const ctx = useHotel();
  if (!ctx.hotel || !ctx.role) throw new Error("No hotel selected");
  return { ...ctx, hotel: ctx.hotel, role: ctx.role };
};

/** Spreadsheet (CSV) downloads need reports.export. */
export const useCanExport = () => useHotel().allowed("reports.export");
