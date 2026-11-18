// Sign-in for the HotelEasy provider team only (/provider/login). Separate from the hotels' sign-in (/login):
// an account that isn't on the provider team is signed out again with a clear message.
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsProvider } from "@/hooks/useProvider";
import { friendlyError } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-4">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3 text-center text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50"><ShieldCheck className="h-7 w-7" /></div>
        <div><div className="text-xl font-semibold">HotelEasy Provider</div><div className="text-sm text-indigo-200">For the HotelEasy team only</div></div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-xl dark:bg-slate-900">{children}</div>
      <p className="text-center text-xs text-indigo-300">Hotel staff sign in at <a className="underline" href="/login">{window.location.host}/login</a></p>
    </div>
  </div>
);

const ProviderLogin = () => {
  const { session, user, signOut } = useAuth();
  const isProvider = useIsProvider();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  if (session && isProvider.data) return <Navigate to="/provider" replace />;
  if (session && isProvider.isLoading) return <Shell><div className="py-6 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div></Shell>;
  if (session && !isProvider.data) {
    // signed in with a hotel account in this browser
    return (
      <Shell>
        <div className="space-y-4 text-sm">
          <p>You're signed in as <b>{user?.email}</b>, which isn't a provider account.</p>
          <Button className="w-full" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out and use a provider account</Button>
        </div>
      </Shell>
    );
  }

  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    if (error) {
      setBusy(false);
      return toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : friendlyError(error));
    }
    const { data: ok } = await supabase.rpc("is_platform_admin");
    if (!ok) {
      await supabase.auth.signOut();
      setBusy(false);
      return toast.error("This account isn't on the HotelEasy provider team.");
    }
    await qc.invalidateQueries({ queryKey: ["provider"] });
    setBusy(false);
    navigate("/provider", { replace: true });
  };

  const reset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(f.get("email")).trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("If that email is a provider account, a reset link is on its way.");
    setForgot(false);
  };

  return (
    <Shell>
      {!forgot ? (
        <form onSubmit={signIn} className="space-y-4">
          <div className="space-y-1"><Label htmlFor="pv-email">Email</Label><Input id="pv-email" name="email" type="email" autoComplete="username" required /></div>
          <div className="space-y-1"><Label htmlFor="pv-pass">Password</Label><Input id="pv-pass" name="password" type="password" autoComplete="current-password" required /></div>
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in to the provider console</Button>
          <button type="button" className="w-full text-center text-xs text-slate-500 hover:underline" onClick={() => setForgot(true)}>Forgot password?</button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <div className="space-y-1"><Label htmlFor="pv-remail">Email</Label><Input id="pv-remail" name="email" type="email" required /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link</Button>
          <button type="button" className="w-full text-center text-xs text-slate-500 hover:underline" onClick={() => setForgot(false)}>Back to sign in</button>
        </form>
      )}
    </Shell>
  );
};
export default ProviderLogin;
