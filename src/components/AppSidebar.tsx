import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Calendar, Clock, CreditCard, Home, MapPin, Package, Settings, ShoppingCart, Smartphone, Globe, Wallet, UserCheck, Users, Wrench, X, ChefHat, type LucideIcon, CalendarRange, Building2, BellRing, LayoutDashboard, MoonStar, ShieldCheck, RefreshCw, MessageCircle, QrCode } from "lucide-react";
import type { HotelRole } from "@/lib/db-types";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Permission needed to open it (any of, "a|b"). Omit = everyone. */
  perm?: string;
  /** Only the hotel owner. */
  ownerOnly?: boolean;
  /** Still showing demo data — not connected to the database yet. */
  preview?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Front office",
    items: [
      { key: "dashboard", label: "Dashboard", icon: Home, perm: "dashboard.view" },
      { key: "reservations", label: "Reservations", icon: Calendar, perm: "reservations.view" },
      { key: "online-checkin", label: "Online check-in", icon: Smartphone, perm: "precheck.view" },
      { key: "requests", label: "Guest requests", icon: BellRing, perm: "requests.view" },
      { key: "audit", label: "Night audit", icon: MoonStar, perm: "audit.view" },
      { key: "rates", label: "Rates & seasons", icon: CalendarRange, perm: "rates.view" },
      { key: "rooms", label: "Rooms", icon: MapPin, perm: "rooms.view" },
      { key: "guests", label: "Guests", icon: Users, perm: "guests.view" },
      { key: "billing", label: "Billing & Payments", icon: CreditCard, perm: "billing.view" },
      { key: "companies", label: "Company accounts", icon: Building2, perm: "companies.view" },
      { key: "online", label: "Online booking & reviews", icon: Globe, perm: "online.view" },
      { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "whatsapp.view" },
      { key: "channels", label: "Booking.com & Airbnb", icon: RefreshCw, perm: "channels.view" },
    ],
  },
  {
    title: "Food & beverage",
    items: [
      { key: "pos", label: "Restaurant & Bar POS", icon: ShoppingCart, perm: "pos.view" },
      { key: "kds", label: "Kitchen & bar screen", icon: ChefHat, perm: "kds.view" },
      { key: "tableqr", label: "Table QR & waiter calls", icon: QrCode, perm: "tableqr.view" },
    ],
  },
  {
    title: "Management",
    items: [
      { key: "owner", label: "Owner overview", icon: LayoutDashboard, perm: "owner.view" },
      { key: "reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
      { key: "finance", label: "Expenses & profit", icon: Wallet, perm: "finance.view" },
    ],
  },
  {
    title: "Operations",
    items: [
      { key: "housekeeping", label: "Housekeeping", icon: UserCheck, perm: "housekeeping.view" },
      { key: "maintenance", label: "Maintenance", icon: Wrench, perm: "maintenance.view" },
      { key: "inventory", label: "Inventory", icon: Package, perm: "inventory.view" },
      { key: "staff", label: "Staff & rota", icon: Users, perm: "staff.view" },
      { key: "my-shifts", label: "My shifts", icon: Clock },
    ],
  },
  {
    title: "Admin",
    items: [
      { key: "settings", label: "Settings & Team", icon: Settings, perm: "settings.view" },
      { key: "roles", label: "Roles & permissions", icon: ShieldCheck, ownerOnly: true },
    ],
  },
];

export const canSee = (item: NavItem, role: HotelRole | null, allowed: (...p: string[]) => boolean) =>
  !!role && (item.ownerOnly ? role === "owner" : !item.perm || allowed(item.perm));

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: HotelRole | null;
  allowed: (...p: string[]) => boolean;
}

const AppSidebar = ({ isOpen, onToggle, activeTab, setActiveTab, role, allowed }: AppSidebarProps) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onToggle} />}
    <aside
      className={`fixed top-0 left-0 h-full w-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200 dark:border-slate-700 z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"} md:sticky md:top-[73px] md:h-[calc(100vh-73px)] md:translate-x-0 md:z-auto`}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 md:hidden">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Navigation</div>
        <Button variant="ghost" size="sm" onClick={onToggle}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="p-4 h-full overflow-y-auto space-y-5 pb-24">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => canSee(i, role, allowed));
          if (!items.length) return null;
          return (
            <div key={section.title} className="space-y-1">
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</div>
              {items.map((item) => (
                <Button
                  key={item.key}
                  variant={activeTab === item.key ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setActiveTab(item.key);
                    if (isOpen) onToggle();
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.preview && (
                    <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 font-normal opacity-70">
                      demo
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  </>
);

export default AppSidebar;
