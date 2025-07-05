
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FileText, Download, Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";

const FinancialReporting = () => {
  const [activeTab, setActiveTab] = useState("statements");
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");

  const financialStatements = [
    {
      name: "Profit & Loss Statement",
      period: "June 2025",
      status: "Generated",
      lastUpdated: "2025-06-25 09:00 AM",
      size: "2.4 MB",
      type: "P&L"
    },
    {
      name: "Balance Sheet",
      period: "June 2025", 
      status: "Pending",
      lastUpdated: "2025-06-24 11:30 PM",
      size: "Processing...",
      type: "Balance Sheet"
    },
    {
      name: "Cash Flow Statement",
      period: "June 2025",
      status: "Generated",
      lastUpdated: "2025-06-25 08:45 AM", 
      size: "1.8 MB",
      type: "Cash Flow"
    },
    {
      name: "Trial Balance",
      period: "June 2025",
      status: "Generated",
      lastUpdated: "2025-06-25 07:30 AM",
      size: "956 KB",
      type: "Trial Balance"
    }
  ];

  const taxReports = [
    {
      name: "VAT Return - June 2025",
      dueDate: "2025-07-20",
      status: "Draft",
      amount: "KES 156,780"
    },
    {
      name: "PAYE Return - June 2025", 
      dueDate: "2025-07-09",
      status: "Submitted",
      amount: "KES 89,450"
    },
    {
      name: "Corporation Tax - Q2 2025",
      dueDate: "2025-09-30",
      status: "Pending",
      amount: "KES 245,600"
    }
  ];

  const complianceItems = [
    {
      requirement: "Monthly VAT Returns",
      nextDue: "2025-07-20",
      status: "On Track",
      description: "Submit monthly VAT returns to KRA"
    },
    {
      requirement: "PAYE Monthly Returns",
      nextDue: "2025-07-09", 
      status: "Submitted",
      description: "Employee tax deductions submitted"
    },
    {
      requirement: "Quarterly Corporation Tax",
      nextDue: "2025-09-30",
      status: "Pending",
      description: "Corporate income tax filing"
    },
    {
      requirement: "Annual Financial Statements",
      nextDue: "2025-12-31",
      status: "On Track", 
      description: "Audited financial statements"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Generated":
      case "Submitted":
      case "On Track":
        return "bg-green-100 text-green-800";
      case "Pending":
      case "Draft":
        return "bg-yellow-100 text-yellow-800";
      case "Overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Generated":
      case "Submitted":
      case "On Track":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Pending":
      case "Draft":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "Overdue":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Financial Reporting</h2>
          <p className="text-sm sm:text-base text-slate-600">Financial statements, tax reports, and compliance management</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 w-full sm:w-auto">
            <FileText className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Generate Report</span>
            <span className="sm:hidden">Generate</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="statements" className="text-xs sm:text-sm">Statements</TabsTrigger>
          <TabsTrigger value="tax" className="text-xs sm:text-sm">Tax Reports</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs sm:text-sm">Compliance</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="statements" className="space-y-4 sm:space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-3 sm:p-6 text-center">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1 text-sm sm:text-base">P&L Statement</h3>
                <p className="text-xs sm:text-sm text-slate-600">Generate profit & loss</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-3 sm:p-6 text-center">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Balance Sheet</h3>
                <p className="text-xs sm:text-sm text-slate-600">Assets & liabilities</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-3 sm:p-6 text-center">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Cash Flow</h3>
                <p className="text-xs sm:text-sm text-slate-600">Cash movement analysis</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-3 sm:p-6 text-center">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Trial Balance</h3>
                <p className="text-xs sm:text-sm text-slate-600">Account balances</p>
              </CardContent>
            </Card>
          </div>

          {/* Generated Statements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Recent Financial Statements</CardTitle>
              <CardDescription className="text-sm sm:text-base">Generated financial reports and statements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialStatements.map((statement, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-slate-50 space-y-3 sm:space-y-0">
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                      <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0 mt-1 sm:mt-0" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-slate-800 text-sm sm:text-base truncate">{statement.name}</h4>
                        <p className="text-xs sm:text-sm text-slate-600">
                          {statement.period} • Last updated: {statement.lastUpdated}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(statement.status)}>
                          {statement.status}
                        </Badge>
                        <span className="text-xs sm:text-sm text-slate-500">{statement.size}</span>
                      </div>
                      {statement.status === 'Generated' && (
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Tax Reports & Returns</CardTitle>
              <CardDescription className="text-sm sm:text-base">KRA tax compliance and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taxReports.map((report, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                      {getStatusIcon(report.status)}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-slate-800 text-sm sm:text-base">{report.name}</h4>
                        <p className="text-xs sm:text-sm text-slate-600">Due: {report.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <p className="font-medium text-sm sm:text-base">{report.amount}</p>
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Compliance Dashboard</CardTitle>
              <CardDescription className="text-sm sm:text-base">Track regulatory compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0">
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                      {getStatusIcon(item.status)}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-slate-800 text-sm sm:text-base">{item.requirement}</h4>
                        <p className="text-xs sm:text-sm text-slate-600">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-left sm:text-right">
                        <p className="text-xs sm:text-sm text-slate-600">Next Due:</p>
                        <p className="font-medium text-sm">{item.nextDue}</p>
                      </div>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Financial Analytics</CardTitle>
              <CardDescription className="text-sm sm:text-base">Advanced financial performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 sm:py-12">
                <TrendingUp className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-2">Advanced Financial Analytics</h3>
                <p className="text-sm sm:text-base text-slate-600">Detailed financial analysis and performance metrics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialReporting;
