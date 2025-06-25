
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, User, Settings, Plus, Search, Filter, Users, Wrench, Broom, CheckCircle } from "lucide-react";

const EnhancedRoomManagement = () => {
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false);
  const [showNewRoomTypeDialog, setShowNewRoomTypeDialog] = useState(false);
  const [showNewFloorDialog, setShowNewFloorDialog] = useState(false);

  const [rooms, setRooms] = useState([
    { number: "101", type: "Standard Single", status: "occupied", guest: "John Doe", floor: 1, rate: "KES 8,000" },
    { number: "102", type: "Standard Double", status: "available", guest: null, floor: 1, rate: "KES 12,000" },
    { number: "103", type: "Deluxe Double", status: "cleaning", guest: null, floor: 1, rate: "KES 15,000" },
    { number: "104", type: "Suite", status: "maintenance", guest: null, floor: 1, rate: "KES 25,000" },
    { number: "201", type: "Standard Single", status: "occupied", guest: "Jane Smith", floor: 2, rate: "KES 8,000" },
    { number: "202", type: "Standard Double", status: "available", guest: null, floor: 2, rate: "KES 12,000" },
    { number: "203", type: "Deluxe Double", status: "occupied", guest: "Mike Johnson", floor: 2, rate: "KES 15,000" },
    { number: "204", type: "Presidential Suite", status: "available", guest: null, floor: 2, rate: "KES 45,000" },
  ]);

  const [roomTypes, setRoomTypes] = useState([
    { id: "standard-single", name: "Standard Single", baseRate: 8000 },
    { id: "standard-double", name: "Standard Double", baseRate: 12000 },
    { id: "deluxe-double", name: "Deluxe Double", baseRate: 15000 },
    { id: "suite", name: "Suite", baseRate: 25000 },
    { id: "presidential", name: "Presidential Suite", baseRate: 45000 },
  ]);

  const [floors, setFloors] = useState([1, 2, 3, 4]);

  const guests = [
    { id: 1, name: "Alice Johnson", email: "alice@email.com" },
    { id: 2, name: "Bob Wilson", email: "bob@email.com" },
    { id: 3, name: "Carol Brown", email: "carol@email.com" },
  ];

  const handleManageRoom = (room) => {
    setSelectedRoom(room);
    setShowManageDialog(true);
  };

  const handleAssignRoom = (room) => {
    setSelectedRoom(room);
    setShowAssignDialog(true);
  };

  const updateRoomStatus = (roomNumber, newStatus, guest = null) => {
    setRooms(rooms.map(room => 
      room.number === roomNumber 
        ? { ...room, status: newStatus, guest }
        : room
    ));
  };

  const addNewRoom = (roomData) => {
    const newRoom = {
      number: roomData.number,
      type: roomTypes.find(t => t.id === roomData.type)?.name || roomData.type,
      status: "available",
      guest: null,
      floor: parseInt(roomData.floor),
      rate: `KES ${roomData.rate}`
    };
    setRooms([...rooms, newRoom]);
    setShowNewRoomDialog(false);
  };

  const addNewRoomType = (typeData) => {
    const newType = {
      id: typeData.name.toLowerCase().replace(/\s+/g, '-'),
      name: typeData.name,
      baseRate: parseInt(typeData.baseRate)
    };
    setRoomTypes([...roomTypes, newType]);
    setShowNewRoomTypeDialog(false);
  };

  const addNewFloor = (floorNumber) => {
    if (!floors.includes(parseInt(floorNumber))) {
      setFloors([...floors, parseInt(floorNumber)].sort((a, b) => a - b));
    }
    setShowNewFloorDialog(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "occupied": return "bg-red-100 text-red-800 border-red-200";
      case "available": return "bg-green-100 text-green-800 border-green-200";
      case "cleaning": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "maintenance": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status) => {
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
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Room Management</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage room status, assignments, and availability</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={showNewFloorDialog} onOpenChange={setShowNewFloorDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Floor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Floor</DialogTitle>
                <DialogDescription>Add a new floor to the hotel</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="floorNumber">Floor Number</Label>
                  <Input 
                    id="floorNumber" 
                    placeholder="e.g., 5" 
                    type="number"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addNewFloor(e.target.value);
                      }
                    }}
                  />
                </div>
                <Button 
                  className="w-full"
                  onClick={() => {
                    const input = document.getElementById('floorNumber') as HTMLInputElement;
                    addNewFloor(input.value);
                  }}
                >
                  Add Floor
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewRoomTypeDialog} onOpenChange={setShowNewRoomTypeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Room Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Room Type</DialogTitle>
                <DialogDescription>Create a new room type category</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="typeName">Room Type Name</Label>
                  <Input id="typeName" placeholder="e.g., Executive Suite" />
                </div>
                <div>
                  <Label htmlFor="typeRate">Base Rate (KES)</Label>
                  <Input id="typeRate" placeholder="e.g., 35000" type="number" />
                </div>
                <Button 
                  className="w-full"
                  onClick={() => {
                    const nameInput = document.getElementById('typeName') as HTMLInputElement;
                    const rateInput = document.getElementById('typeRate') as HTMLInputElement;
                    addNewRoomType({
                      name: nameInput.value,
                      baseRate: rateInput.value
                    });
                  }}
                >
                  Add Room Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewRoomDialog} onOpenChange={setShowNewRoomDialog}>
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
                      {roomTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
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
                      {floors.map(floor => (
                        <SelectItem key={floor} value={floor.toString()}>Floor {floor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rate">Daily Rate (KES)</Label>
                  <Input id="rate" placeholder="e.g., 12000" type="number" />
                </div>
                <Button 
                  className="w-full"
                  onClick={() => {
                    const numberInput = document.getElementById('roomNumber') as HTMLInputElement;
                    const rateInput = document.getElementById('rate') as HTMLInputElement;
                    const typeSelect = document.querySelector('[data-state="open"]') as HTMLElement;
                    const floorSelect = document.querySelector('[data-state="open"]') as HTMLElement;
                    
                    addNewRoom({
                      number: numberInput.value,
                      type: 'standard-single', // Default for demo
                      floor: '1', // Default for demo
                      rate: rateInput.value
                    });
                  }}
                >
                  Add Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
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
                {floors.map(floor => (
                  <SelectItem key={floor} value={floor.toString()}>Floor {floor}</SelectItem>
                ))}
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
          <Card key={room.number} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300 cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Room {room.number}
                </CardTitle>
                <div className="text-xl">{getStatusIcon(room.status)}</div>
              </div>
              <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
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
                  <span className="text-slate-700 dark:text-slate-300">{room.guest}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{room.rate}</span>
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

      {/* Manage Room Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Room {selectedRoom?.number}</DialogTitle>
            <DialogDescription>Update room status and details</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="status">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="status" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={selectedRoom?.status === "available" ? "default" : "outline"}
                  onClick={() => {
                    updateRoomStatus(selectedRoom?.number, "available");
                    setShowManageDialog(false);
                  }}
                  className="flex items-center justify-center"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Available
                </Button>
                <Button 
                  variant={selectedRoom?.status === "cleaning" ? "default" : "outline"}
                  onClick={() => {
                    updateRoomStatus(selectedRoom?.number, "cleaning");
                    setShowManageDialog(false);
                  }}
                  className="flex items-center justify-center"
                >
                  <Broom className="mr-2 h-4 w-4" />
                  Cleaning
                </Button>
                <Button 
                  variant={selectedRoom?.status === "maintenance" ? "default" : "outline"}
                  onClick={() => {
                    updateRoomStatus(selectedRoom?.number, "maintenance");
                    setShowManageDialog(false);
                  }}
                  className="flex items-center justify-center col-span-2"
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Maintenance
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="maintenance" className="space-y-4">
              <div>
                <Label>Maintenance Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select maintenance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="furniture">Furniture</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Describe the maintenance issue..." />
              </div>
              <Button className="w-full">Schedule Maintenance</Button>
            </TabsContent>
            <TabsContent value="details" className="space-y-4">
              <div>
                <Label>Room Rate (KES)</Label>
                <Input defaultValue={selectedRoom?.rate?.replace('KES ', '')} />
              </div>
              <div>
                <Label>Room Features</Label>
                <Textarea placeholder="List room amenities and features..." />
              </div>
              <Button className="w-full">Update Details</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Assign Room Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Room {selectedRoom?.number}</DialogTitle>
            <DialogDescription>Assign this room to a guest</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Guest</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map(guest => (
                    <SelectItem key={guest.id} value={guest.name}>
                      {guest.name} - {guest.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Check-in Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Check-out Date</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Special Requests</Label>
              <Textarea placeholder="Any special requests or notes..." />
            </div>
            <Button 
              className="w-full"
              onClick={() => {
                updateRoomStatus(selectedRoom?.number, "occupied", "Assigned Guest");
                setShowAssignDialog(false);
              }}
            >
              Assign Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

export default EnhancedRoomManagement;
