
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Home, User, Settings, Plus, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RoomManagement = () => {
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showManageRoom, setShowManageRoom] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const { toast } = useToast();

  const [rooms, setRooms] = useState([
    { number: "101", type: "Standard Single", status: "occupied", guest: "John Doe", floor: 1, rate: "KES 8,000" },
    { number: "102", type: "Standard Double", status: "available", guest: null, floor: 1, rate: "KES 12,000" },
    { number: "103", type: "Deluxe Double", status: "cleaning", guest: null, floor: 1, rate: "KES 15,000" },
    { number: "104", type: "Suite", status: "maintenance", guest: null, floor: 1, rate: "KES 25,000" },
    { number: "201", type: "Standard Single", status: "occupied", guest: "Jane Smith", floor: 2, rate: "KES 8,000" },
    { number: "202", type: "Standard Double", status: "available", guest: null, floor: 2, rate: "KES 12,000" },
    { number: "203", type: "Deluxe Double", status: "occupied", guest: "Mike Johnson", floor: 2, rate: "KES 15,000" },
    { number: "204", type: "Presidential Suite", status: "available", guest: null, floor: 2, rate: "KES 45,000" },
    { number: "301", type: "Standard Single", status: "occupied", guest: "Sarah Wilson", floor: 3, rate: "KES 8,000" },
    { number: "302", type: "Standard Double", status: "cleaning", guest: null, floor: 3, rate: "KES 12,000" },
    { number: "303", type: "Deluxe Double", status: "available", guest: null, floor: 3, rate: "KES 15,000" },
    { number: "304", type: "Suite", status: "occupied", guest: "David Brown", floor: 3, rate: "KES 25,000" },
  ]);

  const handleAddRoom = (roomData: any) => {
    const newRoom = {
      number: roomData.roomNumber,
      type: roomData.roomType,
      status: "available",
      guest: null,
      floor: parseInt(roomData.floor),
      rate: `KES ${roomData.rate}`
    };
    setRooms(prev => [...prev, newRoom]);
    toast({
      title: "Room Added",
      description: `Room ${roomData.roomNumber} has been added successfully`,
    });
    setShowAddRoom(false);
  };

  const handleManageRoom = (room: any) => {
    setSelectedRoom(room);
    setShowManageRoom(true);
  };

  const handleAssignRoom = (room: any) => {
    const guestName = prompt("Enter guest name:");
    if (guestName) {
      setRooms(prev => prev.map(r => 
        r.number === room.number 
          ? { ...r, status: "occupied", guest: guestName }
          : r
      ));
      toast({
        title: "Room Assigned",
        description: `Room ${room.number} assigned to ${guestName}`,
      });
    }
  };

  const handleStatusChange = (roomNumber: string, newStatus: string) => {
    setRooms(prev => prev.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus, guest: newStatus === "available" ? null : room.guest }
        : room
    ));
    toast({
      title: "Room Status Updated",
      description: `Room ${roomNumber} status changed to ${newStatus}`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied": return "bg-red-100 text-red-800 border-red-200";
      case "available": return "bg-green-100 text-green-800 border-green-200";
      case "cleaning": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "maintenance": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "occupied": return "🔴";
      case "available": return "🟢";
      case "cleaning": return "🟡";
      case "maintenance": return "🔧";
      default: return "⚪";
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesFloor = selectedFloor === "all" || room.floor.toString() === selectedFloor;
    const matchesStatus = selectedStatus === "all" || room.status === selectedStatus;
    const matchesSearch = searchTerm === "" || 
      room.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (room.guest && room.guest.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFloor && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Room Management</h2>
          <p className="text-slate-600">Manage room status, assignments, and availability</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          onClick={() => setShowAddRoom(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search rooms, guests, types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="1">Floor 1</SelectItem>
                <SelectItem value="2">Floor 2</SelectItem>
                <SelectItem value="3">Floor 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map((room) => (
          <Card key={room.number} className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800">
                  Room {room.number}
                </CardTitle>
                <div className="text-xl">{getStatusIcon(room.status)}</div>
              </div>
              <CardDescription className="text-sm text-slate-600">
                {room.type} • Floor {room.floor}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={`${getStatusColor(room.status)} text-xs font-medium px-2 py-1`}>
                {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
              </Badge>
              
              {room.guest && (
                <div className="flex items-center space-x-2 text-sm">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700">{room.guest}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Rate:</span>
                <span className="font-semibold text-slate-800">{room.rate}</span>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleManageRoom(room)}
                >
                  <Settings className="mr-1 h-3 w-3" />
                  Manage
                </Button>
                {room.status === "available" && (
                  <Button 
                    size="sm" 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleAssignRoom(room)}
                  >
                    <User className="mr-1 h-3 w-3" />
                    Assign
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "available").length}
            </div>
            <div className="text-sm opacity-90">Available Rooms</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "occupied").length}
            </div>
            <div className="text-sm opacity-90">Occupied Rooms</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "cleaning").length}
            </div>
            <div className="text-sm opacity-90">Being Cleaned</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "maintenance").length}
            </div>
            <div className="text-sm opacity-90">Maintenance</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Room Dialog */}
      <Dialog open={showAddRoom} onOpenChange={setShowAddRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
            <DialogDescription>Create a new room in the hotel inventory</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const roomData = {
              roomNumber: formData.get('roomNumber'),
              roomType: formData.get('roomType'),
              floor: formData.get('floor'),
              rate: formData.get('rate'),
              description: formData.get('description')
            };
            handleAddRoom(roomData);
          }}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomNumber">Room Number</Label>
                <Input name="roomNumber" id="roomNumber" placeholder="e.g., 105" required />
              </div>
              <div>
                <Label htmlFor="roomType">Room Type</Label>
                <Select name="roomType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard Single">Standard Single</SelectItem>
                    <SelectItem value="Standard Double">Standard Double</SelectItem>
                    <SelectItem value="Deluxe Double">Deluxe Double</SelectItem>
                    <SelectItem value="Suite">Suite</SelectItem>
                    <SelectItem value="Presidential Suite">Presidential Suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Select name="floor" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Floor 1</SelectItem>
                    <SelectItem value="2">Floor 2</SelectItem>
                    <SelectItem value="3">Floor 3</SelectItem>
                    <SelectItem value="4">Floor 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rate">Daily Rate (KES)</Label>
                <Input name="rate" id="rate" placeholder="e.g., 12000" type="number" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea name="description" id="description" placeholder="Room amenities and features" />
              </div>
              <Button type="submit" className="w-full">Add Room</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Room Dialog */}
      <Dialog open={showManageRoom} onOpenChange={setShowManageRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Room {selectedRoom?.number}</DialogTitle>
            <DialogDescription>Update room status and details</DialogDescription>
          </DialogHeader>
          {selectedRoom && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="room-status">Room Status</Label>
                <Select 
                  value={selectedRoom.status} 
                  onValueChange={(value) => handleStatusChange(selectedRoom.number, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="guest-name">Current Guest</Label>
                <Input 
                  id="guest-name" 
                  value={selectedRoom.guest || "No guest assigned"} 
                  readOnly 
                />
              </div>
              <div>
                <Label htmlFor="room-rate">Room Rate</Label>
                <Input 
                  id="room-rate" 
                  value={selectedRoom.rate} 
                  readOnly 
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "Housekeeping Called",
                      description: `Housekeeping dispatched to Room ${selectedRoom.number}`,
                    });
                  }}
                >
                  Call Housekeeping
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "Maintenance Requested",
                      description: `Maintenance ticket created for Room ${selectedRoom.number}`,
                    });
                  }}
                >
                  Request Maintenance
                </Button>
              </div>
              <Button 
                onClick={() => setShowManageRoom(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomManagement;
