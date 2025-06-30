
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Package, AlertTriangle, ShoppingCart, TrendingDown, 
  RefreshCw, Bell, Plus, Settings, Search, Filter,
  Coffee, Bed, Utensils, Wrench, Sparkles, Shirt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InventoryAlerts = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState("all");
  const { toast } = useToast();

  // Inventory items with stock levels
  const inventoryItems = [
    {
      id: "INV001",
      name: "Toilet Paper",
      category: "Bathroom",
      currentStock: 15,
      minThreshold: 20,
      maxCapacity: 100,
      unit: "rolls",
      supplier: "Supplies Co.",
      lastRestock: "2024-01-10",
      avgUsage: "8 per day",
      daysLeft: 2,
      status: "critical",
      icon: Package
    },
    {
      id: "INV002",
      name: "Towels",
      category: "Bathroom",
      currentStock: 45,
      minThreshold: 30,
      maxCapacity: 80,
      unit: "pieces",
      supplier: "Linen Supply",
      lastRestock: "2024-01-12",
      avgUsage: "12 per day",
      daysLeft: 4,
      status: "ok",
      icon: Shirt
    },
    {
      id: "INV003",
      name: "Coffee Beans",
      category: "Restaurant",
      currentStock: 8,
      minThreshold: 10,
      maxCapacity: 50,
      unit: "kg",
      supplier: "Coffee Roasters",
      lastRestock: "2024-01-08",
      avgUsage: "2 kg per day",
      daysLeft: 4,
      status: "low",
      icon: Coffee
    },
    {
      id: "INV004",
      name: "Bed Sheets",
      category: "Housekeeping",
      currentStock: 25,
      minThreshold: 15,
      maxCapacity: 60,
      unit: "sets",
      supplier: "Linen Supply",
      lastRestock: "2024-01-14",
      avgUsage: "3 sets per day",
      daysLeft: 8,
      status: "ok",
      icon: Bed
    },
    {
      id: "INV005",
      name: "Cleaning Spray",
      category: "Housekeeping",
      currentStock: 3,
      minThreshold: 8,
      maxCapacity: 25,
      unit: "bottles",
      supplier: "Clean Pro",
      lastRestock: "2024-01-05",
      avgUsage: "2 bottles per day",
      daysLeft: 1,
      status: "critical",
      icon: Sparkles
    },
    {
      id: "INV006",
      name: "Light Bulbs",
      category: "Maintenance",
      currentStock: 12,
      minThreshold: 10,
      maxCapacity: 40,
      unit: "pieces",
      supplier: "Electric Supply",
      lastRestock: "2024-01-11",
      avgUsage: "1 per week",
      daysLeft: 84,
      status: "ok",
      icon: Wrench
    }
  ];

  const categories = ["Bathroom", "Restaurant", "Housekeeping", "Maintenance"];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      case "low": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "ok": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStockPercentage = (item: any) => {
    return (item.currentStock / item.maxCapacity) * 100;
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    const matchesAlert = alertFilter === "all" || 
      (alertFilter === "critical" && item.status === "critical") ||
      (alertFilter === "low" && (item.status === "low" || item.status === "critical"));
    
    return matchesSearch && matchesCategory && matchesAlert;
  });

  const criticalCount = inventoryItems.filter(item => item.status === "critical").length;
  const lowCount = inventoryItems.filter(item => item.status === "low").length;

  const handleQuickOrder = (itemId: string, itemName: string) => {
    toast({
      title: "Order Placed",
      description: `Quick order for ${itemName} has been placed with the supplier`,
    });
  };

  const handleBulkOrder = () => {
    toast({
      title: "Bulk Order Initiated",
      description: "Orders have been placed for all critical and low stock items",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Inventory Alerts</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitor stock levels and automate reordering</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="destructive" className="px-3 py-1">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {criticalCount} Critical
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-yellow-500 text-yellow-700">
            <TrendingDown className="mr-1 h-3 w-3" />
            {lowCount} Low Stock
          </Badge>
          <Button onClick={handleBulkOrder}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Bulk Order
          </Button>
        </div>
      </div>

      <Tabs defaultValue="alerts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="settings">Alert Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={alertFilter} onValueChange={setAlertFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Alerts</SelectItem>
                    <SelectItem value="critical">Critical Only</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className={`border-l-4 ${
                item.status === 'critical' ? 'border-l-red-500' : 
                item.status === 'low' ? 'border-l-yellow-500' : 'border-l-green-500'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-6 w-6 text-slate-600" />
                      <div>
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription>{item.category}</CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Stock Level</span>
                      <span>{item.currentStock} / {item.maxCapacity} {item.unit}</span>
                    </div>
                    <Progress 
                      value={getStockPercentage(item)} 
                      className={`h-2 ${
                        item.status === 'critical' ? '[&>div]:bg-red-500' : 
                        item.status === 'low' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Days Left</Label>
                      <p className="font-medium">{item.daysLeft}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Usage</Label>
                      <p className="font-medium">{item.avgUsage}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Supplier</Label>
                      <p className="font-medium">{item.supplier}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Last Restock</Label>
                      <p className="font-medium">{item.lastRestock}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleQuickOrder(item.id, item.name)}
                    >
                      <ShoppingCart className="mr-1 h-3 w-3" />
                      Quick Order
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Historical usage patterns to optimize stock levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inventoryItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-5 w-5 text-slate-600" />
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Average: {item.avgUsage}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        Trend: {Math.random() > 0.5 ? '↗️ Increasing' : '↘️ Decreasing'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        vs last month
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Configure automatic alerts and reordering thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="criticalThreshold">Critical Alert Threshold (%)</Label>
                  <Input id="criticalThreshold" type="number" defaultValue="20" />
                </div>
                <div>
                  <Label htmlFor="lowThreshold">Low Stock Alert Threshold (%)</Label>
                  <Input id="lowThreshold" type="number" defaultValue="40" />
                </div>
                <div>
                  <Label htmlFor="autoReorder">Auto-Reorder When Critical</Label>
                  <Select defaultValue="enabled">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="confirm">Ask for Confirmation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="alertFrequency">Alert Frequency</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button className="w-full">
                <Settings className="mr-2 h-4 w-4" />
                Save Alert Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryAlerts;
