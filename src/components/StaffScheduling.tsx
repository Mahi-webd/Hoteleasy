
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Users, User, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StaffMember {
  id: number;
  name: string;
  role: "manager" | "receptionist" | "housekeeping" | "maintenance" | "security" | "restaurant";
  department: string;
  phone: string;
  email: string;
  status: "active" | "inactive" | "on-leave";
}

interface Shift {
  id: number;
  staffId: number;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
}

const StaffScheduling = () => {
  const [staff] = useState<StaffMember[]>([
    {
      id: 1,
      name: "Sarah Johnson",
      role: "manager",
      department: "Administration",
      phone: "+254-700-123456",
      email: "sarah@olsupat.com",
      status: "active"
    },
    {
      id: 2,
      name: "Maria Santos",
      role: "housekeeping",
      department: "Housekeeping",
      phone: "+254-700-234567",
      email: "maria@olsupat.com",
      status: "active"
    },
    {
      id: 3,
      name: "James Wilson",
      role: "receptionist",
      department: "Front Desk",
      phone: "+254-700-345678",
      email: "james@olsupat.com",
      status: "active"
    },
    {
      id: 4,
      name: "Mike Thompson",
      role: "maintenance",
      department: "Maintenance",
      phone: "+254-700-456789",
      email: "mike@olsupat.com",
      status: "active"
    },
    {
      id: 5,
      name: "Lisa Chen",
      role: "restaurant",
      department: "Restaurant",
      phone: "+254-700-567890",
      email: "lisa@olsupat.com",
      status: "on-leave"
    }
  ]);

  const [shifts, setShifts] = useState<Shift[]>([
    {
      id: 1,
      staffId: 3,
      date: "2024-01-16",
      startTime: "08:00",
      endTime: "16:00",
      position: "Front Desk - Morning",
      status: "scheduled"
    },
    {
      id: 2,
      staffId: 2,
      date: "2024-01-16",
      startTime: "09:00",
      endTime: "17:00",
      position: "Housekeeping",
      status: "scheduled"
    },
    {
      id: 3,
      staffId: 4,
      date: "2024-01-16",
      startTime: "10:00",
      endTime: "18:00",
      position: "Maintenance",
      status: "scheduled"
    },
    {
      id: 4,
      staffId: 1,
      date: "2024-01-15",
      startTime: "08:00",
      endTime: "20:00",
      position: "Manager",
      status: "completed"
    }
  ]);

  const [selectedDate, setSelectedDate] = useState("2024-01-16");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    staffId: "",
    date: "",
    startTime: "",
    endTime: "",
    position: ""
  });

  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      case "on-leave": return "bg-yellow-100 text-yellow-800";
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "no-show": return "bg-red-100 text-red-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "manager": return "bg-purple-100 text-purple-800";
      case "receptionist": return "bg-blue-100 text-blue-800";
      case "housekeeping": return "bg-green-100 text-green-800";
      case "maintenance": return "bg-orange-100 text-orange-800";
      case "security": return "bg-red-100 text-red-800";
      case "restaurant": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const addNewShift = () => {
    if (!newShift.staffId || !newShift.date || !newShift.startTime || !newShift.endTime || !newShift.position) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const shift: Shift = {
      id: Date.now(),
      staffId: parseInt(newShift.staffId),
      date: newShift.date,
      startTime: newShift.startTime,
      endTime: newShift.endTime,
      position: newShift.position,
      status: "scheduled"
    };

    setShifts(prev => [...prev, shift]);
    setNewShift({
      staffId: "",
      date: "",
      startTime: "",
      endTime: "",
      position: ""
    });
    setIsScheduleDialogOpen(false);

    toast({
      title: "Shift Scheduled",
      description: "New shift has been added to the schedule",
    });
  };

  const updateShiftStatus = (shiftId: number, newStatus: string) => {
    setShifts(prev => prev.map(shift => 
      shift.id === shiftId 
        ? { ...shift, status: newStatus as Shift['status'] }
        : shift
    ));

    toast({
      title: "Shift Updated",
      description: `Shift status changed to ${newStatus}`,
    });
  };

  const filteredShifts = shifts.filter(shift => shift.date === selectedDate);

  const todayShifts = shifts.filter(shift => shift.date === new Date().toISOString().split('T')[0]);
  const activeStaff = staff.filter(s => s.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Staff Scheduling</h2>
        <p className="text-slate-600">Manage staff schedules and shifts</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{staff.length}</div>
            <div className="text-sm opacity-90">Total Staff</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{activeStaff}</div>
            <div className="text-sm opacity-90">Active Staff</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{todayShifts.length}</div>
            <div className="text-sm opacity-90">Today's Shifts</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{staff.filter(s => s.status === "on-leave").length}</div>
            <div className="text-sm opacity-90">On Leave</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff List */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-slate-500">{member.department}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(member.status)}>
                        {member.status.replace('-', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
                <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Shift
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule New Shift</DialogTitle>
                      <DialogDescription>
                        Create a new shift assignment for a staff member.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="staff">Staff Member</Label>
                        <Select onValueChange={(value) => setNewShift(prev => ({ ...prev, staffId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                          <SelectContent>
                            {staff.filter(s => s.status === "active").map((member) => (
                              <SelectItem key={member.id} value={member.id.toString()}>
                                {member.name} - {member.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={newShift.date}
                          onChange={(e) => setNewShift(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="startTime">Start Time</Label>
                          <Input
                            id="startTime"
                            type="time"
                            value={newShift.startTime}
                            onChange={(e) => setNewShift(prev => ({ ...prev, startTime: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endTime">End Time</Label>
                          <Input
                            id="endTime"
                            type="time"
                            value={newShift.endTime}
                            onChange={(e) => setNewShift(prev => ({ ...prev, endTime: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="position">Position/Notes</Label>
                        <Input
                          id="position"
                          value={newShift.position}
                          onChange={(e) => setNewShift(prev => ({ ...prev, position: e.target.value }))}
                          placeholder="e.g., Front Desk - Morning Shift"
                        />
                      </div>
                      <Button onClick={addNewShift} className="w-full">
                        Schedule Shift
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredShifts.map((shift) => {
                const staffMember = staff.find(s => s.id === shift.staffId);
                return (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {staffMember?.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{staffMember?.name}</div>
                        <div className="text-sm text-slate-600">{shift.position}</div>
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Clock className="h-3 w-3" />
                          {shift.startTime} - {shift.endTime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(shift.status)}>
                        {shift.status.replace('-', ' ')}
                      </Badge>
                      <Select onValueChange={(value) => updateShiftStatus(shift.id, value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Update" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="no-show">No Show</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
              {filteredShifts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No shifts scheduled for {selectedDate}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffScheduling;
