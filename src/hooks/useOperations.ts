import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { addDays, friendlyError, todayIn } from "@/lib/format";
import type { HkTask, HkTaskType, MtTicket, Priority } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

const KEYS = ["housekeeping", "maintenance", "rooms", "dashboard", "activity"];

const useOpsAction = <TArgs,>(fn: (a: TArgs) => Promise<unknown>, success?: string | ((a: TArgs) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => {
      KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(a) : success);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

// ------------------------------------------------------------- housekeeping
/** Open tasks plus anything finished or cancelled since yesterday. */
export const useHousekeepingTasks = () => {
  const { hotel } = useCurrentHotel();
  const since = addDays(todayIn(hotel.timezone), -1);
  return useQuery({
    queryKey: ["housekeeping", hotel.id, since],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("housekeeping_tasks")
          .select("*, rooms(id, room_number, status, floor, room_types(name))")
          .eq("hotel_id", hotel.id)
          .or(`status.in.(pending,in_progress),updated_at.gte.${since}`)
          .order("created_at"),
      ) as HkTask[],
  });
};

export const useUpdateTask = () =>
  useOpsAction(
    async ({ id, patch }: { id: string; patch: Partial<Pick<HkTask, "status" | "assigned_to" | "priority" | "notes">>; message?: string }) =>
      unwrap(await supabase.from("housekeeping_tasks").update(patch).eq("id", id)),
    (a) => a.message ?? "Task updated",
  );

export const useCreateTask = () => {
  const { hotel } = useCurrentHotel();
  return useOpsAction(
    async (t: { room_id: string; task_type: HkTaskType; priority: Priority; notes?: string; assigned_to?: string | null }) =>
      unwrap(
        await supabase.from("housekeeping_tasks").insert({
          ...t,
          hotel_id: hotel.id,
          due_date: todayIn(hotel.timezone),
          notes: t.notes?.trim() || null,
        }),
      ),
    "Task added",
  );
};

export const useCreateStayovers = () => {
  const { hotel } = useCurrentHotel();
  return useOpsAction(
    async () => unwrap(await supabase.rpc("create_stayover_tasks", { _hotel_id: hotel.id })) as number,
    "Daily service tasks created for occupied rooms",
  );
};

// ------------------------------------------------------------- maintenance
export const useTickets = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["maintenance", hotel.id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("maintenance_tickets")
          .select("*, rooms(id, room_number, status)")
          .eq("hotel_id", hotel.id)
          .order("created_at", { ascending: false })
          .limit(500),
      ) as MtTicket[],
  });
};

export const useCreateTicket = () => {
  const { hotel } = useCurrentHotel();
  return useOpsAction(
    async (t: Pick<MtTicket, "title" | "category" | "priority" | "blocks_room"> & { room_id: string | null; location: string | null; description: string | null }) =>
      unwrap(
        await supabase.from("maintenance_tickets").insert({
          ...t,
          hotel_id: hotel.id,
          title: t.title.trim(),
          location: t.room_id ? null : t.location?.trim() || null,
          description: t.description?.trim() || null,
        }),
      ),
    (a) => (a.blocks_room ? "Issue reported — room taken out of service" : "Issue reported"),
  );
};

export const useUpdateTicket = () =>
  useOpsAction(
    async ({ id, patch }: { id: string; patch: Partial<MtTicket> }) =>
      unwrap(await supabase.from("maintenance_tickets").update(patch).eq("id", id)),
    "Issue updated",
  );
