
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, TrendingDown, Clock, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InventoryAlerts = () => {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [alerts, setAlerts] = useState([
    {
      id: 1,
      item: "Towels - White Bath",
      category: "Linens",
      currentStock: 12,
      minLevel: 25,
      status: "critical",
      lastUpdated: "2024-01-20",
      location: "Housekeeping Storage"
    },
    {
      id: 2,
      item: "Toilet Paper - 2-Ply",
      category: "Bathroom Supplies",
      currentStock: 8,
      minLevel: 20,
      status: "critical",
      lastUpdated: "2024-01-20",
      location: "Supply Closet A"
    },
    {
      id: 3,
      item: "Coffee Pods - Espresso",
      category: "Food & Beverage",
      currentStock: 15,
      minLevel: 30,
      status: "low",
      lastUpdated: "2024-01-19",
      location: "Kitchen Storage"
    },
    {
      id: 4,
      item: "Hand Soap Dispensers",
      category: "Bathroom Supplies",
      currentStock: 3,
      minLevel: 10,
      status: "critical",
      lastUpdated: "2024-01-19",
      location: "Maintenance Room"
    },
    {
      id: 5,
      item: "Pillow Cases - Standard",
      category: "Linens",
      currentStock: 18,
      minLevel: 40,
      status: "low",
      lastUpdated: "2024-01-18",
      location: "Housekeeping Storage"
    },
    {
      id: 6,
      item: "Cleaning Spray - All Purpose",
      category: "Cleaning Supplies",
      currentStock: 6,
      minLevel: 15,
      status: "critical",
      lastUpdated: "2024-01-18",
      location: "Housekeeping Cart"
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      case "low": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "normal": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "low": return <TrendingDown className="h-4 w-4 text-yellow-600" />;
      case "normal": return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleDismissAlert = (alertId: number) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
    toast({
      title: "Alert Dismissed",
      description: "The inventory alert has been dismissed",
    });
  };

  const handleMarkResolved = (alertId: number) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId 
        ? { ...alert, status: "normal" }
        : alert
    ));
    toast({
      title: "Alert Resolved",
      description: "The inventory issue has been marked as resolved",
    });
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesStatus = filterStatus === "all" || alert.status === filterStatus;
    const matchesCategory = filterCategory === "all" || alert.category === filterCategory;
    return matchesStatus && matchesCategory;
  });

  const categories = ["All Categories", "Linens", "Bathroom Supplies", "Food & Beverage", "Cleaning Supplies", "Kitchen Supplies"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Inventory Alerts</h2>
          <p className="text-slate-600 dark:text-slate-400">Monitor and manage low stock alerts</p>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Critical Alerts</p>
                <p className="text-2xl font-bold">
                  {alerts.filter(a => a.status === "critical").length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">Low Stock</p>
                <p className="text-2xl font-bold">
                  {alerts.filter(a => a.status === "low").length}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Items</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Linens">Linens</SelectItem>
                <SelectItem value="Bathroom Supplies">Bathroom Supplies</SelectItem>
                <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                <SelectItem value="Cleaning Supplies">Cleaning Supplies</SelectItem>
                <SelectItem value="Kitchen Supplies">Kitchen Supplies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alert List */}
      <div className="space-y-4">
        {filteredAlerts.map((alert) => (
          <Card key={alert.id} className={`bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-l-4 ${
            alert.status === 'critical' ? 'border-l-red-500' : 
            alert.status === 'low' ? 'border-l-yellow-500' : 
            'border-l-green-500'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(alert.status)}
                  <div>
                    <h3 className="font-semibold text-lg">{alert.item}</h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {alert.category} • {alert.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge className={getStatusColor(alert.status)}>
                    {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                  </Badge>
                  <div className="text-right">
                    <div className="text-sm text-slate-600 dark:text-slate-400">Current Stock</div>
                    <div className="font-semibold text-lg">
                      {alert.currentStock} / {alert.minLevel}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Last updated: {alert.lastUpdated}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleMarkResolved(alert.id)}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Mark Resolved
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleDismissAlert(alert.id)}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAlerts.length === 0 && (
        <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">
              No Alerts Found
            </h3>
            <p className="text-slate-500 dark:text-slate-500">
              No inventory alerts match your current filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InventoryAlerts;
