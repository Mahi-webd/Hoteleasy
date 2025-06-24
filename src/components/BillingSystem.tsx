
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Plus, Search, Download, Eye, Receipt, Smartphone, Banknote } from "lucide-react";

const BillingSystem = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const invoices = [
    {
      id: "INV-001",
      guestName: "John Doe",
      room: "101",
      checkIn: "2025-06-20",
      checkOut: "2025-06-25",
      items: [
        { description: "Room Charges (5 nights)", amount: 40000, quantity: 5 },
        { description: "Restaurant", amount: 8500, quantity: 1 },
        { description: "Minibar", amount: 2800, quantity: 1 },
        { description: "Spa Services", amount: 6000, quantity: 1 }
      ],
      subtotal: 57300,
      vat: 9168,
      total: 66468,
      status: "Paid",
      paymentMethod: "M-Pesa",
      paymentDate: "2025-06-25"
    },
    {
      id: "INV-002",
      guestName: "Jane Smith",
      room: "201",
      checkIn: "2025-06-22",
      checkOut: "2025-06-24",
      items: [
        { description: "Room Charges (2 nights)", amount: 24000, quantity: 2 },
        { description: "Laundry Service", amount: 1500, quantity: 1 }
      ],
      subtotal: 25500,
      vat: 4080,
      total: 29580,
      status: "Pending",
      paymentMethod: null,
      paymentDate: null
    },
    {
      id: "INV-003",
      guestName: "Mike Johnson",
      room: "203",
      checkIn: "2025-06-21",
      checkOut: "2025-06-26",
      items: [
        { description: "Room Charges (5 nights)", amount: 75000, quantity: 5 },
        { description: "Conference Room", amount: 15000, quantity: 1 },
        { description: "Catering", amount: 25000, quantity: 1 }
      ],
      subtotal: 115000,
      vat: 18400,
      total: 133400,
      status: "Partially Paid",
      paymentMethod: "Credit Card",
      paymentDate: "2025-06-24"
    }
  ];

  const paymentMethods = [
    { id: "mpesa", name: "M-Pesa", icon: Smartphone, color: "bg-green-500" },
    { id: "card", name: "Credit/Debit Card", icon: CreditCard, color: "bg-blue-500" },
    { id: "cash", name: "Cash", icon: Banknote, color: "bg-yellow-500" },
    { id: "bank", name: "Bank Transfer", icon: Receipt, color: "bg-purple-500" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Overdue": return "bg-red-100 text-red-800";
      case "Partially Paid": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.room.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-600">Manage invoices, payments, and billing processes</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>Generate a new bill for guest services</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Guest Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guest">Guest</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select guest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="john-doe">John Doe - Room 101</SelectItem>
                      <SelectItem value="jane-smith">Jane Smith - Room 201</SelectItem>
                      <SelectItem value="mike-johnson">Mike Johnson - Room 203</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="room">Room</Label>
                  <Input id="room" value="101" disabled />
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <Label className="text-base font-semibold">Invoice Items</Label>
                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-600">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2">Quantity</div>
                    <div className="col-span-2">Rate (KES)</div>
                    <div className="col-span-2">Amount (KES)</div>
                  </div>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <Select>
                      <SelectTrigger className="col-span-6">
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room">Room Charges</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="minibar">Minibar</SelectItem>
                        <SelectItem value="spa">Spa Services</SelectItem>
                        <SelectItem value="laundry">Laundry</SelectItem>
                        <SelectItem value="conference">Conference Room</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="col-span-2" placeholder="1" type="number" />
                    <Input className="col-span-2" placeholder="0" type="number" />
                    <Input className="col-span-2" placeholder="0" disabled />
                  </div>
                  
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>KES 0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (16%):</span>
                    <span>KES 0.00</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>KES 0.00</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">Save Draft</Button>
                <Button className="bg-green-600 hover:bg-green-700">Generate Invoice</Button>
              </div>
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
                <SelectItem value="partial">Partially Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Quick Access */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {paymentMethods.map((method) => (
              <Button
                key={method.id}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-slate-50"
              >
                <div className={`${method.color} p-2 rounded-lg`}>
                  <method.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">{method.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.map((invoice) => (
          <Card key={invoice.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-bold text-slate-800">{invoice.id}</h3>
                    <Badge className={getStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-slate-600">
                    {invoice.guestName} • Room {invoice.room} • {invoice.checkIn} to {invoice.checkOut}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-800">
                    KES {invoice.total.toLocaleString()}
                  </div>
                  {invoice.paymentMethod && (
                    <p className="text-sm text-slate-600">
                      Paid via {invoice.paymentMethod}
                    </p>
                  )}
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-slate-800">Items:</h4>
                {invoice.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-slate-50 p-2 rounded">
                    <span>{item.description}</span>
                    <span>KES {item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-slate-100 p-3 rounded-lg mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Subtotal:</span>
                  <span>KES {invoice.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>VAT (16%):</span>
                  <span>KES {invoice.vat.toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>KES {invoice.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline">
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="mr-1 h-3 w-3" />
                    Download
                  </Button>
                </div>
                {invoice.status !== "Paid" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    <CreditCard className="mr-1 h-3 w-3" />
                    Process Payment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.total, 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Total Paid</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.filter(i => i.status === "Pending").reduce((sum, i) => sum + i.total, 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === "Partially Paid").length}
            </div>
            <div className="text-sm opacity-90">Partial Payments</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              KES {invoices.reduce((sum, i) => sum + i.total, 0).toLocaleString()}
            </div>
            <div className="text-sm opacity-90">Total Revenue</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillingSystem;
