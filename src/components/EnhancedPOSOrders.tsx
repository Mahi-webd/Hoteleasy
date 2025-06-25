
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ShoppingCart, Clock, CheckCircle, X, Minus, Edit, Trash2 } from "lucide-react";

const EnhancedPOSOrders = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentOrder, setCurrentOrder] = useState([]);
  const [menuItems, setMenuItems] = useState([
    { id: 1, name: "Grilled Chicken", category: "Main Course", price: 1800, available: true },
    { id: 2, name: "Fish & Chips", category: "Main Course", price: 1600, available: true },
    { id: 3, name: "Vegetable Pasta", category: "Main Course", price: 1400, available: true },
    { id: 4, name: "Caesar Salad", category: "Appetizers", price: 900, available: true },
    { id: 5, name: "Soup of the Day", category: "Appetizers", price: 700, available: true },
    { id: 6, name: "Chocolate Cake", category: "Desserts", price: 800, available: true },
    { id: 7, name: "Fresh Fruit Platter", category: "Desserts", price: 600, available: true },
    { id: 8, name: "Coffee", category: "Beverages", price: 300, available: true },
    { id: 9, name: "Fresh Juice", category: "Beverages", price: 400, available: true },
    { id: 10, name: "Wine (Glass)", category: "Beverages", price: 1200, available: true }
  ]);
  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    category: "",
    price: 0
  });

  const orders = [
    {
      id: "ORD001",
      customerName: "John Doe",
      roomNumber: "101",
      items: [
        { name: "Grilled Chicken", quantity: 2, price: 1800 },
        { name: "Coffee", quantity: 2, price: 300 }
      ],
      status: "Completed",
      orderTime: "2025-06-25 14:30",
      total: "KES 4,200"
    },
    {
      id: "ORD002",
      customerName: "Jane Smith",
      roomNumber: "201",
      items: [
        { name: "Fish & Chips", quantity: 1, price: 1600 },
        { name: "Caesar Salad", quantity: 1, price: 900 },
        { name: "Wine (Glass)", quantity: 2, price: 1200 }
      ],
      status: "In Progress",
      orderTime: "2025-06-25 15:45",
      total: "KES 4,900"
    },
    {
      id: "ORD003",
      customerName: "Mike Johnson",
      roomNumber: "203",
      items: [
        { name: "Vegetable Pasta", quantity: 1, price: 1400 },
        { name: "Fresh Juice", quantity: 1, price: 400 }
      ],
      status: "Pending",
      orderTime: "2025-06-25 16:20",
      total: "KES 1,800"
    }
  ];

  const addToOrder = (item) => {
    const existingItem = currentOrder.find(orderItem => orderItem.id === item.id);
    if (existingItem) {
      setCurrentOrder(currentOrder.map(orderItem =>
        orderItem.id === item.id
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ));
    } else {
      setCurrentOrder([...currentOrder, { ...item, quantity: 1 }]);
    }
  };

  const removeFromOrder = (itemId) => {
    setCurrentOrder(currentOrder.filter(item => item.id !== itemId));
  };

  const updateOrderItemQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromOrder(itemId);
    } else {
      setCurrentOrder(currentOrder.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const getOrderTotal = () => {
    return currentOrder.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const addMenuItem = () => {
    if (newMenuItem.name && newMenuItem.category && newMenuItem.price > 0) {
      const newItem = {
        id: menuItems.length + 1,
        name: newMenuItem.name,
        category: newMenuItem.category,
        price: newMenuItem.price,
        available: true
      };
      setMenuItems([...menuItems, newItem]);
      setNewMenuItem({ name: "", category: "", price: 0 });
    }
  };

  const removeMenuItem = (itemId) => {
    setMenuItems(menuItems.filter(item => item.id !== itemId));
  };

  const toggleMenuItemAvailability = (itemId) => {
    setMenuItems(menuItems.map(item =>
      item.id === itemId ? { ...item, available: !item.available } : item
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-100 text-green-800";
      case "In Progress": return "bg-blue-100 text-blue-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const categories = [...new Set(menuItems.map(item => item.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">POS Orders</h2>
          <p className="text-slate-600">Manage restaurant orders and menu items</p>
        </div>
        <div className="flex space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Manage Menu
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Menu Management</DialogTitle>
                <DialogDescription>Add, edit, or remove menu items</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Add New Menu Item */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold mb-4">Add New Menu Item</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="itemName">Item Name</Label>
                      <Input
                        id="itemName"
                        value={newMenuItem.name}
                        onChange={(e) => setNewMenuItem({...newMenuItem, name: e.target.value})}
                        placeholder="Enter item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="itemCategory">Category</Label>
                      <Select value={newMenuItem.category} onValueChange={(value) => setNewMenuItem({...newMenuItem, category: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Appetizers">Appetizers</SelectItem>
                          <SelectItem value="Main Course">Main Course</SelectItem>
                          <SelectItem value="Desserts">Desserts</SelectItem>
                          <SelectItem value="Beverages">Beverages</SelectItem>
                          <SelectItem value="Snacks">Snacks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="itemPrice">Price (KES)</Label>
                      <Input
                        id="itemPrice"
                        type="number"
                        value={newMenuItem.price || ''}
                        onChange={(e) => setNewMenuItem({...newMenuItem, price: parseFloat(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={addMenuItem} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Menu Items List */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Current Menu Items</h3>
                  {categories.map(category => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-medium text-slate-700 border-b pb-1">{category}</h4>
                      <div className="grid gap-2">
                        {menuItems.filter(item => item.category === category).map(item => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div className="flex-1">
                              <span className={`font-medium ${!item.available ? 'text-gray-400 line-through' : ''}`}>
                                {item.name}
                              </span>
                              <span className="ml-4 text-slate-600">KES {item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={item.available ? "default" : "secondary"}>
                                {item.available ? "Available" : "Unavailable"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleMenuItemAvailability(item.id)}
                              >
                                {item.available ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeMenuItem(item.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Order</DialogTitle>
                <DialogDescription>Select items and create a new restaurant order</DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Menu Items */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Menu Items</h3>
                  <Tabs defaultValue="all">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="Appetizers">Appetizers</TabsTrigger>
                      <TabsTrigger value="Main Course">Main</TabsTrigger>
                      <TabsTrigger value="Desserts">Desserts</TabsTrigger>
                      <TabsTrigger value="Beverages">Drinks</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all" className="space-y-2 max-h-96 overflow-y-auto">
                      {menuItems.filter(item => item.available).map(item => (
                        <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addToOrder(item)}>
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium">{item.name}</h4>
                                <p className="text-sm text-slate-600">{item.category}</p>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">KES {item.price.toLocaleString()}</div>
                                <Button size="sm" className="mt-1">Add</Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </TabsContent>
                    
                    {categories.map(category => (
                      <TabsContent key={category} value={category} className="space-y-2 max-h-96 overflow-y-auto">
                        {menuItems.filter(item => item.category === category && item.available).map(item => (
                          <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => addToOrder(item)}>
                            <CardContent className="p-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-medium">{item.name}</h4>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold">KES {item.price.toLocaleString()}</div>
                                  <Button size="sm" className="mt-1">Add</Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>

                {/* Current Order */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Current Order</h3>
                  
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input id="customerName" placeholder="Enter customer name" />
                    </div>
                    <div>
                      <Label htmlFor="roomNumber">Room Number</Label>
                      <Input id="roomNumber" placeholder="Room number (optional)" />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
                    {currentOrder.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No items in order</p>
                    ) : (
                      currentOrder.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <div className="flex-1">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-sm text-slate-600 ml-2">KES {item.price.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderItemQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderItemQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromOrder(item.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>KES {getOrderTotal().toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="orderNotes">Special Instructions</Label>
                    <Textarea id="orderNotes" placeholder="Any special requests or notes" />
                  </div>

                  <Button className="w-full" disabled={currentOrder.length === 0}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Place Order
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search orders by customer name, room number, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid grid-cols-1 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <div className="font-semibold text-slate-800">{order.id}</div>
                  <div className="text-sm text-slate-600">{order.customerName}</div>
                  <div className="text-sm text-slate-500">Room {order.roomNumber}</div>
                  <div className="text-xs text-slate-400">{order.orderTime}</div>
                </div>
                <div className="lg:col-span-2">
                  <div className="text-sm text-slate-600 mb-2">Order Items:</div>
                  <div className="space-y-1">
                    {order.items.map((item, index) => (
                      <div key={index} className="text-sm">
                        {item.quantity}x {item.name} - KES {(item.quantity * item.price).toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                  <div className="font-bold text-lg">{order.total}</div>
                  <div className="flex space-x-2">
                    {order.status === "Pending" && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Start
                      </Button>
                    )}
                    {order.status === "In Progress" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Complete
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{orders.length}</div>
            <div className="text-sm opacity-90">Total Orders</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {orders.filter(o => o.status === "Completed").length}
            </div>
            <div className="text-sm opacity-90">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {orders.filter(o => o.status === "In Progress").length}
            </div>
            <div className="text-sm opacity-90">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">KES 25,400</div>
            <div className="text-sm opacity-90">Today's Revenue</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedPOSOrders;
