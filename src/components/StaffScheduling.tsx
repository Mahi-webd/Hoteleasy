
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Users, Calendar as CalendarIcon, UserCheck, AlertTriangle, Coffee, Plus, Filter, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const StaffScheduling = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const { toast } = useToast();

  // Mock staff data
  const staffMembers = [
    {
      id: "S001",
      name: "Alice Johnson",
      department: "Front Desk",
      position: "Receptionist",
      email: "alice@hotel.com",
      phone: "+254 700 123456",
      status: "active",
      shifts: [
        { date: "2024-01-15", start: "08:00", end: "16:00", type: "morning" },
        { date: "2024-01-16", start: "08:00", end: "16:00", type: "morning" }
      ]
    },
    {
      id: "S002", 
      name: "Bob Wilson",
      department: "Housekeeping",
      position: "Housekeeper",
      email: "bob@hotel.com",
      phone: "+254 700 234567",
      status: "active",
      shifts: [
        { date: "2024-01-15", start: "06:00", end: "14:00", type: "morning" },
        { date: "2024-01-17", start: "14:00", end: "22:00", type: "evening" }
      ]
    },
    {
      id: "S003",
      name: "Carol Davis",
      department: "Restaurant", 
      position: "Server",
      email: "carol@hotel.com",
      phone: "+254 700 345678",
      status: "active",
      shifts: [
        { date: "2024-01-15", start: "12:00", end: "20:00", type: "evening" },
        { date: "2024-01-16", start: "06:00", end: "14:00", type: "morning" }
      ]
    },
    {
      id: "S004",
      name: "David Brown",
      department: "Maintenance",
      position: "Technician", 
      email: "david@hotel.com",
      phone: "+254 700 456789",
      status: "off",
      shifts: []
    },
    {
      id: "S005",
      name: "Emma Taylor",
      department: "Security",
      position: "Security Guard",
      email: "emma@hotel.com", 
      phone: "+254 700 567890",
      status: "active",
      shifts: [
        { date: "2024-01-15", start: "22:00", end: "06:00", type: "night" },
        { date: "2024-01-16", start: "22:00", end: "06:00", type: "night" }
      ]
    }
  ];

  const departments = ["Front Desk", "Housekeeping", "Restaurant", "Maintenance", "Security"];

  const shiftStats = {
    totalStaff: staffMembers.length,
    onDuty: staffMembers.filter(s => s.status === "active").length,
    offDuty: staffMembers.filter(s => s.status === "off").length,
    overtime: 2
  };

  const handleAddShift = (staffId: string) => {
    toast({
      title: "Shift Added",
      description: "New shift has been scheduled successfully",
    });
  };

  const handleRequestTimeOff = (staffId: string) => {
    toast({
      title: "Time Off Requested",
      description: "Time off request has been submitted for approval",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 border-green-200";
      case "off": return "bg-red-100 text-red-800 border-red-200";
      case "break": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case "morning": return "bg-blue-100 text-blue-800";
      case "evening": return "bg-orange-100 text-orange-800";
      case "night": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredStaff = staffMembers.filter(staff => {
    return departmentFilter === "all" || staff.department === departmentFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Staff Scheduling</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage staff schedules and assignments</p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
                <DialogDescription>Enter staff member details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="staffName">Full Name</Label>
                  <Input id="staffName" placeholder="Enter full name" />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept.toLowerCase().replace(' ', '-')}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input id="position" placeholder="Job title" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="email@hotel.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+254 700 000000" />
                </div>
                <Button className="w-full">Add Staff Member</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="staff">Staff List</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          {/* Schedule Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Staff</p>
                    <p className="text-2xl font-bold">{shiftStats.totalStaff}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">On Duty</p>
                    <p className="text-2xl font-bold">{shiftStats.onDuty}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Off Duty</p>
                    <p className="text-2xl font-bold">{shiftStats.offDuty}</p>
                  </div>
                  <Coffee className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Overtime</p>
                    <p className="text-2xl font-bold">{shiftStats.overtime}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Schedule</CardTitle>
                  <CardDescription>Current week staff assignments</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    This Week
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredStaff.map((staff) => (
                  <div key={staff.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{staff.name}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {staff.position} • {staff.department}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(staff.status)}>
                          {staff.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {staff.shifts.map((shift, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <Badge variant="outline" className={getShiftTypeColor(shift.type)}>
                            {shift.date}: {shift.start} - {shift.end}
                          </Badge>
                        </div>
                      ))}
                      {staff.shifts.length === 0 && (
                        <span className="text-sm text-slate-500">No shifts scheduled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing {filteredStaff.length} staff members
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((staff) => (
              <Card key={staff.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">{staff.name}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{staff.position}</p>
                    </div>
                    <Badge className={getStatusColor(staff.status)}>
                      {staff.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><strong>Department:</strong> {staff.department}</p>
                    <p><strong>Email:</strong> {staff.email}</p>
                    <p><strong>Phone:</strong> {staff.phone}</p>
                    <p><strong>Shifts this week:</strong> {staff.shifts.length}</p>
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="flex-1">
                          <Clock className="mr-1 h-3 w-3" />
                          Schedule
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Schedule Shift - {staff.name}</DialogTitle>
                          <DialogDescription>Add a new shift for this staff member</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="shiftDate">Date</Label>
                            <Input id="shiftDate" type="date" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="startTime">Start Time</Label>
                              <Input id="startTime" type="time" />
                            </div>
                            <div>
                              <Label htmlFor="endTime">End Time</Label>
                              <Input id="endTime" type="time" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="shiftType">Shift Type</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select shift type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="morning">Morning</SelectItem>
                                <SelectItem value="evening">Evening</SelectItem>
                                <SelectItem value="night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" placeholder="Additional notes..." />
                          </div>
                          <Button 
                            className="w-full"
                            onClick={() => handleAddShift(staff.id)}
                          >
                            Schedule Shift
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleRequestTimeOff(staff.id)}
                    >
                      Time Off
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance</CardTitle>
              <CardDescription>Track staff check-in and check-out times</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staffMembers.slice(0, 5).map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{staff.name}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{staff.department}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">Check-in: 08:00</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Status: {staff.status === "active" ? "Present" : "Absent"}
                        </p>
                      </div>
                      <Badge className={getStatusColor(staff.status)}>
                        {staff.status === "active" ? "Present" : "Absent"}
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
                <CardTitle>Department Summary</CardTitle>
                <CardDescription>Staff distribution by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departments.map((dept) => {
                    const count = staffMembers.filter(s => s.department === dept).length;
                    return (
                      <div key={dept} className="flex items-center justify-between">
                        <span className="font-medium">{dept}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full">
                            <div 
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${(count / staffMembers.length) * 100}%` }}
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
                <CardTitle>Weekly Hours</CardTitle>
                <CardDescription>Total working hours by staff</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {staffMembers.slice(0, 5).map((staff) => (
                    <div key={staff.id} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{staff.name}</span>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{staff.department}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          {staff.shifts.length * 8} hours
                        </span>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {staff.shifts.length} shifts
                        </p>
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

export default StaffScheduling;
