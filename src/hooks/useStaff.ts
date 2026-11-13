import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/format";
import type { HoursRow, LeaveRequest, Shift, ShiftTemplate, Staff, StaffPay, TimeEntry } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

const useStaffAction = <TArgs, TRes = unknown>(fn: (a: TArgs) => Promise<TRes>, success?: string | ((a: TArgs, r: TRes) => string) | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      ["staff", "activity"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(a, r) : success);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useStaffList = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "list", hotel.id],
    queryFn: async () => unwrap(await supabase.from("staff").select("*").eq("hotel_id", hotel.id).order("department").order("full_name")) as Staff[],
  });
};

export const useStaffPay = (enabled: boolean) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "pay", hotel.id],
    enabled,
    queryFn: async () => unwrap(await supabase.from("staff_pay").select("*").eq("hotel_id", hotel.id)) as StaffPay[],
  });
};

export const useShiftTemplates = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "templates", hotel.id],
    queryFn: async () => unwrap(await supabase.from("shift_templates").select("*").eq("hotel_id", hotel.id).order("sort").order("starts")) as ShiftTemplate[],
  });
};

/** Shifts that start between two instants (ISO). */
export const useShifts = (fromIso: string, toIso: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "shifts", hotel.id, fromIso, toIso],
    queryFn: async () =>
      unwrap(await supabase.from("shifts").select("*").eq("hotel_id", hotel.id).gte("starts_at", fromIso).lt("starts_at", toIso).order("starts_at")) as Shift[],
  });
};

export const useLeave = (fromDate?: string, toDate?: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "leave", hotel.id, fromDate, toDate],
    queryFn: async () => {
      let q = supabase.from("leave_requests").select("*").eq("hotel_id", hotel.id).order("from_date", { ascending: false }).limit(500);
      if (fromDate) q = q.gte("to_date", fromDate);
      if (toDate) q = q.lte("from_date", toDate);
      return unwrap(await q) as LeaveRequest[];
    },
  });
};

export const useTimeEntries = (fromIso: string, toIso: string) => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`te-${hotel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `hotel_id=eq.${hotel.id}` },
        () => qc.invalidateQueries({ queryKey: ["staff", "time"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotel.id, qc]);
  return useQuery({
    queryKey: ["staff", "time", hotel.id, fromIso, toIso],
    queryFn: async () =>
      unwrap(await supabase.from("time_entries").select("*").eq("hotel_id", hotel.id).gte("clock_in", fromIso).lt("clock_in", toIso).order("clock_in", { ascending: false })) as TimeEntry[],
  });
};

export const useOpenEntries = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "time", "open", hotel.id],
    queryFn: async () => unwrap(await supabase.from("time_entries").select("*").eq("hotel_id", hotel.id).is("clock_out", null)) as TimeEntry[],
  });
};

export const useMyStaff = () => {
  const { hotel } = useCurrentHotel();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["staff", "me", hotel.id, user?.id],
    enabled: !!user,
    queryFn: async () => unwrap(await supabase.from("staff").select("*").eq("hotel_id", hotel.id).eq("user_id", user!.id).maybeSingle()) as Staff | null,
  });
};

export const useHoursReport = (from: string, to: string, enabled = true) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["staff", "hours", hotel.id, from, to],
    enabled: enabled && !!from && !!to && from <= to,
    queryFn: async () => unwrap(await supabase.rpc("staff_hours_report", { _hotel_id: hotel.id, _from: from, _to: to })) as HoursRow[],
  });
};

// ---------------------------------------------------------------- writes
export const useSaveShift = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async (a: { id?: string; staffId: string; date: string; starts: string; ends: string; breakMinutes?: number; templateId?: string | null; note?: string }) =>
    unwrap(await supabase.rpc("shift_save", {
      _hotel_id: hotel.id, _staff_id: a.staffId, _date: a.date, _starts: a.starts, _ends: a.ends, _break: a.breakMinutes ?? 0,
      _template_id: a.templateId ?? null, _note: a.note ?? null, _id: a.id ?? null,
    })), null);
};

export const useDeleteShift = () => useStaffAction(async (id: string) => unwrap(await supabase.rpc("shift_delete", { _id: id })), "Shift removed");

export const usePublishRota = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async ({ from, to }: { from: string; to: string }) =>
    unwrap(await supabase.rpc("rota_publish", { _hotel_id: hotel.id, _from: from, _to: to })) as number,
    (_a, n) => (n ? `Rota published: ${n} shift${n === 1 ? "" : "s"} now visible to staff` : "Nothing new to publish"));
};

export const useCopyWeek = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async (from: string) => unwrap(await supabase.rpc("rota_copy_week", { _hotel_id: hotel.id, _from: from })) as { copied: number; skipped: number },
    (_a, r) => `Copied ${r.copied} shift${r.copied === 1 ? "" : "s"} to next week${r.skipped ? ` (${r.skipped} skipped: leave or already busy)` : ""}`);
};

export const useClock = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async (a: { action: "in" | "out"; staffId?: string | null; note?: string }) =>
    unwrap(await supabase.rpc("clock", { _hotel_id: hotel.id, _action: a.action, _staff_id: a.staffId ?? null, _note: a.note ?? null })) as
      { name: string; action: string; late_minutes?: number | null; hours?: number; has_shift?: boolean },
    (_a, r) => r.action === "in"
      ? `${r.name} clocked in${r.late_minutes ? ` (${r.late_minutes >= 60 ? `${Math.floor(r.late_minutes / 60)} h ${r.late_minutes % 60} min` : `${r.late_minutes} min`} late)` : ""}`
      : `${r.name} clocked out after ${Number(r.hours).toFixed(1)} h`);
};

export const useFixTime = () =>
  useStaffAction(async (a: { id: string; clockIn: string; clockOut: string | null; note: string }) =>
    unwrap(await supabase.rpc("time_entry_fix", { _id: a.id, _clock_in: a.clockIn, _clock_out: a.clockOut, _note: a.note })), "Times corrected");

export const useSaveStaff = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async ({ staff, pay }: { staff: Partial<Staff>; pay?: { pay_type: StaffPay["pay_type"]; rate: number } | null }) => {
    const { id, ...rest } = staff;
    const row = (id
      ? unwrap(await supabase.from("staff").update(rest).eq("id", id).select().single())
      : unwrap(await supabase.from("staff").insert({ ...rest, hotel_id: hotel.id }).select().single())) as Staff;
    if (pay === null) unwrap(await supabase.from("staff_pay").delete().eq("staff_id", row.id));
    else if (pay) unwrap(await supabase.from("staff_pay").upsert({ staff_id: row.id, hotel_id: hotel.id, ...pay }));
    return row;
  }, "Staff saved");
};

export const useImportMembers = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async () => unwrap(await supabase.rpc("staff_import_members", { _hotel_id: hotel.id })) as number,
    (_a, n) => (n ? `${n} team member${n === 1 ? "" : "s"} added to the staff list` : "Everyone with a login is already on the list"));
};

export const useSaveTemplate = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async (t: Partial<ShiftTemplate>) => {
    const { id, ...rest } = t;
    return id ? unwrap(await supabase.from("shift_templates").update(rest).eq("id", id))
      : unwrap(await supabase.from("shift_templates").insert({ ...rest, hotel_id: hotel.id }));
  }, "Shift type saved");
};
export const useDeleteTemplate = () =>
  useStaffAction(async (id: string) => unwrap(await supabase.from("shift_templates").delete().eq("id", id)), "Shift type removed");

export const useSaveLeave = () => {
  const { hotel } = useCurrentHotel();
  return useStaffAction(async (l: Partial<LeaveRequest>) => {
    const { id, ...rest } = l;
    return id ? unwrap(await supabase.from("leave_requests").update(rest).eq("id", id))
      : unwrap(await supabase.from("leave_requests").insert({ ...rest, hotel_id: hotel.id }));
  }, (a) => (a.status === "approved" ? "Leave approved" : a.status === "refused" ? "Leave refused" : a.status === "cancelled" ? "Leave cancelled" : "Leave request sent"));
};
