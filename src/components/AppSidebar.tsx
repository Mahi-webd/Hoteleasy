
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard, ShoppingCart, BarChart3, Smartphone, MessageCircle, Star, Wrench, UserCheck, Clock, Target, Zap, Bot, Package, Menu, X } from "lucide-react";

interface AppSidebarProps {
  activeView?: string;
  setActiveView?: (view: string) => void;
}

const AppSidebar = ({ activeView = "rooms", setActiveView }: AppSidebarProps) => {
  const handleTabClick = (tab: string) => {
    if (setActiveView) {
      setActiveView(tab);
    }
  };

  return (
    <aside className="w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Navigation</div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 p-4 h-full overflow-y-auto">
        <Button 
          variant={activeView === "dashboard" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("dashboard")}
        >
          <Home className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button 
          variant={activeView === "rooms" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("rooms")}
        >
          <MapPin className="mr-2 h-4 w-4" />
          Room Management
        </Button>
        <Button 
          variant={activeView === "guests" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("guests")}
        >
          <Users className="mr-2 h-4 w-4" />
          Guest Management
        </Button>
        <Button 
          variant={activeView === "reservations" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("reservations")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Reservations
        </Button>
        <Button 
          variant={activeView === "billing" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("billing")}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Billing & Payments
        </Button>
        <Button 
          variant={activeView === "pos" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("pos")}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          POS Orders
        </Button>
        <Button 
          variant={activeView === "reports" ? "default" : "ghost"} 
          className="w-full justify-start" 
          onClick={() => handleTabClick("reports")}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          MIS Reports
        </Button>
        
        {/* Operations Section */}
        <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">OPERATIONS</p>
          <Button 
            variant={activeView === "housekeeping" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("housekeeping")}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Housekeeping
          </Button>
          <Button 
            variant={activeView === "maintenance" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("maintenance")}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Maintenance
          </Button>
          <Button 
            variant={activeView === "staff" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("staff")}
          >
            <Clock className="mr-2 h-4 w-4" />
            Staff Scheduling
          </Button>
        </div>
        
        {/* Guest Experience Section */}
        <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">GUEST EXPERIENCE</p>
          <Button 
            variant={activeView === "mobile-checkin" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("mobile-checkin")}
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Mobile Check-in
          </Button>
          <Button 
            variant={activeView === "feedback" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("feedback")}
          >
            <Star className="mr-2 h-4 w-4" />
            Guest Feedback
          </Button>
          <Button 
            variant={activeView === "concierge" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("concierge")}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Digital Concierge
          </Button>
        </div>
        
        {/* Efficiency Tools Section */}
        <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">EFFICIENCY TOOLS</p>
          <Button 
            variant={activeView === "quick-actions" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("quick-actions")}
          >
            <Zap className="mr-2 h-4 w-4" />
            Quick Actions
          </Button>
          <Button 
            variant={activeView === "task-automation" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("task-automation")}
          >
            <Bot className="mr-2 h-4 w-4" />
            Task Automation
          </Button>
          <Button 
            variant={activeView === "inventory-alerts" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("inventory-alerts")}
          >
            <Package className="mr-2 h-4 w-4" />
            Inventory Alerts
          </Button>
        </div>
        
        {/* Revenue & Analytics Section */}
        <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">REVENUE & ANALYTICS</p>
          <Button 
            variant={activeView === "revenue-analytics" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("revenue-analytics")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Revenue Analytics
          </Button>
          <Button 
            variant={activeView === "financial-reporting" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("financial-reporting")}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Financial Reports
          </Button>
          <Button 
            variant={activeView === "budget-management" ? "default" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => handleTabClick("budget-management")}
          >
            <Target className="mr-2 h-4 w-4" />
            Budget Management
          </Button>
        </div>
      </nav>
    </aside>
  );
};

export default AppSidebar;
