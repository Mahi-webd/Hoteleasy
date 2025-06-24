
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

const RoomManagement = () => {
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const rooms = [
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
  ];

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
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>Create a new room in the hotel inventory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="roomNumber">Room Number</Label>
                <Input id="roomNumber" placeholder="e.g., 105" />
              </div>
              <div>
                <Label htmlFor="roomType">Room Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard-single">Standard Single</SelectItem>
                    <SelectItem value="standard-double">Standard Double</SelectItem>
                    <SelectItem value="deluxe-double">Deluxe Double</SelectItem>
                    <SelectItem value="suite">Suite</SelectItem>
                    <SelectItem value="presidential">Presidential Suite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Select>
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
                <Input id="rate" placeholder="e.g., 12000" type="number" />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Room amenities and features" />
              </div>
              <Button className="w-full">Add Room</Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <Button size="sm" variant="outline" className="flex-1">
                  <Settings className="mr-1 h-3 w-3" />
                  Manage
                </Button>
                {room.status === "available" && (
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
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
    </div>
  );
};

export default RoomManagement;
