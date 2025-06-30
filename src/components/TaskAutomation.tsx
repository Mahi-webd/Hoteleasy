
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Bot, Clock, Bell, CheckCircle, AlertTriangle, Calendar,
  Users, Bed, Coffee, Wrench, MessageSquare, BarChart3,
  Settings, Plus, Play, Pause, RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TaskAutomation = () => {
  const [activeAutomations, setActiveAutomations] = useState<string[]>(["daily-checklist", "inventory-alerts"]);
  const { toast } = useToast();

  // Automation rules
  const automationRules = [
    {
      id: "daily-checklist",
      title: "Daily Operations Checklist",
      description: "Automatically generate daily task lists based on occupancy",
      category: "Operations",
      trigger: "Every day at 6:00 AM",
      icon: CheckCircle,
      color: "green",
      active: true,
      lastRun: "Today at 6:00 AM",
      tasksGenerated: 12
    },
    {
      id: "inventory-alerts",
      title: "Low Inventory Alerts",
      description: "Send notifications when supplies run below threshold",
      category: "Inventory",
      trigger: "Real-time monitoring",
      icon: AlertTriangle,
      color: "yellow",
      active: true,
      lastRun: "15 minutes ago",
      alertsSent: 3
    },
    {
      id: "guest-followup",
      title: "Guest Follow-up Messages",
      description: "Send automated messages based on guest activity",
      category: "Guest Service",
      trigger: "Based on check-in/out",
      icon: MessageSquare,
      color: "blue",
      active: false,
      lastRun: "Yesterday at 2:30 PM",
      messagesSent: 8
    },
    {
      id: "maintenance-schedule",
      title: "Preventive Maintenance",
      description: "Schedule recurring maintenance tasks automatically",
      category: "Maintenance",
      trigger: "Weekly/Monthly schedules",
      icon: Wrench,
      color: "red",
      active: true,
      lastRun: "2 days ago",
      tasksCreated: 5
    },
    {
      id: "staff-reminders",
      title: "Staff Task Reminders",
      description: "Send reminders for upcoming shifts and tasks",
      category: "Staff",
      trigger: "2 hours before shift",
      icon: Bell,
      color: "purple",
      active: false,
      lastRun: "Today at 10:00 AM",
      remindersSent: 15
    },
    {
      id: "report-generation",
      title: "Automatic Reports",
      description: "Generate and email daily/weekly reports",
      category: "Reports",
      trigger: "Daily at 11:00 PM",
      icon: BarChart3,
      color: "indigo",
      active: true,
      lastRun: "Yesterday at 11:00 PM",
      reportsGenerated: 1
    }
  ];

  // Current active tasks
  const activeTasks = [
    { id: 1, title: "Check all room statuses", type: "Operations", priority: "High", dueIn: "30 min", automated: true },
    { id: 2, title: "Restock bathroom supplies (Rooms 101-105)", type: "Inventory", priority: "Medium", dueIn: "1 hour", automated: true },
    { id: 3, title: "Send welcome messages to new guests", type: "Guest Service", priority: "High", dueIn: "15 min", automated: true },
    { id: 4, title: "Schedule AC maintenance for Room 301", type: "Maintenance", priority: "Low", dueIn: "2 hours", automated: false },
    { id: 5, title: "Prepare checkout reminder messages", type: "Guest Service", priority: "Medium", dueIn: "45 min", automated: true }
  ];

  const toggleAutomation = (ruleId: string) => {
    if (activeAutomations.includes(ruleId)) {
      setActiveAutomations(prev => prev.filter(id => id !== ruleId));
      toast({
        title: "Automation Disabled",
        description: "The automation rule has been turned off",
      });
    } else {
      setActiveAutomations(prev => [...prev, ruleId]);
      toast({
        title: "Automation Enabled",
        description: "The automation rule is now active",
      });
    }
  };

  const runAutomationNow = (ruleId: string, title: string) => {
    toast({
      title: "Automation Running",
      description: `${title} is being executed now`,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return "bg-red-100 text-red-800 border-red-200";
      case "Medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Task Automation</h1>
          <p className="text-slate-600 dark:text-slate-400">Automate repetitive tasks and streamline operations</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            <Bot className="mr-1 h-3 w-3" />
            {activeAutomations.length} Active Rules
          </Badge>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="automations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="automations">Automation Rules</TabsTrigger>
          <TabsTrigger value="tasks">Active Tasks</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {automationRules.map((rule) => (
              <Card key={rule.id} className={`border-l-4 border-l-${rule.color}-500`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <rule.icon className={`h-8 w-8 text-${rule.color}-600`} />
                      <div>
                        <CardTitle className="text-lg">{rule.title}</CardTitle>
                        <CardDescription className="mt-1">{rule.description}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={activeAutomations.includes(rule.id)}
                      onCheckedChange={() => toggleAutomation(rule.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Category</Label>
                      <p className="font-medium">{rule.category}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Trigger</Label>
                      <p className="font-medium">{rule.trigger}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Last Run</Label>
                      <p className="font-medium">{rule.lastRun}</p>
                    </div>
                    <div>
                      <Label className="text-slate-600 dark:text-slate-400">Results</Label>
                      <p className="font-medium">
                        {rule.tasksGenerated && `${rule.tasksGenerated} tasks`}
                        {rule.alertsSent && `${rule.alertsSent} alerts`}
                        {rule.messagesSent && `${rule.messagesSent} messages`}
                        {rule.tasksCreated && `${rule.tasksCreated} tasks`}
                        {rule.remindersSent && `${rule.remindersSent} reminders`}
                        {rule.reportsGenerated && `${rule.reportsGenerated} report`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => runAutomationNow(rule.id, rule.title)}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Run Now
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today's Automated Tasks</CardTitle>
              <CardDescription>Tasks generated and managed by automation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-2 h-2 rounded-full ${task.automated ? 'bg-blue-500' : 'bg-gray-400'}`} />
                      <div>
                        <h4 className="font-medium">{task.title}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">{task.type}</Badge>
                          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                          {task.automated && (
                            <Badge variant="outline" className="text-xs">
                              <Bot className="mr-1 h-2 w-2" />
                              Auto
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Due in {task.dueIn}
                      </p>
                      <div className="flex space-x-2 mt-2">
                        <Button size="sm" variant="outline">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Complete
                        </Button>
                        <Button size="sm" variant="outline">
                          <Pause className="mr-1 h-3 w-3" />
                          Defer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automation History</CardTitle>
              <CardDescription>Recent automation executions and their results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "Today at 6:00 AM", rule: "Daily Operations Checklist", result: "12 tasks generated", status: "success" },
                  { time: "Today at 5:45 AM", rule: "Low Inventory Alerts", result: "3 alerts sent", status: "success" },
                  { time: "Yesterday at 11:00 PM", rule: "Automatic Reports", result: "Daily report generated", status: "success" },
                  { time: "Yesterday at 6:00 PM", rule: "Guest Follow-up Messages", result: "8 messages sent", status: "success" },
                  { time: "Yesterday at 2:00 PM", rule: "Preventive Maintenance", result: "5 tasks scheduled", status: "success" },
                  { time: "Yesterday at 10:00 AM", rule: "Staff Task Reminders", result: "Failed to send 2 reminders", status: "error" }
                ].map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        entry.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="font-medium">{entry.rule}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{entry.result}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{entry.time}</p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          entry.status === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {entry.status === 'success' ? 'Success' : 'Error'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaskAutomation;
