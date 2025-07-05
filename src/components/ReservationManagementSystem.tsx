
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Plus, Search, User, MapPin, Clock, CheckCircle, AlertCircle, Edit, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Reservation {
  id: string;
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  total_amount: number;
  special_requests: string | null;
  status: string;
  created_at: string;
  guests: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
  rooms: {
    room_number: string;
    room_types: {
      name: string;
    };
  };
}

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

interface Room {
  id: string;
  room_number: string;
  daily_rate: number;
  status: string;
  max_occupancy: number;
  room_types: {
    name: string;
  };
}

const ReservationManagementSystem = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch reservations with related data using type assertion
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations' as any)
        .select(`
          *,
          guests (first_name, last_name, email, phone),
          rooms (room_number, room_types (name))
        `)
        .order('check_in_date', { ascending: true });
      
      if (error) throw error;
      return data as Reservation[];
    }
  });

  // Fetch guests for the dropdown using type assertion
  const { data: guests = [] } = useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests' as any)
        .select('id, first_name, last_name, email, phone')
        .eq('status', 'active')
        .order('first_name');
      
      if (error) throw error;
      return data as Guest[];
    }
  });

  // Fetch available rooms
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_types (name)
        `)
        .eq('status', 'available')
        .order('room_number');
      
      if (error) throw error;
      return data as Room[];
    }
  });

  // Create reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: async (newReservation: any) => {
      const { data, error } = await supabase
        .from('reservations' as any)
        .insert([newReservation])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success("Reservation created successfully!");
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create reservation: " + error.message);
    }
  });

  // Update reservation mutation
  const updateReservationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('reservations' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success("Reservation updated successfully!");
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to update reservation: " + error.message);
    }
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { data, error } = await supabase
        .from('reservations' as any)
        .update({ status: 'checked_in' })
        .eq('id', reservationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success("Guest checked in successfully!");
    },
    onError: (error) => {
      toast.error("Failed to check in guest: " + error.message);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "checked_in": return "bg-blue-100 text-blue-800";
      case "checked_out": return "bg-gray-100 text-gray-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "no_show": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = 
      `${reservation.guests.first_name} ${reservation.guests.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.guests.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.rooms.room_number.includes(searchTerm) ||
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateReservation = (formData: FormData) => {
    const guest_id = formData.get('guest_id') as string;
    const room_id = formData.get('room_id') as string;
    const adults = parseInt(formData.get('adults') as string);
    const children = parseInt(formData.get('children') as string) || 0;
    const total_amount = parseFloat(formData.get('total_amount') as string);
    const special_requests = formData.get('special_requests') as string;

    if (!checkInDate || !checkOutDate) {
      toast.error("Please select check-in and check-out dates");
      return;
    }

    createReservationMutation.mutate({
      guest_id,
      room_id,
      check_in_date: checkInDate.toISOString().split('T')[0],
      check_out_date: checkOutDate.toISOString().split('T')[0],
      adults,
      children,
      total_amount,
      special_requests: special_requests || null,
      status: 'confirmed'
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Reservation Management</h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Manage room bookings and guest reservations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Reservation</DialogTitle>
              <DialogDescription>Book a new room for a guest</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateReservation(new FormData(e.currentTarget));
            }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guest_id">Guest</Label>
                  <Select name="guest_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.first_name} {guest.last_name} - {guest.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="room_id">Room</Label>
                  <Select name="room_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          Room {room.room_number} - {room.room_types.name} (KES {room.daily_rate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Check-in Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkInDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkInDate ? format(checkInDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-white dark:bg-slate-900 border">
                      <Calendar
                        mode="single"
                        selected={checkInDate}
                        onSelect={setCheckInDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Check-out Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !checkOutDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOutDate ? format(checkOutDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-white dark:bg-slate-900 border">
                      <Calendar
                        mode="single"
                        selected={checkOutDate}
                        onSelect={setCheckOutDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="adults">Adults</Label>
                  <Select name="adults" defaultValue="1" required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Adult</SelectItem>
                      <SelectItem value="2">2 Adults</SelectItem>
                      <SelectItem value="3">3 Adults</SelectItem>
                      <SelectItem value="4">4 Adults</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="children">Children</Label>
                  <Select name="children" defaultValue="0">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 Children</SelectItem>
                      <SelectItem value="1">1 Child</SelectItem>
                      <SelectItem value="2">2 Children</SelectItem>
                      <SelectItem value="3">3 Children</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="total_amount">Total Amount (KES)</Label>
                  <Input name="total_amount" type="number" step="0.01" required />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="special_requests">Special Requests</Label>
                  <Textarea name="special_requests" placeholder="Any special requests or notes..." />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createReservationMutation.isPending}>
                  {createReservationMutation.isPending ? "Creating..." : "Create Reservation"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-slate-500 flex-shrink-0" />
              <Input
                placeholder="Search reservations by guest name, email, room number, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="checked_out">Checked Out</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Tabs */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="list" className="flex-1 sm:flex-none">List View</TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 sm:flex-none">Calendar View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-4">
          {reservationsLoading ? (
            <div className="text-center py-8">Loading reservations...</div>
          ) : (
            <div className="space-y-4">
              {filteredReservations.map((reservation) => (
                <Card key={reservation.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                      {/* Guest Info */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
                            {reservation.guests.first_name} {reservation.guests.last_name}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-1">
                          <div className="break-all">{reservation.guests.email}</div>
                          <div>{reservation.guests.phone}</div>
                          <div className="flex items-center">
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {reservation.id.substring(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Booking Details */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
                            Room {reservation.rooms.room_number} - {reservation.rooms.room_types.name}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span>{reservation.check_in_date} - {reservation.check_out_date}</span>
                          </div>
                          <div>{reservation.adults} adults • {reservation.children} children</div>
                          <div>KES {reservation.total_amount.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <Badge className={getStatusColor(reservation.status)}>
                          {reservation.status.replace('_', ' ')}
                        </Badge>
                        {reservation.special_requests && (
                          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            <strong>Special Requests:</strong>
                            <p className="mt-1">{reservation.special_requests}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2">
                        {reservation.status === "confirmed" && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => checkInMutation.mutate(reservation.id)}
                            disabled={checkInMutation.isPending}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Check In
                          </Button>
                        )}
                        {reservation.status === "pending" && (
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => updateReservationMutation.mutate({ id: reservation.id, updates: { status: 'confirmed' } })}
                          >
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Confirm
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedReservation(reservation);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="calendar">
          <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardContent className="p-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-semibold mb-2">Calendar View</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Calendar view with reservation visualization will be implemented in the next phase
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold">{reservations.length}</div>
            <div className="text-xs sm:text-sm opacity-90">Total Reservations</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold">
              {reservations.filter(r => r.status === "confirmed").length}
            </div>
            <div className="text-xs sm:text-sm opacity-90">Confirmed</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold">
              {reservations.filter(r => r.status === "pending").length}
            </div>
            <div className="text-xs sm:text-sm opacity-90">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-bold">
              {reservations.filter(r => r.status === "checked_in").length}
            </div>
            <div className="text-xs sm:text-sm opacity-90">In-House</div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Reservation Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Reservation</DialogTitle>
                <DialogDescription>
                  Modify reservation details for {selectedReservation.guests.first_name} {selectedReservation.guests.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Guest</Label>
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                      {selectedReservation.guests.first_name} {selectedReservation.guests.last_name}
                    </div>
                  </div>
                  <div>
                    <Label>Room</Label>
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                      Room {selectedReservation.rooms.room_number}
                    </div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select 
                      defaultValue={selectedReservation.status}
                      onValueChange={(value) => {
                        updateReservationMutation.mutate({ 
                          id: selectedReservation.id, 
                          updates: { status: value } 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                        <SelectItem value="checked_out">Checked Out</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Special Requests</Label>
                  <Textarea 
                    defaultValue={selectedReservation.special_requests || ""} 
                    placeholder="Special requests or notes..."
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReservationManagementSystem;
