import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Calendar, Home, CreditCard, TrendingUp, TrendingDown, MapPin, Clock } from "lucide-react";
const DashboardOverview = () => {
  const kpiData = [{
    title: "Occupancy Rate",
    value: "87%",
    change: "+5.2%",
    trend: "up",
    icon: Home,
    color: "bg-blue-500"
  }, {
    title: "Revenue Today",
    value: "KES 245,000",
    change: "+12.3%",
    trend: "up",
    icon: CreditCard,
    color: "bg-green-500"
  }, {
    title: "Total Guests",
    value: "156",
    change: "+8",
    trend: "up",
    icon: Users,
    color: "bg-purple-500"
  }, {
    title: "Available Rooms",
    value: "23",
    change: "-3",
    trend: "down",
    icon: MapPin,
    color: "bg-orange-500"
  }];
  const recentActivity = [{
    time: "10:30 AM",
    event: "New check-in: John Doe - Room 205",
    type: "checkin"
  }, {
    time: "10:15 AM",
    event: "Payment received: KES 15,000 - Room 312",
    type: "payment"
  }, {
    time: "09:45 AM",
    event: "Housekeeping completed: Room 108",
    type: "housekeeping"
  }, {
    time: "09:30 AM",
    event: "New reservation: Sarah Johnson - 3 nights",
    type: "reservation"
  }, {
    time: "09:00 AM",
    event: "Check-out completed: Room 201",
    type: "checkout"
  }];
  const todayArrivals = [{
    name: "Michael Smith",
    room: "305",
    time: "2:00 PM",
    status: "Confirmed"
  }, {
    name: "Emma Wilson",
    room: "412",
    time: "3:30 PM",
    status: "Pending"
  }, {
    name: "David Brown",
    room: "208",
    time: "4:00 PM",
    status: "Confirmed"
  }, {
    name: "Lisa Davis",
    room: "156",
    time: "5:30 PM",
    status: "VIP"
  }];
  return <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Good Morning, Hotel Manager!</h2>
        <p className="text-blue-100">Here's what's happening at Olsupat lodge today</p>
        <div className="flex items-center mt-4 space-x-4 text-sm">
          <div className="flex items-center">
            <Calendar className="mr-1 h-4 w-4" />
            Monday, June 24, 2025
          </div>
          <div className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            10:45 AM
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => <Card key={index} className="relative overflow-hidden bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{kpi.title}</CardTitle>
              <div className={`${kpi.color} p-2 rounded-lg`}>
                <kpi.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800 mb-1">{kpi.value}</div>
              <div className="flex items-center text-sm">
                {kpi.trend === "up" ? <TrendingUp className="mr-1 h-3 w-3 text-green-500" /> : <TrendingDown className="mr-1 h-3 w-3 text-red-500" />}
                <span className={kpi.trend === "up" ? "text-green-600" : "text-red-600"}>
                  {kpi.change}
                </span>
                <span className="text-slate-500 ml-1">from yesterday</span>
              </div>
            </CardContent>
          </Card>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Arrivals */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5 text-blue-600" />
              Today's Arrivals
            </CardTitle>
            <CardDescription>Guests checking in today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayArrivals.map((arrival, index) => <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{arrival.name}</p>
                    <p className="text-sm text-slate-600">Room {arrival.room} • {arrival.time}</p>
                  </div>
                  <Badge variant={arrival.status === "VIP" ? "default" : arrival.status === "Confirmed" ? "secondary" : "outline"}>
                    {arrival.status}
                  </Badge>
                </div>)}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest hotel operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => <div key={index} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === "checkin" ? "bg-blue-500" : activity.type === "payment" ? "bg-green-500" : activity.type === "housekeeping" ? "bg-purple-500" : activity.type === "reservation" ? "bg-orange-500" : "bg-red-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm text-slate-800">{activity.event}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Status Overview */}
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Home className="mr-2 h-5 w-5 text-purple-600" />
            Room Status Overview
          </CardTitle>
          <CardDescription>Current status of all rooms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">125</div>
              <div className="text-sm text-green-700">Occupied</div>
              <Progress value={87} className="mt-2 h-2" />
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">23</div>
              <div className="text-sm text-blue-700">Available</div>
              <Progress value={15} className="mt-2 h-2" />
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">8</div>
              <div className="text-sm text-orange-700">Cleaning</div>
              <Progress value={5} className="mt-2 h-2" />
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">2</div>
              <div className="text-sm text-red-700">Maintenance</div>
              <Progress value={1} className="mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
};
export default DashboardOverview;