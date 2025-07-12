
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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Hotel Management System
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage your hotel operations efficiently
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground hidden sm:block">
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
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </header>
          
          {/* Navigation Tabs */}
          <div className="bg-card/30 border-b">
            <div className="px-6 py-3">
              <div className="flex space-x-1 bg-muted/50 rounded-lg p-1 max-w-fit">
                <Button
                  variant={activeView === "rooms" ? "default" : "ghost"}
                  onClick={() => setActiveView("rooms")}
                  className="px-4 py-2 text-sm font-medium"
                  size="sm"
                >
                  Room Management
                </Button>
                <Button
                  variant={activeView === "guests" ? "default" : "ghost"}
                  onClick={() => setActiveView("guests")}
                  className="px-4 py-2 text-sm font-medium"
                  size="sm"
                >
                  Guest Management
                </Button>
                <Button
                  variant={activeView === "reservations" ? "default" : "ghost"}
                  onClick={() => setActiveView("reservations")}
                  className="px-4 py-2 text-sm font-medium"
                  size="sm"
                >
                  Reservations
                </Button>
                <Button
                  variant={activeView === "billing" ? "default" : "ghost"}
                  onClick={() => setActiveView("billing")}
                  className="px-4 py-2 text-sm font-medium"
                  size="sm"
                >
                  Billing & Payments
                </Button>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="p-6">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
