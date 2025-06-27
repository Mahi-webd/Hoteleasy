
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Smartphone, CheckCircle, Clock, User, Mail, Phone, CreditCard, Key, Upload, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestMobileCheckin = () => {
  const [checkinStep, setCheckinStep] = useState(1);
  const [guestData, setGuestData] = useState({
    confirmationNumber: "",
    email: "",
    phone: "",
    specialRequests: "",
    arrivalTime: "",
    idDocument: null
  });
  const { toast } = useToast();

  const handleStepComplete = (step: number) => {
    setCheckinStep(step + 1);
    toast({
      title: "Step Completed",
      description: `Step ${step} completed successfully`,
    });
  };

  const handleFinalCheckin = () => {
    toast({
      title: "Check-in Complete!",
      description: "Your digital key will be sent to your mobile device",
    });
    setCheckinStep(6);
  };

  // Mock data for active check-ins
  const activeCheckins = [
    {
      id: "CI001",
      guest: "John Smith",
      room: "201",
      status: "In Progress",
      step: 3,
      arrivalTime: "2:30 PM",
      confirmation: "HTL12345"
    },
    {
      id: "CI002", 
      guest: "Sarah Johnson",
      room: "305",
      status: "Completed",
      step: 5,
      arrivalTime: "1:15 PM",
      confirmation: "HTL67890"
    },
    {
      id: "CI003",
      guest: "Mike Wilson",
      room: "102",
      status: "Pending",
      step: 1,
      arrivalTime: "4:00 PM",
      confirmation: "HTL11111"
    }
  ];

  const checkinSteps = [
    { step: 1, title: "Verify Booking", icon: CheckCircle },
    { step: 2, title: "Personal Details", icon: User },
    { step: 3, title: "Upload ID", icon: Upload },
    { step: 4, title: "Preferences", icon: MapPin },
    { step: 5, title: "Digital Key", icon: Key }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Mobile Check-in</h1>
          <p className="text-slate-600 dark:text-slate-400">Streamlined digital check-in experience</p>
        </div>
        <Button>
          <QrCode className="mr-2 h-4 w-4" />
          Generate QR Code
        </Button>
      </div>

      <Tabs defaultValue="demo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demo">Check-in Demo</TabsTrigger>
          <TabsTrigger value="active">Active Check-ins</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Check-in Process Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Smartphone className="mr-2 h-5 w-5" />
                  Mobile Check-in Simulator
                </CardTitle>
                <CardDescription>Experience the guest check-in journey</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-6">
                  {checkinSteps.map((item, index) => (
                    <div key={item.step} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        checkinStep > item.step 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : checkinStep === item.step
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-slate-300 text-slate-400'
                      }`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs mt-1 text-center">{item.title}</span>
                    </div>
                  ))}
                </div>

                {/* Step Content */}
                {checkinStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Step 1: Verify Booking</h3>
                    <Input 
                      placeholder="Enter confirmation number"
                      value={guestData.confirmationNumber}
                      onChange={(e) => setGuestData({...guestData, confirmationNumber: e.target.value})}
                    />
                    <Input 
                      placeholder="Email address"
                      type="email"
                      value={guestData.email}
                      onChange={(e) => setGuestData({...guestData, email: e.target.value})}
                    />
                    <Button onClick={() => handleStepComplete(1)} className="w-full">
                      Verify & Continue
                    </Button>
                  </div>
                )}

                {checkinStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Step 2: Personal Details</h3>
                    <Input 
                      placeholder="Phone number"
                      value={guestData.phone}
                      onChange={(e) => setGuestData({...guestData, phone: e.target.value})}
                    />
                    <Input 
                      placeholder="Expected arrival time"
                      value={guestData.arrivalTime}
                      onChange={(e) => setGuestData({...guestData, arrivalTime: e.target.value})}
                    />
                    <Button onClick={() => handleStepComplete(2)} className="w-full">
                      Continue
                    </Button>
                  </div>
                )}

                {checkinStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Step 3: Upload ID Document</h3>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-12 w-12 text-slate-400" />
                      <p className="mt-2 text-sm text-slate-500">Click to upload ID document</p>
                    </div>
                    <Button onClick={() => handleStepComplete(3)} className="w-full">
                      Continue
                    </Button>
                  </div>
                )}

                {checkinStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Step 4: Preferences & Requests</h3>
                    <textarea 
                      className="w-full p-3 border rounded-md"
                      placeholder="Any special requests or preferences?"
                      value={guestData.specialRequests}
                      onChange={(e) => setGuestData({...guestData, specialRequests: e.target.value})}
                    />
                    <Button onClick={() => handleStepComplete(4)} className="w-full">
                      Continue
                    </Button>
                  </div>
                )}

                {checkinStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Step 5: Digital Key Setup</h3>
                    <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Key className="mx-auto h-12 w-12 text-blue-500" />
                      <p className="mt-2">Your digital key is ready!</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">You'll receive it on your mobile device</p>
                    </div>
                    <Button onClick={handleFinalCheckin} className="w-full">
                      Complete Check-in
                    </Button>
                  </div>
                )}

                {checkinStep === 6 && (
                  <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                    <h3 className="text-lg font-semibold mt-2">Check-in Complete!</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Welcome to Olsupat Lodge. Your room is ready!
                    </p>
                    <Button onClick={() => setCheckinStep(1)} className="mt-4">
                      Start New Check-in
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* QR Code & Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Instructions</CardTitle>
                <CardDescription>How guests access mobile check-in</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="w-32 h-32 mx-auto bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center">
                    <QrCode className="h-16 w-16 text-slate-600" />
                  </div>
                  <p className="mt-4 font-medium">Scan QR Code</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Or visit: hotel.com/checkin
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Check-in Process:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-3">1</div>
                      <span>Scan QR code or visit link</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-3">2</div>
                      <span>Enter confirmation details</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-3">3</div>
                      <span>Complete verification</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-3">4</div>
                      <span>Receive digital room key</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Check-ins</CardTitle>
              <CardDescription>Monitor guest check-in progress in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeCheckins.map((checkin) => (
                  <div key={checkin.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{checkin.guest}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Room {checkin.room} • {checkin.confirmation} • Arrival: {checkin.arrivalTime}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">Step {checkin.step}/5</p>
                        <Badge 
                          variant={
                            checkin.status === 'Completed' ? 'default' : 
                            checkin.status === 'In Progress' ? 'secondary' : 'outline'
                          }
                        >
                          {checkin.status}
                        </Badge>
                      </div>
                      <div className="w-12 h-2 bg-slate-200 rounded-full">
                        <div 
                          className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${(checkin.step / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Check-in Settings</CardTitle>
                <CardDescription>Configure mobile check-in options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Check-in Window</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>24 hours before arrival</option>
                    <option>12 hours before arrival</option>
                    <option>6 hours before arrival</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Required Documents</label>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" defaultChecked />
                      <span className="text-sm">Government ID</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm">Credit Card</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Digital Key Settings</CardTitle>
                <CardDescription>Configure digital key delivery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Delivery Method</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>SMS + App Notification</option>
                    <option>App Notification Only</option>
                    <option>SMS Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Activation</label>
                  <select className="w-full p-2 border rounded-md">
                    <option>Upon check-in completion</option>
                    <option>At scheduled arrival time</option>
                    <option>Manual activation</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestMobileCheckin;
