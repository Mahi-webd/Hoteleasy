
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard, ShoppingCart, BarChart3, Smartphone, MessageCircle, Star, Wrench, UserCheck, Clock, Target, Zap, Bot, Package, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import AppSidebar from "@/components/AppSidebar";
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
import RevenueAnalytics from "@/components/RevenueAnalytics";
import FinancialReporting from "@/components/FinancialReporting";
import BudgetManagement from "@/components/BudgetManagement";
import QuickActionsDashboard from "@/components/QuickActionsDashboard";
import TaskAutomation from "@/components/TaskAutomation";
import InventoryAlerts from "@/components/InventoryAlerts";
import EmbeddedChatbot from "@/components/EmbeddedChatbot";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header Navigation */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg">
                <img 
                  src="/lovable-uploads/398cb7b2-ebc9-4eed-8703-0f2623d53917.png" 
                  alt="Olsupat Lodge" 
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Olsupat Lodge</h1>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
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
        {/* Sidebar */}
        <AppSidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:ml-0">
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
            <TabsContent value="revenue-analytics">
              <RevenueAnalytics />
            </TabsContent>
            <TabsContent value="financial-reporting">
              <FinancialReporting />
            </TabsContent>
            <TabsContent value="budget-management">
              <BudgetManagement />
            </TabsContent>
            <TabsContent value="quick-actions">
              <QuickActionsDashboard />
            </TabsContent>
            <TabsContent value="task-automation">
              <TaskAutomation />
            </TabsContent>
            <TabsContent value="inventory-alerts">
              <InventoryAlerts />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      
      {/* Embedded Chatbot */}
      <EmbeddedChatbot />
    </div>
  );
};

export default Index;
