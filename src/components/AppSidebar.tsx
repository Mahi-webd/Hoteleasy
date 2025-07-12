
import { Button } from "@/components/ui/button";
import { Calendar, Users, Home, CreditCard, MapPin, BarChart3, UserCheck, Wrench, Clock, Smartphone, Star, MessageCircle, Zap, Bot, Package, Target } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const AppSidebar = ({ activeView, setActiveView }: AppSidebarProps) => {
  const mainMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "rooms", label: "Room Management", icon: MapPin },
    { id: "guests", label: "Guest Management", icon: Users },
    { id: "reservations", label: "Reservations", icon: Calendar },
    { id: "billing", label: "Billing & Payments", icon: CreditCard },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ];

  const operationsItems = [
    { id: "housekeeping", label: "Housekeeping", icon: UserCheck },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "scheduling", label: "Staff Scheduling", icon: Clock },
  ];

  const guestExperienceItems = [
    { id: "mobile-checkin", label: "Mobile Check-in", icon: Smartphone },
    { id: "feedback", label: "Guest Feedback", icon: Star },
    { id: "concierge", label: "Digital Concierge", icon: MessageCircle },
  ];

  const toolsItems = [
    { id: "quick-actions", label: "Quick Actions", icon: Zap },
    { id: "automation", label: "Automation", icon: Bot },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "analytics", label: "Analytics", icon: Target },
  ];

  return (
    <Sidebar className="border-r bg-sidebar">
      <SidebarHeader className="border-b">
        <div className="flex items-center space-x-3 px-4 py-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Home className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              Olsupat Lodge
            </h2>
            <p className="text-xs text-sidebar-foreground/70">
              Management System
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 px-3 py-2">
            MAIN MENU
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className={`w-full justify-start px-3 py-2 text-sm ${
                      activeView === item.id 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover:bg-sidebar-accent/50"
                    }`}
                    onClick={() => setActiveView(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Operations Section */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 px-3 py-2">
            OPERATIONS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {operationsItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className={`w-full justify-start px-3 py-2 text-sm ${
                      activeView === item.id 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover:bg-sidebar-accent/50"
                    }`}
                    onClick={() => setActiveView(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Guest Experience Section */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 px-3 py-2">
            GUEST EXPERIENCE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {guestExperienceItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className={`w-full justify-start px-3 py-2 text-sm ${
                      activeView === item.id 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover:bg-sidebar-accent/50"
                    }`}
                    onClick={() => setActiveView(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Tools Section */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 px-3 py-2">
            TOOLS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton 
                    className={`w-full justify-start px-3 py-2 text-sm ${
                      activeView === item.id 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover:bg-sidebar-accent/50"
                    }`}
                    onClick={() => setActiveView(item.id)}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
