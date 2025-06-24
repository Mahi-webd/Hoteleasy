
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { User, Plus, Search, Phone, Mail, MapPin, Calendar, Star, CreditCard } from "lucide-react";

const GuestManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);

  const guests = [
    {
      id: 1,
      name: "John Doe",
      email: "john.doe@email.com",
      phone: "+254 700 123 456",
      nationality: "Kenyan",
      idNumber: "12345678",
      room: "101",
      checkIn: "2025-06-20",
      checkOut: "2025-06-25",
      status: "Checked In",
      vip: true,
      totalStays: 5,
      totalSpent: "KES 245,000",
      preferences: "Ocean view, late checkout",
      lastStay: "2025-04-15"
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane.smith@email.com",
      phone: "+254 700 234 567",
      nationality: "British",
      idNumber: "AB123456",
      room: "201",
      checkIn: "2025-06-22",
      checkOut: "2025-06-24",
      status: "Checked In",
      vip: false,
      totalStays: 2,
      totalSpent: "KES 89,000",
      preferences: "Quiet room, early breakfast",
      lastStay: "2025-03-10"
    },
    {
      id: 3,
      name: "Mike Johnson",
      email: "mike.johnson@email.com",
      phone: "+254 700 345 678",
      nationality: "American",
      idNumber: "US789123",
      room: "203",
      checkIn: "2025-06-21",
      checkOut: "2025-06-26",
      status: "Checked In",
      vip: false,
      totalStays: 1,
      totalSpent: "KES 67,500",
      preferences: "Ground floor, no smoking",
      lastStay: "2025-06-21"
    },
    {
      id: 4,
      name: "Sarah Wilson",
      email: "sarah.wilson@email.com",
      phone: "+254 700 456 789",
      nationality: "South African",
      idNumber: "SA456789",
      room: null,
      checkIn: null,
      checkOut: null,
      status: "Past Guest",
      vip: true,
      totalStays: 8,
      totalSpent: "KES 456,000",
      preferences: "Suite room, spa services",
      lastStay: "2025-05-18"
    }
  ];

  const filteredGuests = guests.filter(guest =>
    guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.phone.includes(searchTerm) ||
    (guest.room && guest.room.includes(searchTerm))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Checked In": return "bg-green-100 text-green-800";
      case "Checked Out": return "bg-blue-100 text-blue-800";
      case "Past Guest": return "bg-gray-100 text-gray-800";
      case "Reserved": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Guest Management</h2>
          <p className="text-slate-600">Manage guest profiles, preferences, and history</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Guest</DialogTitle>
              <DialogDescription>Create a new guest profile</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="John" />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Doe" />
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
                <Label htmlFor="nationality">Nationality</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kenyan">Kenyan</SelectItem>
                    <SelectItem value="ugandan">Ugandan</SelectItem>
                    <SelectItem value="tanzanian">Tanzanian</SelectItem>
                    <SelectItem value="british">British</SelectItem>
                    <SelectItem value="american">American</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="idNumber">ID/Passport Number</Label>
                <Input id="idNumber" placeholder="12345678" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="preferences">Preferences & Notes</Label>
                <Textarea id="preferences" placeholder="Special requests, dietary requirements, etc." />
              </div>
            </div>
            <Button className="w-full mt-4">Add Guest</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search guests by name, email, phone, or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Guest Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuests.map((guest) => (
          <Card key={guest.id} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src={`/api/placeholder/40/40`} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                      {guest.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      {guest.name}
                      {guest.vip && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600">
                      {guest.nationality}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(guest.status)}>
                  {guest.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700">{guest.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700">{guest.phone}</span>
                </div>
                {guest.room && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-700">Room {guest.room}</span>
                  </div>
                )}
                {guest.checkIn && guest.checkOut && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-700 text-xs">
                      {guest.checkIn} - {guest.checkOut}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700">{guest.totalSpent}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Total Stays: {guest.totalStays}</span>
                  <span>Last: {guest.lastStay}</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1">
                  View Profile
                </Button>
                <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                  Contact
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Guest Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{guests.length}</div>
            <div className="text-sm opacity-90">Total Guests</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {guests.filter(g => g.status === "Checked In").length}
            </div>
            <div className="text-sm opacity-90">Currently In-House</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {guests.filter(g => g.vip).length}
            </div>
            <div className="text-sm opacity-90">VIP Guests</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {Math.round(guests.reduce((acc, g) => acc + g.totalStays, 0) / guests.length)}
            </div>
            <div className="text-sm opacity-90">Avg. Stays</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GuestManagement;
