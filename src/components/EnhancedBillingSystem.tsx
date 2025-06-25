
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CreditCard, DollarSign, FileText, Plus, Search, Trash2, Eye, CheckCircle } from "lucide-react";

const EnhancedBillingSystem = () => {
  const [activeTab, setActiveTab] = useState("invoices");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newInvoiceItems, setNewInvoiceItems] = useState([
    { description: "", quantity: 1, rate: 0, amount: 0 }
  ]);

  const invoices = [
    {
      id: "INV001",
      guestName: "John Doe",
      roomNumber: "101",
      issueDate: "2025-06-24",
      dueDate: "2025-06-28",
      totalAmount: 45000,
      paidAmount: 45000,
      status: "Paid",
      items: [
        { description: "Room Charges (3 nights)", quantity: 3, rate: 12000, amount: 36000 },
        { description: "Breakfast", quantity: 6, rate: 1500, amount: 9000 }
      ]
    },
    {
      id: "INV002",
      guestName: "Jane Smith",
      roomNumber: "205",
      issueDate: "2025-06-23",
      dueDate: "2025-06-27",
      totalAmount: 32000,
      paidAmount: 15000,
      status: "Partial",
      items: [
        { description: "Room Charges (2 nights)", quantity: 2, rate: 10000, amount: 20000 },
        { description: "Spa Services", quantity: 1, rate: 8000, amount: 8000 },
        { description: "Mini Bar", quantity: 1, rate: 4000, amount: 4000 }
      ]
    },
    {
      id: "INV003",
      guestName: "Mike Johnson",
      roomNumber: "301",
      issueDate: "2025-06-25",
      dueDate: "2025-06-29",
      totalAmount: 60000,
      paidAmount: 0,
      status: "Pending",
      items: [
        { description: "Executive Suite (3 nights)", quantity: 3, rate: 18000, amount: 54000 },
        { description: "Room Service", quantity: 1, rate: 6000, amount: 6000 }
      ]
    }
  ];

  const filteredInvoices = invoices.filter(invoice =>
    invoice.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.roomNumber.includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-800";
      case "Partial": return "bg-yellow-100 text-yellow-800";
      case "Pending": return "bg-red-100 text-red-800";
      case "Overdue": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewInvoice = (invoice: any) => {
    console.log("Viewing invoice:", invoice.id);
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleProcessPayment = (invoice: any) => {
    console.log("Processing payment for invoice:", invoice.id);
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const addNewItem = () => {
    setNewInvoiceItems([...newInvoiceItems, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (newInvoiceItems.length > 1) {
      const items = newInvoiceItems.filter((_, i) => i !== index);
      setNewInvoiceItems(items);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...newInvoiceItems];
    items[index] = { ...items[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      items[index].amount = items[index].quantity * items[index].rate;
    }
    
    setNewInvoiceItems(items);
  };

  const getTotalAmount = () => {
    return newInvoiceItems.reduce((total, item) => total + item.amount, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-600">Manage invoices, payments, and financial transactions</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-emerald-600">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>Generate a new invoice for guest services</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Guest Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guestName">Guest Name</Label>
                  <Input id="guestName" placeholder="John Doe" />
                </div>
                <div>
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="101">Room 101</SelectItem>
                      <SelectItem value="102">Room 102</SelectItem>
                      <SelectItem value="201">Room 201</SelectItem>
                      <SelectItem value="205">Room 205</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input id="issueDate" type="date" />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" />
                </div>
              </div>

              <Separator />

              {/* Invoice Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Invoice Items</h3>
                  <Button onClick={addNewItem} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {newInvoiceItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-5">
                        <Label htmlFor={`description-${index}`}>Description</Label>
                        <Input
                          id={`description-${index}`}
                          placeholder="Room charges, services, etc."
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`rate-${index}`}>Rate (KES)</Label>
                        <Input
                          id={`rate-${index}`}
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Amount (KES)</Label>
                        <Input value={item.amount.toLocaleString()} readOnly className="bg-gray-50" />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={newInvoiceItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-lg font-semibold">
                      Total Amount: KES {getTotalAmount().toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">Save as Draft</Button>
                <Button onClick={() => alert('Invoice created successfully!')}>
                  Create Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Tabs */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search invoices by guest name, invoice ID, or room number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="invoices">All Invoices</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredInvoices.map((invoice) => (
          <Card key={invoice.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-800">{invoice.guestName}</h3>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      Invoice {invoice.id} • Room {invoice.roomNumber}
                    </p>
                    <div className="text-sm text-slate-600">
                      <p>Issue Date: {invoice.issueDate} | Due Date: {invoice.dueDate}</p>
                      <p>Paid: KES {invoice.paidAmount.toLocaleString()} / KES {invoice.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-right mr-4">
                    <p className="text-2xl font-bold text-slate-800">
                      KES {invoice.totalAmount.toLocaleString()}
                    </p>
                    {invoice.status !== "Paid" && (
                      <p className="text-sm text-red-600">
                        Outstanding: KES {(invoice.totalAmount - invoice.paidAmount).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewInvoice(invoice)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                    {invoice.status !== "Paid" && (
                      <Button 
                        size="sm"
                        onClick={() => handleProcessPayment(invoice)}
                      >
                        <CreditCard className="mr-1 h-4 w-4" />
                        Payment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle>Invoice Details - {selectedInvoice.id}</DialogTitle>
                <DialogDescription>Complete invoice information</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Bill To:</h3>
                    <p className="font-medium">{selectedInvoice.guestName}</p>
                    <p className="text-sm text-slate-600">Room {selectedInvoice.roomNumber}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-semibold text-lg mb-2">Invoice Details:</h3>
                    <p><strong>Invoice ID:</strong> {selectedInvoice.id}</p>
                    <p><strong>Issue Date:</strong> {selectedInvoice.issueDate}</p>
                    <p><strong>Due Date:</strong> {selectedInvoice.dueDate}</p>
                    <Badge className={getStatusColor(selectedInvoice.status) + " mt-2"}>
                      {selectedInvoice.status}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-4">Invoice Items</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-4 font-medium text-sm text-slate-600 pb-2 border-b">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-center">Quantity</div>
                      <div className="col-span-2 text-right">Rate</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>
                    {selectedInvoice.items.map((item: any, index: number) => (
                      <div key={index} className="grid grid-cols-12 gap-4 py-2">
                        <div className="col-span-6">{item.description}</div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-right">KES {item.rate.toLocaleString()}</div>
                        <div className="col-span-2 text-right">KES {item.amount.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <div className="text-right space-y-2">
                    <p className="text-lg"><strong>Total Amount: KES {selectedInvoice.totalAmount.toLocaleString()}</strong></p>
                    <p className="text-sm text-slate-600">Paid Amount: KES {selectedInvoice.paidAmount.toLocaleString()}</p>
                    {selectedInvoice.status !== "Paid" && (
                      <p className="text-sm font-medium text-red-600">
                        Outstanding: KES {(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                <Button variant="outline">Print Invoice</Button>
                {selectedInvoice.status !== "Paid" && (
                  <Button onClick={() => handleProcessPayment(selectedInvoice)}>
                    Process Payment
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle>Process Payment</DialogTitle>
                <DialogDescription>Record payment for invoice {selectedInvoice.id}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Invoice Total</Label>
                  <Input value={`KES ${selectedInvoice.totalAmount.toLocaleString()}`} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Amount Paid</Label>
                  <Input value={`KES ${selectedInvoice.paidAmount.toLocaleString()}`} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Outstanding Amount</Label>
                  <Input 
                    value={`KES ${(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString()}`} 
                    readOnly 
                    className="bg-red-50 text-red-700 font-medium" 
                  />
                </div>
                <div>
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <Input 
                    id="paymentAmount" 
                    type="number" 
                    placeholder="Enter payment amount" 
                    max={selectedInvoice.totalAmount - selectedInvoice.paidAmount}
                  />
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
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  alert('Payment processed successfully!');
                  setIsPaymentDialogOpen(false);
                }}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Process Payment
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Total Revenue</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.reduce((sum, inv) => sum + inv.paidAmount, 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Total Paid</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Outstanding</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{invoices.length}</div>
            <div className="text-sm opacity-90">Total Invoices</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedBillingSystem;
