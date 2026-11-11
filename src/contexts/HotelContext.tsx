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
  /** True if the current user has one of the given roles in the current hotel. */
  can: (...roles: HotelRole[]) => boolean;
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
        .select("id, hotel_id, role, hotels(*)")
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
    can: (...roles) => !!current && roles.includes(current.role),
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
