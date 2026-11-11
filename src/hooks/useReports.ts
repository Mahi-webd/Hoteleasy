import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";

export interface Kpis {
  from: string; to: string; days: number; rooms: number;
  room_nights_available: number; room_nights_sold: number; occupancy: number;
  room_revenue: number; adr: number; revpar: number; trevpar: number;
  fnb_revenue: number; other_revenue: number; total_revenue: number;
  vat: number; levy: number; gross: number; collected: number;
}
export interface DailyRow {
  date: string; rooms_sold: number; occupancy: number;
  room_revenue: number; fnb_revenue: number; other_revenue: number;
  vat: number; levy: number; collected: number;
}
export interface DeptRow { grp: "rooms" | "fnb" | "other"; dept: string; net: number; vat: number; levy: number; gross: number; lines: number }
export interface OutletRow {
  outlet: string; kind: string; bills: number; covers: number; net: number; service_charge: number;
  vat: number; levy: number; total: number; discounts: number; room_charged: number; avg_bill: number;
}
export interface PaymentRow { source: "front_desk" | "pos"; method: string; count: number; amount: number }
export interface SourceRow { source: string; stays: number; nights: number; revenue: number; adr: number }
export interface RoomTypeRow { room_type: string; rooms: number; nights: number; occupancy: number; revenue: number; adr: number }
export interface NationalityRow { nationality: string; guests: number; nights: number }
export interface StayStats {
  arrivals: number; avg_length_of_stay: number; avg_lead_days: number; avg_guests: number;
  new_bookings: number; cancellations: number; no_shows: number;
}
export interface DebtorRow {
  reservation_id: string; code: string; status: string; guest: string; phone: string | null; room: string | null;
  check_in: string; check_out: string; charges: number; paid: number; balance: number;
}
export interface StaffRow { name: string; bills: number; sales: number; voids: number; comps: number }

export interface PeriodReport {
  kpis: Kpis; previous: Kpis; daily: DailyRow[]; departments: DeptRow[]; outlets: OutletRow[];
  payments: PaymentRow[]; sources: SourceRow[]; room_types: RoomTypeRow[]; nationalities: NationalityRow[];
  stays: StayStats; debtors: DebtorRow[]; staff: StaffRow[];
}

/** Numbers arrive as JSON numbers already; this keeps any numeric strings safe too. */
const num = (o: unknown): unknown => {
  if (Array.isArray(o)) return o.map(num);
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, num(v)]));
  return o;
};

export const useReport = (from: string, to: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["reports", hotel.id, from, to],
    enabled: !!from && !!to && from <= to,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_period", { _hotel_id: hotel.id, _from: from, _to: to });
      if (error) throw error;
      return num(data) as PeriodReport;
    },
  });
};
