
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard } from "lucide-react";
import DashboardOverview from "@/components/DashboardOverview";
import RoomManagement from "@/components/RoomManagement";
import GuestManagement from "@/components/GuestManagement";
import ReservationSystem from "@/components/ReservationSystem";
import BillingSystem from "@/components/BillingSystem";

const Index = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Navigation */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
              <Home className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Paradise Hotel</h1>
              <p className="text-sm text-slate-600">Enterprise Management System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input 
                placeholder="Search guests, rooms, bookings..." 
                className="pl-10 w-64 bg-white/50 border-slate-200"
              />
            </div>
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
        <aside className="w-64 bg-white/60 backdrop-blur-sm border-r border-slate-200 min-h-screen p-4">
          <nav className="space-y-2">
            <Button
              variant={activeTab === "dashboard" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("dashboard")}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={activeTab === "rooms" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("rooms")}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Room Management
            </Button>
            <Button
              variant={activeTab === "guests" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("guests")}
            >
              <Users className="mr-2 h-4 w-4" />
              Guest Management
            </Button>
            <Button
              variant={activeTab === "reservations" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("reservations")}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Reservations
            </Button>
            <Button
              variant={activeTab === "billing" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("billing")}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Billing & Payments
            </Button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="dashboard">
              <DashboardOverview />
            </TabsContent>
            <TabsContent value="rooms">
              <RoomManagement />
            </TabsContent>
            <TabsContent value="guests">
              <GuestManagement />
            </TabsContent>
            <TabsContent value="reservations">
              <ReservationSystem />
            </TabsContent>
            <TabsContent value="billing">
              <BillingSystem />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Index;
