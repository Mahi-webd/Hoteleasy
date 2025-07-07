
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import DatabaseRoomManagement from "@/components/DatabaseRoomManagement";
import GuestManagementSystem from "@/components/GuestManagementSystem";
import ReservationManagementSystem from "@/components/ReservationManagementSystem";
import EnhancedBillingSystem from "@/components/EnhancedBillingSystem";
import DashboardOverview from "@/components/DashboardOverview";
import RevenueAnalytics from "@/components/RevenueAnalytics";
import RoomManagement from "@/components/RoomManagement";
import TaskAutomation from "@/components/TaskAutomation";
import StaffScheduling from "@/components/StaffScheduling";
import { useState } from "react";

const Index = () => {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardOverview />;
      case "rooms":
        return <DatabaseRoomManagement />;
      case "guests":
        return <GuestManagementSystem />;
      case "reservations":
        return <ReservationManagementSystem />;
      case "billing":
        return <EnhancedBillingSystem />;
      case "revenue-analytics":
        return <RevenueAnalytics />;
      case "room-management-alt":
        return <RoomManagement />;
      case "task-automation":
        return <TaskAutomation />;
      case "staff-scheduling":
        return <StaffScheduling />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppSidebar activeView={activeView} setActiveView={setActiveView} />
        <main className="flex-1 p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <SidebarTrigger />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                Hotel Management System
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px] sm:max-w-none">
                Welcome, {user?.email}
              </span>
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-1 sm:gap-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-lg p-1 w-full overflow-x-auto">
              <Button
                variant={activeView === "dashboard" ? "default" : "ghost"}
                onClick={() => setActiveView("dashboard")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Dashboard
              </Button>
              <Button
                variant={activeView === "rooms" ? "default" : "ghost"}
                onClick={() => setActiveView("rooms")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Room Management
              </Button>
              <Button
                variant={activeView === "guests" ? "default" : "ghost"}
                onClick={() => setActiveView("guests")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Guest Management
              </Button>
              <Button
                variant={activeView === "reservations" ? "default" : "ghost"}
                onClick={() => setActiveView("reservations")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Reservations
              </Button>
              <Button
                variant={activeView === "billing" ? "default" : "ghost"}
                onClick={() => setActiveView("billing")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Billing & Payments
              </Button>
              <Button
                variant={activeView === "revenue-analytics" ? "default" : "ghost"}
                onClick={() => setActiveView("revenue-analytics")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Revenue Analytics
              </Button>
              <Button
                variant={activeView === "room-management-alt" ? "default" : "ghost"}
                onClick={() => setActiveView("room-management-alt")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Enhanced Rooms
              </Button>
              <Button
                variant={activeView === "task-automation" ? "default" : "ghost"}
                onClick={() => setActiveView("task-automation")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Task Automation
              </Button>
              <Button
                variant={activeView === "staff-scheduling" ? "default" : "ghost"}
                onClick={() => setActiveView("staff-scheduling")}
                className="px-2 sm:px-4 py-2 text-xs sm:text-sm flex-shrink-0"
              >
                Staff Scheduling
              </Button>
            </div>
          </div>
          
          {renderActiveView()}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
