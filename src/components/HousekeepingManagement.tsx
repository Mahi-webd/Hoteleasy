
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Clock, AlertTriangle, User, MapPin, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HousekeepingTask {
  id: number;
  roomNumber: string;
  taskType: "cleaning" | "maintenance" | "inspection" | "deep-clean";
  status: "pending" | "in-progress" | "completed" | "needs-attention";
  assignedTo: string;
  priority: "low" | "medium" | "high";
  estimatedTime: string;
  notes?: string;
  completedAt?: string;
}

const HousekeepingManagement = () => {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([
    {
      id: 1,
      roomNumber: "101",
      taskType: "cleaning",
      status: "completed",
      assignedTo: "Maria Santos",
      priority: "medium",
      estimatedTime: "45 min",
      completedAt: "10:30 AM"
    },
    {
      id: 2,
      roomNumber: "205",
      taskType: "cleaning",
      status: "in-progress",
      assignedTo: "James Wilson",
      priority: "high",
      estimatedTime: "30 min"
    },
    {
      id: 3,
      roomNumber: "301",
      taskType: "maintenance",
      status: "needs-attention",
      assignedTo: "Sarah Johnson",
      priority: "high",
      estimatedTime: "60 min",
      notes: "Bathroom faucet needs repair"
    },
    {
      id: 4,
      roomNumber: "150",
      taskType: "deep-clean",
      status: "pending",
      assignedTo: "Maria Santos",
      priority: "low",
      estimatedTime: "120 min"
    }
  ]);

  const [selectedFilter, setSelectedFilter] = useState("all");
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "in-progress": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "needs-attention": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case "cleaning": return "🧹";
      case "maintenance": return "🔧";
      case "inspection": return "🔍";
      case "deep-clean": return "✨";
      default: return "📋";
    }
  };

  const updateTaskStatus = (taskId: number, newStatus: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { 
            ...task, 
            status: newStatus as HousekeepingTask['status'],
            completedAt: newStatus === "completed" ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
          }
        : task
    ));

    toast({
      title: "Task Updated",
      description: `Task status changed to ${newStatus}`,
    });
  };

  const filteredTasks = selectedFilter === "all" 
    ? tasks 
    : tasks.filter(task => task.status === selectedFilter);

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    pending: tasks.filter(t => t.status === "pending").length,
    needsAttention: tasks.filter(t => t.status === "needs-attention").length
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Housekeeping Management</h2>
        <p className="text-slate-600">Manage room cleaning and maintenance tasks</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{taskStats.total}</div>
            <div className="text-sm opacity-90">Total Tasks</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{taskStats.completed}</div>
            <div className="text-sm opacity-90">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{taskStats.inProgress}</div>
            <div className="text-sm opacity-90">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{taskStats.pending}</div>
            <div className="text-sm opacity-90">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{taskStats.needsAttention}</div>
            <div className="text-sm opacity-90">Need Attention</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Actions */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Housekeeping Tasks</CardTitle>
            <div className="flex gap-2">
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="needs-attention">Needs Attention</SelectItem>
                </SelectContent>
              </Select>
              <Button>Add New Task</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Task Type</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Est. Time</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {task.roomNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getTaskTypeIcon(task.taskType)}</span>
                      <span className="capitalize">{task.taskType.replace('-', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {task.assignedTo.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {task.assignedTo}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {task.estimatedTime}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-32 truncate">
                    {task.notes || '-'}
                  </TableCell>
                  <TableCell>
                    <Select onValueChange={(value) => updateTaskStatus(task.id, value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Update" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="needs-attention">Needs Attention</SelectItem>
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

export default HousekeepingManagement;
