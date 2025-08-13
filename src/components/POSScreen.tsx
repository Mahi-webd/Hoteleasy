import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Minus, 
  Users, 
  Clock, 
  CreditCard, 
  Check,
  Edit,
  Trash2,
  Coffee,
  UtensilsCrossed,
  Wine,
  Monitor,
  Search,
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  Printer,
  X,
  Settings
} from 'lucide-react';

// Define interfaces for our data structures
interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  display_order: number;
}

interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  total_price: number;
  notes?: string;
}

interface Order {
  id: string;
  order_number: number;
  table_id: string | null;
  customer_name: string | null;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  tips?: number;
  discount?: number;
  pos_order_items?: any[];
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  area: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
}

export default function POSScreen() {
  const [currentView, setCurrentView] = useState<'tables' | 'orders' | 'new-order' | 'table-bills' | 'checkout'>('tables');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mpesa' | 'room'>('card');
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [tips, setTips] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [printCheck, setPrintCheck] = useState<boolean>(false);
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState<MenuItem | null>(null);
  const [customizationOptions, setCustomizationOptions] = useState<{[key: string]: any}>({});
  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');
      
      if (tablesError) throw tablesError;
      setTables(tablesData || []);

      // Load menu categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (categoriesError) throw categoriesError;
      setMenuCategories(categoriesData || []);
      
      if (categoriesData && categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id);
      }

      // Load menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('display_order');
      
      if (itemsError) throw itemsError;
      setMenuItems(itemsData || []);

      // Load current orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('pos_orders')
        .select(`
          *,
          pos_order_items (
            id,
            menu_item_id,
            quantity,
            unit_price,
            total_price,
            notes,
            menu_items (name)
          )
        `)
        .in('status', ['new', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false });
      
      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load POS data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add item to current order
  const addToOrder = (item: MenuItem) => {
    setCurrentOrder(prev => {
      const existingItem = prev.find(orderItem => orderItem.menu_item_id === item.id);
      if (existingItem) {
        return prev.map(orderItem =>
          orderItem.menu_item_id === item.id
            ? { 
                ...orderItem, 
                quantity: orderItem.quantity + 1, 
                total_price: (orderItem.quantity + 1) * orderItem.price 
              }
            : orderItem
        );
      } else {
        return [...prev, {
          id: `temp-${Date.now()}`,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          total_price: item.price
        }];
      }
    });
  };

  // Update order item quantity
  const updateOrderItemQuantity = (menuItemId: string, change: number) => {
    setCurrentOrder(prev => {
      return prev.map(item => {
        if (item.menu_item_id === menuItemId) {
          const newQuantity = Math.max(0, item.quantity + change);
          if (newQuantity === 0) {
            return null;
          }
          return { ...item, quantity: newQuantity, total_price: newQuantity * item.price };
        }
        return item;
      }).filter(Boolean) as OrderItem[];
    });
  };

  // Remove item from order
  const removeFromOrder = (menuItemId: string) => {
    setCurrentOrder(prev => prev.filter(item => item.menu_item_id !== menuItemId));
  };

  // Calculate order total
  const getOrderTotal = () => {
    return currentOrder.reduce((sum, item) => sum + item.total_price, 0);
  };

  // Submit order
  const submitOrder = async () => {
    if (!selectedTable || currentOrder.length === 0) {
      toast({
        title: "Error",
        description: "Please select a table and add items to the order.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('pos_orders')
        .insert({
          table_id: selectedTable.id,
          customer_name: customerName || null,
          notes: orderNotes || null,
          status: 'new'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Add order items
      const orderItems = currentOrder.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total_price,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase
        .from('pos_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Update table status
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', selectedTable.id);

      // Reset form
      setCurrentOrder([]);
      setCustomerName('');
      setOrderNotes('');
      setSelectedTable(null);
      setCurrentView('tables');

      // Reload data
      loadData();

      toast({
        title: "Order Submitted",
        description: `Order for table ${selectedTable.table_number} has been submitted successfully.`,
      });

    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: "Error",
        description: "Failed to submit order. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('pos_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      loadData();

      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });

    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    }
  };

  // Clear table (mark as available after all bills are processed)
  const clearTable = async (tableId: string, tableName: string) => {
    try {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('id', tableId);

      loadData();
      setCurrentView('tables');
      setSelectedTable(null);
      setSelectedOrders([]);

      toast({
        title: "Table Cleared",
        description: `Table ${tableName} has been marked as available.`,
      });

    } catch (error) {
      console.error('Error clearing table:', error);
      toast({
        title: "Error",
        description: "Failed to clear table.",
        variant: "destructive",
      });
    }
  };

  // Helper functions for display
  const getTableStatus = (table: Table) => {
    switch (table.status) {
      case 'available':
        return { color: 'bg-green-500', text: 'Available', bgClass: 'bg-green-50 border-green-200' };
      case 'occupied':
        return { color: 'bg-red-500', text: 'Occupied', bgClass: 'bg-red-50 border-red-200' };
      case 'reserved':
        return { color: 'bg-yellow-500', text: 'Reserved', bgClass: 'bg-yellow-50 border-yellow-200' };
      case 'cleaning':
        return { color: 'bg-blue-500', text: 'Cleaning', bgClass: 'bg-blue-50 border-blue-200' };
      default:
        return { color: 'bg-gray-500', text: 'Unknown', bgClass: 'bg-gray-50 border-gray-200' };
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ready':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'served':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case 'food':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'bar':
        return <Wine className="w-4 h-4" />;
      case 'conference':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Coffee className="w-4 h-4" />;
    }
  };

  // Filter menu items based on search term and category
  const filteredMenuItems = menuItems.filter(item =>
    item.category_id === selectedCategory &&
    (searchTerm === '' || 
     item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Group tables by area
  const tablesByArea = tables.reduce((acc, table) => {
    if (!acc[table.area]) acc[table.area] = [];
    acc[table.area].push(table);
    return acc;
  }, {} as Record<string, Table[]>);

  // Get active orders for a table (now supports multiple orders)
  const getTableOrders = (tableId: string) => {
    return orders.filter(order => order.table_id === tableId && ['new', 'preparing', 'ready', 'served'].includes(order.status));
  };

  // Get total amount for all orders on a table
  const getTableTotal = (tableId: string) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.reduce((sum, order) => sum + order.total, 0);
  };

  // Payment processing function
  const processPayment = async (orderIds: string[], paymentMethod: 'card' | 'mpesa' | 'room', roomNumber?: string) => {
    try {
      // Update orders to paid status
      const { error } = await supabase
        .from('pos_orders')
        .update({ 
          status: 'paid',
          notes: paymentMethod === 'room' ? `Room: ${roomNumber}` : `Payment: ${paymentMethod}`
        })
        .in('id', orderIds);

      if (error) throw error;

      // Get table id from first order to make table available
      const firstOrder = orders.find(o => orderIds.includes(o.id));
      if (firstOrder?.table_id) {
        await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('id', firstOrder.table_id);
      }

      loadData();

      toast({
        title: "Payment Processed",
        description: `Payment via ${paymentMethod} completed successfully.`,
      });

    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Merge multiple orders into one bill
  const mergeOrders = async (orderIds: string[], tableName: string) => {
    try {
      if (orderIds.length < 2) {
        toast({
          title: "Error",
          description: "Select at least 2 orders to merge.",
          variant: "destructive",
        });
        return;
      }

      // Get all order items from the orders to merge
      const { data: orderItems, error: itemsError } = await supabase
        .from('pos_order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // Create a new merged order
      const { data: newOrder, error: orderError } = await supabase
        .from('pos_orders')
        .insert({
          table_id: orders.find(o => orderIds.includes(o.id))?.table_id,
          customer_name: `Merged Bill - ${tableName}`,
          status: 'served',
          notes: `Merged from orders: ${orderIds.join(', ')}`
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Move all items to the new order
      if (orderItems) {
        const updatedItems = orderItems.map(item => ({
          ...item,
          id: undefined, // Let database generate new ID
          order_id: newOrder.id
        }));

        const { error: insertItemsError } = await supabase
          .from('pos_order_items')
          .insert(updatedItems);

        if (insertItemsError) throw insertItemsError;
      }

      // Delete old orders and their items
      const { error: deleteItemsError } = await supabase
        .from('pos_order_items')
        .delete()
        .in('order_id', orderIds);

      if (deleteItemsError) throw deleteItemsError;

      const { error: deleteOrdersError } = await supabase
        .from('pos_orders')
        .delete()
        .in('id', orderIds);

      if (deleteOrdersError) throw deleteOrdersError;

      loadData();

      toast({
        title: "Orders Merged",
        description: `Successfully merged ${orderIds.length} orders into one bill.`,
      });

    } catch (error) {
      console.error('Error merging orders:', error);
      toast({
        title: "Merge Error", 
        description: "Failed to merge orders. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Render tables view
  const renderTablesView = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tables Overview</h1>
        <div className="flex items-center gap-4">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">Reserved</span>
            </div>
          </div>
        </div>
      </div>

      {Object.entries(tablesByArea).map(([area, areaTables]) => (
        <div key={area} className="space-y-4">
          <h2 className="text-xl font-semibold capitalize">{area}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {areaTables.map(table => {
              const status = getTableStatus(table);
              
              
              return (
                <Card 
                  key={table.id} 
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${status.bgClass} ${
                    selectedTable?.id === table.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedTable(table);
                    if (table.status === 'available') {
                      setCurrentView('new-order');
                    } else {
                      setCurrentView('table-bills');
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="text-center space-y-2">
                      <div className={`w-4 h-4 rounded-full ${status.color} mx-auto`}></div>
                      <div className="font-bold text-lg">T{table.table_number}</div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Users className="w-3 h-3" />
                        {table.capacity}
                      </div>
                       <Badge variant="outline" className={`text-xs ${getOrderStatusColor(table.status)}`}>
                        {status.text}
                      </Badge>
                      {(() => {
                        const tableOrders = getTableOrders(table.id);
                        if (tableOrders.length > 0) {
                          return (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                {tableOrders.length} Bill{tableOrders.length > 1 ? 's' : ''}
                              </div>
                              <div className="text-sm font-semibold">
                                ${getTableTotal(table.id).toFixed(2)}
                              </div>
                              {tableOrders.length > 1 && (
                                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                                  Multiple Bills
                                </Badge>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // Calculate time elapsed since order creation
  const getTimeElapsed = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    return diffInMinutes;
  };

  // Get time badge color based on elapsed time
  const getTimeBadgeColor = (minutes: number, status: string) => {
    if (status === 'served' || status === 'paid') return 'bg-gray-500';
    if (minutes <= 4) return 'bg-green-500';
    if (minutes <= 15) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Render orders view
  const renderOrdersView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Current Orders ({orders.length})</h1>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">All</Button>
            <Button variant="outline" size="sm">In Restaurant</Button>
            <Button variant="outline" size="sm">Delivery</Button>
            <Button variant="outline" size="sm">Pick Up</Button>
          </div>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-4">
          {orders.map(order => {
            const table = tables.find(t => t.id === order.table_id);
            const timeElapsed = getTimeElapsed(order.created_at);
            const timeBadgeColor = getTimeBadgeColor(timeElapsed, order.status);
            
            return (
              <Card key={order.id} className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Badge className={`${timeBadgeColor} text-white flex items-center gap-1`}>
                        {order.status === 'served' ? (
                          <Check className="w-3 h-3" />
                        ) : order.status === 'preparing' ? (
                          '🍳'
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {timeElapsed} min
                      </Badge>
                      <Button variant="ghost" size="sm">
                        •••
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <CardTitle className="text-lg">
                      {table ? `Table ${table.table_number}` : order.customer_name || 'Room 101'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {table ? `${table.capacity} Person` : 'Herman Hubanov'}
                    </p>
                    <div className="text-right text-sm text-muted-foreground">
                      #{order.order_number}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.pos_order_items?.map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          🍔
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">x{item.quantity} {item.menu_items?.name || 'Unknown Item'}</div>
                          {item.notes && (
                            <div className="text-sm text-blue-600 flex items-center gap-1">
                              <Plus className="w-3 h-3" />
                              {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {order.notes && (
                      <div className="mt-3 p-2 bg-blue-50 border-l-4 border-blue-400 text-sm">
                        {order.notes}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={() => updateOrderStatus(order.id, order.status === 'new' ? 'preparing' : 'ready')}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={order.status === 'served'}
                      >
                        {order.status === 'new' ? 'Start' : order.status === 'preparing' ? 'Finish' : 'Ready'}
                      </Button>
                      <Button 
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        variant="outline" 
                        className="flex-1"
                        disabled={order.status !== 'ready'}
                      >
                        {order.status === 'served' ? 'Served' : 'Finish'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {orders.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Active Orders</h3>
                <p>New orders will appear here when customers place them</p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Render table bills view
  const renderTableBillsView = () => {
    if (!selectedTable) {
      return (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">Please select a table first</p>
          <Button onClick={() => setCurrentView('tables')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tables
          </Button>
        </div>
      );
    }

    const tableOrders = getTableOrders(selectedTable.id);
    const totalAmount = getTableTotal(selectedTable.id);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            Table {selectedTable.table_number} Bills
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentView('new-order')}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Order
            </Button>
            <Button variant="outline" onClick={() => {
              setCurrentView('tables');
              setSelectedTable(null);
              setSelectedOrders([]);
            }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tables
            </Button>
          </div>
        </div>

        {tableOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Bills for This Table</h3>
              <p>Click "Add New Order" to create the first order</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {/* Summary Card */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Table Summary</span>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {tableOrders.length} Bill{tableOrders.length > 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-2xl font-bold">
                  <span>Total Amount:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
                
                {tableOrders.length > 1 && (
                  <div className="mt-4 flex gap-2">
                    <Button 
                      onClick={() => mergeOrders(selectedOrders.length > 0 ? selectedOrders : tableOrders.map(o => o.id), `T${selectedTable.table_number}`)}
                      variant="outline"
                      disabled={selectedOrders.length === 0 && tableOrders.length < 2}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Merge {selectedOrders.length > 0 ? 'Selected' : 'All'} Bills
                    </Button>
                  </div>
                )}

                {/* Payment Section */}
                <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                  <h3 className="font-semibold mb-3">Process Payment</h3>
                  <div className="grid gap-4">
                    <div className="flex gap-2">
                      <Button
                        variant={paymentMethod === 'card' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('card')}
                        className="flex-1"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Card
                      </Button>
                      <Button
                        variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('mpesa')}
                        className="flex-1"
                      >
                        📱 M-Pesa
                      </Button>
                      <Button
                        variant={paymentMethod === 'room' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('room')}
                        className="flex-1"
                      >
                        🏨 Room
                      </Button>
                    </div>
                    
                    {paymentMethod === 'room' && (
                      <Input
                        placeholder="Enter room number"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                      />
                    )}
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button 
                        onClick={() => {
                          const orderToCheckout = tableOrders.find(o => selectedOrders.includes(o.id)) || tableOrders[0];
                          setCheckoutOrder(orderToCheckout);
                          setCurrentView('checkout');
                        }}
                        disabled={tableOrders.length === 0}
                        size="lg"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Checkout
                      </Button>
                      
                      <Button 
                        onClick={() => clearTable(selectedTable.id, selectedTable.table_number.toString())}
                        variant="outline"
                        size="lg"
                        className="border-green-500 text-green-700 hover:bg-green-50"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Clear Table
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual Bills */}
            <div className="grid gap-4">
              <h3 className="text-xl font-semibold">Individual Bills</h3>
              {tableOrders.map(order => {
                const isSelected = selectedOrders.includes(order.id);
                
                return (
                  <Card 
                    key={order.id} 
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    onClick={() => {
                      setSelectedOrders(prev => 
                        isSelected 
                          ? prev.filter(id => id !== order.id)
                          : [...prev, order.id]
                      );
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-3">
                            <span>Order #{order.order_number}</span>
                            <Badge className={getOrderStatusColor(order.status)}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                            {isSelected && <Badge variant="default">Selected</Badge>}
                          </CardTitle>
                          {order.customer_name && (
                            <p className="text-sm text-muted-foreground">
                              Customer: {order.customer_name}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">${order.total.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">
                            Tax: ${order.tax.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.pos_order_items?.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span>{item.quantity}× {item.menu_items?.name || 'Unknown Item'}</span>
                            <span>${item.total_price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      {order.notes && (
                        <div className="mt-3 p-2 bg-muted rounded text-sm">
                          <strong>Notes:</strong> {order.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render new order view
  const renderNewOrderView = () => {
    if (!selectedTable) {
      return (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">Please select a table first</p>
          <Button onClick={() => setCurrentView('tables')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tables
          </Button>
        </div>
      );
    }

    const subtotal = getOrderTotal();
    const tax = subtotal * 0.085; // 8.5% tax
    const total = subtotal + tax;

    return (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Menu Categories and Items */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">
              New Order - Table {selectedTable.table_number}
            </h1>
            <Button variant="outline" onClick={() => {
              setCurrentView('tables');
              setSelectedTable(null);
              setCurrentOrder([]);
            }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tables
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            {menuCategories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center gap-2"
              >
                {getCategoryIcon(category.name)}
                {category.name}
              </Button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenuItems.map(item => {
              const itemInOrder = currentOrder.find(orderItem => orderItem.menu_item_id === item.id);
              
              return (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      <span className="font-bold text-lg text-primary">${item.price.toFixed(2)}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      {itemInOrder ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOrderItemQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold min-w-[2rem] text-center">
                            {itemInOrder.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOrderItemQuantity(item.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button onClick={() => addToOrder(item)} className="flex-1">
                            <Plus className="w-4 h-4 mr-2" />
                            Add to Order
                          </Button>
                          <Button 
                            onClick={() => setSelectedItemForCustomization(item)} 
                            variant="outline"
                            size="sm"
                          >
                            <Settings className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="xl:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer Name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3">
                  {currentOrder.map(item => (
                    <div key={item.menu_item_id} className="flex justify-between items-start p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-sm text-muted-foreground">
                          ${item.price.toFixed(2)} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="font-bold text-right">
                          ${item.total_price.toFixed(2)}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromOrder(item.menu_item_id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {currentOrder.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No items in order
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="space-y-2">
                <Label htmlFor="order-notes">Special Instructions</Label>
                <Textarea
                  id="order-notes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any special requests..."
                  rows={3}
                />
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (8.5%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <Button 
                onClick={submitOrder} 
                className="w-full" 
                disabled={currentOrder.length === 0}
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Submit Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Render checkout screen
  const renderCheckoutView = () => {
    if (!checkoutOrder || !selectedTable) {
      return (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">No order selected for checkout</p>
          <Button onClick={() => setCurrentView('table-bills')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bills
          </Button>
        </div>
      );
    }

    const orderSubtotal = checkoutOrder.subtotal;
    const orderTax = checkoutOrder.tax;
    const finalTotal = orderSubtotal + orderTax + tips - discount;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Check Out</h1>
          <Button variant="outline" onClick={() => setCurrentView('table-bills')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Table {selectedTable.table_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <div className="font-semibold mb-2">Order: #{checkoutOrder.order_number}</div>
                {checkoutOrder.pos_order_items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <div>
                      <div className="font-medium">{item.menu_items?.name || 'Unknown Item'}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} Units{item.notes && `, Extras: ${item.notes}`}
                      </div>
                    </div>
                    <div className="text-right font-bold">
                      ${item.total_price.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>${orderSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tips</span>
                  <span>${tips.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>$0.00</span>
                </div>
                <div className="flex justify-between font-bold text-xl pt-2 border-t">
                  <span>Amount due</span>
                  <span>${finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Options */}
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total to Pay:</span>
                  <span className="text-3xl font-bold">${finalTotal.toFixed(2)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Including Tips: ${tips.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Discount: %{((discount / orderSubtotal) * 100).toFixed(0)}
                </div>
                
                <div className="flex items-center justify-end space-x-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">Print Check</span>
                    <Switch 
                      checked={printCheck} 
                      onCheckedChange={setPrintCheck}
                    />
                  </div>
                  <X className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setTips(tips + 10);
                  }}
                  variant="outline" 
                  className="w-full"
                >
                  Add Tips
                </Button>
                <Button 
                  onClick={() => {
                    setDiscount(discount + 5);
                  }}
                  variant="outline" 
                  className="w-full"
                >
                  Add Discount
                </Button>
              </div>

              <div className="space-y-3">
                <span className="font-semibold">Pay with:</span>
                <div className="space-y-2">
                  <Button
                    variant={paymentMethod === 'card' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('card')}
                    className="w-full flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Credit Card
                  </Button>
                  <Button
                    variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('mpesa')}
                    className="w-full flex items-center gap-2"
                  >
                    <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white">$</span>
                    </div>
                    Cash
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:bg-red-50 border-red-200"
                >
                  Close without payment
                </Button>
                <Button 
                  onClick={() => {
                    processPayment([checkoutOrder.id], paymentMethod, roomNumber);
                    setCurrentView('tables');
                    setCheckoutOrder(null);
                    setTips(0);
                    setDiscount(0);
                    if (printCheck) {
                      toast({
                        title: "Receipt Printed",
                        description: "Receipt has been sent to printer.",
                      });
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Render item customization dialog
  const renderItemCustomizationDialog = (item: MenuItem) => (
    <Dialog open={selectedItemForCustomization !== null} onOpenChange={() => setSelectedItemForCustomization(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            Select Options & Extras — {item?.name}
            <Button variant="ghost" size="sm" onClick={() => setSelectedItemForCustomization(null)}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Options Section */}
          <div>
            <h3 className="font-semibold mb-4">Options</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Roasting</h4>
                <div className="grid grid-cols-1 gap-2">
                  {['Rare', 'Medium Rare', 'Medium Well', 'Medium', 'Well Done'].map((option) => (
                    <Button
                      key={option}
                      variant={customizationOptions.roasting === option ? 'default' : 'outline'}
                      onClick={() => setCustomizationOptions(prev => ({ ...prev, roasting: option }))}
                      className="text-left justify-start"
                    >
                      {option}
                      <span className="ml-auto">$0.00</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Bun</h4>
                <Button variant="outline" className="w-full justify-start">
                  Regular Bun
                  <span className="ml-auto">$0.00</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Extras Section */}
          <div>
            <h3 className="font-semibold mb-4">Extras</h3>
            <div className="grid grid-cols-3 gap-4">
              <Button variant="outline" className="justify-start">
                All
              </Button>
              <Button 
                variant={customizationOptions.sauce === 'cheese' ? 'default' : 'outline'}
                onClick={() => setCustomizationOptions(prev => ({ ...prev, sauce: 'cheese' }))}
                className="justify-start flex-col h-auto p-4"
              >
                <span>Sauce</span>
                <span className="text-xs">Cheese Sauce</span>
                <div className="flex items-center justify-between w-full mt-2">
                  <span className="text-sm line-through text-muted-foreground">$3.00</span>
                  <span className="text-sm text-red-600">$2.00</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span>1</span>
                  <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </Button>
              <Button variant="outline" className="justify-start flex-col h-auto p-4">
                <span>Tomatoes</span>
                <span className="text-sm mt-1">$2.00</span>
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Button variant="outline" className="justify-start flex-col h-auto p-4">
                <span>Tomato Sauce</span>
                <span className="text-sm mt-1">$3.00</span>
              </Button>
              <Button variant="outline" className="justify-start flex-col h-auto p-4">
                <span>Garlic Sauce</span>
                <span className="text-sm mt-1">$2.00</span>
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setSelectedItemForCustomization(null)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (item) {
                addToOrder(item);
                setSelectedItemForCustomization(null);
                setCustomizationOptions({});
              }
            }}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading POS system...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header Navigation */}
        <div className="mb-6">
          <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)}>
            <TabsList className="grid w-full grid-cols-2 max-w-lg">
              <TabsTrigger value="tables" className="text-base">
                Tables
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-base">
                Active Orders ({orders.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content */}
        {currentView === 'tables' && renderTablesView()}
        {currentView === 'orders' && renderOrdersView()}
        {currentView === 'new-order' && renderNewOrderView()}
        {currentView === 'table-bills' && renderTableBillsView()}
        {currentView === 'checkout' && renderCheckoutView()}
        
        {/* Item Customization Dialog */}
        {selectedItemForCustomization && renderItemCustomizationDialog(selectedItemForCustomization)}
      </div>
    </div>
  );
}