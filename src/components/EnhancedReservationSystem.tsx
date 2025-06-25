
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, MapPin, Phone, Mail, CreditCard, Search, Plus, CheckCircle, XCircle, Edit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const EnhancedReservationSystem = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const reservations = [
    {
      id: "RES001",
      guestName: "John Doe",
      email: "john.doe@email.com",
      phone: "+254 700 123 456",
      roomNumber: "101",
      roomType: "Deluxe Suite",
      checkIn: "2025-06-25",
      checkOut: "2025-06-28",
      guests: 2,
      nights: 3,
      totalAmount: "KES 45,000",
      status: "Confirmed",
      bookingDate: "2025-06-20",
      specialRequests: "Late checkout, ocean view",
      paymentStatus: "Paid"
    },
    {
      id: "RES002",
      guestName: "Jane Smith",
      email: "jane.smith@email.com",
      phone: "+254 700 234 567",
      roomNumber: "205",
      roomType: "Standard Room",
      checkIn: "2025-06-26",
      checkOut: "2025-06-29",
      guests: 1,
      nights: 3,
      totalAmount: "KES 27,000",
      status: "Pending",
      bookingDate: "2025-06-22",
      specialRequests: "Ground floor room",
      paymentStatus: "Pending"
    },
    {
      id: "RES003",
      guestName: "Mike Johnson",
      email: "mike.johnson@email.com",
      phone: "+254 700 345 678",
      roomNumber: "301",
      roomType: "Executive Suite",
      checkIn: "2025-06-24",
      checkOut: "2025-06-27",
      guests: 2,
      nights: 3,
      totalAmount: "KES 60,000",
      status: "Checked In",
      bookingDate: "2025-06-18",
      specialRequests: "Extra towels, minibar stocked",
      paymentStatus: "Paid"
    }
  ];

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = reservation.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reservation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reservation.roomNumber.includes(searchTerm) ||
                         reservation.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && reservation.status.toLowerCase().replace(" ", "-") === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-blue-100 text-blue-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Checked In": return "bg-green-100 text-green-800";
      case "Checked Out": return "bg-gray-100 text-gray-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleCheckIn = (reservation: any) => {
    console.log("Checking in guest:", reservation.guestName);
    // In a real app, this would update the reservation status
    alert(`Checking in ${reservation.guestName} to room ${reservation.roomNumber}`);
  };

  const handleViewDetails = (reservation: any) => {
    console.log("Viewing details for reservation:", reservation.id);
    setSelectedReservation(reservation);
    setIsDetailsDialogOpen(true);
  };

  const handleEdit = (reservation: any) => {
    console.log("Editing reservation:", reservation.id);
    setSelectedReservation(reservation);
    setIsEditDialogOpen(true);
  };

  const handleCancel = (reservation: any) => {
    console.log("Cancelling reservation:", reservation.id);
    if (confirm(`Are you sure you want to cancel reservation ${reservation.id}?`)) {
      alert(`Reservation ${reservation.id} has been cancelled`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Reservation Management</h2>
          <p className="text-slate-600">Manage room bookings and guest reservations</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Reservation</DialogTitle>
              <DialogDescription>Book a new room for a guest</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestName">Guest Name</Label>
                <Input id="guestName" placeholder="John Doe" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="john@email.com" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" placeholder="+254 700 123 456" />
              </div>
              <div>
                <Label htmlFor="guests">Number of Guests</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select guests" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Guest</SelectItem>
                    <SelectItem value="2">2 Guests</SelectItem>
                    <SelectItem value="3">3 Guests</SelectItem>
                    <SelectItem value="4">4 Guests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="checkIn">Check-in Date</Label>
                <Input id="checkIn" type="date" />
              </div>
              <div>
                <Label htmlFor="checkOut">Check-out Date</Label>
                <Input id="checkOut" type="date" />
              </div>
              <div>
                <Label htmlFor="roomType">Room Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Room</SelectItem>
                    <SelectItem value="deluxe">Deluxe Suite</SelectItem>
                    <SelectItem value="executive">Executive Suite</SelectItem>
                    <SelectItem value="presidential">Presidential Suite</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="202">Room 202</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="specialRequests">Special Requests</Label>
                <Textarea id="specialRequests" placeholder="Any special requests or notes..." />
              </div>
            </div>
            <Button className="w-full mt-4">Create Reservation</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4 mb-4">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by guest name, email, room number, or reservation ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All Reservations</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="checked-in">Checked In</TabsTrigger>
              <TabsTrigger value="checked-out">Checked Out</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredReservations.map((reservation) => (
          <Card key={reservation.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-800">{reservation.guestName}</h3>
                      <Badge className={getStatusColor(reservation.status)}>
                        {reservation.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      Reservation ID: {reservation.id} • Room {reservation.roomNumber} ({reservation.roomType})
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{reservation.checkIn} - {reservation.checkOut}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{reservation.guests} guests</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{reservation.nights} nights</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="text-right mr-4">
                    <p className="text-lg font-bold text-slate-800">{reservation.totalAmount}</p>
                    <p className="text-sm text-slate-600">
                      Payment: <span className={reservation.paymentStatus === 'Paid' ? 'text-green-600' : 'text-yellow-600'}>
                        {reservation.paymentStatus}
                      </span>
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    {reservation.status === "Confirmed" && (
                      <Button size="sm" onClick={() => handleCheckIn(reservation)}>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Check In
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewDetails(reservation)}
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEdit(reservation)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {reservation.status !== "Checked Out" && reservation.status !== "Cancelled" && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleCancel(reservation)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reservation Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>Reservation Details - {selectedReservation.id}</DialogTitle>
                <DialogDescription>Complete reservation information</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Guest Information</h3>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {selectedReservation.guestName}</div>
                    <div><strong>Email:</strong> {selectedReservation.email}</div>
                    <div><strong>Phone:</strong> {selectedReservation.phone}</div>
                    <div><strong>Guests:</strong> {selectedReservation.guests}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Booking Details</h3>
                  <div className="space-y-2">
                    <div><strong>Room:</strong> {selectedReservation.roomNumber} ({selectedReservation.roomType})</div>
                    <div><strong>Check-in:</strong> {selectedReservation.checkIn}</div>
                    <div><strong>Check-out:</strong> {selectedReservation.checkOut}</div>
                    <div><strong>Nights:</strong> {selectedReservation.nights}</div>
                    <div><strong>Total Amount:</strong> {selectedReservation.totalAmount}</div>
                    <div><strong>Payment Status:</strong> 
                      <Badge className={selectedReservation.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800 ml-2' : 'bg-yellow-100 text-yellow-800 ml-2'}>
                        {selectedReservation.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <h3 className="font-semibold text-lg">Special Requests</h3>
                  <p className="text-sm text-slate-600 mt-2">{selectedReservation.specialRequests}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>Close</Button>
                <Button onClick={() => handleEdit(selectedReservation)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Reservation
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Reservation - {selectedReservation.id}</DialogTitle>
                <DialogDescription>Modify reservation details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editGuestName">Guest Name</Label>
                  <Input id="editGuestName" defaultValue={selectedReservation.guestName} />
                </div>
                <div>
                  <Label htmlFor="editEmail">Email</Label>
                  <Input id="editEmail" type="email" defaultValue={selectedReservation.email} />
                </div>
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input id="editPhone" defaultValue={selectedReservation.phone} />
                </div>
                <div>
                  <Label htmlFor="editGuests">Number of Guests</Label>
                  <Select defaultValue={selectedReservation.guests.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Guest</SelectItem>
                      <SelectItem value="2">2 Guests</SelectItem>
                      <SelectItem value="3">3 Guests</SelectItem>
                      <SelectItem value="4">4 Guests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="editCheckIn">Check-in Date</Label>
                  <Input id="editCheckIn" type="date" defaultValue={selectedReservation.checkIn} />
                </div>
                <div>
                  <Label htmlFor="editCheckOut">Check-out Date</Label>
                  <Input id="editCheckOut" type="date" defaultValue={selectedReservation.checkOut} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="editSpecialRequests">Special Requests</Label>
                  <Textarea id="editSpecialRequests" defaultValue={selectedReservation.specialRequests} />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  alert('Reservation updated successfully!');
                  setIsEditDialogOpen(false);
                }}>
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{reservations.length}</div>
            <div className="text-sm opacity-90">Total Reservations</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {reservations.filter(r => r.status === "Confirmed").length}
            </div>
            <div className="text-sm opacity-90">Confirmed</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {reservations.filter(r => r.status === "Pending").length}
            </div>
            <div className="text-sm opacity-90">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {reservations.filter(r => r.status === "Checked In").length}
            </div>
            <div className="text-sm opacity-90">Checked In</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedReservationSystem;
