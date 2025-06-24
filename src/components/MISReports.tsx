
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, FileText, Download, Calendar, DollarSign, Users, Home, PieChart, LineChart } from "lucide-react";

const MISReports = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

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

  const kpiMetrics = [
    { label: "ADR (Average Daily Rate)", value: "KES 8,450", change: "+12.5%", trend: "up" },
    { label: "RevPAR (Revenue per Available Room)", value: "KES 7,352", change: "+8.3%", trend: "up" },
    { label: "Occupancy Rate", value: "87.2%", change: "+5.1%", trend: "up" },
    { label: "GOPPAR (Gross Operating Profit PAR)", value: "KES 4,180", change: "+15.2%", trend: "up" }
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LineChart className="mr-2 h-5 w-5 text-blue-600" />
                  Revenue Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <LineChart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Interactive Charts</h3>
                  <p className="text-slate-600">Advanced analytics charts will be displayed here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="mr-2 h-5 w-5 text-green-600" />
                  Revenue Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <PieChart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Revenue Distribution</h3>
                  <p className="text-slate-600">Department-wise revenue analysis charts</p>
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
