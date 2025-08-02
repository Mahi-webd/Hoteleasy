import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, CreditCard, DollarSign, Clock, Users, ArrowLeft, MoreHorizontal, Search, Grid, List } from "lucide-react";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  options?: Array<{
    name: string;
    choices: Array<{ name: string; price: number }>;
  }>;
}

interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  options?: Array<{ name: string; choice: string; price: number }>;
  special_instructions?: string;
}

interface Order {
  id: string;
  tableNumber?: string;
  roomNumber?: string;
  customerName?: string;
  items: OrderItem[];
  status: 'new' | 'preparing' | 'ready' | 'completed';
  orderTime: Date;
  estimatedTime?: number;
  total: number;
  type: 'dine-in' | 'room-service' | 'takeaway';
}

interface Table {
  id: string;
  number: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved';
  currentOrder?: string;
  area: string;
}

const POSScreen = () => {
  const [currentView, setCurrentView] = useState<'tables' | 'orders' | 'checkout'>('tables');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForCheckout, setSelectedOrderForCheckout] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card');
  const [tip, setTip] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sample data
  const tables: Table[] = [
    { id: "1", number: "101", seats: 4, status: "available", area: "Restaurant" },
    { id: "2", number: "102", seats: 4, status: "occupied", currentOrder: "ord-1", area: "Restaurant" },
    { id: "3", number: "103", seats: 4, status: "available", area: "Restaurant" },
    { id: "4", number: "104", seats: 4, status: "available", area: "Restaurant" },
    { id: "5", number: "105", seats: 6, status: "occupied", currentOrder: "ord-2", area: "Restaurant" },
    { id: "6", number: "106", seats: 4, status: "occupied", currentOrder: "ord-3", area: "Restaurant" },
    { id: "7", number: "107", seats: 4, status: "available", area: "Restaurant" },
    { id: "8", number: "108", seats: 4, status: "occupied", currentOrder: "ord-4", area: "Restaurant" },
    { id: "9", number: "109", seats: 4, status: "available", area: "Restaurant" },
    { id: "10", number: "110", seats: 4, status: "available", area: "Restaurant" },
    { id: "11", number: "111", seats: 4, status: "occupied", currentOrder: "ord-5", area: "Terrace" },
    { id: "12", number: "112", seats: 3, status: "occupied", currentOrder: "ord-6", area: "Terrace" },
    { id: "13", number: "113", seats: 10, status: "occupied", currentOrder: "ord-7", area: "Terrace" },
    { id: "14", number: "114", seats: 6, status: "occupied", currentOrder: "ord-8", area: "Terrace" },
    { id: "15", number: "115", seats: 6, status: "occupied", currentOrder: "ord-9", area: "Terrace" },
  ];

  const menuItems: MenuItem[] = [
    { id: "1", name: "Burger", price: 10.00, category: "Main", available: true },
    { id: "2", name: "Big Burger", price: 15.00, category: "Main", available: true },
    { id: "3", name: "Salad", price: 8.00, category: "Main", available: true },
    { id: "4", name: "Pumpkin Soup", price: 6.50, category: "Appetizer", available: true },
    { id: "5", name: "Standard Breakfast", price: 12.00, category: "Breakfast", available: true },
    { id: "6", name: "American Breakfast", price: 17.00, category: "Breakfast", available: true },
    { id: "7", name: "Tea", price: 3.00, category: "Beverage", available: true },
    { id: "8", name: "Coffee", price: 4.00, category: "Beverage", available: true },
    { id: "9", name: "Marble Steak", price: 25.00, category: "Main", available: true,
      options: [
        {
          name: "Cooking Style",
          choices: [
            { name: "Rare", price: 0 },
            { name: "Medium Rare", price: 0 },
            { name: "Medium", price: 0 },
            { name: "Well Done", price: 0 }
          ]
        },
        {
          name: "Sauce",
          choices: [
            { name: "Tomato Sauce", price: 3.00 },
            { name: "Cheese Sauce", price: 2.00 },
            { name: "Garlic Sauce", price: 2.00 }
          ]
        }
      ]
    }
  ];

  // Initialize sample orders
  useEffect(() => {
    const sampleOrders: Order[] = [
      {
        id: "ord-1",
        tableNumber: "102",
        items: [
          { id: "1", menuItemId: "1", name: "Burger", price: 10.00, quantity: 1 },
          { id: "2", menuItemId: "3", name: "Salad", price: 8.00, quantity: 1, options: [{ name: "Extra", choice: "Cheese", price: 2.00 }] }
        ],
        status: "preparing",
        orderTime: new Date(Date.now() - 15 * 60000),
        estimatedTime: 15,
        total: 20.00,
        type: "dine-in"
      },
      {
        id: "ord-2",
        tableNumber: "105",
        items: [
          { id: "3", menuItemId: "2", name: "Big Burger", price: 15.00, quantity: 3, options: [{ name: "Extra", choice: "Double Meat", price: 3.00 }] },
          { id: "4", menuItemId: "4", name: "Pumpkin Soup", price: 6.50, quantity: 1, options: [{ name: "Extra", choice: "Double Cheese", price: 2.00 }, { name: "Extra", choice: "Double Pepper", price: 1.50 }] }
        ],
        status: "preparing",
        orderTime: new Date(Date.now() - 4 * 60000),
        estimatedTime: 4,
        total: 300.00,
        type: "dine-in"
      },
      {
        id: "ord-3",
        roomNumber: "101",
        customerName: "Herman Hubanov",
        items: [
          { id: "5", menuItemId: "5", name: "Standard Breakfast", price: 12.00, quantity: 1 },
          { id: "6", menuItemId: "3", name: "Salad", price: 8.00, quantity: 1 }
        ],
        status: "new",
        orderTime: new Date(),
        estimatedTime: 0,
        total: 20.00,
        type: "room-service"
      }
    ];
    setOrders(sampleOrders);
  }, []);

  const getTableStatus = (table: Table) => {
    if (table.status === 'occupied' && table.currentOrder) {
      const order = orders.find(o => o.id === table.currentOrder);
      return order ? order.total : 0;
    }
    return 0;
  };

  const getTableOrderCount = (table: Table) => {
    if (table.status === 'occupied' && table.currentOrder) {
      const order = orders.find(o => o.id === table.currentOrder);
      return order ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
    }
    return 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 border-green-300 text-green-800';
      case 'occupied': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'reserved': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-500';
      case 'preparing': return 'bg-yellow-500';
      case 'ready': return 'bg-blue-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const addToOrder = (menuItem: MenuItem, options?: Array<{ name: string; choice: string; price: number }>) => {
    const existingItem = currentOrder.find(item => 
      item.menuItemId === menuItem.id && 
      JSON.stringify(item.options) === JSON.stringify(options)
    );

    if (existingItem) {
      setCurrentOrder(prev => prev.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem: OrderItem = {
        id: Date.now().toString(),
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: 1,
        options
      };
      setCurrentOrder(prev => [...prev, newItem]);
    }
  };

  const updateOrderItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCurrentOrder(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCurrentOrder(prev => prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const getOrderTotal = () => {
    return currentOrder.reduce((total, item) => {
      const itemTotal = item.price * item.quantity;
      const optionsTotal = (item.options || []).reduce((sum, option) => sum + option.price, 0) * item.quantity;
      return total + itemTotal + optionsTotal;
    }, 0);
  };

  const submitOrder = () => {
    if (currentOrder.length === 0 || !selectedTable) return;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      tableNumber: selectedTable.number,
      items: [...currentOrder],
      status: 'new',
      orderTime: new Date(),
      total: getOrderTotal(),
      type: 'dine-in'
    };

    setOrders(prev => [...prev, newOrder]);
    setCurrentOrder([]);
    setSelectedTable(null);
    setCurrentView('orders');
    toast.success("Order submitted successfully!");
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  const renderTablesView = () => {
    const restaurantTables = tables.filter(table => table.area === "Restaurant");
    const terraceTables = tables.filter(table => table.area === "Terrace");

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">All</Badge>
              <Badge variant="secondary" className="bg-green-500 text-white">● Open</Badge>
              <Badge variant="secondary" className="bg-orange-500 text-white">● Online</Badge>
              <Badge variant="secondary" className="bg-yellow-500 text-white">● Reserved</Badge>
              <Badge variant="secondary" className="bg-gray-500 text-white">● Closed</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">Order List</Button>
            <Button variant="outline" size="sm">Archive</Button>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Order
            </Button>
          </div>
        </div>

        {/* Restaurant Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Restaurant</h2>
          <div className="grid grid-cols-5 gap-4">
            {restaurantTables.map((table) => (
              <Card
                key={table.id}
                className={`cursor-pointer transition-all hover:shadow-md ${getStatusColor(table.status)} border-2`}
                onClick={() => {
                  setSelectedTable(table);
                  if (table.status === 'available') {
                    setCurrentView('checkout');
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{table.number}</span>
                    <span className="text-sm text-gray-600">👥 {table.seats}</span>
                  </div>
                  {table.status === 'occupied' && (
                    <>
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString().slice(0, 5)}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {getTableOrderCount(table)} Orders
                      </div>
                      <div className="text-lg font-bold">
                        ${getTableStatus(table).toFixed(2)}
                      </div>
                    </>
                  )}
                  {table.status === 'available' && (
                    <div className="text-lg font-bold text-center">$0.00</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Terrace Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Terrace</h2>
          <div className="grid grid-cols-5 gap-4">
            {terraceTables.map((table) => (
              <Card
                key={table.id}
                className={`cursor-pointer transition-all hover:shadow-md ${getStatusColor(table.status)} border-2`}
                onClick={() => {
                  setSelectedTable(table);
                  if (table.status === 'available') {
                    setCurrentView('checkout');
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{table.number}</span>
                    <span className="text-sm text-gray-600">👥 {table.seats}</span>
                  </div>
                  {table.status === 'occupied' && (
                    <>
                      <div className="text-xs text-gray-500 mb-1">
                        {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString().slice(0, 5)}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {getTableOrderCount(table)} Orders
                      </div>
                      <div className="text-lg font-bold">
                        ${getTableStatus(table).toFixed(2)}
                      </div>
                    </>
                  )}
                  {table.status === 'available' && (
                    <div className="text-lg font-bold text-center">$0.00</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersView = () => {
    const activeOrders = orders.filter(order => order.status !== 'completed');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Current Orders ({activeOrders.length})</h2>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-500 text-white">● New</Badge>
              <Badge variant="secondary" className="bg-yellow-500 text-white">● In Progress</Badge>
              <Badge variant="secondary" className="bg-gray-500 text-white">● Closed</Badge>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">All</Badge>
            <Badge variant="outline">In Restaurant</Badge>
            <Badge variant="outline">Delivery</Badge>
            <Badge variant="outline">Pick Up</Badge>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-3 gap-6">
          {activeOrders.map((order) => (
            <Card key={order.id} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`w-3 h-6 rounded ${getOrderStatusColor(order.status)}`}></div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="secondary" 
                      className={`${order.status === 'new' ? 'bg-green-500' : order.status === 'preparing' ? 'bg-yellow-500' : 'bg-gray-500'} text-white`}
                    >
                      {order.estimatedTime ? `${order.estimatedTime} min` : '0 min'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">
                    {order.tableNumber ? `Table ${order.tableNumber}` : `Room ${order.roomNumber}`}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {order.customerName ? order.customerName : `${order.items.reduce((sum, item) => sum + item.quantity, 0)} Person`}
                  </p>
                  <p className="text-xs text-gray-500">#{order.id.slice(-3)}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-md flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="font-medium">x{item.quantity} {item.name}</p>
                      {item.options && item.options.map((option, idx) => (
                        <p key={idx} className="text-sm text-blue-600">+ {option.choice}</p>
                      ))}
                    </div>
                  </div>
                ))}
                
                {order.status === 'new' && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600 mb-2">Submit as soon as possible</p>
                    <div className="flex space-x-2">
                      <Button 
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                      >
                        Start
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Finish
                      </Button>
                    </div>
                  </div>
                )}

                {order.status === 'preparing' && (
                  <div className="pt-3 border-t">
                    <div className="flex space-x-2">
                      <Button variant="outline" className="flex-1">
                        Start
                      </Button>
                      <Button 
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                      >
                        Finish
                      </Button>
                    </div>
                  </div>
                )}

                {order.status === 'ready' && (
                  <div className="pt-3 border-t">
                    <div className="flex space-x-2">
                      <Button variant="outline" className="flex-1">
                        Start
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Finish
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderCheckoutView = () => {
    if (selectedOrderForCheckout) {
      return (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => {
              setSelectedOrderForCheckout(null);
              setCurrentView('orders');
            }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h2 className="text-2xl font-bold">Check Out</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedOrderForCheckout.tableNumber ? `Table ${selectedOrderForCheckout.tableNumber}` : `Room ${selectedOrderForCheckout.roomNumber}`}
                </CardTitle>
                <div className="flex items-center justify-between">
                  <span>Order: #{selectedOrderForCheckout.id.slice(-3)}</span>
                  <Button variant="outline" size="sm">Split Bill</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedOrderForCheckout.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} Units
                        {item.options && item.options.length > 0 && (
                          <span>, Extras: {item.options.map(opt => opt.choice).join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <span className="font-medium">${(item.price * item.quantity + (item.options?.reduce((sum, opt) => sum + opt.price, 0) || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>${selectedOrderForCheckout.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tips</span>
                    <span>${tip.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Amount due</span>
                    <span>${(selectedOrderForCheckout.total + tip).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Total to Pay: ${(selectedOrderForCheckout.total + tip).toFixed(2)}</span>
                  <Button variant="outline" size="sm">Print Check</Button>
                </CardTitle>
                <div className="text-sm text-gray-600">
                  Including Tips: ${tip.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  Discount: %0
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tips
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Discount
                  </Button>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Pay with:</h4>
                  <div className="space-y-2">
                    <Button 
                      variant={paymentMethod === 'card' ? 'default' : 'outline'} 
                      className="w-full justify-start"
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Credit Card
                    </Button>
                    <Button 
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'} 
                      className="w-full justify-start"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Cash
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button variant="outline" className="flex-1 text-red-600 border-red-600">
                    Close without payment
                  </Button>
                  <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white">
                    Pay Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // New order creation view
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setCurrentView('tables')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h2 className="text-2xl font-bold">
              {selectedTable ? `Table ${selectedTable.number}` : 'New Order'}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Menu Items */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center space-x-4">
              <Input 
                placeholder="Search menu items..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Breakfast">Breakfast</SelectItem>
                  <SelectItem value="Main">Main Course</SelectItem>
                  <SelectItem value="Appetizer">Appetizers</SelectItem>
                  <SelectItem value="Beverage">Beverages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 gap-4' : 'grid-cols-1 gap-2'}`}>
              {menuItems
                .filter(item => 
                  (selectedCategory === 'all' || item.category === selectedCategory) &&
                  item.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((item) => (
                  <Card key={item.id} className={`cursor-pointer hover:shadow-md ${!item.available ? 'opacity-50' : ''}`}>
                    <CardContent className={`${viewMode === 'grid' ? 'p-4' : 'p-3'}`}>
                      <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'items-center'} space-y-2`}>
                        <div className={`w-full ${viewMode === 'grid' ? 'h-32' : 'w-16 h-16'} bg-gray-200 rounded-md flex-shrink-0`}></div>
                        <div className="flex-1">
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-gray-600">{item.category}</p>
                          <p className="font-bold text-lg">${item.price.toFixed(2)}</p>
                        </div>
                        {item.available && (
                          <Button 
                            size="sm" 
                            onClick={() => {
                              if (item.options && item.options.length > 0) {
                                // For items with options, you'd open a modal here
                                // For now, just add without options
                                addToOrder(item);
                              } else {
                                addToOrder(item);
                              }
                            }}
                            className="w-full mt-2"
                          >
                            Add to Order
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>

          {/* Current Order */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Current Order</CardTitle>
              {selectedTable && (
                <p className="text-sm text-gray-600">Table {selectedTable.number}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {currentOrder.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items added yet</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {currentOrder.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                          {item.options && item.options.map((option, idx) => (
                            <p key={idx} className="text-xs text-blue-600">+ {option.choice} (+${option.price.toFixed(2)})</p>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateOrderItemQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateOrderItemQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>${getOrderTotal().toFixed(2)}</span>
                    </div>
                    <Button 
                      className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white"
                      onClick={submitOrder}
                      disabled={currentOrder.length === 0}
                    >
                      Submit Order
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navigation Tabs */}
      <div className="mb-6">
        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)}>
          <TabsList>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="orders">Current Orders</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {currentView === 'tables' && renderTablesView()}
      {currentView === 'orders' && renderOrdersView()}
      {currentView === 'checkout' && renderCheckoutView()}

      {/* Order Details Modal for Checkout */}
      {orders.map((order) => (
        <Dialog key={order.id}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="hidden"
              onClick={() => setSelectedOrderForCheckout(order)}
            />
          </DialogTrigger>
        </Dialog>
      ))}
    </div>
  );
};

export default POSScreen;