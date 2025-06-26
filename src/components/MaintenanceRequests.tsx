
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Wrench, AlertTriangle, CheckCircle, Clock, User, MapPin, Calendar, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MaintenanceRequest {
  id: number;
  roomNumber: string;
  issue: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "completed" | "cancelled";
  reportedBy: string;
  assignedTo?: string;
  reportedAt: string;
  completedAt?: string;
  estimatedCost?: number;
}

const MaintenanceRequests = () => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([
    {
      id: 1,
      roomNumber: "205",
      issue: "Air Conditioning",
      description: "AC unit not cooling properly, making loud noises",
      priority: "high",
      status: "in-progress",
      reportedBy: "Guest - Alice Johnson",
      assignedTo: "Mike Thompson",
      reportedAt: "2024-01-15 10:30",
      estimatedCost: 150
    },
    {
      id: 2,
      roomNumber: "301",
      issue: "Plumbing",
      description: "Bathroom faucet leaking continuously",
      priority: "medium",
      status: "open",
      reportedBy: "Housekeeping - Maria Santos",
      reportedAt: "2024-01-15 14:20"
    },
    {
      id: 3,
      roomNumber: "110",
      issue: "Electrical",
      description: "Light switch in bedroom not working",
      priority: "low",
      status: "completed",
      reportedBy: "Guest - Robert Smith",
      assignedTo: "John Davis",
      reportedAt: "2024-01-14 16:45",
      completedAt: "2024-01-15 09:15",
      estimatedCost: 75
    },
    {
      id: 4,
      roomNumber: "Lobby",
      issue: "Safety",
      description: "Emergency exit door handle broken",
      priority: "urgent",
      status: "in-progress",
      reportedBy: "Security - David Wilson",
      assignedTo: "Mike Thompson",
      reportedAt: "2024-01-15 08:00",
      estimatedCost: 200
    }
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    roomNumber: "",
    issue: "",
    description: "",
    priority: "medium" as const,
    reportedBy: ""
  });

  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "in-progress": return "bg-blue-100 text-blue-800";
      case "open": return "bg-yellow-100 text-yellow-800";
      case "cancelled": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getIssueIcon = (issue: string) => {
    const lowerIssue = issue.toLowerCase();
    if (lowerIssue.includes("electrical")) return "⚡";
    if (lowerIssue.includes("plumbing")) return "🚿";
    if (lowerIssue.includes("air") || lowerIssue.includes("ac")) return "❄️";
    if (lowerIssue.includes("safety")) return "🚨";
    return "🔧";
  };

  const updateRequestStatus = (requestId: number, newStatus: string) => {
    setRequests(prev => prev.map(request => 
      request.id === requestId 
        ? { 
            ...request, 
            status: newStatus as MaintenanceRequest['status'],
            completedAt: newStatus === "completed" ? new Date().toISOString() : undefined
          }
        : request
    ));

    toast({
      title: "Request Updated",
      description: `Maintenance request status changed to ${newStatus}`,
    });
  };

  const addNewRequest = () => {
    if (!newRequest.roomNumber || !newRequest.issue || !newRequest.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const request: MaintenanceRequest = {
      id: Date.now(),
      ...newRequest,
      status: "open",
      reportedAt: new Date().toISOString(),
    };

    setRequests(prev => [request, ...prev]);
    setNewRequest({
      roomNumber: "",
      issue: "",
      description: "",
      priority: "medium",
      reportedBy: ""
    });
    setIsDialogOpen(false);

    toast({
      title: "Request Created",
      description: "New maintenance request has been added",
    });
  };

  const requestStats = {
    total: requests.length,
    open: requests.filter(r => r.status === "open").length,
    inProgress: requests.filter(r => r.status === "in-progress").length,
    completed: requests.filter(r => r.status === "completed").length,
    urgent: requests.filter(r => r.priority === "urgent").length
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Maintenance Requests</h2>
        <p className="text-slate-600">Track and manage property maintenance issues</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{requestStats.total}</div>
            <div className="text-sm opacity-90">Total Requests</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{requestStats.open}</div>
            <div className="text-sm opacity-90">Open</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{requestStats.inProgress}</div>
            <div className="text-sm opacity-90">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{requestStats.completed}</div>
            <div className="text-sm opacity-90">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{requestStats.urgent}</div>
            <div className="text-sm opacity-90">Urgent</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Maintenance Requests</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Maintenance Request</DialogTitle>
                  <DialogDescription>
                    Report a new maintenance issue that needs attention.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="room">Room Number</Label>
                    <Input
                      id="room"
                      value={newRequest.roomNumber}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, roomNumber: e.target.value }))}
                      placeholder="e.g., 205 or Lobby"
                    />
                  </div>
                  <div>
                    <Label htmlFor="issue">Issue Type</Label>
                    <Select onValueChange={(value) => setNewRequest(prev => ({ ...prev, issue: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Plumbing">Plumbing</SelectItem>
                        <SelectItem value="Electrical">Electrical</SelectItem>
                        <SelectItem value="Air Conditioning">Air Conditioning</SelectItem>
                        <SelectItem value="Heating">Heating</SelectItem>
                        <SelectItem value="Safety">Safety</SelectItem>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newRequest.description}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the issue in detail..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select onValueChange={(value) => setNewRequest(prev => ({ ...prev, priority: value as any }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
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
                    <Label htmlFor="reportedBy">Reported By</Label>
                    <Input
                      id="reportedBy"
                      value={newRequest.reportedBy}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, reportedBy: e.target.value }))}
                      placeholder="Your name or role"
                    />
                  </div>
                  <Button onClick={addNewRequest} className="w-full">
                    Create Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {request.roomNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getIssueIcon(request.issue)}</span>
                      {request.issue}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {request.description}
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(request.priority)}>
                      {request.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {request.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {request.assignedTo.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        {request.assignedTo}
                      </div>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(request.reportedAt).toLocaleDateString()}</div>
                      <div className="text-slate-500">{request.reportedBy}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select onValueChange={(value) => updateRequestStatus(request.id, value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Update" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MaintenanceRequests;
