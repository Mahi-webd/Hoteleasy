import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { BillTo, FolioTransfer, Balance, ChargeKind, FolioCharge, Invoice, Payment, PaymentMethod, Reservation } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

const BILLING_KEYS = ["folio", "balances", "payments", "invoices", "reservations", "rooms", "dashboard", "activity"];

const useBillingAction = <TArgs,>(fn: (a: TArgs) => Promise<unknown>, success?: string | ((a: TArgs) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => {
      BILLING_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(a) : success);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

// ------------------------------------------------------------------ folio
export const useFolio = (reservationId?: string) =>
  useQuery({
    queryKey: ["folio", reservationId],
    enabled: !!reservationId,
    queryFn: async () => {
      const [charges, payments, invoices, transfers, res] = await Promise.all([
        supabase.from("folio_charges").select("*").eq("reservation_id", reservationId!).order("stay_date", { nullsFirst: false }).order("posted_at"),
        supabase.from("payments").select("*").eq("reservation_id", reservationId!).order("received_at"),
        supabase.from("invoices").select("id, number, issued_at, total, superseded_at").eq("reservation_id", reservationId!).order("issued_at", { ascending: false }),
        supabase.from("folio_transfers").select("*, companies(name)").eq("reservation_id", reservationId!).order("created_at"),
        supabase.from("reservations").select("company_id, bill_to, company_ref, companies(name)").eq("id", reservationId!).maybeSingle(),
      ]);
      const t = unwrap(transfers) as FolioTransfer[];
      const transferredTotal = t.filter((x) => !x.voided_at).reduce((s, x) => s + Number(x.amount), 0);
      const c = unwrap(charges) as FolioCharge[];
      const p = unwrap(payments) as Payment[];
      const live = (x: { voided_at: string | null }) => !x.voided_at;
      const chargesTotal = c.filter(live).reduce((s, x) => s + Number(x.amount), 0);
      const paymentsTotal = p.filter(live).reduce((s, x) => s + Number(x.amount), 0);
      return {
        charges: c,
        payments: p,
        invoices: unwrap(invoices) as Pick<Invoice, "id" | "number" | "issued_at" | "total" | "superseded_at">[],
        chargesTotal,
        paymentsTotal,
        transfers: t,
        transferredTotal,
        billing: unwrap(res) as unknown as { company_id: string | null; bill_to: BillTo; company_ref: string | null; companies: { name: string } | null } | null,
        balance: Math.round((chargesTotal - paymentsTotal - transferredTotal) * 100) / 100,
      };
    },
  });

/** Balances for a set of reservations (for list screens). */
export const useBalances = (ids: string[]) =>
  useQuery({
    queryKey: ["balances", [...ids].sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out = new Map<string, Balance>();
      // keep URLs short
      for (let i = 0; i < ids.length; i += 150) {
        const rows = unwrap(await supabase.from("reservation_balances").select("*").in("reservation_id", ids.slice(i, i + 150))) as Balance[];
        rows.forEach((r) => out.set(r.reservation_id, r));
      }
      return out;
    },
  });

export const useAddCharge = () => {
  const { hotel } = useCurrentHotel();
  return useBillingAction(
    async (c: { reservation_id: string; kind: ChargeKind; description: string; quantity: number; unit_price: number }) =>
      unwrap(await supabase.from("folio_charges").insert({ ...c, hotel_id: hotel.id, description: c.description.trim() })),
    "Charge added",
  );
};

export const useAddPayment = () => {
  const { hotel } = useCurrentHotel();
  return useBillingAction(
    async (p: { reservation_id: string; method: PaymentMethod; amount: number; reference?: string | null; payer_phone?: string | null; notes?: string | null }) =>
      unwrap(
        await supabase.from("payments").insert({
          ...p,
          hotel_id: hotel.id,
          reference: p.reference?.trim() ? (p.method === "mpesa" ? p.reference.trim().toUpperCase() : p.reference.trim()) : null,
          payer_phone: p.payer_phone?.trim() || null,
          notes: p.notes?.trim() || null,
        }),
      ),
    (a) => (a.amount < 0 ? "Refund recorded" : "Payment recorded"),
  );
};

export const useVoidCharge = () =>
  useBillingAction(
    async ({ id, reason }: { id: string; reason: string }) => unwrap(await supabase.rpc("void_charge", { _charge_id: id, _reason: reason })),
    "Charge voided",
  );

export const useVoidPayment = () =>
  useBillingAction(
    async ({ id, reason }: { id: string; reason: string }) => unwrap(await supabase.rpc("void_payment", { _payment_id: id, _reason: reason })),
    "Payment voided",
  );

export const useIssueInvoice = () =>
  useBillingAction(
    async (reservationId: string) => unwrap(await supabase.rpc("issue_invoice", { _reservation_id: reservationId })) as Invoice,
    "Invoice issued",
  );

export const useCheckOutSettled = () =>
  useBillingAction(
    async ({ id, allowBalance }: { id: string; allowBalance?: boolean }) =>
      unwrap(await supabase.rpc("check_out_reservation", { _reservation_id: id, _allow_balance: !!allowBalance })),
    (a) => (a.allowBalance ? "Checked out — balance left on account" : "Guest checked out and invoice issued"),
  );

// ------------------------------------------------------------------ lists
const RES_MINI = "id, code, status, check_in, check_out, guests(first_name, last_name, phone, is_vip), rooms(room_number)";

export type ReservationMini = Pick<Reservation, "id" | "code" | "status" | "check_in" | "check_out" | "guests" | "rooms">;

/** In-house folios plus any closed stay that still has money owing or a credit. */
export const useOpenAccounts = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["balances", "open", hotel.id],
    queryFn: async () => {
      const bal = unwrap(
        await supabase.from("reservation_balances").select("*").eq("hotel_id", hotel.id).or("balance.gt.0.009,balance.lt.-0.009"),
      ) as Balance[];
      const inHouse = unwrap(
        await supabase.from("reservations").select(RES_MINI).eq("hotel_id", hotel.id).eq("status", "checked_in"),
      ) as unknown as ReservationMini[];
      const ids = new Set([...bal.map((b) => b.reservation_id), ...inHouse.map((r) => r.id)]);
      const missing = [...ids].filter((id) => !inHouse.some((r) => r.id === id));
      const others = missing.length
        ? (unwrap(await supabase.from("reservations").select(RES_MINI).in("id", missing)) as unknown as ReservationMini[])
        : [];
      const allBal = unwrap(
        await supabase.from("reservation_balances").select("*").in("reservation_id", [...ids].length ? [...ids] : ["00000000-0000-0000-0000-000000000000"]),
      ) as Balance[];
      const balMap = new Map(allBal.map((b) => [b.reservation_id, b]));
      return [...inHouse, ...others].map((r) => ({
        reservation: r,
        balance: balMap.get(r.id) ?? { reservation_id: r.id, charges_total: 0, payments_total: 0, balance: 0 },
      }));
    },
  });
};

export const usePaymentsBetween = (fromIso: string, toIso: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["payments", hotel.id, fromIso, toIso],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("payments")
          .select("*, reservations(id, code, guests(first_name, last_name), rooms(room_number))")
          .eq("hotel_id", hotel.id)
          .gte("received_at", fromIso)
          .lt("received_at", toIso)
          .order("received_at", { ascending: false }),
      ) as Payment[],
  });
};

export const useInvoices = (search: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["invoices", hotel.id, search],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("id, number, issued_at, total, superseded_at, reservation_id, guest, stay")
        .eq("hotel_id", hotel.id);
      const s = search.trim().replace(/[%,()]/g, " ");
      if (s) q = q.or(`number.ilike.%${s}%,guest->>name.ilike.%${s}%,stay->>code.ilike.%${s}%`);
      return unwrap(await q.order("issued_at", { ascending: false }).limit(200)) as Pick<
        Invoice, "id" | "number" | "issued_at" | "total" | "superseded_at" | "reservation_id" | "guest" | "stay"
      >[];
    },
  });
};

export const useInvoice = (id?: string) =>
  useQuery({
    queryKey: ["invoices", "one", id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from("invoices").select("*").eq("id", id!).single()) as Invoice,
  });

/** Payments received per invoice's reservation (for "paid / balance" on the invoice). */
export const useReservationPaid = (reservationId?: string) =>
  useQuery({
    queryKey: ["balances", "one", reservationId],
    enabled: !!reservationId,
    queryFn: async () =>
      unwrap(await supabase.from("reservation_balances").select("*").eq("reservation_id", reservationId!).maybeSingle()) as Balance | null,
  });
