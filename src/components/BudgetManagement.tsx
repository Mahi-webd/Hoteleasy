
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Target, Calendar, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BudgetManagement = () => {
  const { toast } = useToast();
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [budgets, setBudgets] = useState([
    {
      id: 1,
      name: "Operations Budget 2024",
      category: "Operations",
      allocated: 500000,
      spent: 320000,
      remaining: 180000,
      period: "Annual",
      status: "On Track"
    },
    {
      id: 2,
      name: "Marketing Q1 2024",
      category: "Marketing",
      allocated: 100000,
      spent: 85000,
      remaining: 15000,
      period: "Quarterly",
      status: "Near Limit"
    },
    {
      id: 3,
      name: "Maintenance Fund",
      category: "Maintenance",
      allocated: 200000,
      spent: 120000,
      remaining: 80000,
      period: "Annual",
      status: "On Track"
    }
  ]);

  const categories = [
    "Operations", "Marketing", "Maintenance", "Staffing", "Utilities", "Food & Beverage", "Technology", "Other"
  ];

  const handleCreateBudget = (budgetData: any) => {
    const newBudget = {
      id: budgets.length + 1,
      name: budgetData.name,
      category: budgetData.category,
      allocated: parseInt(budgetData.allocated),
      spent: 0,
      remaining: parseInt(budgetData.allocated),
      period: budgetData.period,
      status: "On Track"
    };

    setBudgets([...budgets, newBudget]);
    setShowCreateBudget(false);
    toast({
      title: "Budget Created",
      description: `Budget "${budgetData.name}" has been created successfully`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "On Track": return "bg-green-100 text-green-800";
      case "Near Limit": return "bg-yellow-100 text-yellow-800";
      case "Over Budget": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getSpentPercentage = (spent: number, allocated: number) => {
    return Math.round((spent / allocated) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Budget Management</h2>
          <p className="text-slate-600 dark:text-slate-400">Monitor and manage hotel budgets and expenses</p>
        </div>
        <Dialog open={showCreateBudget} onOpenChange={setShowCreateBudget}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
              <DialogDescription>Set up a new budget for tracking expenses</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleCreateBudget({
                name: formData.get('name'),
                category: formData.get('category'),
                allocated: formData.get('allocated'),
                period: formData.get('period'),
                description: formData.get('description')
              });
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Budget Name</Label>
                  <Input name="name" id="name" placeholder="e.g., Marketing Q2 2024" required />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="allocated">Allocated Amount (KES)</Label>
                  <Input name="allocated" id="allocated" type="number" placeholder="e.g., 100000" required />
                </div>
                <div>
                  <Label htmlFor="period">Budget Period</Label>
                  <Select name="period" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                      <SelectItem value="Annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea name="description" id="description" placeholder="Budget description and notes..." />
                </div>
                <Button type="submit" className="w-full">Create Budget</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Allocated</p>
                <p className="text-2xl font-bold">
                  KES {budgets.reduce((sum, budget) => sum + budget.allocated, 0).toLocaleString()}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Total Spent</p>
                <p className="text-2xl font-bold">
                  KES {budgets.reduce((sum, budget) => sum + budget.spent, 0).toLocaleString()}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Total Remaining</p>
                <p className="text-2xl font-bold">
                  KES {budgets.reduce((sum, budget) => sum + budget.remaining, 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Active Budgets</p>
                <p className="text-2xl font-bold">{budgets.length}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.map((budget) => (
          <Card key={budget.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{budget.name}</CardTitle>
                  <CardDescription>{budget.category} • {budget.period}</CardDescription>
                </div>
                <Badge className={getStatusColor(budget.status)}>
                  {budget.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Budget Progress</span>
                  <span>{getSpentPercentage(budget.spent, budget.allocated)}%</span>
                </div>
                <Progress 
                  value={getSpentPercentage(budget.spent, budget.allocated)} 
                  className="h-2"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Allocated</p>
                  <p className="font-semibold">KES {budget.allocated.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Spent</p>
                  <p className="font-semibold text-red-600">KES {budget.spent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Remaining</p>
                  <p className="font-semibold text-green-600">KES {budget.remaining.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  View Details
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Add Expense
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget Analysis */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Budget Analysis</CardTitle>
          <CardDescription>Insights and recommendations for budget management</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Category Breakdown</h4>
                  <div className="space-y-2">
                    {categories.slice(0, 4).map((category) => {
                      const categoryBudgets = budgets.filter(b => b.category === category);
                      const totalSpent = categoryBudgets.reduce((sum, b) => sum + b.spent, 0);
                      const totalAllocated = categoryBudgets.reduce((sum, b) => sum + b.allocated, 0);
                      
                      if (totalAllocated === 0) return null;
                      
                      return (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-sm">{category}</span>
                          <div className="flex items-center space-x-2">
                            <Progress 
                              value={Math.round((totalSpent / totalAllocated) * 100)} 
                              className="w-20 h-2"
                            />
                            <span className="text-xs text-slate-600">
                              {Math.round((totalSpent / totalAllocated) * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Performance Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Budgets On Track:</span>
                      <span className="text-green-600 font-semibold">
                        {budgets.filter(b => b.status === "On Track").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Near Budget Limit:</span>
                      <span className="text-yellow-600 font-semibold">
                        {budgets.filter(b => b.status === "Near Limit").length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Over Budget:</span>
                      <span className="text-red-600 font-semibold">
                        {budgets.filter(b => b.status === "Over Budget").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="trends">
              <p className="text-slate-600 dark:text-slate-400">Budget trend analysis would be displayed here with charts and historical data.</p>
            </TabsContent>
            <TabsContent value="alerts">
              <div className="space-y-3">
                {budgets
                  .filter(budget => budget.status !== "On Track")
                  .map(budget => (
                    <div key={budget.id} className="flex items-center space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-sm">{budget.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {budget.status === "Near Limit" ? 
                            `Budget is at ${getSpentPercentage(budget.spent, budget.allocated)}% utilization` :
                            "Budget has exceeded the allocated amount"
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                {budgets.filter(budget => budget.status !== "On Track").length === 0 && (
                  <p className="text-slate-600 dark:text-slate-400">No budget alerts at this time.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetManagement;
