
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, TrendingDown, DollarSign, Plus, AlertTriangle, CheckCircle } from "lucide-react";

const BudgetManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const budgetData = [
    {
      department: "Rooms",
      budgeted: 1200000,
      actual: 1350000,
      variance: 150000,
      variancePercent: 12.5,
      status: "Over Budget"
    },
    {
      department: "F&B",
      budgeted: 400000,
      actual: 465000,
      variance: 65000,
      variancePercent: 16.25,
      status: "Over Budget"
    },
    {
      department: "Spa",
      budgeted: 120000,
      actual: 135000,
      variance: 15000,
      variancePercent: 12.5,
      status: "Over Budget"
    },
    {
      department: "Marketing",
      budgeted: 80000,
      actual: 72000,
      variance: -8000,
      variancePercent: -10,
      status: "Under Budget"
    },
    {
      department: "Operations",
      budgeted: 150000,
      actual: 148000,
      variance: -2000,
      variancePercent: -1.33,
      status: "On Track"
    }
  ];

  const expenseCategories = [
    {
      category: "Staff Costs",
      budgeted: 450000,
      actual: 465000,
      variance: 15000,
      percentage: 103.3
    },
    {
      category: "Utilities",
      budgeted: 85000,
      actual: 78000,
      variance: -7000,
      percentage: 91.8
    },
    {
      category: "Maintenance",
      budgeted: 65000,
      actual: 72000,
      variance: 7000,
      percentage: 110.8
    },
    {
      category: "Marketing",
      budgeted: 80000,
      actual: 72000,
      variance: -8000,
      percentage: 90
    },
    {
      category: "Supplies",
      budgeted: 120000,
      actual: 135000,
      variance: 15000,
      percentage: 112.5
    }
  ];

  const monthlyTargets = [
    { month: "Jul", target: 2100000, forecast: 2150000, confidence: 85 },
    { month: "Aug", target: 2200000, forecast: 2320000, confidence: 80 },
    { month: "Sep", target: 2000000, forecast: 2180000, confidence: 75 },
    { month: "Oct", target: 1950000, forecast: 2050000, confidence: 78 },
    { month: "Nov", target: 1800000, forecast: 1950000, confidence: 82 },
    { month: "Dec", target: 2300000, forecast: 2450000, confidence: 88 }
  ];

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-red-600";
    if (variance < 0) return "text-green-600";
    return "text-slate-600";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Over Budget":
        return "bg-red-100 text-red-800";
      case "Under Budget":
        return "bg-green-100 text-green-800";
      case "On Track":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Over Budget":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "Under Budget":
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case "On Track":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Target className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Budget Management</h2>
          <p className="text-slate-600">Budget planning, tracking, and variance analysis</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="rooms">Rooms</SelectItem>
              <SelectItem value="fb">F&B</SelectItem>
              <SelectItem value="spa">Spa</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Budget Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-6 w-6 text-blue-600" />
                  <Badge variant="outline">June 2025</Badge>
                </div>
                <h3 className="font-semibold text-sm text-slate-600 mb-1">Total Budget</h3>
                <p className="text-2xl font-bold text-slate-800">KES 1.95M</p>
                <p className="text-xs text-slate-500">Monthly allocation</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-6 w-6 text-green-600" />
                  <Badge variant="default" className="bg-green-100 text-green-800">+12.8%</Badge>
                </div>
                <h3 className="font-semibold text-sm text-slate-600 mb-1">Actual Spent</h3>
                <p className="text-2xl font-bold text-slate-800">KES 2.17M</p>
                <p className="text-xs text-slate-500">Current month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-6 w-6 text-red-600" />
                  <Badge variant="destructive">Over</Badge>
                </div>
                <h3 className="font-semibold text-sm text-slate-600 mb-1">Variance</h3>
                <p className="text-2xl font-bold text-red-600">KES 220K</p>
                <p className="text-xs text-slate-500">Above budget</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-6 w-6 text-purple-600" />
                  <Badge variant="outline">111%</Badge>
                </div>
                <h3 className="font-semibold text-sm text-slate-600 mb-1">Budget Usage</h3>
                <p className="text-2xl font-bold text-slate-800">111%</p>
                <p className="text-xs text-slate-500">Of allocated budget</p>
              </CardContent>
            </Card>
          </div>

          {/* Budget vs Actual Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Actual Performance</CardTitle>
              <CardDescription>Monthly budget tracking and variance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {budgetData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(item.status)}
                        <span className="font-medium">{item.department}</span>
                      </div>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Budgeted</p>
                        <p className="font-medium">KES {item.budgeted.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Actual</p>
                        <p className="font-medium">KES {item.actual.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Variance</p>
                        <p className={`font-medium ${getVarianceColor(item.variance)}`}>
                          {item.variance > 0 ? '+' : ''}KES {item.variance.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Variance %</p>
                        <p className={`font-medium ${getVarianceColor(item.variance)}`}>
                          {item.variancePercent > 0 ? '+' : ''}{item.variancePercent}%
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={Math.abs((item.actual / item.budgeted) * 100)} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {budgetData.map((dept, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {dept.department}
                    <Badge className={getStatusColor(dept.status)}>
                      {dept.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Budget Allocated</span>
                      <span className="font-bold">KES {dept.budgeted.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Amount Spent</span>
                      <span className="font-bold">KES {dept.actual.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Variance</span>
                      <span className={`font-bold ${getVarianceColor(dept.variance)}`}>
                        {dept.variance > 0 ? '+' : ''}KES {dept.variance.toLocaleString()}
                      </span>
                    </div>
                    <Progress 
                      value={(dept.actual / dept.budgeted) * 100} 
                      className="h-3"
                    />
                    <p className="text-sm text-slate-600 text-center">
                      {((dept.actual / dept.budgeted) * 100).toFixed(1)}% of budget used
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>Budget allocation and spent amounts by expense category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {expenseCategories.map((category, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{category.category}</span>
                      <Badge 
                        variant="outline"
                        className={category.percentage > 100 ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}
                      >
                        {category.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Budgeted</p>
                        <p className="font-medium">KES {category.budgeted.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Actual</p>
                        <p className="font-medium">KES {category.actual.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Variance</p>
                        <p className={`font-medium ${getVarianceColor(category.variance)}`}>
                          {category.variance > 0 ? '+' : ''}KES {category.variance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(category.percentage, 100)} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Targets vs Forecast</CardTitle>
              <CardDescription>Budget targets and revenue forecasts for upcoming months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthlyTargets.map((item, index) => (
                  <Card key={index} className="p-4">
                    <h4 className="font-semibold mb-3">{item.month} 2025</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Target:</span>
                        <span className="font-medium">KES {item.target.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Forecast:</span>
                        <span className="font-medium text-green-600">KES {item.forecast.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Variance:</span>
                        <span className="font-medium text-green-600">
                          +KES {(item.forecast - item.target).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-slate-600">Confidence:</span>
                        <Badge variant="outline">{item.confidence}%</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetManagement;
