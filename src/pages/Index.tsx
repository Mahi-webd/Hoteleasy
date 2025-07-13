
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
              Olsupat Lodge Management System
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
        
        {renderActiveView()}
      </main>
    </div>
  );
};

export default Index;
