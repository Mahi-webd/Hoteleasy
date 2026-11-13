import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Bot, Calendar, Clock, CreditCard, Home, MapPin, MessageCircle, Package, Settings, ShoppingCart,
  Smartphone, Globe, Wallet, UserCheck, Users, Wrench, X, Zap, ChefHat, type LucideIcon,
} from "lucide-react";
import type { HotelRole } from "@/lib/db-types";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Roles allowed to open it. Omit = everyone. */
  roles?: HotelRole[];
  /** Still showing demo data — not connected to the database yet. */
  preview?: boolean;
}

const FRONT: HotelRole[] = ["owner", "manager", "front_desk"];
const MGMT: HotelRole[] = ["owner", "manager"];
const MONEY: HotelRole[] = ["owner", "manager", "accountant"];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Front office",
    items: [
      { key: "dashboard", label: "Dashboard", icon: Home },
      { key: "reservations", label: "Reservations", icon: Calendar },
      { key: "rooms", label: "Rooms", icon: MapPin },
      { key: "guests", label: "Guests", icon: Users, roles: [...FRONT, "accountant", "restaurant"] },
      { key: "billing", label: "Billing & Payments", icon: CreditCard, roles: [...FRONT, "accountant"] },
      { key: "online", label: "Online booking & reviews", icon: Globe, roles: [...FRONT, "accountant"] },
    ],
  },
  {
    title: "Food & beverage",
    items: [
      { key: "pos", label: "Restaurant & Bar POS", icon: ShoppingCart, roles: [...FRONT, "restaurant", "accountant"] },
      { key: "kds", label: "Kitchen & bar screen", icon: ChefHat, roles: [...MGMT, "front_desk", "restaurant"] },
    ],
  },
  {
    title: "Management",
    items: [
      { key: "reports", label: "Reports", icon: BarChart3, roles: MONEY },
      { key: "finance", label: "Expenses & profit", icon: Wallet, roles: MONEY },
    ],
  },
  {
    title: "Operations",
    items: [
      { key: "housekeeping", label: "Housekeeping", icon: UserCheck, roles: [...FRONT, "housekeeping"] },
      { key: "maintenance", label: "Maintenance", icon: Wrench },
      { key: "inventory", label: "Inventory", icon: Package, roles: ["owner", "manager", "storekeeper", "accountant", "restaurant"] },
      { key: "staff", label: "Staff & rota", icon: Users, roles: ["owner", "manager", "front_desk", "accountant"] },
      { key: "my-shifts", label: "My shifts", icon: Clock },
    ],
  },
  {
    title: "Coming next",
    items: [
      { key: "mobile-checkin", label: "Mobile Check-in", icon: Smartphone, roles: FRONT, preview: true },
      { key: "concierge", label: "Digital Concierge", icon: MessageCircle, roles: FRONT, preview: true },
      { key: "quick-actions", label: "Quick Actions", icon: Zap, roles: MGMT, preview: true },
      { key: "task-automation", label: "Task Automation", icon: Bot, roles: MGMT, preview: true },
    ],
  },
  {
    title: "Admin",
    items: [{ key: "settings", label: "Settings & Team", icon: Settings }],
  },
];

export const canSee = (item: NavItem, role: HotelRole | null) => !item.roles || (!!role && item.roles.includes(role));

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: HotelRole | null;
}

const AppSidebar = ({ isOpen, onToggle, activeTab, setActiveTab, role }: AppSidebarProps) => (
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
          const items = section.items.filter((i) => canSee(i, role));
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
