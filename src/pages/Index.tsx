
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import DatabaseRoomManagement from "@/components/DatabaseRoomManagement";
import GuestManagementSystem from "@/components/GuestManagementSystem";
import ReservationManagementSystem from "@/components/ReservationManagementSystem";
import EnhancedBillingSystem from "@/components/EnhancedBillingSystem";
import DashboardOverview from "@/components/DashboardOverview";
import MISReports from "@/components/MISReports";
import AppSidebar from "@/components/AppSidebar";
import { useState } from "react";

const Index = () => {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      case "reports":
        return <MISReports />;
      default:
        return <DashboardOverview />;
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppSidebar 
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        activeTab={activeView}
        setActiveTab={setActiveView}
      />
      
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Hotel Management System
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Welcome, {user?.email}
            </span>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
        
        {/* Navigation Tabs - Hidden on mobile when sidebar is available */}
        <div className="mb-6 hidden md:block">
          <div className="flex space-x-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-lg p-1 w-fit">
            <Button
              variant={activeView === "dashboard" ? "default" : "ghost"}
              onClick={() => setActiveView("dashboard")}
              className="px-4 py-2"
            >
              Dashboard
            </Button>
            <Button
              variant={activeView === "rooms" ? "default" : "ghost"}
              onClick={() => setActiveView("rooms")}
              className="px-4 py-2"
            >
              Room Management
            </Button>
            <Button
              variant={activeView === "guests" ? "default" : "ghost"}
              onClick={() => setActiveView("guests")}
              className="px-4 py-2"
            >
              Guest Management
            </Button>
            <Button
              variant={activeView === "reservations" ? "default" : "ghost"}
              onClick={() => setActiveView("reservations")}
              className="px-4 py-2"
            >
              Reservation Management
            </Button>
            <Button
              variant={activeView === "billing" ? "default" : "ghost"}
              onClick={() => setActiveView("billing")}
              className="px-4 py-2"
            >
              Billing & Payments
            </Button>
            <Button
              variant={activeView === "reports" ? "default" : "ghost"}
              onClick={() => setActiveView("reports")}
              className="px-4 py-2"
            >
              MIS Reports
            </Button>
          </div>
        </div>
        
        {renderActiveView()}
      </main>
    </div>
  );
};

export default Index;
