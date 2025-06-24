import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Plus, Clock, CheckCircle, XCircle, User, MapPin, CreditCard, Utensils, Coffee, Truck } from "lucide-react";
import NewOrderForm from "./NewOrderForm";

const POSOrders = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [orders, setOrders] = useState([
    {
      id: "POS-001",
      orderNumber: "ORD-2024-001",
      customer: "John Doe",
      room: "205",
      outlet: "Main Restaurant",
      items: [
        { name: "Grilled Chicken", quantity: 2, price: 1200, total: 2400 },
        { name: "Caesar Salad", quantity: 1, price: 800, total: 800 },
        { name: "Red Wine", quantity: 1, price: 1500, total: 1500 }
      ],
      subtotal: 4700,
      tax: 752,
      total: 5452,
      status: "Completed",
      orderType: "Dine-in",
      timestamp: "2024-06-24 14:30",
      paymentMethod: "MPesa",
      waiter: "Mary Wanjiku"
    },
    {
      id: "POS-002",
      orderNumber: "ORD-2024-002",
      customer: "Sarah Johnson",
      room: "312",
      outlet: "Room Service",
      items: [
        { name: "Club Sandwich", quantity: 1, price: 900, total: 900 },
        { name: "French Fries", quantity: 1, price: 400, total: 400 },
        { name: "Fresh Juice", quantity: 2, price: 300, total: 600 }
      ],
      subtotal: 1900,
      tax: 304,
      total: 2204,
      status: "Preparing",
      orderType: "Room Service",
      timestamp: "2024-06-24 15:15",
      paymentMethod: "Room Charge",
      waiter: "Peter Kimani"
    },
    {
      id: "POS-003",
      orderNumber: "ORD-2024-003",
      customer: "Walk-in Customer",
      room: "-",
      outlet: "Coffee Shop",
      items: [
        { name: "Cappuccino", quantity: 2, price: 250, total: 500 },
        { name: "Croissant", quantity: 1, price: 200, total: 200 }
      ],
      subtotal: 700,
      tax: 112,
      total: 812,
      status: "Served",
      orderType: "Takeaway",
      timestamp: "2024-06-24 10:45",
      paymentMethod: "Cash",
      waiter: "Grace Muthoni"
    }
  ]);

  const outlets = [
    { name: "Main Restaurant", icon: Utensils, orders: 45, revenue: 125000 },
    { name: "Coffee Shop", icon: Coffee, orders: 28, revenue: 35000 },
    { name: "Room Service", icon: Truck, orders: 22, revenue: 68000 },
    { name: "Bar & Lounge", icon: Coffee, orders: 35, revenue: 95000 }
  ];

  const handleNewOrder = (newOrder: any) => {
    setOrders([newOrder, ...orders]);
    console.log("New order created:", newOrder);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-100 text-green-800";
      case "Served": return "bg-blue-100 text-blue-800";
      case "Preparing": return "bg-yellow-100 text-yellow-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "Dine-in": return <Utensils className="h-4 w-4" />;
      case "Room Service": return <Truck className="h-4 w-4" />;
      case "Takeaway": return <ShoppingCart className="h-4 w-4" />;
      default: return <Utensils className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">POS Orders Management</h2>
          <p className="text-slate-600">Manage restaurant, bar, and room service orders</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-blue-600 to-indigo-600"
          onClick={() => setShowNewOrderForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders">Active Orders</TabsTrigger>
          <TabsTrigger value="outlets">Outlet Performance</TabsTrigger>
          <TabsTrigger value="analytics">Sales Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Orders</p>
                    <p className="text-2xl font-bold text-slate-800">{orders.length}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Today's Revenue</p>
                    <p className="text-2xl font-bold text-slate-800">KES 323,000</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Preparing</p>
                    <p className="text-2xl font-bold text-slate-800">{orders.filter(o => o.status === "Preparing").length}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Avg Order Value</p>
                    <p className="text-2xl font-bold text-slate-800">KES 2,071</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>All POS orders from restaurants, bar, and room service</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                <div className="flex space-x-4">
                  <Input placeholder="Search orders..." className="w-64" />
                  <Select>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outlets</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="room-service">Room Service</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="served">Served</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer}</p>
                          {order.room !== "-" && (
                            <p className="text-sm text-slate-500 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              Room {order.room}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{order.outlet}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getOrderTypeIcon(order.orderType)}
                          <span className="ml-2">{order.orderType}</span>
                        </div>
                      </TableCell>
                      <TableCell>{order.items.length} items</TableCell>
                      <TableCell className="font-medium">KES {order.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.timestamp}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outlets" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {outlets.map((outlet, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <outlet.icon className="h-8 w-8 text-blue-600" />
                    <Badge variant="secondary">{outlet.orders} orders</Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{outlet.name}</h3>
                  <p className="text-2xl font-bold text-green-600">
                    KES {outlet.revenue.toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-600">Today's Revenue</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics Dashboard</CardTitle>
              <CardDescription>Comprehensive sales performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Advanced Analytics Coming Soon</h3>
                <p className="text-slate-600">Detailed sales charts, trends, and performance metrics will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Order Form Modal */}
      {showNewOrderForm && (
        <NewOrderForm 
          onClose={() => setShowNewOrderForm(false)}
          onOrderCreated={handleNewOrder}
        />
      )}
    </div>
  );
};

export default POSOrders;
