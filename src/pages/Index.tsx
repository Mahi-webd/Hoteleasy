
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
      case "dashboard":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
            <p className="text-muted-foreground">Dashboard overview coming soon...</p>
          </div>
        );
      case "rooms":
        return <DatabaseRoomManagement />;
      case "guests":
        return <GuestManagementSystem />;
      case "reservations":
        return <ReservationManagementSystem />;
      case "billing":
        return <EnhancedBillingSystem />;
      case "reports":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Reports</h2>
            <p className="text-muted-foreground">Reports and analytics coming soon...</p>
          </div>
        );
      case "housekeeping":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Housekeeping</h2>
            <p className="text-muted-foreground">Housekeeping management coming soon...</p>
          </div>
        );
      case "maintenance":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Maintenance</h2>
            <p className="text-muted-foreground">Maintenance requests coming soon...</p>
          </div>
        );
      case "scheduling":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Staff Scheduling</h2>
            <p className="text-muted-foreground">Staff scheduling system coming soon...</p>
          </div>
        );
      case "mobile-checkin":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Mobile Check-in</h2>
            <p className="text-muted-foreground">Mobile check-in system coming soon...</p>
          </div>
        );
      case "feedback":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Guest Feedback</h2>
            <p className="text-muted-foreground">Guest feedback system coming soon...</p>
          </div>
        );
      case "concierge":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Digital Concierge</h2>
            <p className="text-muted-foreground">Digital concierge service coming soon...</p>
          </div>
        );
      case "quick-actions":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
            <p className="text-muted-foreground">Quick actions dashboard coming soon...</p>
          </div>
        );
      case "automation":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Automation</h2>
            <p className="text-muted-foreground">Task automation system coming soon...</p>
          </div>
        );
      case "inventory":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Inventory</h2>
            <p className="text-muted-foreground">Inventory management coming soon...</p>
          </div>
        );
      case "analytics":
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Analytics</h2>
            <p className="text-muted-foreground">Advanced analytics coming soon...</p>
          </div>
        );
      default:
        return <DatabaseRoomManagement />;
    }
  };

  const getViewTitle = () => {
    switch (activeView) {
      case "dashboard": return "Dashboard Overview";
      case "rooms": return "Room Management";
      case "guests": return "Guest Management";
      case "reservations": return "Reservations";
      case "billing": return "Billing & Payments";
      case "reports": return "Reports & Analytics";
      case "housekeeping": return "Housekeeping Operations";
      case "maintenance": return "Maintenance Requests";
      case "scheduling": return "Staff Scheduling";
      case "mobile-checkin": return "Mobile Check-in";
      case "feedback": return "Guest Feedback";
      case "concierge": return "Digital Concierge";
      case "quick-actions": return "Quick Actions";
      case "automation": return "Task Automation";
      case "inventory": return "Inventory Management";
      case "analytics": return "Advanced Analytics";
      default: return "Hotel Management System";
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeView={activeView} setActiveView={setActiveView} />
        <main className="flex-1">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {getViewTitle()}
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
