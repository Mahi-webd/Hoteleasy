
import { Button } from "@/components/ui/button";
import { Home, MapPin, Users, Calendar, CreditCard } from "lucide-react";

interface AppSidebarProps {
  activeView?: string;
  setActiveView?: (view: string) => void;
}

const AppSidebar = ({ activeView = "dashboard", setActiveView }: AppSidebarProps) => {
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
      </nav>
    </aside>
  );
};

export default AppSidebar;
