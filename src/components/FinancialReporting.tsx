
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Financial Reporting</h2>
          <p className="text-slate-600">Financial statements, tax reports, and compliance management</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="tax">Tax Reports</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="analytics">Financial Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="statements" className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">P&L Statement</h3>
                <p className="text-sm text-slate-600">Generate profit & loss</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Balance Sheet</h3>
                <p className="text-sm text-slate-600">Assets & liabilities</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Cash Flow</h3>
                <p className="text-sm text-slate-600">Cash movement analysis</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Trial Balance</h3>
                <p className="text-sm text-slate-600">Account balances</p>
              </CardContent>
            </Card>
          </div>

          {/* Generated Statements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Financial Statements</CardTitle>
              <CardDescription>Generated financial reports and statements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialStatements.map((statement, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                    <div className="flex items-center space-x-4">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-slate-800">{statement.name}</h4>
                        <p className="text-sm text-slate-600">
                          {statement.period} • Last updated: {statement.lastUpdated}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={getStatusColor(statement.status)}>
                        {statement.status}
                      </Badge>
                      <span className="text-sm text-slate-500">{statement.size}</span>
                      {statement.status === 'Generated' && (
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

        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Reports & Returns</CardTitle>
              <CardDescription>KRA tax compliance and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {taxReports.map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(report.status)}
                      <div>
                        <h4 className="font-medium text-slate-800">{report.name}</h4>
                        <p className="text-sm text-slate-600">Due: {report.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">{report.amount}</p>
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Dashboard</CardTitle>
              <CardDescription>Track regulatory compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(item.status)}
                      <div>
                        <h4 className="font-medium text-slate-800">{item.requirement}</h4>
                        <p className="text-sm text-slate-600">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-slate-600">Next Due:</p>
                        <p className="font-medium">{item.nextDue}</p>
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

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Analytics</CardTitle>
              <CardDescription>Advanced financial performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Advanced Financial Analytics</h3>
                <p className="text-slate-600">Detailed financial analysis and performance metrics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialReporting;
