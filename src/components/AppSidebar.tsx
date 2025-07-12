
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

const AppSidebar = () => {
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
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Home className="mr-3 h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <MapPin className="mr-3 h-4 w-4" />
                  <span>Room Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Users className="mr-3 h-4 w-4" />
                  <span>Guest Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Calendar className="mr-3 h-4 w-4" />
                  <span>Reservations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <CreditCard className="mr-3 h-4 w-4" />
                  <span>Billing & Payments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <BarChart3 className="mr-3 h-4 w-4" />
                  <span>Reports</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <UserCheck className="mr-3 h-4 w-4" />
                  <span>Housekeeping</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Wrench className="mr-3 h-4 w-4" />
                  <span>Maintenance</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Clock className="mr-3 h-4 w-4" />
                  <span>Staff Scheduling</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Smartphone className="mr-3 h-4 w-4" />
                  <span>Mobile Check-in</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Star className="mr-3 h-4 w-4" />
                  <span>Guest Feedback</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <MessageCircle className="mr-3 h-4 w-4" />
                  <span>Digital Concierge</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Zap className="mr-3 h-4 w-4" />
                  <span>Quick Actions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Bot className="mr-3 h-4 w-4" />
                  <span>Automation</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Package className="mr-3 h-4 w-4" />
                  <span>Inventory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="w-full justify-start px-3 py-2 text-sm">
                  <Target className="mr-3 h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
