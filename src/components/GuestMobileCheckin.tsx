
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Smartphone, CheckCircle, Clock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GuestMobileCheckin = () => {
  const [reservationId, setReservationId] = useState("");
  const [guestInfo, setGuestInfo] = useState<any>(null);
  const [qrCode, setQrCode] = useState("");
  const { toast } = useToast();

  const handleLookupReservation = () => {
    // Mock reservation lookup
    const mockReservation = {
      id: reservationId,
      guestName: "John Doe",
      roomNumber: "205",
      checkIn: "2025-06-26",
      checkOut: "2025-06-28",
      roomType: "Deluxe Double",
      status: "Confirmed"
    };
    setGuestInfo(mockReservation);
    setQrCode(`CHECKIN_${reservationId}_${Date.now()}`);
  };

  const handleMobileCheckin = () => {
    toast({
      title: "Check-in Successful!",
      description: "Welcome to Olsupat Lodge! Your room key has been activated.",
    });
    setGuestInfo({ ...guestInfo, status: "Checked In" });
  };

  const handleMobileCheckout = () => {
    toast({
      title: "Check-out Complete!",
      description: "Thank you for staying with us! Your final bill has been sent to your email.",
    });
    setGuestInfo({ ...guestInfo, status: "Checked Out" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Mobile Check-in/Check-out</h2>
        <p className="text-slate-600">Contactless guest experience with QR codes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservation Lookup */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Find Your Reservation
            </CardTitle>
            <CardDescription>Enter your reservation ID or confirmation number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reservationId">Reservation ID</Label>
              <Input
                id="reservationId"
                placeholder="RES001"
                value={reservationId}
                onChange={(e) => setReservationId(e.target.value)}
              />
            </div>
            <Button onClick={handleLookupReservation} className="w-full">
              Lookup Reservation
            </Button>
          </CardContent>
        </Card>

        {/* QR Code Generator */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Check-in
            </CardTitle>
            <CardDescription>Generate QR code for mobile check-in</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {qrCode ? (
              <div className="space-y-4">
                <div className="bg-slate-100 p-8 rounded-lg">
                  <QrCode className="h-32 w-32 mx-auto text-slate-600" />
                  <p className="text-sm text-slate-500 mt-2">QR Code: {qrCode}</p>
                </div>
                <p className="text-sm text-slate-600">
                  Scan this QR code with your mobile device to check-in
                </p>
              </div>
            ) : (
              <div className="py-8">
                <QrCode className="h-16 w-16 mx-auto text-slate-400" />
                <p className="text-slate-500 mt-2">Enter reservation ID to generate QR code</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guest Information */}
      {guestInfo && (
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Reservation Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div><strong>Guest:</strong> {guestInfo.guestName}</div>
                <div><strong>Room:</strong> {guestInfo.roomType} - {guestInfo.roomNumber}</div>
                <div><strong>Check-in:</strong> {guestInfo.checkIn}</div>
                <div><strong>Check-out:</strong> {guestInfo.checkOut}</div>
              </div>
              <div className="space-y-2">
                <div><strong>Status:</strong> 
                  <Badge className={
                    guestInfo.status === "Checked In" ? "bg-green-100 text-green-800 ml-2" :
                    guestInfo.status === "Checked Out" ? "bg-blue-100 text-blue-800 ml-2" :
                    "bg-yellow-100 text-yellow-800 ml-2"
                  }>
                    {guestInfo.status}
                  </Badge>
                </div>
                <div className="flex space-x-2 pt-4">
                  {guestInfo.status === "Confirmed" && (
                    <Button onClick={handleMobileCheckin} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mobile Check-in
                    </Button>
                  )}
                  {guestInfo.status === "Checked In" && (
                    <Button onClick={handleMobileCheckout} className="bg-blue-600 hover:bg-blue-700">
                      <Clock className="mr-2 h-4 w-4" />
                      Mobile Check-out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GuestMobileCheckin;
