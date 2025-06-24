
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Plus, Search, User, MapPin, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ReservationSystem = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();

  const reservations = [
    {
      id: "RES001",
      guestName: "Alice Johnson",
      email: "alice.johnson@email.com",
      phone: "+254 700 111 222",
      roomType: "Deluxe Double",
      roomNumber: "205",
      checkIn: "2025-06-25",
      checkOut: "2025-06-28",
      nights: 3,
      adults: 2,
      children: 0,
      status: "Confirmed",
      totalAmount: "KES 45,000",
      paymentStatus: "Paid",
      bookingDate: "2025-06-20",
      source: "Direct"
    },
    {
      id: "RES002",
      guestName: "Robert Smith",
      email: "robert.smith@email.com",
      phone: "+254 700 333 444",
      roomType: "Suite",
      roomNumber: "301",
      checkIn: "2025-06-26",
      checkOut: "2025-06-30",
      nights: 4,
      adults: 2,
      children: 1,
      status: "Pending",
      totalAmount: "KES 100,000",
      paymentStatus: "Pending",
      bookingDate: "2025-06-22",
      source: "Booking.com"
    },
    {
      id: "RES003",
      guestName: "Maria Garcia",
      email: "maria.garcia@email.com",
      phone: "+254 700 555 666",
      roomType: "Standard Single",
      roomNumber: "102",
      checkIn: "2025-06-24",
      checkOut: "2025-06-26",
      nights: 2,
      adults: 1,
      children: 0,
      status: "Checked In",
      totalAmount: "KES 16,000",
      paymentStatus: "Paid",
      bookingDate: "2025-06-18",
      source: "Phone"
    },
    {
      id: "RES004",
      guestName: "David Wilson",
      email: "david.wilson@email.com",
      phone: "+254 700 777 888",
      roomType: "Presidential Suite",
      roomNumber: "401",
      checkIn: "2025-06-27",
      checkOut: "2025-07-02",
      nights: 5,
      adults: 2,
      children: 2,
      status: "Confirmed",
      totalAmount: "KES 225,000",
      paymentStatus: "Deposit Paid",
      bookingDate: "2025-06-15",
      source: "Travel Agent"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-green-100 text-green-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Checked In": return "bg-blue-100 text-blue-800";
      case "Checked Out": return "bg-gray-100 text-gray-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Deposit Paid": return "bg-blue-100 text-blue-800";
      case "Overdue": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredReservations = reservations.filter(reservation =>
    reservation.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reservation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reservation.roomNumber.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Reservations</h2>
          <p className="text-slate-600">Manage bookings, check-ins, and guest reservations</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create New Reservation</DialogTitle>
              <DialogDescription>Add a new booking to the system</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              {/* Guest Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800">Guest Information</h3>
                <div>
                  <Label htmlFor="guestName">Guest Name</Label>
                  <Input id="guestName" placeholder="John Doe" />
                </div>
                <div>
                  <Label htmlFor="guestEmail">Email</Label>
                  <Input id="guestEmail" type="email" placeholder="john@email.com" />
                </div>
                <div>
                  <Label htmlFor="guestPhone">Phone</Label>
                  <Input id="guestPhone" placeholder="+254 700 123 456" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="adults">Adults</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="1" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Adult</SelectItem>
                        <SelectItem value="2">2 Adults</SelectItem>
                        <SelectItem value="3">3 Adults</SelectItem>
                        <SelectItem value="4">4 Adults</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="children">Children</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="0" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 Children</SelectItem>
                        <SelectItem value="1">1 Child</SelectItem>
                        <SelectItem value="2">2 Children</SelectItem>
                        <SelectItem value="3">3 Children</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800">Booking Details</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Check-in Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !checkInDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkInDate ? format(checkInDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkInDate}
                          onSelect={setCheckInDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Check-out Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !checkOutDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {checkOutDate ? format(checkOutDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={checkOutDate}
                          onSelect={setCheckOutDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <Label htmlFor="roomType">Room Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard-single">Standard Single - KES 8,000</SelectItem>
                      <SelectItem value="standard-double">Standard Double - KES 12,000</SelectItem>
                      <SelectItem value="deluxe-double">Deluxe Double - KES 15,000</SelectItem>
                      <SelectItem value="suite">Suite - KES 25,000</SelectItem>
                      <SelectItem value="presidential">Presidential Suite - KES 45,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bookingSource">Booking Source</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="booking.com">Booking.com</SelectItem>
                      <SelectItem value="expedia">Expedia</SelectItem>
                      <SelectItem value="travel-agent">Travel Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specialRequests">Special Requests</Label>
                  <Textarea id="specialRequests" placeholder="Any special requests or notes" />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline">Save as Draft</Button>
              <Button className="bg-green-600 hover:bg-green-700">Confirm Reservation</Button>
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
                placeholder="Search reservations by guest name, ID, email, or room..."
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checkedIn">Checked In</SelectItem>
                <SelectItem value="checkedOut">Checked Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <div className="space-y-4">
        {filteredReservations.map((reservation) => (
          <Card key={reservation.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Guest Info */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-800">{reservation.guestName}</span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div>{reservation.email}</div>
                    <div>{reservation.phone}</div>
                    <div className="flex items-center">
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                        {reservation.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-800">
                      {reservation.roomType} - Room {reservation.roomNumber}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{reservation.checkIn} - {reservation.checkOut}</span>
                    </div>
                    <div>{reservation.nights} nights • {reservation.adults} adults • {reservation.children} children</div>
                    <div>Source: {reservation.source}</div>
                  </div>
                </div>

                {/* Status & Payment */}
                <div className="space-y-2">
                  <div className="flex flex-col space-y-2">
                    <Badge className={getStatusColor(reservation.status)}>
                      {reservation.status}
                    </Badge>
                    <Badge className={getPaymentStatusColor(reservation.paymentStatus)}>
                      {reservation.paymentStatus}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">
                    <div className="font-semibold text-slate-800">{reservation.totalAmount}</div>
                    <div>Booked: {reservation.bookingDate}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2">
                  {reservation.status === "Confirmed" && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Check In
                    </Button>
                  )}
                  {reservation.status === "Pending" && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Confirm
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                  <Button size="sm" variant="ghost" className="text-slate-600">
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
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
            <div className="text-sm opacity-90">In-House</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReservationSystem;
