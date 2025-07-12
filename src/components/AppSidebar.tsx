
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Home, Bell, Search, Settings, User, Plus, MapPin, Phone, Mail, CreditCard, ShoppingCart, BarChart3, Smartphone, MessageCircle, Star, Wrench, UserCheck, Clock, Target, Zap, Bot, Package } from "lucide-react";
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
    <Sidebar>
      <SidebarHeader>
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400 p-4">
          Hotel Management
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Home className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <MapPin className="mr-2 h-4 w-4" />
                  <span>Room Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Guest Management</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Reservations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing & Payments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <span>POS Orders</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>MIS Reports</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Operations Section */}
        <SidebarGroup>
          <SidebarGroupLabel>OPERATIONS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UserCheck className="mr-2 h-4 w-4" />
                  <span>Housekeeping</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Wrench className="mr-2 h-4 w-4" />
                  <span>Maintenance</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Staff Scheduling</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Guest Experience Section */}
        <SidebarGroup>
          <SidebarGroupLabel>GUEST EXPERIENCE</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Smartphone className="mr-2 h-4 w-4" />
                  <span>Mobile Check-in</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Star className="mr-2 h-4 w-4" />
                  <span>Guest Feedback</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  <span>Digital Concierge</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Efficiency Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>EFFICIENCY TOOLS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Zap className="mr-2 h-4 w-4" />
                  <span>Quick Actions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Bot className="mr-2 h-4 w-4" />
                  <span>Task Automation</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Inventory Alerts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* Revenue & Analytics Section */}
        <SidebarGroup>
          <SidebarGroupLabel>REVENUE & ANALYTICS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>Revenue Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Financial Reports</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Target className="mr-2 h-4 w-4" />
                  <span>Budget Management</span>
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
