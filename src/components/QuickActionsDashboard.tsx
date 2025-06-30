
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Zap, MessageSquare, ClipboardCheck, AlertTriangle, Clock, 
  Users, Bed, Coffee, Wrench, DollarSign, Calendar, Send,
  CheckCircle, XCircle, Phone, Mail, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QuickActionsDashboard = () => {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedGuest, setSelectedGuest] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("sms");
  const [showRoomDialog, setShowRoomDialog] = useState(false);
  const [showSupplyDialog, setShowSupplyDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { toast } = useToast();

  // Quick action statistics
  const quickStats = {
    pendingTasks: 8,
    lowInventory: 3,
    maintenanceAlerts: 2,
    guestRequests: 5,
    checkinsToday: 12,
    checkoutsToday: 8
  };

  const messageTemplates = [
    { id: "welcome", title: "Welcome Message", content: "Welcome to Olsupat Lodge! We're delighted to have you stay with us. If you need anything during your stay, please don't hesitate to contact our front desk." },
    { id: "checkout", title: "Checkout Reminder", content: "Thank you for staying with us! Please note that checkout time is 11:00 AM. If you need a late checkout, please contact the front desk." },
    { id: "maintenance", title: "Maintenance Notice", content: "We apologize for any inconvenience. Our maintenance team is working to resolve the issue as quickly as possible. We'll keep you updated on the progress." },
    { id: "amenity", title: "Amenity Information", content: "Our restaurant is open from 7:00 AM to 10:00 PM. Room service is available 24/7. The fitness center is located on the 2nd floor and is open 24 hours." },
    { id: "feedback", title: "Feedback Request", content: "We hope you're enjoying your stay! We'd love to hear your feedback. Please let us know if there's anything we can do to make your experience even better." }
  ];

  const rooms = ["101", "102", "103", "201", "202", "203", "301", "302", "303"];
  const guests = ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson", "David Brown"];

  const handleRoomStatusCheck = () => {
    setShowRoomDialog(true);
  };

  const handleHousekeepingDispatch = () => {
    if (!selectedRoom) {
      toast({
        title: "Room Required",
        description: "Please select a room for housekeeping",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Housekeeping Dispatched",
      description: `Housekeeping team has been sent to Room ${selectedRoom}`,
    });
    setSelectedRoom("");
  };

  const handleSupplyOrder = () => {
    setShowSupplyDialog(true);
  };

  const handleMaintenanceSchedule = () => {
    setShowMaintenanceDialog(true);
  };

  const handlePaymentProcess = () => {
    setShowPaymentDialog(true);
  };

  const handleCalendarUpdate = () => {
    toast({
      title: "Calendar Updated",
      description: "Room availability calendar has been refreshed",
    });
  };

  const quickActions = [
    { title: "Check Room Status", icon: Bed, color: "blue", action: handleRoomStatusCheck },
    { title: "Send Housekeeping", icon: Users, color: "green", action: handleHousekeepingDispatch },
    { title: "Order Supplies", icon: Coffee, color: "orange", action: handleSupplyOrder },
    { title: "Schedule Maintenance", icon: Wrench, color: "red", action: handleMaintenanceSchedule },
    { title: "Process Payment", icon: DollarSign, color: "purple", action: handlePaymentProcess },
    { title: "Update Calendar", icon: Calendar, color: "indigo", action: handleCalendarUpdate }
  ];

  const handleSendMessage = () => {
    if (!selectedTemplate && !customMessage) {
      toast({
        title: "Error",
        description: "Please select a template or write a custom message",
        variant: "destructive",
      });
      return;
    }

    if (!selectedGuest) {
      toast({
        title: "Error",
        description: "Please select a guest to send the message to",
        variant: "destructive",
      });
      return;
    }

    const messageContent = selectedTemplate 
      ? messageTemplates.find(t => t.id === selectedTemplate)?.content || ""
      : customMessage;

    toast({
      title: "Message Sent",
      description: `Message sent to ${selectedGuest} via ${selectedMethod.toUpperCase()}`,
    });
    setCustomMessage("");
    setSelectedTemplate("");
    setSelectedGuest("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Quick Actions</h1>
          <p className="text-slate-600 dark:text-slate-400">Streamline your daily operations with one-click actions</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Clock className="mr-1 h-3 w-3" />
          {new Date().toLocaleDateString()}
        </Badge>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-700">{quickStats.maintenanceAlerts}</p>
            <p className="text-xs text-red-600">Urgent Issues</p>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="p-4 text-center">
            <Coffee className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-yellow-700">{quickStats.lowInventory}</p>
            <p className="text-xs text-yellow-600">Low Stock</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
          <CardContent className="p-4 text-center">
            <MessageCircle className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-700">{quickStats.guestRequests}</p>
            <p className="text-xs text-blue-600">Guest Requests</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-700">{quickStats.checkinsToday}</p>
            <p className="text-xs text-green-600">Check-ins</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 text-purple-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-purple-700">{quickStats.checkoutsToday}</p>
            <p className="text-xs text-purple-600">Check-outs</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardContent className="p-4 text-center">
            <ClipboardCheck className="h-6 w-6 text-orange-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-orange-700">{quickStats.pendingTasks}</p>
            <p className="text-xs text-orange-600">Pending Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="mr-2 h-5 w-5" />
            One-Click Actions
          </CardTitle>
          <CardDescription>Perform common tasks with a single click</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center space-y-2 hover:scale-105 transition-transform"
                onClick={action.action}
              >
                <action.icon className={`h-6 w-6 text-${action.color}-600`} />
                <span className="text-xs text-center">{action.title}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Communication Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="mr-2 h-5 w-5" />
            Quick Communication
          </CardTitle>
          <CardDescription>Send pre-written messages to guests instantly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Guest</label>
              <Select value={selectedGuest} onValueChange={setSelectedGuest}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose guest..." />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((guest) => (
                    <SelectItem key={guest} value={guest}>
                      {guest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Message Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {messageTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Send Method</label>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant={selectedMethod === "sms" ? "default" : "outline"} 
                  className="flex-1"
                  onClick={() => setSelectedMethod("sms")}
                >
                  <Phone className="mr-1 h-3 w-3" />
                  SMS
                </Button>
                <Button 
                  size="sm" 
                  variant={selectedMethod === "email" ? "default" : "outline"} 
                  className="flex-1"
                  onClick={() => setSelectedMethod("email")}
                >
                  <Mail className="mr-1 h-3 w-3" />
                  Email
                </Button>
                <Button 
                  size="sm" 
                  variant={selectedMethod === "app" ? "default" : "outline"} 
                  className="flex-1"
                  onClick={() => setSelectedMethod("app")}
                >
                  <MessageCircle className="mr-1 h-3 w-3" />
                  App
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Message Preview</label>
            <Textarea
              placeholder="Write a custom message or select a template above..."
              value={
                selectedTemplate 
                  ? messageTemplates.find(t => t.id === selectedTemplate)?.content || ""
                  : customMessage
              }
              onChange={(e) => {
                if (!selectedTemplate) {
                  setCustomMessage(e.target.value);
                }
              }}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {selectedTemplate ? "Using template" : "Custom message"}
            </div>
            <Button onClick={handleSendMessage}>
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
          <CardDescription>Your recent quick actions for reference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { time: "2 min ago", action: "Sent welcome message to Room 201", user: "You" },
              { time: "5 min ago", action: "Dispatched housekeeping to Room 105", user: "You" },
              { time: "8 min ago", action: "Ordered bathroom supplies", user: "You" },
              { time: "12 min ago", action: "Scheduled AC maintenance for Room 304", user: "You" },
              { time: "15 min ago", action: "Processed payment for Booking #1234", user: "You" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.time} • {item.user}</p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <Dialog open={showRoomDialog} onOpenChange={setShowRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Room Status Check</DialogTitle>
            <DialogDescription>Select a room to check its current status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="room-select">Room Number</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room} value={room}>
                      Room {room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => {
              if (selectedRoom) {
                toast({
                  title: "Room Status Updated",
                  description: `Room ${selectedRoom} status has been checked and updated`,
                });
                setShowRoomDialog(false);
                setSelectedRoom("");
              }
            }}>
              Check Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplyDialog} onOpenChange={setShowSupplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Supplies</DialogTitle>
            <DialogDescription>Place a new supply order</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="supply-type">Supply Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select supply type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="towels">Towels</SelectItem>
                  <SelectItem value="toiletries">Toiletries</SelectItem>
                  <SelectItem value="linens">Bed Linens</SelectItem>
                  <SelectItem value="cleaning">Cleaning Supplies</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input type="number" placeholder="Enter quantity" />
            </div>
            <Button onClick={() => {
              toast({
                title: "Supply Order Created",
                description: "Your supply order has been submitted successfully",
              });
              setShowSupplyDialog(false);
            }}>
              Place Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
            <DialogDescription>Create a new maintenance request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="maintenance-room">Room Number</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select room..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room} value={room}>
                      Room {room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="issue-type">Issue Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select issue type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ac">Air Conditioning</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea placeholder="Describe the issue..." />
            </div>
            <Button onClick={() => {
              toast({
                title: "Maintenance Scheduled",
                description: "Maintenance request has been created and assigned",
              });
              setShowMaintenanceDialog(false);
            }}>
              Schedule Maintenance
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>Process a guest payment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-guest">Guest</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select guest..." />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((guest) => (
                    <SelectItem key={guest} value={guest}>
                      {guest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input type="number" placeholder="Enter amount" />
            </div>
            <div>
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => {
              toast({
                title: "Payment Processed",
                description: "Payment has been successfully processed",
              });
              setShowPaymentDialog(false);
            }}>
              Process Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickActionsDashboard;
