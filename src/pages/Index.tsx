
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
import { useState } from "react";

const Index = () => {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState("rooms");

  const renderActiveView = () => {
    switch (activeView) {
      case "rooms":
        return <DatabaseRoomManagement />;
      case "guests":
        return <GuestManagementSystem />;
      case "reservations":
        return <ReservationManagementSystem />;
      case "billing":
        return <EnhancedBillingSystem />;
      default:
        return <DatabaseRoomManagement />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <SidebarTrigger />
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
          
          {/* Navigation Tabs */}
          <div className="mb-6">
            <div className="flex space-x-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-lg p-1 w-fit">
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
            </div>
          </div>
          
          {renderActiveView()}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
