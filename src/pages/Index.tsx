import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard, ShoppingCart, BarChart3, Smartphone, MessageCircle, Star, Wrench, UserCheck, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardOverview from "@/components/DashboardOverview";
import EnhancedRoomManagement from "@/components/EnhancedRoomManagement";
import GuestManagement from "@/components/GuestManagement";
import EnhancedReservationSystem from "@/components/EnhancedReservationSystem";
import EnhancedBillingSystem from "@/components/EnhancedBillingSystem";
import EnhancedPOSOrders from "@/components/EnhancedPOSOrders";
import MISReports from "@/components/MISReports";
import GuestMobileCheckin from "@/components/GuestMobileCheckin";
import GuestFeedback from "@/components/GuestFeedback";
import DigitalConcierge from "@/components/DigitalConcierge";
import HousekeepingManagement from "@/components/HousekeepingManagement";
import MaintenanceRequests from "@/components/MaintenanceRequests";
import StaffScheduling from "@/components/StaffScheduling";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header Navigation */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="p-2 rounded-lg">
              <img 
                src="/lovable-uploads/398cb7b2-ebc9-4eed-8703-0f2623d53917.png" 
                alt="Olsupat Lodge" 
                className="h-12 w-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Olsupat Lodge</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Enterprise Management System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input placeholder="Search guests, rooms, bookings..." className="pl-10 w-64 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600" />
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Avatar>
              <AvatarImage src="/api/placeholder/32/32" />
              <AvatarFallback>GM</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 min-h-screen p-4">
          <nav className="space-y-2">
            <Button variant={activeTab === "dashboard" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("dashboard")}>
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant={activeTab === "rooms" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("rooms")}>
              <MapPin className="mr-2 h-4 w-4" />
              Room Management
            </Button>
            <Button variant={activeTab === "guests" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("guests")}>
              <Users className="mr-2 h-4 w-4" />
              Guest Management
            </Button>
            <Button variant={activeTab === "reservations" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("reservations")}>
              <Calendar className="mr-2 h-4 w-4" />
              Reservations
            </Button>
            <Button variant={activeTab === "billing" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("billing")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing & Payments
            </Button>
            <Button variant={activeTab === "pos" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("pos")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              POS Orders
            </Button>
            <Button variant={activeTab === "reports" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("reports")}>
              <BarChart3 className="mr-2 h-4 w-4" />
              MIS Reports
            </Button>
            
            {/* Operations Section */}
            <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">OPERATIONS</p>
              <Button variant={activeTab === "housekeeping" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("housekeeping")}>
                <UserCheck className="mr-2 h-4 w-4" />
                Housekeeping
              </Button>
              <Button variant={activeTab === "maintenance" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("maintenance")}>
                <Wrench className="mr-2 h-4 w-4" />
                Maintenance
              </Button>
              <Button variant={activeTab === "staff" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("staff")}>
                <Clock className="mr-2 h-4 w-4" />
                Staff Scheduling
              </Button>
            </div>
            
            {/* Guest Experience Section */}
            <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">GUEST EXPERIENCE</p>
              <Button variant={activeTab === "mobile-checkin" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("mobile-checkin")}>
                <Smartphone className="mr-2 h-4 w-4" />
                Mobile Check-in
              </Button>
              <Button variant={activeTab === "feedback" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("feedback")}>
                <Star className="mr-2 h-4 w-4" />
                Guest Feedback
              </Button>
              <Button variant={activeTab === "concierge" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("concierge")}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Digital Concierge
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="dashboard">
              <DashboardOverview />
            </TabsContent>
            <TabsContent value="rooms">
              <EnhancedRoomManagement />
            </TabsContent>
            <TabsContent value="guests">
              <GuestManagement />
            </TabsContent>
            <TabsContent value="reservations">
              <EnhancedReservationSystem />
            </TabsContent>
            <TabsContent value="billing">
              <EnhancedBillingSystem />
            </TabsContent>
            <TabsContent value="pos">
              <EnhancedPOSOrders />
            </TabsContent>
            <TabsContent value="reports">
              <MISReports />
            </TabsContent>
            <TabsContent value="housekeeping">
              <HousekeepingManagement />
            </TabsContent>
            <TabsContent value="maintenance">
              <MaintenanceRequests />
            </TabsContent>
            <TabsContent value="staff">
              <StaffScheduling />
            </TabsContent>
            <TabsContent value="mobile-checkin">
              <GuestMobileCheckin />
            </TabsContent>
            <TabsContent value="feedback">
              <GuestFeedback />
            </TabsContent>
            <TabsContent value="concierge">
              <DigitalConcierge />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>;
};

export default Index;
