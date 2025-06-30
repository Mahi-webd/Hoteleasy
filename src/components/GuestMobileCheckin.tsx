
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrCode, Smartphone, CheckCircle, Clock, User, MapPin, Calendar, Star, Wifi, Coffee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestMobileCheckin = () => {
  const [checkinCode, setCheckinCode] = useState("");
  const { toast } = useToast();

  // Mock data for mobile check-ins
  const guestCheckins = [
    {
      id: "MC001",
      guestName: "John Smith",
      roomNumber: "201",
      checkInTime: "2024-01-15 14:30",
      status: "completed",
      qrCode: "QR001234",
      preferences: ["Late checkout", "Room service"]
    },
    {
      id: "MC002", 
      guestName: "Sarah Johnson",
      roomNumber: "105",
      checkInTime: "2024-01-15 16:45",
      status: "pending",
      qrCode: "QR005678",
      preferences: ["Extra towels", "Do not disturb"]
    }
  ];

  const handleQRScan = () => {
    toast({
      title: "QR Code Generated",
      description: "Check-in QR code has been generated successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Mobile Check-in</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage digital guest check-in experience</p>
        </div>
        <Button onClick={handleQRScan}>
          <QrCode className="mr-2 h-4 w-4" />
          Generate QR Code
        </Button>
      </div>

      <Tabs defaultValue="checkins" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checkins">Check-ins</TabsTrigger>
          <TabsTrigger value="qr-codes">QR Codes</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="checkins" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guestCheckins.map((checkin) => (
              <Card key={checkin.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-lg">{checkin.guestName}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Room {checkin.roomNumber}</p>
                    </div>
                    <Badge className={checkin.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {checkin.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <p><strong>Check-in:</strong> {checkin.checkInTime}</p>
                    <p><strong>QR Code:</strong> {checkin.qrCode}</p>
                    <p><strong>Preferences:</strong> {checkin.preferences.join(", ")}</p>
                  </div>
                  
                  <Button size="sm" className="w-full">
                    <Smartphone className="mr-1 h-3 w-3" />
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="qr-codes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Management</CardTitle>
              <CardDescription>Generate and manage check-in QR codes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Enter booking reference..."
                  value={checkinCode}
                  onChange={(e) => setCheckinCode(e.target.value)}
                />
                <Button onClick={handleQRScan} className="w-full">
                  Generate QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Check-in Analytics</CardTitle>
              <CardDescription>Mobile check-in performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">85%</p>
                  <p className="text-sm text-slate-600">Adoption Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">3.2min</p>
                  <p className="text-sm text-slate-600">Avg Check-in Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">4.8</p>
                  <p className="text-sm text-slate-600">Guest Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">127</p>
                  <p className="text-sm text-slate-600">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestMobileCheckin;
