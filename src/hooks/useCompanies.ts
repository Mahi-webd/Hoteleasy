import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { Company, CompanyAccount, PaymentMethod, Statement } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};
const KEYS = ["companies", "folio", "balances", "reservations", "billing", "activity", "reports"];
const useAct = <A,>(fn: (a: A) => Promise<unknown>, success?: string | ((a: A) => string)) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, a) => { KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); if (success) toast.success(typeof success === "function" ? success(a) : success); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useCompanyAccounts = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["companies", "accounts", hotel.id],
    queryFn: async () => unwrap(await supabase.rpc("company_accounts", { _hotel_id: hotel.id })) as CompanyAccount[],
  });
};
export const useCompanyStatement = (companyId: string | null, from: string, to: string) =>
  useQuery({
    queryKey: ["companies", "statement", companyId, from, to],
    enabled: !!companyId && to >= from,
    queryFn: async () => unwrap(await supabase.rpc("company_statement", { _company_id: companyId!, _from: from, _to: to })) as Statement,
  });

export const useSaveCompany = () => {
  const { hotel } = useCurrentHotel();
  return useAct(async ({ company, rates }: { company: Partial<Company>; rates: Record<string, number> }) => {
    const { id, created_at: _c, hotel_id: _h, ...rest } = company;
    void _c; void _h;
    const row = (id
      ? unwrap(await supabase.from("companies").update(rest).eq("id", id).select().single())
      : unwrap(await supabase.from("companies").insert({ ...rest, hotel_id: hotel.id }).select().single())) as Company;
    unwrap(await supabase.from("company_rates").delete().eq("company_id", row.id));
    const list = Object.entries(rates).map(([room_type_id, rate]) => ({ company_id: row.id, room_type_id, rate, hotel_id: hotel.id }));
    if (list.length) unwrap(await supabase.from("company_rates").insert(list));
    return row;
  }, "Company saved");
};
export const useCompanyEntry = () =>
  useAct(async (a: { companyId: string; kind: "payment" | "credit" | "charge"; amount: number; date?: string; method?: PaymentMethod | null; reference?: string; description?: string }) =>
    unwrap(await supabase.rpc("company_entry", {
      _company_id: a.companyId, _kind: a.kind, _amount: a.amount, _entry_date: a.date || null, _method: a.method ?? null,
      _reference: a.reference || null, _description: a.description || null,
    })), (a) => (a.kind === "payment" ? "Payment recorded" : a.kind === "credit" ? "Credit note recorded" : "Charge added"));
export const useVoidCompanyEntry = () =>
  useAct(async ({ id, reason }: { id: string; reason: string }) => unwrap(await supabase.rpc("company_entry_void", { _id: id, _reason: reason })), "Entry undone");
export const useCompanyTransfer = () =>
  useAct(async (a: { reservationId: string; companyId: string; amount: number }) =>
    unwrap(await supabase.rpc("company_transfer", { _reservation_id: a.reservationId, _company_id: a.companyId, _amount: a.amount })),
    "Moved to the company account");
