
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
import { Wrench, AlertTriangle, CheckCircle, Clock, User, MapPin, Plus, Filter, Search, Calendar, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MaintenanceRequests = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Mock maintenance data
  const maintenanceRequests = [
    {
      id: "MR001",
      title: "AC Unit Not Working",
      description: "Air conditioning in room 102 is not cooling properly. Guest complained about temperature.",
      location: "Room 102",
      category: "HVAC",
      priority: "high",
      status: "assigned",
      assignee: "David Brown",
      reporter: "Front Desk",
      dateReported: "2024-01-15 09:30",
      dateAssigned: "2024-01-15 10:00",
      estimatedCompletion: "2024-01-15 16:00",
      actualCompletion: null,
      photos: ["ac-issue-1.jpg"],
      cost: 0,
      partsNeeded: ["AC Filter", "Refrigerant"]
    },
    {
      id: "MR002",
      title: "Leaky Faucet",
      description: "Bathroom faucet in room 205 has a persistent drip that's disturbing guests.",
      location: "Room 205",
      category: "Plumbing",
      priority: "medium",
      status: "in-progress", 
      assignee: "Mike Johnson",
      reporter: "Housekeeping",
      dateReported: "2024-01-14 14:15",
      dateAssigned: "2024-01-14 15:00",
      estimatedCompletion: "2024-01-15 12:00",
      actualCompletion: null,
      photos: [],
      cost: 45,
      partsNeeded: ["Faucet Washer"]
    },
    {
      id: "MR003",
      title: "Broken Light Switch",
      description: "Main light switch in room 301 is not responding. Lights won't turn on.",
      location: "Room 301", 
      category: "Electrical",
      priority: "urgent",
      status: "pending",
      assignee: null,
      reporter: "Guest",
      dateReported: "2024-01-15 18:45",
      dateAssigned: null,
      estimatedCompletion: null,
      actualCompletion: null,
      photos: ["switch-issue.jpg"],
      cost: 0,
      partsNeeded: ["Light Switch", "Wire Nuts"]
    },
    {
      id: "MR004",
      title: "Carpet Stain Removal",
      description: "Large stain on carpet near entrance of room 108 needs professional cleaning.",
      location: "Room 108",
      category: "Cleaning",
      priority: "low",
      status: "completed",
      assignee: "Carol Davis",
      reporter: "Housekeeping",
      dateReported: "2024-01-13 11:20",
      dateAssigned: "2024-01-13 12:00",
      estimatedCompletion: "2024-01-14 10:00",
      actualCompletion: "2024-01-14 09:30",
      photos: [],
      cost: 75,
      partsNeeded: ["Carpet Cleaner Solution"]
    },
    {
      id: "MR005",
      title: "TV Remote Not Working",
      description: "Television remote control in room 203 is unresponsive. Batteries changed but still not working.",
      location: "Room 203",
      category: "Electronics",
      priority: "low",
      status: "assigned",
      assignee: "Tom Wilson",
      reporter: "Guest",
      dateReported: "2024-01-15 16:20",
      dateAssigned: "2024-01-15 17:00",
      estimatedCompletion: "2024-01-16 09:00",
      actualCompletion: null,
      photos: [],
      cost: 0,
      partsNeeded: ["TV Remote"]
    }
  ];

  const maintenanceStaff = [
    {
      id: "MT001",
      name: "David Brown",
      role: "Senior Technician",
      specialties: ["HVAC", "Electrical"],
      status: "available",
      currentTasks: 1,
      rating: 4.8
    },
    {
      id: "MT002",
      name: "Mike Johnson", 
      role: "Plumber",
      specialties: ["Plumbing", "Cleaning"],
      status: "busy",
      currentTasks: 2,
      rating: 4.6
    },
    {
      id: "MT003",
      name: "Tom Wilson",
      role: "General Maintenance",
      specialties: ["Electronics", "General"],
      status: "available",
      currentTasks: 1,
      rating: 4.4
    }
  ];

  const categories = ["HVAC", "Plumbing", "Electrical", "Cleaning", "Electronics", "General"];

  const maintenanceStats = {
    totalRequests: maintenanceRequests.length,
    pending: maintenanceRequests.filter(r => r.status === "pending").length,
    inProgress: maintenanceRequests.filter(r => r.status === "in-progress" || r.status === "assigned").length,
    completed: maintenanceRequests.filter(r => r.status === "completed").length,
    averageResponseTime: "2.5 hours",
    totalCost: maintenanceRequests.reduce((sum, r) => sum + r.cost, 0)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-red-100 text-red-800 border-red-200";
      case "assigned": return "bg-blue-100 text-blue-800 border-blue-200";
      case "in-progress": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <AlertTriangle className="h-4 w-4" />;
      case "assigned": return <User className="h-4 w-4" />;
      case "in-progress": return <Clock className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const handleAssignRequest = (requestId: string, staffId: string) => {
    toast({
      title: "Request Assigned",
      description: "Maintenance request has been assigned successfully",
    });
  };

  const handleUpdateStatus = (requestId: string, newStatus: string) => {
    toast({
      title: "Status Updated", 
      description: `Request status updated to ${newStatus}`,
    });
  };

  const handleCreateRequest = () => {
    toast({
      title: "Request Created",
      description: "New maintenance request has been submitted",
    });
  };

  const filteredRequests = maintenanceRequests.filter(request => {
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;
    const matchesSearch = searchTerm === "" || 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Maintenance Requests</h1>
          <p className="text-slate-600 dark:text-slate-400">Track and manage facility maintenance issues</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Maintenance Request</DialogTitle>
              <DialogDescription>Submit a new maintenance issue for tracking</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Issue Title</Label>
                <Input id="title" placeholder="Brief description of the issue" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="Room number or area" />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat.toLowerCase()}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea id="description" placeholder="Provide detailed information about the issue..." rows={4} />
              </div>
              <div>
                <Label htmlFor="reporter">Reporter</Label>
                <Input id="reporter" placeholder="Your name or department" />
              </div>
              <Button className="w-full" onClick={handleCreateRequest}>
                <Wrench className="mr-2 h-4 w-4" />
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requests">All Requests</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
                    <p className="text-2xl font-bold">{maintenanceStats.totalRequests}</p>
                  </div>
                  <Wrench className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
                    <p className="text-2xl font-bold">{maintenanceStats.pending}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">In Progress</p>
                    <p className="text-2xl font-bold">{maintenanceStats.inProgress}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Completed</p>
                    <p className="text-2xl font-bold">{maintenanceStats.completed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg Response</p>
                    <p className="text-lg font-bold">{maintenanceStats.averageResponseTime}</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Cost</p>
                    <p className="text-lg font-bold">KES {maintenanceStats.totalCost.toLocaleString()}</p>
                  </div>
                  <span className="text-2xl">💰</span>
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
                    placeholder="Search requests..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(request.status)}
                        <h4 className="font-medium text-lg">{request.title}</h4>
                        <Badge className={getPriorityColor(request.priority)}>
                          {request.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {request.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{request.location}</span>
                        </span>
                        <span>Category: {request.category}</span>
                        <span>Reporter: {request.reporter}</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{request.dateReported}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        ID: {request.id}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <strong>Assignee:</strong> {request.assignee || "Unassigned"}
                    </div>
                    <div>
                      <strong>Est. Completion:</strong> {request.estimatedCompletion || "TBD"}
                    </div>
                    <div>
                      <strong>Cost:</strong> KES {request.cost.toLocaleString()}
                    </div>
                  </div>

                  {request.partsNeeded.length > 0 && (
                    <div className="mb-4">
                      <strong className="text-sm">Parts Needed:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {request.partsNeeded.map((part, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {part}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      {request.status === "pending" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <User className="mr-1 h-3 w-3" />
                              Assign
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Request</DialogTitle>
                              <DialogDescription>Assign this maintenance request to a staff member</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="staff">Staff Member</Label>
                                <Select>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select staff member" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {maintenanceStaff.map(staff => (
                                      <SelectItem key={staff.id} value={staff.id}>
                                        {staff.name} - {staff.role} ({staff.status})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="deadline">Expected Completion</Label>
                                <Input id="deadline" type="datetime-local" />
                              </div>
                              <div>
                                <Label htmlFor="assignNotes">Assignment Notes</Label>
                                <Textarea id="assignNotes" placeholder="Special instructions..." />
                              </div>
                              <Button 
                                className="w-full"
                                onClick={() => handleAssignRequest(request.id, "MT001")}
                              >
                                Assign Request
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateStatus(request.id, "completed")}
                      >
                        Update Status
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      {request.photos.length > 0 && (
                        <Button size="sm" variant="ghost">
                          <Camera className="mr-1 h-3 w-3" />
                          {request.photos.length} Photos
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maintenanceStaff.map((staff) => (
              <Card key={staff.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">{staff.name}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{staff.role}</p>
                    </div>
                    <Badge className={staff.status === "available" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {staff.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <p><strong>Specialties:</strong> {staff.specialties.join(", ")}</p>
                    <p><strong>Current Tasks:</strong> {staff.currentTasks}</p>
                    <p><strong>Rating:</strong> ⭐ {staff.rating}/5.0</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1">
                      View Tasks
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

        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parts & Supplies Inventory</CardTitle>
              <CardDescription>Track maintenance parts and supplies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["AC Filters", "Faucet Washers", "Light Switches", "Paint", "Cleaning Supplies"].map((item, index) => (
                  <div key={item} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{item}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Last restocked: 2024-01-{10 + index}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{Math.floor(Math.random() * 50) + 10} units</p>
                      <Badge variant={Math.random() > 0.3 ? "default" : "destructive"}>
                        {Math.random() > 0.3 ? "In Stock" : "Low Stock"}
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
                <CardTitle>Request Categories</CardTitle>
                <CardDescription>Breakdown by maintenance type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categories.map((category) => {
                    const count = maintenanceRequests.filter(r => r.category === category).length;
                    const percentage = Math.round((count / maintenanceRequests.length) * 100);
                    
                    return (
                      <div key={category} className="flex items-center justify-between">
                        <span className="font-medium">{category}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full">
                            <div 
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Monthly maintenance statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Completion Rate</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg Response Time</span>
                    <span className="font-medium">2.5 hours</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Guest Satisfaction</span>
                    <span className="font-medium">4.6/5.0</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Monthly Cost</span>
                    <span className="font-medium">KES {maintenanceStats.totalCost.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MaintenanceRequests;
