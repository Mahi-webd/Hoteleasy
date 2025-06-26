
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, Calendar, Download, Target, Users, Home } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Cell } from "recharts";

const RevenueAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [activeTab, setActiveTab] = useState("overview");

  // Sample revenue data
  const monthlyRevenue = [
    { month: "Jan", rooms: 875000, fb: 320000, spa: 85000, other: 45000, total: 1325000 },
    { month: "Feb", rooms: 920000, fb: 285000, spa: 92000, other: 38000, total: 1335000 },
    { month: "Mar", rooms: 1100000, fb: 385000, spa: 110000, other: 55000, total: 1650000 },
    { month: "Apr", rooms: 980000, fb: 340000, spa: 88000, other: 42000, total: 1450000 },
    { month: "May", rooms: 1250000, fb: 420000, spa: 125000, other: 68000, total: 1863000 },
    { month: "Jun", rooms: 1350000, fb: 465000, spa: 135000, other: 72000, total: 2022000 }
  ];

  const departmentData = [
    { name: "Rooms", value: 67, revenue: 1350000, color: "#2563EB" },
    { name: "F&B", value: 23, revenue: 465000, color: "#059669" },
    { name: "Spa", value: 7, revenue: 135000, color: "#D97706" },
    { name: "Others", value: 3, revenue: 72000, color: "#7C3AED" }
  ];

  const kpiMetrics = [
    { 
      label: "Total Revenue", 
      value: "KES 2.02M", 
      change: "+18.2%", 
      trend: "up",
      icon: DollarSign,
      description: "Current month"
    },
    { 
      label: "Revenue Growth", 
      value: "18.2%", 
      change: "+3.1%", 
      trend: "up",
      icon: TrendingUp,
      description: "Month over month"
    },
    { 
      label: "ADR", 
      value: "KES 8,750", 
      change: "+12.5%", 
      trend: "up",
      icon: Home,
      description: "Average Daily Rate"
    },
    { 
      label: "RevPAR", 
      value: "KES 7,543", 
      change: "+15.8%", 
      trend: "up",
      icon: BarChart3,
      description: "Revenue per Available Room"
    }
  ];

  const profitabilityData = [
    { department: "Rooms", revenue: 1350000, costs: 405000, profit: 945000, margin: 70 },
    { department: "F&B", revenue: 465000, costs: 279000, profit: 186000, margin: 40 },
    { department: "Spa", revenue: 135000, costs: 81000, profit: 54000, margin: 40 },
    { department: "Others", revenue: 72000, costs: 43200, profit: 28800, margin: 40 }
  ];

  const forecastData = [
    { month: "Jul", actual: null, forecast: 2150000, confidence: 85 },
    { month: "Aug", actual: null, forecast: 2320000, confidence: 80 },
    { month: "Sep", actual: null, forecast: 2180000, confidence: 75 },
    { month: "Oct", actual: null, forecast: 2050000, confidence: 78 },
    { month: "Nov", actual: null, forecast: 1950000, confidence: 82 },
    { month: "Dec", actual: null, forecast: 2450000, confidence: 88 }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Revenue Analytics</h2>
          <p className="text-slate-600">Advanced revenue analysis and financial performance tracking</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiMetrics.map((metric, index) => (
              <Card key={index} className="bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className="h-6 w-6 text-blue-600" />
                    <Badge variant={metric.trend === 'up' ? 'default' : 'destructive'} className="text-xs">
                      {metric.change}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-600 mb-1">{metric.label}</h3>
                  <p className="text-2xl font-bold text-slate-800 mb-1">{metric.value}</p>
                  <p className="text-xs text-slate-500">{metric.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends (6 Months)</CardTitle>
                <CardDescription>Monthly revenue breakdown by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Area type="monotone" dataKey="rooms" stackId="1" stroke="#2563EB" fill="#2563EB" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="fb" stackId="1" stroke="#059669" fill="#059669" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="spa" stackId="1" stroke="#D97706" fill="#D97706" fillOpacity={0.8} />
                      <Area type="monotone" dataKey="other" stackId="1" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.8} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-sm">Rooms (67%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-sm">F&B (23%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                    <span className="text-sm">Spa (7%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                    <span className="text-sm">Others (3%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Current month revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <pie 
                        data={departmentData} 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={100} 
                        fill="#8884d8" 
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-4">
                  {departmentData.map((dept, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: dept.color }}></div>
                        <span className="font-medium">{dept.name}</span>
                      </div>
                      <span className="font-bold">KES {dept.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profitability" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profitability Analysis</CardTitle>
              <CardDescription>Department-wise profit margins and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" />
                    <YAxis />
                    <Bar dataKey="revenue" fill="#2563EB" name="Revenue" />
                    <Bar dataKey="costs" fill="#DC2626" name="Costs" />
                    <Bar dataKey="profit" fill="#059669" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {profitabilityData.map((dept, index) => (
                  <Card key={index} className="p-4">
                    <h4 className="font-semibold mb-2">{dept.department}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span className="font-medium">KES {dept.revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costs:</span>
                        <span className="font-medium text-red-600">KES {dept.costs.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Profit:</span>
                        <span className="font-medium text-green-600">KES {dept.profit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span>Margin:</span>
                        <Badge variant="default">{dept.margin}%</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Forecast</CardTitle>
              <CardDescription>6-month revenue projection with confidence intervals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...monthlyRevenue, ...forecastData]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#2563EB" 
                      strokeWidth={3}
                      name="Actual Revenue"
                      connectNulls={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="forecast" 
                      stroke="#059669" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Forecasted Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {forecastData.slice(0, 3).map((item, index) => (
                  <Card key={index} className="p-4">
                    <h4 className="font-semibold mb-2">{item.month} Forecast</h4>
                    <p className="text-2xl font-bold text-green-600 mb-1">
                      KES {item.forecast.toLocaleString()}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-600">Confidence:</span>
                      <Badge variant="outline">{item.confidence}%</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Targets & Goals</CardTitle>
              <CardDescription>Track progress against set revenue targets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Revenue Target Management</h3>
                <p className="text-slate-600 mb-4">Set and track departmental revenue targets</p>
                <Button>
                  <Target className="mr-2 h-4 w-4" />
                  Set Revenue Targets
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RevenueAnalytics;
