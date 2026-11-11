import { useEffect, useState, type ComponentType } from "react";
import { Building2, Check, ChevronDown, Home, Info, LogOut, Menu, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import AppSidebar, { NAV_SECTIONS, canSee } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentHotel } from "@/contexts/HotelContext";
import { useRealtimeSync } from "@/hooks/useHotelQueries";
import { ROLE_LABELS } from "@/lib/format";

// Live modules
import Dashboard from "@/features/dashboard/Dashboard";
import RoomsPage from "@/features/rooms/RoomsPage";
import GuestsPage from "@/features/guests/GuestsPage";
import ReservationsPage from "@/features/reservations/ReservationsPage";
import SettingsPage from "@/features/settings/SettingsPage";

// Demo modules (still showing sample data)
import EnhancedBillingSystem from "@/components/EnhancedBillingSystem";
import MISReports from "@/components/MISReports";
import GuestMobileCheckin from "@/components/GuestMobileCheckin";
import GuestFeedback from "@/components/GuestFeedback";
import DigitalConcierge from "@/components/DigitalConcierge";
import HousekeepingManagement from "@/components/HousekeepingManagement";
import MaintenanceRequests from "@/components/MaintenanceRequests";
import StaffScheduling from "@/components/StaffScheduling";
import RevenueAnalytics from "@/components/RevenueAnalytics";
import FinancialReporting from "@/components/FinancialReporting";
import BudgetManagement from "@/components/BudgetManagement";
import QuickActionsDashboard from "@/components/QuickActionsDashboard";
import TaskAutomation from "@/components/TaskAutomation";
import InventoryAlerts from "@/components/InventoryAlerts";

const PosComingSoon = () => (
  <Card>
    <CardContent className="py-16 text-center space-y-2">
      <ShoppingCart className="h-10 w-10 mx-auto text-slate-400" />
      <h2 className="text-xl font-semibold">Restaurant POS is being rebuilt</h2>
      <p className="text-slate-600 max-w-md mx-auto">
        It will come back connected to your menu, tables and guest folios so restaurant bills can be charged to a room.
      </p>
    </CardContent>
  </Card>
);

const SCREENS: Record<string, ComponentType<{ onNavigate?: (tab: string) => void }>> = {
  dashboard: Dashboard,
  rooms: RoomsPage,
  guests: GuestsPage,
  reservations: ReservationsPage,
  settings: SettingsPage,
  billing: EnhancedBillingSystem,
  pos: PosComingSoon,
  reports: MISReports,
  housekeeping: HousekeepingManagement,
  maintenance: MaintenanceRequests,
  staff: StaffScheduling,
  "mobile-checkin": GuestMobileCheckin,
  feedback: GuestFeedback,
  concierge: DigitalConcierge,
  "revenue-analytics": RevenueAnalytics,
  "financial-reporting": FinancialReporting,
  "budget-management": BudgetManagement,
  "quick-actions": QuickActionsDashboard,
  "task-automation": TaskAutomation,
  "inventory-alerts": InventoryAlerts,
};

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

const Index = () => {
  const { user, signOut } = useAuth();
  const { hotel, role, memberships, switchHotel } = useCurrentHotel();
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("hoteleasy.tab") || "dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useRealtimeSync();

  const item = ALL_ITEMS.find((i) => i.key === activeTab);
  const allowed = item && canSee(item, role);
  useEffect(() => {
    if (!allowed) setActiveTab("dashboard");
    sessionStorage.setItem("hoteleasy.tab", activeTab);
  }, [activeTab, allowed]);

  const Screen = SCREENS[allowed ? activeTab : "dashboard"];
  const name = (user?.user_metadata?.full_name as string) || user?.email || "";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 h-[73px]">
        <div className="flex items-center justify-between px-4 md:px-6 h-full">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
              <Home className="h-6 w-6" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-left min-w-0 rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <div className="text-xs text-slate-500">HotelEasy</div>
                  <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100 truncate">
                    {hotel.name}
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Your hotels</DropdownMenuLabel>
                {memberships.map((m) => (
                  <DropdownMenuItem key={m.hotel_id} onClick={() => switchHotel(m.hotel_id)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{m.hotels.name}</span>
                    {m.hotel_id === hotel.id && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full">
                  <Avatar>
                    <AvatarFallback>{initials || "?"}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate">{name}</div>
                  <div className="text-xs font-normal text-slate-500">{role ? ROLE_LABELS[role] : ""}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          role={role}
        />
        <main className="flex-1 min-w-0 p-4 md:p-6 space-y-4">
          {item?.preview && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>Demo screen.</strong> {item.label} still shows sample data and doesn't save anything yet. It's
                next on the build list.
              </span>
            </div>
          )}
          <Screen onNavigate={setActiveTab} />
        </main>
      </div>
    </div>
  );
};

export default Index;
