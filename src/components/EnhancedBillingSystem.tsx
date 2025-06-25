
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, CreditCard, FileText, DollarSign, Calendar, Trash2, Edit } from "lucide-react";

const EnhancedBillingSystem = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGuest, setSelectedGuest] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([
    { id: 1, description: "Room Charges", quantity: 3, rate: 15000, amount: 45000 }
  ]);
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 1,
    rate: 0
  });

  const availableItems = [
    { name: "Room Charges", rate: 15000 },
    { name: "Restaurant Bill", rate: 2500 },
    { name: "Laundry Services", rate: 500 },
    { name: "Spa Services", rate: 3500 },
    { name: "Transport Services", rate: 1500 },
    { name: "Wi-Fi Premium", rate: 200 },
    { name: "Minibar", rate: 800 },
    { name: "Conference Room", rate: 5000 },
    { name: "Extra Bed", rate: 2000 },
    { name: "Late Checkout", rate: 1000 }
  ];

  const invoices = [
    {
      id: "INV001",
      guestName: "John Doe",
      roomNumber: "101",
      checkIn: "2025-06-20",
      checkOut: "2025-06-25",
      status: "Paid",
      totalAmount: "KES 47,500",
      paymentMethod: "Credit Card",
      issueDate: "2025-06-25"
    },
    {
      id: "INV002",
      guestName: "Jane Smith",
      roomNumber: "201",
      checkIn: "2025-06-22",
      checkOut: "2025-06-24",
      status: "Pending",
      totalAmount: "KES 25,000",
      paymentMethod: "Cash",
      issueDate: "2025-06-24"
    },
    {
      id: "INV003",
      guestName: "Mike Johnson",
      roomNumber: "203",
      checkIn: "2025-06-21",
      checkOut: "2025-06-26",
      status: "Overdue",
      totalAmount: "KES 67,500",
      paymentMethod: "Bank Transfer",
      issueDate: "2025-06-26"
    }
  ];

  const addItemToInvoice = () => {
    if (newItem.description && newItem.rate > 0) {
      const item = {
        id: invoiceItems.length + 1,
        description: newItem.description,
        quantity: newItem.quantity,
        rate: newItem.rate,
        amount: newItem.quantity * newItem.rate
      };
      setInvoiceItems([...invoiceItems, item]);
      setNewItem({ description: "", quantity: 1, rate: 0 });
    }
  };

  const removeItemFromInvoice = (itemId: number) => {
    setInvoiceItems(invoiceItems.filter(item => item.id !== itemId));
  };

  const selectPresetItem = (itemName: string) => {
    const preset = availableItems.find(item => item.name === itemName);
    if (preset) {
      setNewItem({
        description: preset.name,
        quantity: 1,
        rate: preset.rate
      });
    }
  };

  const getTotalAmount = () => {
    return invoiceItems.reduce((total, item) => total + item.amount, 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Overdue": return "bg-red-100 text-red-800";
      case "Cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.roomNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-600">Manage invoices, payments, and guest billing</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>Generate a new invoice for guest charges</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Guest Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guestSelect">Select Guest</Label>
                  <Select value={selectedGuest} onValueChange={setSelectedGuest}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a guest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="john-doe">John Doe - Room 101</SelectItem>
                      <SelectItem value="jane-smith">Jane Smith - Room 201</SelectItem>
                      <SelectItem value="mike-johnson">Mike Johnson - Room 203</SelectItem>
                      <SelectItem value="sarah-wilson">Sarah Wilson - Room 301</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Credit/Debit Card</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="mobile">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Invoice Items</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addItemToInvoice}
                    disabled={!newItem.description || newItem.rate <= 0}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>

                {/* Quick Add Preset Items */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableItems.map((item) => (
                    <Button
                      key={item.name}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => selectPresetItem(item.name)}
                      className="text-xs p-2 h-auto"
                    >
                      {item.name}
                      <br />
                      <span className="text-muted-foreground">KES {item.rate.toLocaleString()}</span>
                    </Button>
                  ))}
                </div>

                {/* Add New Item Form */}
                <div className="grid grid-cols-4 gap-2 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="itemDescription" className="text-xs">Description</Label>
                    <Input
                      id="itemDescription"
                      placeholder="Item description"
                      value={newItem.description}
                      onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemQuantity" className="text-xs">Quantity</Label>
                    <Input
                      id="itemQuantity"
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="itemRate" className="text-xs">Rate (KES)</Label>
                    <Input
                      id="itemRate"
                      type="number"
                      min="0"
                      value={newItem.rate || ''}
                      onChange={(e) => setNewItem({...newItem, rate: parseFloat(e.target.value) || 0})}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <div className="h-8 flex items-center text-sm font-medium">
                      KES {(newItem.quantity * newItem.rate).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Invoice Items List */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Description</th>
                        <th className="text-center p-3 text-sm font-medium">Qty</th>
                        <th className="text-right p-3 text-sm font-medium">Rate</th>
                        <th className="text-right p-3 text-sm font-medium">Amount</th>
                        <th className="text-center p-3 text-sm font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">{item.description}</td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-right">KES {item.rate.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium">KES {item.amount.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItemFromInvoice(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={3} className="p-3 font-medium text-right">Total:</td>
                        <td className="p-3 text-right font-bold text-lg">KES {getTotalAmount().toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <Label htmlFor="invoiceNotes">Notes</Label>
                <Textarea 
                  id="invoiceNotes" 
                  placeholder="Additional notes or payment terms"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline">Save as Draft</Button>
              <Button>Generate Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search invoices by guest name, invoice ID, or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <Select>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredInvoices.map((invoice) => (
          <Card key={invoice.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                <div>
                  <div className="font-semibold text-slate-800">{invoice.id}</div>
                  <div className="text-sm text-slate-600">{invoice.guestName}</div>
                  <div className="text-sm text-slate-500">Room {invoice.roomNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Stay Period</div>
                  <div className="font-medium">{invoice.checkIn}</div>
                  <div className="font-medium">to {invoice.checkOut}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Amount</div>
                  <div className="text-lg font-bold text-slate-800">{invoice.totalAmount}</div>
                  <div className="text-sm text-slate-500">{invoice.paymentMethod}</div>
                </div>
                <div>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status}
                  </Badge>
                  <div className="text-sm text-slate-500 mt-1">Issued: {invoice.issueDate}</div>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <FileText className="mr-1 h-3 w-3" />
                    View
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <CreditCard className="mr-1 h-3 w-3" />
                    Payment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">KES 45,250</div>
            <div className="text-sm opacity-90">Today's Revenue</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === "Paid").length}
            </div>
            <div className="text-sm opacity-90">Paid Invoices</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === "Pending").length}
            </div>
            <div className="text-sm opacity-90">Pending Payments</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === "Overdue").length}
            </div>
            <div className="text-sm opacity-90">Overdue</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedBillingSystem;
