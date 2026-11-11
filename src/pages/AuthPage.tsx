import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/format";

const AuthShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-center justify-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <Home className="h-7 w-7" />
        </div>
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">HotelEasy</span>
      </div>
      {children}
    </div>
  </div>
);

export const AuthPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");

  if (session) return <Navigate to="/" replace />;

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : friendlyError(error));
    navigate("/");
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return toast.error("Use at least 8 characters for the password.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(f.get("email")).trim(),
      password,
      options: {
        data: { full_name: String(f.get("full_name")).trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    if (!data.session) {
      toast.success("Check your email to confirm your account, then sign in.");
      setMode("signin");
    }
  };

  const handleForgot = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(String(f.get("email")).trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("If that email has an account, a reset link is on its way.");
    setMode("signin");
  };

  return (
    <AuthShell>
      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {mode === "forgot" ? (
          <>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>We'll email you a link to choose a new password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input id="fp-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link
                </Button>
                <Button type="button" variant="link" className="w-full" onClick={() => setMode("signin")}>
                  Back to sign in
                </Button>
              </form>
            </CardContent>
          </>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <CardHeader>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Password</Label>
                    <Input id="si-password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
                  </Button>
                  <Button type="button" variant="link" className="w-full" onClick={() => setMode("forgot")}>
                    Forgot password?
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" name="full_name" required autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Staff invited by a hotel should sign up with the email address the invitation was sent to.
                  </p>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        )}
      </Card>
    </AuthShell>
  );
};

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Password updated.");
    navigate("/");
  };

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="New password" />
            <Button type="submit" className="w-full" disabled={busy}>Save password</Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
};

export { AuthShell };
