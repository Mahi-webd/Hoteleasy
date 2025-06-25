import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, FileText, Download, Calendar, DollarSign, Users, Home, PieChart, LineChart } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Cell, AreaChart, Area } from "recharts";

const MISReports = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Sample data for charts
  const revenueData = [
    { month: "Jan", revenue: 850000, occupancy: 75, guests: 420 },
    { month: "Feb", revenue: 920000, occupancy: 82, guests: 465 },
    { month: "Mar", revenue: 1100000, occupancy: 88, guests: 520 },
    { month: "Apr", revenue: 980000, occupancy: 79, guests: 445 },
    { month: "May", revenue: 1250000, occupancy: 92, guests: 580 },
    { month: "Jun", revenue: 1350000, occupancy: 95, guests: 620 }
  ];

  const departmentData = [
    { name: "Rooms", value: 65, revenue: 875000, color: "#2563EB" },
    { name: "F&B", value: 25, revenue: 337500, color: "#059669" },
    { name: "Spa & Wellness", value: 6, revenue: 81000, color: "#D97706" },
    { name: "Others", value: 4, revenue: 54000, color: "#7C3AED" }
  ];

  const occupancyData = [
    { day: "Mon", occupied: 45, available: 55 },
    { day: "Tue", occupied: 52, available: 48 },
    { day: "Wed", occupied: 38, available: 62 },
    { day: "Thu", occupied: 61, available: 39 },
    { day: "Fri", occupied: 78, available: 22 },
    { day: "Sat", occupied: 95, available: 5 },
    { day: "Sun", occupied: 88, available: 12 }
  ];

  const guestSourceData = [
    { source: "Direct Booking", guests: 35, color: "#2563EB" },
    { source: "Booking.com", guests: 28, color: "#059669" },
    { source: "Walk-in", guests: 20, color: "#D97706" },
    { source: "Expedia", guests: 12, color: "#7C3AED" },
    { source: "Others", guests: 5, color: "#DC2626" }
  ];

  const chartConfig = {
    revenue: { label: "Revenue", color: "#2563EB" },
    occupancy: { label: "Occupancy %", color: "#059669" },
    guests: { label: "Guests", color: "#D97706" }
  };

  const kpiMetrics = [
    { label: "ADR (Average Daily Rate)", value: "KES 8,450", change: "+12.5%", trend: "up" },
    { label: "RevPAR (Revenue per Available Room)", value: "KES 7,352", change: "+8.3%", trend: "up" },
    { label: "Occupancy Rate", value: "87.2%", change: "+5.1%", trend: "up" },
    { label: "GOPPAR (Gross Operating Profit PAR)", value: "KES 4,180", change: "+15.2%", trend: "up" }
  ];

  const reportCategories = [
    {
      title: "Financial Reports",
      icon: DollarSign,
      reports: [
        { name: "Daily Sales Report", description: "Daily revenue breakdown by department", frequency: "Daily" },
        { name: "Monthly P&L Statement", description: "Profit and loss analysis", frequency: "Monthly" },
        { name: "Revenue Analysis", description: "Revenue trends and forecasting", frequency: "Weekly" },
        { name: "Tax Reports (KRA)", description: "VAT and tax compliance reports", frequency: "Monthly" }
      ]
    },
    {
      title: "Operational Reports",
      icon: Home,
      reports: [
        { name: "Occupancy Report", description: "Room occupancy rates and trends", frequency: "Daily" },
        { name: "Housekeeping Report", description: "Room status and cleaning schedules", frequency: "Daily" },
        { name: "Maintenance Report", description: "Maintenance activities and costs", frequency: "Weekly" },
        { name: "Inventory Report", description: "Stock levels and consumption", frequency: "Weekly" }
      ]
    },
    {
      title: "Guest Reports",
      icon: Users,
      reports: [
        { name: "Guest Demographics", description: "Guest origin and profile analysis", frequency: "Monthly" },
        { name: "Guest Satisfaction", description: "Feedback and satisfaction scores", frequency: "Weekly" },
        { name: "Loyalty Program", description: "Member activity and rewards", frequency: "Monthly" },
        { name: "Booking Source Analysis", description: "Channel performance analysis", frequency: "Weekly" }
      ]
    },
    {
      title: "Management Reports",
      icon: BarChart3,
      reports: [
        { name: "Executive Dashboard", description: "Key performance indicators", frequency: "Daily" },
        { name: "Staff Performance", description: "Employee productivity metrics", frequency: "Monthly" },
        { name: "Budget vs Actual", description: "Financial performance analysis", frequency: "Monthly" },
        { name: "Market Analysis", description: "Competitive positioning report", frequency: "Quarterly" }
      ]
    }
  ];

  const recentReports = [
    {
      name: "Daily Sales Report - June 24, 2025",
      type: "Financial",
      generatedBy: "System Auto",
      timestamp: "Today, 6:00 AM",
      status: "Completed",
      size: "2.3 MB"
    },
    {
      name: "Weekly Occupancy Analysis",
      type: "Operational",
      generatedBy: "Mary Wanjiku",
      timestamp: "Yesterday, 11:30 PM",
      status: "Completed",
      size: "1.8 MB"
    },
    {
      name: "Monthly Guest Demographics",
      type: "Guest Analysis",
      generatedBy: "Peter Kimani",
      timestamp: "June 22, 2025",
      status: "Processing",
      size: "Processing..."
    },
    {
      name: "KRA VAT Compliance Report",
      type: "Tax & Compliance",
      generatedBy: "System Auto",
      timestamp: "June 20, 2025",
      status: "Completed",
      size: "876 KB"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">MIS Reports & Analytics</h2>
          <p className="text-slate-600">Management Information System reports and business intelligence</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Report
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reports">Report Library</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiMetrics.map((metric, index) => (
              <Card key={index} className="bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className={`h-5 w-5 ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`} />
                    <Badge variant={metric.trend === 'up' ? 'default' : 'destructive'} className="text-xs">
                      {metric.change}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-600 mb-1">{metric.label}</h3>
                  <p className="text-2xl font-bold text-slate-800">{metric.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Fixed Charts Section with proper sizing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend - Fixed container */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LineChart className="mr-2 h-5 w-5 text-blue-600" />
                  Revenue Trends (6 Months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Department Revenue - Fixed container */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="mr-2 h-5 w-5 text-green-600" />
                  Revenue by Department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <ChartTooltip />
                      <RechartsPieChart data={departmentData} cx="50%" cy="50%" outerRadius={80}>
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </RechartsPieChart>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {departmentData.map((dept, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }}></div>
                      <div>
                        <p className="text-sm font-medium">{dept.name}</p>
                        <p className="text-xs text-slate-600">KES {dept.revenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Occupancy Analysis - Fixed container */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-purple-600" />
                  Weekly Occupancy Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={occupancyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="occupied" fill="#2563EB" name="Occupied" />
                      <Bar dataKey="available" fill="#E5E7EB" name="Available" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Guest Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-orange-600" />
                  Guest Booking Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {guestSourceData.map((source, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: source.color }}></div>
                        <span className="font-medium">{source.source}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold">{source.guests}%</span>
                        <div className="w-20 h-2 bg-slate-200 rounded-full">
                          <div 
                            className="h-2 rounded-full" 
                            style={{ 
                              backgroundColor: source.color, 
                              width: `${source.guests}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Latest generated reports and analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentReports.map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center space-x-4">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-slate-800">{report.name}</h4>
                        <p className="text-sm text-slate-600">
                          {report.type} • Generated by {report.generatedBy} • {report.timestamp}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={report.status === 'Completed' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                      <span className="text-sm text-slate-500">{report.size}</span>
                      {report.status === 'Completed' && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Library */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportCategories.map((category, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <category.icon className="mr-2 h-5 w-5 text-blue-600" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.reports.map((report, reportIndex) => (
                      <div key={reportIndex} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                        <div>
                          <h4 className="font-medium text-slate-800">{report.name}</h4>
                          <p className="text-sm text-slate-600">{report.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{report.frequency}</Badge>
                          <Button variant="ghost" size="sm">
                            Generate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Advanced Analytics Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <ChartTooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="guests" stroke="#059669" fill="#059669" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Occupancy vs Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Occupancy vs Revenue Correlation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <ChartTooltip />
                      <Bar yAxisId="left" dataKey="revenue" fill="#2563EB" name="Revenue (KES)" />
                      <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#059669" strokeWidth={3} name="Occupancy %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Automated report generation schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Automated Scheduling</h3>
                <p className="text-slate-600">Set up automated report generation and distribution</p>
                <Button className="mt-4">
                  <Calendar className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MISReports;
