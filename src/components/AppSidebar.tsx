import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard, ShoppingCart, BarChart3, Smartphone, MessageCircle, Star, Wrench, UserCheck, Clock, Target, Zap, Bot, Package, Menu, X } from "lucide-react";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const AppSidebar = ({ isOpen, onToggle, activeTab, setActiveTab }: AppSidebarProps) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Navigation</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 p-4 h-full overflow-y-auto">
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
            POS System
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
          
          {/* Efficiency Tools Section */}
          <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">EFFICIENCY TOOLS</p>
            <Button variant={activeTab === "quick-actions" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("quick-actions")}>
              <Zap className="mr-2 h-4 w-4" />
              Quick Actions
            </Button>
            <Button variant={activeTab === "task-automation" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("task-automation")}>
              <Bot className="mr-2 h-4 w-4" />
              Task Automation
            </Button>
            <Button variant={activeTab === "inventory-alerts" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("inventory-alerts")}>
              <Package className="mr-2 h-4 w-4" />
              Inventory Alerts
            </Button>
          </div>
          
          {/* Revenue & Analytics Section */}
          <div className="pt-4 border-t border-slate-300 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-2">REVENUE & ANALYTICS</p>
            <Button variant={activeTab === "revenue-analytics" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("revenue-analytics")}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Revenue Analytics
            </Button>
            <Button variant={activeTab === "financial-reporting" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("financial-reporting")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Financial Reports
            </Button>
            <Button variant={activeTab === "budget-management" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("budget-management")}>
              <Target className="mr-2 h-4 w-4" />
              Budget Management
            </Button>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default AppSidebar;
