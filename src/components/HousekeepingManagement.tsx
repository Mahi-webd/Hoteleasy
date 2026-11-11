import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, AlertTriangle, User, MapPin, Plus, Filter, Search, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HousekeepingManagement = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Mock housekeeping data
  const rooms = [
    {
      number: "101",
      status: "clean",
      assignee: "Maria Santos",
      lastCleaned: "2024-01-15 10:30",
      nextService: "checkout",
      priority: "normal",
      floor: 1,
      notes: "Deep cleaning completed",
      checklist: {
        bathroom: true,
        bedroom: true,
        amenities: true,
        vacuum: true,
        linens: true
      }
    },
    {
      number: "102", 
      status: "cleaning",
      assignee: "Bob Wilson",
      lastCleaned: "2024-01-14 14:20",
      nextService: "maintenance",
      priority: "high",
      floor: 1,
      notes: "Guest checkout at 11 AM",
      checklist: {
        bathroom: true,
        bedroom: false,
        amenities: false,
        vacuum: false,
        linens: true
      }
    },
    {
      number: "103",
      status: "dirty",
      assignee: null,
      lastCleaned: "2024-01-13 16:45",
      nextService: "checkin",
      priority: "urgent",
      floor: 1,
      notes: "Guest checking in at 3 PM",
      checklist: {
        bathroom: false,
        bedroom: false,
        amenities: false,
        vacuum: false,
        linens: false
      }
    },
    {
      number: "201",
      status: "inspecting",
      assignee: "Carol Davis",
      lastCleaned: "2024-01-15 12:00",
      nextService: "occupied",
      priority: "normal",
      floor: 2,
      notes: "Quality inspection in progress",
      checklist: {
        bathroom: true,
        bedroom: true,
        amenities: true,
        vacuum: true,
        linens: true
      }
    },
    {
      number: "202",
      status: "maintenance",
      assignee: null,
      lastCleaned: "2024-01-12 09:15",
      nextService: "repair",
      priority: "high",
      floor: 2,
      notes: "AC unit needs repair",
      checklist: {
        bathroom: true,
        bedroom: true,
        amenities: false,
        vacuum: true,
        linens: true
      }
    }
  ];

  const staff = [
    {
      id: "HK001",
      name: "Maria Santos",
      role: "Senior Housekeeper",
      status: "active",
      assignedRooms: ["101", "104", "107"],
      rating: 4.8,
      completedToday: 3
    },
    {
      id: "HK002", 
      name: "Bob Wilson",
      role: "Housekeeper",
      status: "active",
      assignedRooms: ["102", "105"],
      rating: 4.6,
      completedToday: 1
    },
    {
      id: "HK003",
      name: "Carol Davis",
      role: "Inspector",
      status: "active", 
      assignedRooms: ["201", "203"],
      rating: 4.9,
      completedToday: 2
    }
  ];

  const housekeepingStats = {
    totalRooms: rooms.length,
    cleanRooms: rooms.filter(r => r.status === "clean").length,
    inProgress: rooms.filter(r => r.status === "cleaning").length,
    pendingCleaning: rooms.filter(r => r.status === "dirty").length,
    activeStaff: staff.filter(s => s.status === "active").length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "clean": return "bg-green-100 text-green-800 border-green-200";
      case "cleaning": return "bg-blue-100 text-blue-800 border-blue-200";
      case "dirty": return "bg-red-100 text-red-800 border-red-200";
      case "inspecting": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "maintenance": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "normal": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleAssignRoom = (roomNumber: string, staffId: string) => {
    toast({
      title: "Room Assigned",
      description: `Room ${roomNumber} has been assigned successfully`,
    });
  };

  const handleUpdateStatus = (roomNumber: string, newStatus: string) => {
    toast({
      title: "Status Updated",
      description: `Room ${roomNumber} status updated to ${newStatus}`,
    });
  };

  const filteredRooms = rooms.filter(room => {
    const matchesStatus = statusFilter === "all" || room.status === statusFilter;
    const matchesFloor = floorFilter === "all" || room.floor.toString() === floorFilter;
    const matchesSearch = searchTerm === "" || 
      room.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (room.assignee && room.assignee.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesFloor && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Housekeeping Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage room cleaning and maintenance schedules</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <Tabs defaultValue="rooms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rooms">Room Status</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Rooms</p>
                    <p className="text-2xl font-bold">{housekeepingStats.totalRooms}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Clean</p>
                    <p className="text-2xl font-bold">{housekeepingStats.cleanRooms}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">In Progress</p>
                    <p className="text-2xl font-bold">{housekeepingStats.inProgress}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Needs Cleaning</p>
                    <p className="text-2xl font-bold">{housekeepingStats.pendingCleaning}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Active Staff</p>
                    <p className="text-2xl font-bold">{housekeepingStats.activeStaff}</p>
                  </div>
                  <User className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search rooms or staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="dirty">Dirty</SelectItem>
                    <SelectItem value="inspecting">Inspecting</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={floorFilter} onValueChange={setFloorFilter}>
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
              </div>
            </CardContent>
          </Card>

          {/* Room List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <Card key={room.number}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">Room {room.number}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Floor {room.floor}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(room.status)}>
                        {room.status}
                      </Badge>
                      <Badge className={`${getPriorityColor(room.priority)} mt-1`} variant="outline">
                        {room.priority}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <p><strong>Assignee:</strong> {room.assignee || "Unassigned"}</p>
                    <p><strong>Last Cleaned:</strong> {room.lastCleaned}</p>
                    <p><strong>Next Service:</strong> {room.nextService}</p>
                    <p><strong>Notes:</strong> {room.notes}</p>
                  </div>

                  {/* Cleaning Checklist */}
                  <div className="space-y-2 mb-4">
                    <h5 className="font-medium text-sm">Cleaning Checklist</h5>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center space-x-1 ${room.checklist.bathroom ? 'text-green-600' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${room.checklist.bathroom ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span>Bathroom</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${room.checklist.bedroom ? 'text-green-600' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${room.checklist.bedroom ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span>Bedroom</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${room.checklist.amenities ? 'text-green-600' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${room.checklist.amenities ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span>Amenities</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${room.checklist.vacuum ? 'text-green-600' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${room.checklist.vacuum ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span>Vacuum</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${room.checklist.linens ? 'text-green-600' : 'text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${room.checklist.linens ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span>Linens</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="flex-1">
                          <User className="mr-1 h-3 w-3" />
                          Assign
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Room {room.number}</DialogTitle>
                          <DialogDescription>Select a staff member to clean this room</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="staff">Staff Member</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select staff member" />
                              </SelectTrigger>
                              <SelectContent>
                                {staff.map(member => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.name} - {member.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="priority">Priority</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Set priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="notes">Special Instructions</Label>
                            <Textarea id="notes" placeholder="Any special cleaning instructions..." />
                          </div>
                          <Button 
                            className="w-full"
                            onClick={() => handleAssignRoom(room.number, "HK001")}
                          >
                            Assign Room
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleUpdateStatus(room.number, "clean")}
                    >
                      Update
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staff.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">{member.name}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{member.role}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">{member.rating}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <p><strong>Status:</strong> 
                      <Badge className="ml-2 bg-green-100 text-green-800">
                        {member.status}
                      </Badge>
                    </p>
                    <p><strong>Assigned Rooms:</strong> {member.assignedRooms.join(", ")}</p>
                    <p><strong>Completed Today:</strong> {member.completedToday} rooms</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      View Schedule
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Performance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Schedule</CardTitle>
              <CardDescription>Today's cleaning assignments and priorities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rooms.filter(r => r.assignee).map((room) => (
                  <div key={room.number} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Room {room.number}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Assigned to: {room.assignee}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(room.priority)}>
                        {room.priority}
                      </Badge>
                      <Badge className={getStatusColor(room.status)}>
                        {room.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Daily housekeeping performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Rooms Cleaned Today</span>
                    <span className="font-medium">12 / 15</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Cleaning Time</span>
                    <span className="font-medium">45 min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Quality Score</span>
                    <span className="font-medium">4.7 / 5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>On-Time Completion</span>
                    <span className="font-medium">94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Individual staff metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {staff.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{member.name}</span>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{member.rating}</span>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {member.completedToday} rooms today
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HousekeepingManagement;
