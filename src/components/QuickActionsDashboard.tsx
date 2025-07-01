import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Home, Users, MessageCircle, Package, Wrench, Phone, Mail, CreditCard, AlertTriangle, CheckCircle, Clock, DollarSign, Settings, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QuickActionsDashboard = () => {
  const { toast } = useToast();
  const [showGuestCommunication, setShowGuestCommunication] = useState(false);
  const [showRoomStatus, setShowRoomStatus] = useState(false);
  const [showSupplyOrder, setShowSupplyOrder] = useState(false);
  const [showMaintenanceSchedule, setShowMaintenanceSchedule] = useState(false);
  const [showPaymentProcess, setShowPaymentProcess] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [roomStatusInfo, setRoomStatusInfo] = useState(null);

  // Mock data
  const guests = [
    { id: 1, name: "John Doe", room: "101", email: "john@email.com", phone: "+254712345678" },
    { id: 2, name: "Jane Smith", room: "201", email: "jane@email.com", phone: "+254723456789" },
    { id: 3, name: "Mike Johnson", room: "203", email: "mike@email.com", phone: "+254734567890" },
  ];

  const rooms = [
    { number: "101", type: "Standard Single", status: "occupied", guest: "John Doe", floor: 1, rate: "KES 8,000", capacity: 1, smoking: false },
    { number: "102", type: "Standard Double", status: "available", guest: null, floor: 1, rate: "KES 12,000", capacity: 2, smoking: false },
    { number: "103", type: "Deluxe Double", status: "cleaning", guest: null, floor: 1, rate: "KES 15,000", capacity: 2, smoking: true },
    { number: "201", type: "Standard Single", status: "occupied", guest: "Jane Smith", floor: 2, rate: "KES 8,000", capacity: 1, smoking: false },
    { number: "202", type: "Standard Double", status: "available", guest: null, floor: 2, rate: "KES 12,000", capacity: 2, smoking: false },
    { number: "203", type: "Deluxe Double", status: "occupied", guest: "Mike Johnson", floor: 2, rate: "KES 15,000", capacity: 2, smoking: false },
  ];

  const handleRoomStatusCheck = (roomNumber: string) => {
    const room = rooms.find(r => r.number === roomNumber);
    if (room) {
      setRoomStatusInfo(room);
      toast({
        title: "Room Status Retrieved",
        description: `Room ${roomNumber}: ${room.status} - ${room.type}`,
      });
    } else {
      toast({
        title: "Room Not Found",
        description: `Room ${roomNumber} does not exist`,
        variant: "destructive",
      });
    }
  };

  const communicationTemplates = [
    { id: 1, name: "Welcome Message", content: "Welcome to Olsupat Lodge! We hope you enjoy your stay. Please don't hesitate to contact us if you need anything." },
    { id: 2, name: "Checkout Reminder", content: "This is a friendly reminder that your checkout time is 11:00 AM. Please let us know if you need a late checkout." },
    { id: 3, name: "Service Follow-up", content: "Thank you for using our room service. We hope everything was to your satisfaction. Please rate your experience." },
    { id: 4, name: "Maintenance Notice", content: "We will be performing brief maintenance in your area. We apologize for any inconvenience and appreciate your patience." },
  ];

  const handleGuestCommunication = (guestId: string, template: string, method: string) => {
    const guest = guests.find(g => g.id.toString() === guestId);
    const templateContent = communicationTemplates.find(t => t.id.toString() === template);
    
    if (guest && templateContent) {
      toast({
        title: "Message Sent",
        description: `${templateContent.name} sent to ${guest.name} via ${method}`,
      });
      setShowGuestCommunication(false);
    }
  };

  const handleHousekeepingDispatch = () => {
    toast({
      title: "Housekeeping Dispatched",
      description: "Housekeeping team has been notified and dispatched to the requested rooms",
    });
  };

  const handleSupplyOrder = (supplier: string, items: string, priority: string) => {
    toast({
      title: "Supply Order Placed",
      description: `Order placed with ${supplier} - Priority: ${priority}`,
    });
    setShowSupplyOrder(false);
  };

  const handleMaintenanceSchedule = (type: string, room: string, priority: string, description: string) => {
    toast({
      title: "Maintenance Scheduled",
      description: `${type} maintenance scheduled for Room ${room} - Priority: ${priority}`,
    });
    setShowMaintenanceSchedule(false);
  };

  const handlePaymentProcess = (amount: string, method: string, guestId: string) => {
    const guest = guests.find(g => g.id.toString() === guestId);
    toast({
      title: "Payment Processed",
      description: `KES ${amount} payment processed for ${guest?.name} via ${method}`,
    });
    setShowPaymentProcess(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Quick Actions Dashboard</h2>
        <p className="text-slate-600 dark:text-slate-400">Perform common hotel operations with one-click actions</p>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Guest Communication */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
              <MessageCircle className="mr-2 h-5 w-5" />
              Guest Communication
            </CardTitle>
            <CardDescription>Send messages to guests via SMS, email, or in-app notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowGuestCommunication(true)}
            >
              Send Message
            </Button>
          </CardContent>
        </Card>

        {/* Room Status Check */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700 dark:text-green-300">
              <Home className="mr-2 h-5 w-5" />
              Room Status Check
            </CardTitle>
            <CardDescription>Quickly check the status and details of any room</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map(room => (
                  <SelectItem key={room.number} value={room.number}>
                    Room {room.number} - {room.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => handleRoomStatusCheck(selectedRoom)}
              disabled={!selectedRoom}
            >
              Check Status
            </Button>
            {roomStatusInfo && (
              <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">Room {roomStatusInfo.number} Details:</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge className={
                      roomStatusInfo.status === 'occupied' ? 'bg-red-100 text-red-800' :
                      roomStatusInfo.status === 'available' ? 'bg-green-100 text-green-800' :
                      roomStatusInfo.status === 'cleaning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-orange-100 text-orange-800'
                    }>
                      {roomStatusInfo.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span>{roomStatusInfo.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Floor:</span>
                    <span>{roomStatusInfo.floor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate:</span>
                    <span>{roomStatusInfo.rate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Capacity:</span>
                    <span>{roomStatusInfo.capacity} guests</span>
                  </div>
                  {roomStatusInfo.guest && (
                    <div className="flex justify-between">
                      <span>Guest:</span>
                      <span>{roomStatusInfo.guest}</span>
                    </div>
                  )}
                  {roomStatusInfo.smoking && (
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span>🚬 Smoking Room</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Housekeeping Dispatch */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700">
          <CardHeader>
            <CardTitle className="flex items-center text-purple-700 dark:text-purple-300">
              <Users className="mr-2 h-5 w-5" />
              Housekeeping Dispatch
            </CardTitle>
            <CardDescription>Send housekeeping staff to specific rooms or areas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={handleHousekeepingDispatch}
            >
              Dispatch Team
            </Button>
          </CardContent>
        </Card>

        {/* Supply Order */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-700 dark:text-orange-300">
              <Package className="mr-2 h-5 w-5" />
              Quick Supply Order
            </CardTitle>
            <CardDescription>Place emergency or routine supply orders</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => setShowSupplyOrder(true)}
            >
              Place Order
            </Button>
          </CardContent>
        </Card>

        {/* Maintenance Schedule */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700">
          <CardHeader>
            <CardTitle className="flex items-center text-red-700 dark:text-red-300">
              <Wrench className="mr-2 h-5 w-5" />
              Maintenance Schedule
            </CardTitle>
            <CardDescription>Schedule urgent or routine maintenance tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700"
              onClick={() => setShowMaintenanceSchedule(true)}
            >
              Schedule Maintenance
            </Button>
          </CardContent>
        </Card>

        {/* Payment Processing */}
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700">
          <CardHeader>
            <CardTitle className="flex items-center text-indigo-700 dark:text-indigo-300">
              <CreditCard className="mr-2 h-5 w-5" />
              Quick Payment
            </CardTitle>
            <CardDescription>Process guest payments and charges</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowPaymentProcess(true)}
            >
              Process Payment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Guest Communication Dialog */}
      <Dialog open={showGuestCommunication} onOpenChange={setShowGuestCommunication}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guest Communication</DialogTitle>
            <DialogDescription>Send a message to a guest</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handleGuestCommunication(
              formData.get('guest') as string,
              formData.get('template') as string,
              formData.get('method') as string
            );
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="guest">Select Guest</Label>
                <Select name="guest" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.map(guest => (
                      <SelectItem key={guest.id} value={guest.id.toString()}>
                        {guest.name} - Room {guest.room}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="template">Message Template</Label>
                <Select name="template" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {communicationTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="method">Communication Method</Label>
                <Select name="method" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="app">In-App Notification</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Send Message</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supply Order Dialog */}
      <Dialog open={showSupplyOrder} onOpenChange={setShowSupplyOrder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Supply Order</DialogTitle>
            <DialogDescription>Place an order for supplies</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handleSupplyOrder(
              formData.get('supplier') as string,
              formData.get('items') as string,
              formData.get('priority') as string
            );
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select name="supplier" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linen-supply">Premium Linen Supply</SelectItem>
                    <SelectItem value="cleaning-supplies">CleanCo Supplies</SelectItem>
                    <SelectItem value="food-beverage">F&B Distributors</SelectItem>
                    <SelectItem value="maintenance">Maintenance Parts Co</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="items">Items Needed</Label>
                <Textarea name="items" placeholder="List the items you need..." required />
              </div>
              <div>
                <Label htmlFor="priority">Priority Level</Label>
                <Select name="priority" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Place Order</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Maintenance Schedule Dialog */}
      <Dialog open={showMaintenanceSchedule} onOpenChange={setShowMaintenanceSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
            <DialogDescription>Schedule a maintenance task</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handleMaintenanceSchedule(
              formData.get('type') as string,
              formData.get('room') as string,
              formData.get('priority') as string,
              formData.get('description') as string
            );
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Maintenance Type</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="furniture">Furniture</SelectItem>
                    <SelectItem value="appliance">Appliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="room">Room/Location</Label>
                <Select name="room" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => (
                      <SelectItem key={room.number} value={room.number}>
                        Room {room.number}
                      </SelectItem>
                    ))}
                    <SelectItem value="lobby">Lobby</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="gym">Gym</SelectItem>
                    <SelectItem value="pool">Pool Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea name="description" placeholder="Describe the maintenance issue..." required />
              </div>
              <Button type="submit" className="w-full">Schedule Maintenance</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Processing Dialog */}
      <Dialog open={showPaymentProcess} onOpenChange={setShowPaymentProcess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>Process a guest payment</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            handlePaymentProcess(
              formData.get('amount') as string,
              formData.get('method') as string,
              formData.get('guest') as string
            );
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="guest">Guest</Label>
                <Select name="guest" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.map(guest => (
                      <SelectItem key={guest.id} value={guest.id.toString()}>
                        {guest.name} - Room {guest.room}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input name="amount" type="number" placeholder="Enter amount" required />
              </div>
              <div>
                <Label htmlFor="method">Payment Method</Label>
                <Select name="method" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Process Payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickActionsDashboard;
