// HotelEasy provider console: plans, hotel companies and their licences, provider settings.
// Everything goes through provider_* database functions that only platform admins can use.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/format";

const rpc = async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
};

export interface LicensePlan {
  id: string; name: string; description: string | null; price: number; currency: string; billing_period: "month" | "year";
  staff_included: number; modules: string[]; active: boolean; sort: number; hotels: number;
}
export interface ModuleInfo { module: string; label: string; core: boolean }
export type CompanyState = "active" | "expiring" | "expired" | "suspended" | "not_started";
export interface CompanyRow {
  hotel: { id: string; name: string; city: string | null; address: string | null; country: string; phone: string | null; email: string | null;
    currency: string; timezone: string; created_at: string };
  license: { plan_id: string | null; plan_name: string | null; status: "active" | "suspended"; starts_on: string | null; ends_on: string | null;
    staff_limit: number | null; source: "provider" | "self_signup" | "existing"; owner_name: string | null; owner_email: string | null;
    owner_phone: string | null; notes: string | null; price: number | null; currency: string | null; billing_period: string | null };
  state: CompanyState; days_left: number | null; users: number;
  owner: { email: string; joined: boolean } | null; owner_invite: { email: string; sent: string } | null;
  rooms: number; last_activity: string | null;
}
export interface CompanyDetail extends CompanyRow {
  members: { email: string; role: string; since: string }[];
  invites: { email: string; role: string; sent: string }[];
  history: { action: string; details: Record<string, unknown>; at: string; by: string | null }[];
}
export interface Overview {
  companies: number; active: number; expiring: number; expired: number; suspended: number; not_started: number;
  users: number; user_limit: number; monthly_revenue: number; plans: number; renew_soon: CompanyRow[]; recent: CompanyRow[];
}
export interface ProviderSettings {
  allow_self_signup: boolean; trial_days: number; trial_staff_limit: number; trial_plan_id: string | null; warn_days: number;
  support_name: string | null; support_email: string | null; support_phone: string | null;
}

/** Is the signed-in person on the HotelEasy provider team? */
export const useIsProvider = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["provider", "is", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: () => rpc<boolean>("is_platform_admin").catch(() => false),
  });
};

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["provider"] });
};

export const useOverview = () => useQuery({ queryKey: ["provider", "overview"], queryFn: () => rpc<Overview>("provider_overview") });
export const useCompanies = () => useQuery({ queryKey: ["provider", "companies"], queryFn: async () => (await rpc<CompanyRow[] | null>("provider_companies")) ?? [] });
export const useCompany = (id: string | null) =>
  useQuery({ queryKey: ["provider", "company", id], enabled: !!id, queryFn: () => rpc<CompanyDetail>("provider_company", { _hotel_id: id }) });
export const usePlans = () => useQuery({ queryKey: ["provider", "plans"], queryFn: async () => (await rpc<LicensePlan[] | null>("provider_plans")) ?? [] });
export const useModules = () => useQuery({ queryKey: ["provider", "modules"], staleTime: Infinity, queryFn: async () => (await rpc<ModuleInfo[] | null>("provider_modules")) ?? [] });
export const useProviderSettings = () => useQuery({ queryKey: ["provider", "settings"], queryFn: () => rpc<ProviderSettings>("provider_settings_get") });

export interface PlanInput {
  id: string | null; name: string; description: string; price: number; currency: string; billing_period: "month" | "year";
  staff_included: number; modules: string[]; active: boolean;
}
export const useSavePlan = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (p: PlanInput) => rpc<string>("provider_plan_save", {
      _id: p.id, _name: p.name, _description: p.description, _price: p.price, _currency: p.currency, _billing_period: p.billing_period,
      _staff_included: p.staff_included, _modules: p.modules, _active: p.active,
    }),
    onSuccess: (_d, p) => { done(); toast.success(p.id ? "Plan saved" : "Plan created"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const useDeletePlan = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => rpc("provider_plan_delete", { _id: id }),
    onSuccess: () => { done(); toast.success("Plan deleted"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export interface CompanyInput {
  plan_id: string;
  hotel: { name: string; city: string; address: string; country: string; phone: string; email: string; currency: string; timezone: string };
  owner: { name: string; email: string; phone: string };
  license: { starts_on: string; ends_on: string; staff_limit: number; notes: string };
  sample_rooms: boolean;
}
export const useCreateCompany = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (c: CompanyInput) => rpc<string>("provider_create_company", {
      _plan_id: c.plan_id, _hotel: c.hotel, _owner: c.owner, _license: c.license, _sample_rooms: c.sample_rooms,
    }),
    onSuccess: (_d, c) => { done(); toast.success(`${c.hotel.name} registered`); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

export interface LicenseInput {
  hotel_id: string; plan_id: string | null; starts_on: string | null; ends_on: string | null; staff_limit: number | null;
  status: "active" | "suspended"; notes: string; action: string;
}
export const useSaveLicense = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (l: LicenseInput) => rpc<CompanyRow>("provider_license_save", {
      _hotel_id: l.hotel_id, _plan_id: l.plan_id, _starts_on: l.starts_on, _ends_on: l.ends_on, _staff_limit: l.staff_limit,
      _status: l.status, _notes: l.notes, _action: l.action,
    }),
    onSuccess: (_d, l) => { done(); toast.success(l.action === "suspended" ? "Licence suspended" : l.action === "reactivated" ? "Licence reactivated" : "Licence saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const useSaveOwner = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (o: { hotel_id: string; name: string; email: string; phone: string }) =>
      rpc("provider_owner_save", { _hotel_id: o.hotel_id, _name: o.name, _email: o.email, _phone: o.phone }),
    onSuccess: () => { done(); toast.success("Owner saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};
export const useSaveProviderSettings = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (s: ProviderSettings) => rpc<ProviderSettings>("provider_settings_save", {
      _allow_self_signup: s.allow_self_signup, _trial_days: s.trial_days, _trial_staff_limit: s.trial_staff_limit,
      _trial_plan_id: s.trial_plan_id, _warn_days: s.warn_days, _support_name: s.support_name, _support_email: s.support_email,
      _support_phone: s.support_phone,
    }),
    onSuccess: () => { done(); toast.success("Settings saved"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
};

/** Sign-up page: may hotels open an account themselves? (true before the provider_licences update) */
export const useSignupInfo = () =>
  useQuery({
    queryKey: ["signup-info"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("signup_info" as never);
      if (error) return { allow_self_signup: true, trial_days: 0, support: { name: null, email: null, phone: null } };
      return data as unknown as { allow_self_signup: boolean; trial_days: number; support: { name: string | null; email: string | null; phone: string | null } };
    },
  });
