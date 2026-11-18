import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { hostSite } from "@/lib/siteHost";
import { useIsProvider } from "@/hooks/useProvider";
import { LicenceBlocked } from "@/features/provider/LicenceScreens";
import ProviderConsole from "@/features/provider/ProviderConsole";
import ProviderLogin from "@/features/provider/ProviderLogin";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HotelProvider, useHotel } from "@/contexts/HotelContext";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import { AuthPage, ResetPasswordPage } from "./pages/AuthPage";
import { FolioPrintPage, InvoicePrintPage } from "./features/billing/PrintPages";
import { PosBillPage, PosTicketPage } from "./features/pos/PosPrint";
import { PayslipPage } from "./features/staff/PayslipPrint";
import PrecheckPage from "./features/public/PrecheckPage";
import RegCardPage from "./features/online/RegCardPage";
import StatementPage from "./features/companies/StatementPage";
import { GuestStayPage, RoomQrPage } from "./features/public/GuestStayPage";
import RoomQrSheet from "./features/requests/RoomQrSheet";
import DayReportPage from "./features/audit/DayReportPage";
import BookingPage from "./features/public/BookingPage";
import FeedbackPage from "./features/public/FeedbackPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

const NotConfigured = () => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="max-w-lg space-y-3 text-slate-700">
      <h1 className="text-xl font-bold">HotelEasy isn't connected to a database yet</h1>
      <p>
        Copy <code>.env.example</code> to <code>.env</code> and fill in <code>VITE_SUPABASE_URL</code> and{" "}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from your Supabase project (Project Settings → API), then restart
        the app. See README.md for the full setup.
      </p>
    </div>
  </div>
);

/** Signed in + belongs to a hotel → the app. Otherwise login or onboarding. */
const Protected = ({ children }: { children?: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const { memberships, loading: hotelsLoading, licenseBlocked } = useHotel();
  const isProvider = useIsProvider();
  if (loading || hotelsLoading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (memberships.length === 0) {
    if (isProvider.isLoading) return <FullPageSpinner />;
    // the HotelEasy provider team goes to its console; everyone else sets up (or waits for) a hotel
    return isProvider.data ? <Navigate to="/provider" replace /> : <Onboarding />;
  }
  // licence ended, suspended or not started: a clear stop screen (the database refuses the data anyway)
  if (licenseBlocked) return <LicenceBlocked />;
  return <>{children ?? <Index />}</>;
};

/** A hotel's own domain → its page address (null when the domain isn't any hotel's). */
const HostLookupHome = ({ host }: { host: string }) => {
  const q = useQuery({
    queryKey: ["public", "host", host],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_site_for_host" as never, { _host: host } as never);
      if (error) throw error;
      return (data as unknown as string | null) ?? null;
    },
    staleTime: 10 * 60_000, retry: 2,
  });
  if (q.isLoading) return <FullPageSpinner />;
  if (q.data) return <BookingPage slug={q.data} />;
  return <Navigate to="/login" replace />;
};

/**
 * Home ("/"): signed-in staff get the app. Visitors get the hotel website for this web address
 * (see src/lib/siteHost.ts): VITE_HOME_HOTEL, a hotel subdomain, or a hotel's own domain.
 * On the app's own address visitors get the sign-in page (in development: the sample hotel).
 */
const Home = () => {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (session) return <Protected />;
  const site = hostSite();
  if (site.kind === "slug") return <BookingPage slug={site.slug} />;
  if (site.kind === "lookup") return <HostLookupHome host={site.host} />;
  if (import.meta.env.DEV) return <BookingPage slug="demo" />;
  return <Navigate to="/login" replace />;
};

/** Guest pages: a crash shows a calm "try again" page, not a blank screen. */
const Guest = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary guest resetKey={pathname}>{children}</ErrorBoundary>;
};
const Staff = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="hotel-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner richColors position="top-right" offset={84} />
        {!isSupabaseConfigured ? (
          <NotConfigured />
        ) : (
          <AuthProvider>
            <HotelProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<AuthPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/book/:slug" element={<Guest><BookingPage /></Guest>} />
                  <Route path="/feedback/:token" element={<Guest><FeedbackPage /></Guest>} />
                  <Route path="/checkin/:token" element={<Guest><PrecheckPage /></Guest>} />
                  <Route path="/r/:token" element={<Guest><RoomQrPage /></Guest>} />
                  <Route path="/stay/:key" element={<Guest><GuestStayPage /></Guest>} />
                  <Route path="/" element={<Staff><Home /></Staff>} />
                  <Route path="/provider" element={<Staff><ProviderConsole /></Staff>} />
                  <Route path="/provider/login" element={<Staff><ProviderLogin /></Staff>} />
                  <Route path="/invoice/:id" element={<Protected><InvoicePrintPage /></Protected>} />
                  <Route path="/folio/:id" element={<Protected><FolioPrintPage /></Protected>} />
                  <Route path="/day-report/:day" element={<Protected><DayReportPage /></Protected>} />
                  <Route path="/room-qr" element={<Protected><RoomQrSheet /></Protected>} />
                  <Route path="/statement/:id" element={<Protected><StatementPage /></Protected>} />
                  <Route path="/reg-card/:id" element={<Protected><RegCardPage /></Protected>} />
                  <Route path="/payslips/:runId" element={<Protected><PayslipPage /></Protected>} />
                  <Route path="/pos-bill/:id" element={<Protected><PosBillPage /></Protected>} />
                  <Route path="/pos-ticket/:id" element={<Protected><PosTicketPage /></Protected>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </HotelProvider>
          </AuthProvider>
        )}
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
