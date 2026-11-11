import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type {
  ActivityItem,
  Guest,
  Invitation,
  Reservation,
  Room,
  RoomStatus,
  RoomType,
  TeamMember,
} from "@/lib/db-types";

const RES_SELECT =
  "*, guests(id, first_name, last_name, phone, email, is_vip), rooms(id, room_number, status), room_types(id, name)";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

/** Mutation helper: shows a toast on error/success and refreshes the given query groups. */
const useAction = <TArgs,>(
  fn: (args: TArgs) => Promise<unknown>,
  opts: { invalidate: string[]; success?: string | ((args: TArgs) => string) },
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, args) => {
      opts.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(args) : opts.success);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

// ---------------------------------------------------------------- live updates
/** Refresh rooms / reservations / activity when another device changes them. */
export const useRealtimeSync = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    const filter = `hotel_id=eq.${hotel.id}`;
    const channel = supabase
      .channel(`hotel-${hotel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter }, () =>
        qc.invalidateQueries({ queryKey: ["rooms"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter }, () => {
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks", filter }, () => {
        qc.invalidateQueries({ queryKey: ["housekeeping"] });
        qc.invalidateQueries({ queryKey: ["rooms"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_tickets", filter }, () => {
        qc.invalidateQueries({ queryKey: ["maintenance"] });
        qc.invalidateQueries({ queryKey: ["rooms"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter }, () => {
        qc.invalidateQueries({ queryKey: ["folio"] });
        qc.invalidateQueries({ queryKey: ["balances"] });
        qc.invalidateQueries({ queryKey: ["payments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "folio_charges", filter }, () => {
        qc.invalidateQueries({ queryKey: ["folio"] });
        qc.invalidateQueries({ queryKey: ["balances"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log", filter }, () =>
        qc.invalidateQueries({ queryKey: ["activity"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotel.id, qc]);
};

// ---------------------------------------------------------------- room types
export const useRoomTypes = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["roomTypes", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("room_types").select("*").eq("hotel_id", hotel.id).order("base_rate")) as RoomType[],
  });
};

export const useSaveRoomType = () => {
  const { hotel } = useCurrentHotel();
  return useAction(
    async (rt: Partial<RoomType> & { name: string }) => {
      const payload = {
        name: rt.name.trim(),
        description: rt.description || null,
        base_rate: rt.base_rate ?? 0,
        max_occupancy: rt.max_occupancy ?? 2,
        amenities: rt.amenities ?? [],
      };
      return rt.id
        ? unwrap(await supabase.from("room_types").update(payload).eq("id", rt.id))
        : unwrap(await supabase.from("room_types").insert({ ...payload, hotel_id: hotel.id }));
    },
    { invalidate: ["roomTypes", "rooms"], success: "Room type saved" },
  );
};

export const useDeleteRoomType = () =>
  useAction(async (id: string) => unwrap(await supabase.from("room_types").delete().eq("id", id)), {
    invalidate: ["roomTypes"],
    success: "Room type deleted",
  });

// ---------------------------------------------------------------- rooms
export const useRooms = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["rooms", hotel.id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("rooms")
          .select("*, room_types(id, name, base_rate, max_occupancy)")
          .eq("hotel_id", hotel.id)
          .order("floor", { nullsFirst: false })
          .order("room_number"),
      ) as Room[],
  });
};

export const useSaveRoom = () => {
  const { hotel } = useCurrentHotel();
  return useAction(
    async (r: { id?: string; room_number: string; room_type_id: string; floor: number | null; notes?: string | null }) => {
      const payload = {
        room_number: r.room_number.trim(),
        room_type_id: r.room_type_id,
        floor: r.floor,
        notes: r.notes || null,
      };
      return r.id
        ? unwrap(await supabase.from("rooms").update(payload).eq("id", r.id))
        : unwrap(await supabase.from("rooms").insert({ ...payload, hotel_id: hotel.id }));
    },
    { invalidate: ["rooms"], success: "Room saved" },
  );
};

export const useSetRoomStatus = () =>
  useAction(
    async ({ id, status }: { id: string; status: RoomStatus; label?: string }) =>
      unwrap(await supabase.from("rooms").update({ status }).eq("id", id)),
    { invalidate: ["rooms", "dashboard"], success: (a) => `Room ${a.label ?? ""} updated` },
  );

export const useDeleteRoom = () =>
  useAction(async (id: string) => unwrap(await supabase.from("rooms").delete().eq("id", id)), {
    invalidate: ["rooms"],
    success: "Room deleted",
  });

export const useAvailableRooms = (checkIn?: string, checkOut?: string, roomTypeId?: string, excludeId?: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["rooms", "available", hotel.id, checkIn, checkOut, roomTypeId, excludeId],
    enabled: !!checkIn && !!checkOut && checkOut > checkIn,
    queryFn: async () =>
      unwrap(
        await supabase.rpc("available_rooms", {
          _hotel_id: hotel.id,
          _check_in: checkIn,
          _check_out: checkOut,
          _room_type_id: roomTypeId || null,
          _exclude_reservation: excludeId || null,
        }),
      ) as Room[],
  });
};

// ---------------------------------------------------------------- guests
export const useGuests = (search: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["guests", hotel.id, search],
    queryFn: async () => {
      let q = supabase.from("guests").select("*").eq("hotel_id", hotel.id);
      const s = search.trim().replace(/[%,()]/g, " ");
      if (s) {
        q = q.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,id_number.ilike.%${s}%`,
        );
      }
      return unwrap(await q.order("created_at", { ascending: false }).limit(200)) as Guest[];
    },
  });
};

export const useSaveGuest = () => {
  const { hotel } = useCurrentHotel();
  return useAction(
    async (g: Partial<Guest> & { first_name: string }): Promise<Guest> => {
      const { id, hotel_id: _h, created_at: _c, ...rest } = g;
      const payload = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]),
      );
      payload.first_name = g.first_name.trim();
      payload.last_name = (g.last_name ?? "").trim();
      const res = id
        ? await supabase.from("guests").update(payload).eq("id", id).select().single()
        : await supabase.from("guests").insert({ ...payload, hotel_id: hotel.id }).select().single();
      return unwrap(res) as Guest;
    },
    { invalidate: ["guests", "reservations"], success: "Guest saved" },
  );
};

export const useDeleteGuest = () =>
  useAction(async (id: string) => unwrap(await supabase.from("guests").delete().eq("id", id)), {
    invalidate: ["guests"],
    success: "Guest deleted",
  });

export const useGuestStays = (guestId?: string) =>
  useQuery({
    queryKey: ["reservations", "guest", guestId],
    enabled: !!guestId,
    queryFn: async () =>
      unwrap(
        await supabase.from("reservations").select(RES_SELECT).eq("guest_id", guestId!).order("check_in", { ascending: false }),
      ) as Reservation[],
  });

// ---------------------------------------------------------------- reservations
export interface ReservationFilter {
  from?: string;
  to?: string;
  status?: string;
}

export const useReservations = (f: ReservationFilter) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["reservations", hotel.id, f],
    queryFn: async () => {
      let q = supabase.from("reservations").select(RES_SELECT).eq("hotel_id", hotel.id);
      // Stays overlapping the window
      if (f.from) q = q.gt("check_out", f.from);
      if (f.to) q = q.lte("check_in", f.to);
      if (f.status && f.status !== "all") q = q.eq("status", f.status);
      return unwrap(await q.order("check_in").limit(500)) as Reservation[];
    },
  });
};

export interface ReservationInput {
  id?: string;
  guest_id: string;
  room_type_id: string;
  room_id: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rate_per_night: number;
  source: string;
  special_requests: string | null;
}

export const useSaveReservation = () => {
  const { hotel } = useCurrentHotel();
  return useAction(
    async ({ id, ...r }: ReservationInput) =>
      id
        ? unwrap(await supabase.from("reservations").update(r).eq("id", id))
        : unwrap(await supabase.from("reservations").insert({ ...r, hotel_id: hotel.id })),
    { invalidate: ["reservations", "rooms", "dashboard", "activity"], success: (a) => (a.id ? "Reservation updated" : "Reservation created") },
  );
};

export const useCheckIn = () =>
  useAction(
    async ({ id, roomId }: { id: string; roomId?: string | null }) =>
      unwrap(await supabase.rpc("check_in_reservation", { _reservation_id: id, _room_id: roomId ?? null })),
    { invalidate: ["reservations", "rooms", "dashboard", "activity"], success: "Guest checked in" },
  );

export const useCheckOut = () =>
  useAction(
    async (id: string) => unwrap(await supabase.rpc("check_out_reservation", { _reservation_id: id })),
    { invalidate: ["reservations", "rooms", "dashboard", "activity"], success: "Guest checked out — room marked dirty" },
  );

export const useCancelReservation = () =>
  useAction(
    async ({ id, noShow }: { id: string; noShow?: boolean }) =>
      unwrap(await supabase.rpc("cancel_reservation", { _reservation_id: id, _no_show: !!noShow })),
    { invalidate: ["reservations", "rooms", "dashboard", "activity"], success: (a) => (a.noShow ? "Marked as no-show" : "Reservation cancelled") },
  );

// ---------------------------------------------------------------- dashboard
export const useActivity = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["activity", hotel.id],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("activity_log")
          .select("id, kind, message, created_at")
          .eq("hotel_id", hotel.id)
          .order("created_at", { ascending: false })
          .limit(12),
      ) as ActivityItem[],
  });
};

// ---------------------------------------------------------------- team
export const useTeam = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["team", hotel.id],
    queryFn: async () => unwrap(await supabase.rpc("hotel_team", { _hotel_id: hotel.id })) as TeamMember[],
  });
};

export const useInvitations = (enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["team", "invites", hotel.id],
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("hotel_invitations")
          .select("*")
          .eq("hotel_id", hotel.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false }),
      ) as Invitation[],
  });
};

export const useInvite = () => {
  const { hotel } = useCurrentHotel();
  return useAction(
    async ({ email, role }: { email: string; role: string }) =>
      unwrap(await supabase.from("hotel_invitations").insert({ hotel_id: hotel.id, email: email.trim().toLowerCase(), role })),
    { invalidate: ["team"], success: (a) => `Invitation saved for ${a.email}` },
  );
};

export const useRevokeInvite = () =>
  useAction(async (id: string) => unwrap(await supabase.from("hotel_invitations").delete().eq("id", id)), {
    invalidate: ["team"],
    success: "Invitation removed",
  });

export const useChangeMemberRole = () =>
  useAction(
    async ({ memberId, role }: { memberId: string; role: string }) =>
      unwrap(await supabase.from("hotel_members").update({ role }).eq("id", memberId)),
    { invalidate: ["team"], success: "Role updated" },
  );

export const useRemoveMember = () =>
  useAction(async (memberId: string) => unwrap(await supabase.from("hotel_members").delete().eq("id", memberId)), {
    invalidate: ["team"],
    success: "Removed from hotel",
  });

export const useUpdateHotel = () => {
  const { hotel, refresh } = useCurrentHotel();
  return useAction(
    async (patch: Record<string, unknown>) => {
      unwrap(await supabase.from("hotels").update(patch).eq("id", hotel.id));
      await refresh();
    },
    { invalidate: [], success: "Hotel details saved" },
  );
};
