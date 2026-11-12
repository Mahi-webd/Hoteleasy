import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { friendlyError } from "@/lib/format";
import type { Budget, Expense, ExpenseCategory, PnlReport } from "@/lib/db-types";

const unwrap = <T,>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

const useFinAction = <TArgs, TRes = unknown>(fn: (a: TArgs) => Promise<TRes>, success?: string | ((a: TArgs, r: TRes) => string) | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      ["fin", "activity"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (success) toast.success(typeof success === "function" ? success(a, r) : success);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useExpenseCategories = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["fin", "cats", hotel.id],
    queryFn: async () => unwrap(await supabase.from("expense_categories").select("*").eq("hotel_id", hotel.id).order("sort").order("name")) as ExpenseCategory[],
  });
};

export const useExpenses = (from: string, to: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["fin", "expenses", hotel.id, from, to],
    queryFn: async () =>
      unwrap(await supabase.from("expenses").select("*").eq("hotel_id", hotel.id).gte("spent_on", from).lte("spent_on", to)
        .order("spent_on", { ascending: false }).order("number", { ascending: false }).limit(2000)) as Expense[],
  });
};

export const useUnpaidBills = () => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["fin", "unpaid", hotel.id],
    queryFn: async () =>
      unwrap(await supabase.from("expenses").select("*").eq("hotel_id", hotel.id).eq("status", "unpaid")
        .order("due_on", { ascending: true, nullsFirst: false }).limit(1000)) as Expense[],
  });
};

export const useBudgets = (year: number) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["fin", "budgets", hotel.id, year],
    queryFn: async () =>
      unwrap(await supabase.from("budgets").select("*").eq("hotel_id", hotel.id).gte("month", `${year}-01-01`).lte("month", `${year}-12-01`)) as Budget[],
  });
};

export const usePnl = (from: string, to: string) => {
  const { hotel } = useCurrentHotel();
  return useQuery({
    queryKey: ["fin", "pnl", hotel.id, from, to],
    enabled: !!from && !!to && from <= to,
    queryFn: async () => unwrap(await supabase.rpc("pnl_report", { _hotel_id: hotel.id, _from: from, _to: to })) as PnlReport,
  });
};

export type ExpenseInput = Partial<Omit<Expense, "net_amount" | "number" | "created_at">>;
export const useSaveExpense = () => {
  const { hotel } = useCurrentHotel();
  return useFinAction(async (e: ExpenseInput) => {
    const { id, ...rest } = e;
    return id
      ? unwrap(await supabase.from("expenses").update(rest).eq("id", id).select().single())
      : unwrap(await supabase.from("expenses").insert({ ...rest, hotel_id: hotel.id }).select().single());
  }, (a) => (a.id ? "Expense saved" : "Expense added"));
};

export const usePayExpense = () =>
  useFinAction(async ({ id, paid_on, paid_method, paid_reference }: { id: string; paid_on: string; paid_method: string; paid_reference?: string }) =>
    unwrap(await supabase.from("expenses").update({ status: "paid", paid_on, paid_method, paid_reference: paid_reference || null }).eq("id", id)), "Marked as paid");

export const useVoidExpense = () =>
  useFinAction(async ({ id, reason }: { id: string; reason: string }) =>
    unwrap(await supabase.from("expenses").update({ status: "void", void_reason: reason }).eq("id", id)), "Expense voided");

export const useReopenExpense = () =>
  useFinAction(async (id: string) => unwrap(await supabase.from("expenses").update({ status: "unpaid" }).eq("id", id)), "Marked as unpaid");

export const useCopyRecurring = () => {
  const { hotel } = useCurrentHotel();
  return useFinAction(async (month: string) => unwrap(await supabase.rpc("expense_copy_recurring", { _hotel_id: hotel.id, _month: month })) as number,
    (_a, n) => (n ? `${n} repeating expense${n === 1 ? "" : "s"} added as unpaid bills` : "Nothing to copy: they are already there, or none repeat"));
};

export const useBillFromReceipt = () =>
  useFinAction(async ({ batch, dueOn }: { batch: string; dueOn?: string | null }) =>
    unwrap(await supabase.rpc("expense_from_receipt", { _batch: batch, _due_on: dueOn || null })), "Supplier bill added to Bills to pay");

export const useSaveBudget = () => {
  const { hotel } = useCurrentHotel();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { id?: string; month: string; category_id?: string | null; revenue_grp?: string | null; amount: number | null }) => {
      if (b.amount == null) return b.id ? unwrap(await supabase.from("budgets").delete().eq("id", b.id)) : null;
      return b.id
        ? unwrap(await supabase.from("budgets").update({ amount: b.amount }).eq("id", b.id))
        : unwrap(await supabase.from("budgets").insert({ hotel_id: hotel.id, month: b.month, category_id: b.category_id ?? null, revenue_grp: b.revenue_grp ?? null, amount: b.amount }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fin"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export const useSaveCategory = () => {
  const { hotel } = useCurrentHotel();
  return useFinAction(async (c: Partial<ExpenseCategory>) => {
    const { id, ...rest } = c;
    return id
      ? unwrap(await supabase.from("expense_categories").update(rest).eq("id", id))
      : unwrap(await supabase.from("expense_categories").insert({ ...rest, hotel_id: hotel.id }));
  }, "Category saved");
};
