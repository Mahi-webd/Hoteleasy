import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
  const { memberships, loading: hotelsLoading } = useHotel();
  if (loading || hotelsLoading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (memberships.length === 0) return <Onboarding />;
  return <>{children ?? <Index />}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="hotel-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner richColors position="top-right" />
        {!isSupabaseConfigured ? (
          <NotConfigured />
        ) : (
          <AuthProvider>
            <HotelProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<AuthPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/book/:slug" element={<BookingPage />} />
                  <Route path="/feedback/:token" element={<FeedbackPage />} />
                  <Route path="/checkin/:token" element={<PrecheckPage />} />
                  <Route path="/" element={<Protected />} />
                  <Route path="/invoice/:id" element={<Protected><InvoicePrintPage /></Protected>} />
                  <Route path="/folio/:id" element={<Protected><FolioPrintPage /></Protected>} />
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
