
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, ShoppingCart, User, MapPin, CreditCard } from "lucide-react";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface NewOrderFormProps {
  onClose: () => void;
  onOrderCreated: (order: any) => void;
}

const NewOrderForm = ({ onClose, onOrderCreated }: NewOrderFormProps) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [outlet, setOutlet] = useState("");
  const [orderType, setOrderType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const menuItems = [
    { id: "1", name: "Grilled Chicken", price: 1200, category: "Main Course" },
    { id: "2", name: "Caesar Salad", price: 800, category: "Salads" },
    { id: "3", name: "Pasta Carbonara", price: 1000, category: "Main Course" },
    { id: "4", name: "Club Sandwich", price: 900, category: "Sandwiches" },
    { id: "5", name: "French Fries", price: 400, category: "Sides" },
    { id: "6", name: "Cappuccino", price: 250, category: "Beverages" },
    { id: "7", name: "Fresh Juice", price: 300, category: "Beverages" },
    { id: "8", name: "Red Wine", price: 1500, category: "Alcohol" },
    { id: "9", name: "Beer", price: 300, category: "Alcohol" },
    { id: "10", name: "Croissant", price: 200, category: "Pastries" }
  ];

  const addItem = (item: typeof menuItems[0]) => {
    const existingItem = orderItems.find(orderItem => orderItem.id === item.id);
    if (existingItem) {
      setOrderItems(orderItems.map(orderItem => 
        orderItem.id === item.id 
          ? { ...orderItem, quantity: orderItem.quantity + 1 }
          : orderItem
      ));
    } else {
      setOrderItems([...orderItems, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setOrderItems(orderItems.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + change);
        return newQuantity === 0 ? null : { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean) as OrderItem[]);
  };

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.16; // 16% VAT
  const total = subtotal + tax;

  const handleSubmit = () => {
    if (!customerName || !outlet || !orderType || !paymentMethod || orderItems.length === 0) {
      alert("Please fill all required fields and add at least one item");
      return;
    }

    const newOrder = {
      id: `POS-${Date.now()}`,
      orderNumber: `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      customer: customerName,
      room: roomNumber || "-",
      outlet,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: "Preparing",
      orderType,
      timestamp: new Date().toLocaleString(),
      paymentMethod,
      waiter: "Current User"
    };

    onOrderCreated(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Create New Order</h2>
            <Button variant="ghost" onClick={onClose}>×</Button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Order Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name *</label>
                  <Input 
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Room Number</label>
                  <Input 
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Room number (optional for walk-ins)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Outlet *</label>
                  <Select value={outlet} onValueChange={setOutlet}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Main Restaurant">Main Restaurant</SelectItem>
                      <SelectItem value="Coffee Shop">Coffee Shop</SelectItem>
                      <SelectItem value="Room Service">Room Service</SelectItem>
                      <SelectItem value="Bar & Lounge">Bar & Lounge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order Type *</label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select order type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dine-in">Dine-in</SelectItem>
                      <SelectItem value="Room Service">Room Service</SelectItem>
                      <SelectItem value="Takeaway">Takeaway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method *</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="MPesa">MPesa</SelectItem>
                      <SelectItem value="Card">Credit/Debit Card</SelectItem>
                      <SelectItem value="Room Charge">Room Charge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Menu Items */}
            <Card>
              <CardHeader>
                <CardTitle>Menu Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded hover:bg-slate-50">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-slate-600">KES {item.price.toLocaleString()}</p>
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </div>
                      <Button size="sm" onClick={() => addItem(item)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No items added yet</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orderItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-slate-600">KES {item.price.toLocaleString()} each</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <span className="w-20 text-right font-medium">
                              KES {(item.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t pt-4 mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>KES {subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VAT (16%):</span>
                        <span>KES {tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>KES {total.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50 flex space-x-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600">
            Create Order
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewOrderForm;
