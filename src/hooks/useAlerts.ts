import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import type { HotelAlert, OwnerHotel } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};
export const useAlerts = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["alerts", hotel.id],
    queryFn: async () => unwrap(await supabase.rpc("hotel_alerts", { _hotel_id: hotel.id })) as HotelAlert[],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
};
export const useOwnerOverview = () =>
  useQuery({
    queryKey: ["alerts", "overview"],
    queryFn: async () => unwrap(await supabase.rpc("owner_overview")) as OwnerHotel[],
    refetchInterval: 120_000,
  });
