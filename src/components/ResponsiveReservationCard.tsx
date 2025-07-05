
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Users, MapPin, CheckCircle, XCircle, Edit } from "lucide-react";

interface Reservation {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  totalAmount: string;
  status: string;
  paymentStatus: string;
}

interface ResponsiveReservationCardProps {
  reservation: Reservation;
  onCheckIn: (reservation: Reservation) => void;
  onViewDetails: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}

const ResponsiveReservationCard = ({ 
  reservation, 
  onCheckIn, 
  onViewDetails, 
  onEdit, 
  onCancel 
}: ResponsiveReservationCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Confirmed": return "bg-blue-100 text-blue-800";
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Checked In": return "bg-green-100 text-green-800";
      case "Checked Out": return "bg-gray-100 text-gray-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                <MapPin className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">{reservation.guestName}</h3>
                  <Badge className={`${getStatusColor(reservation.status)} text-xs`}>
                    {reservation.status}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mb-2">
                  ID: {reservation.id} • Room {reservation.roomNumber} ({reservation.roomType})
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="truncate">{reservation.checkIn} - {reservation.checkOut}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>{reservation.guests} guests</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span>{reservation.nights} nights</span>
            </div>
          </div>

          {/* Amount and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-800">{reservation.totalAmount}</p>
              <p className="text-xs sm:text-sm text-slate-600">
                Payment: <span className={reservation.paymentStatus === 'Paid' ? 'text-green-600' : 'text-yellow-600'}>
                  {reservation.paymentStatus}
                </span>
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {reservation.status === "Confirmed" && (
                <Button size="sm" onClick={() => onCheckIn(reservation)} className="text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Check In
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onViewDetails(reservation)}
                className="text-xs"
              >
                View Details
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onEdit(reservation)}
                className="text-xs"
              >
                <Edit className="h-3 w-3" />
              </Button>
              {reservation.status !== "Checked Out" && reservation.status !== "Cancelled" && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => onCancel(reservation)}
                  className="text-xs"
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResponsiveReservationCard;
