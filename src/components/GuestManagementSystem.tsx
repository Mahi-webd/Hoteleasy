
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Plus, Search, Mail, Phone, MapPin, Star, Calendar, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality?: string;
  id_number?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  country?: string;
  vip: boolean;
  preferences?: string;
  notes?: string;
  total_stays: number;
  total_spent: number;
  last_stay?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Reservation {
  id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  total_rate: number;
  special_requests?: string;
  status: string;
  guests: {
    first_name: string;
    last_name: string;
    email: string;
  };
  rooms: {
    room_number: string;
    room_types: {
      name: string;
    };
  };
}

const GuestManagementSystem = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddGuestDialog, setShowAddGuestDialog] = useState(false);
  const [showGuestDetailsDialog, setShowGuestDetailsDialog] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch guests
  const { data: guests = [], isLoading: guestsLoading } = useQuery({
    queryKey: ['guests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Guest[];
    }
  });

  // Fetch reservations
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          guests(first_name, last_name, email),
          rooms(room_number, room_types(name))
        `)
        .order('check_in_date', { ascending: false });
      
      if (error) throw error;
      return data as Reservation[];
    }
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('guest-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guests'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['guests'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['reservations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Add guest mutation
  const addGuestMutation = useMutation({
    mutationFn: async (guestData: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      nationality?: string;
      id_number?: string;
      date_of_birth?: string;
      address?: string;
      city?: string;
      country?: string;
      vip: boolean;
      preferences?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('guests')
        .insert([guestData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      setShowAddGuestDialog(false);
      toast({
        title: "Guest Added",
        description: "New guest has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add guest",
        variant: "destructive",
      });
      console.error('Error adding guest:', error);
    }
  });

  // Update guest mutation
  const updateGuestMutation = useMutation({
    mutationFn: async ({ guestId, updates }: { guestId: string; updates: Partial<Guest> }) => {
      const { error } = await supabase
        .from('guests')
        .update(updates)
        .eq('id', guestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      toast({
        title: "Guest Updated",
        description: "Guest information has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update guest",
        variant: "destructive",
      });
      console.error('Error updating guest:', error);
    }
  });

  const handleAddGuest = (formData: FormData) => {
    const guestData = {
      first_name: formData.get('firstName') as string,
      last_name: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string || undefined,
      nationality: formData.get('nationality') as string || undefined,
      id_number: formData.get('idNumber') as string || undefined,
      date_of_birth: formData.get('dateOfBirth') as string || undefined,
      address: formData.get('address') as string || undefined,
      city: formData.get('city') as string || undefined,
      country: formData.get('country') as string || undefined,
      vip: formData.get('vip') === 'on',
      preferences: formData.get('preferences') as string || undefined,
      notes: formData.get('notes') as string || undefined,
    };

    addGuestMutation.mutate(guestData);
  };

  const handleViewGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setShowGuestDetailsDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 border-green-200";
      case "checked_in": return "bg-blue-100 text-blue-800 border-blue-200";
      case "checked_out": return "bg-gray-100 text-gray-800 border-gray-200";
      case "blacklisted": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredGuests = guests.filter(guest => {
    const matchesSearch = searchTerm === "" || 
      guest.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || guest.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (guestsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Guest Management</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage guest profiles, preferences, and history</p>
        </div>
        <Dialog open={showAddGuestDialog} onOpenChange={setShowAddGuestDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Guest</DialogTitle>
              <DialogDescription>Create a new guest profile</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleAddGuest(formData);
            }}>
              <div className="grid grid-cols-2 gap-4 space-y-2">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input name="firstName" id="firstName" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input name="lastName" id="lastName" required />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input name="email" id="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input name="phone" id="phone" />
                </div>
                <div>
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input name="nationality" id="nationality" />
                </div>
                <div>
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input name="idNumber" id="idNumber" />
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input name="dateOfBirth" id="dateOfBirth" type="date" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input name="address" id="address" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input name="city" id="city" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input name="country" id="country" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="preferences">Preferences</Label>
                  <Textarea name="preferences" id="preferences" placeholder="Guest preferences..." />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea name="notes" id="notes" placeholder="Additional notes..." />
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <Checkbox name="vip" id="vip" />
                  <Label htmlFor="vip">VIP Guest</Label>
                </div>
                <div className="col-span-2">
                  <Button type="submit" className="w-full" disabled={addGuestMutation.isPending}>
                    {addGuestMutation.isPending ? "Adding..." : "Add Guest"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search guests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="checked_out">Checked Out</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Guest Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGuests.map((guest) => (
          <Card key={guest.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {guest.first_name} {guest.last_name}
                  </CardTitle>
                  {guest.vip && (
                    <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                  )}
                </div>
              </div>
              <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                {guest.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={`${getStatusColor(guest.status)} text-xs font-medium px-2 py-1`}>
                {guest.status.charAt(0).toUpperCase() + guest.status.slice(1)}
              </Badge>
              
              {guest.phone && (
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700 dark:text-slate-300">{guest.phone}</span>
                </div>
              )}
              
              {guest.nationality && (
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-700 dark:text-slate-300">{guest.nationality}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Stays:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{guest.total_stays}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Spent:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">KES {guest.total_spent?.toLocaleString()}</span>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleViewGuest(guest)}
                >
                  <User className="mr-1 h-3 w-3" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {guests.filter(g => g.status === "active").length}
            </div>
            <div className="text-sm opacity-90">Active Guests</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {guests.filter(g => g.status === "checked_in").length}
            </div>
            <div className="text-sm opacity-90">Checked In</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {guests.filter(g => g.vip).length}
            </div>
            <div className="text-sm opacity-90">VIP Guests</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {reservations.length}
            </div>
            <div className="text-sm opacity-90">Total Reservations</div>
          </CardContent>
        </Card>
      </div>

      {/* Guest Details Dialog */}
      <Dialog open={showGuestDetailsDialog} onOpenChange={setShowGuestDetailsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>{selectedGuest?.first_name} {selectedGuest?.last_name}</span>
              {selectedGuest?.vip && (
                <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
              )}
            </DialogTitle>
            <DialogDescription>Guest profile and history</DialogDescription>
          </DialogHeader>
          {selectedGuest && (
            <Tabs defaultValue="profile">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="reservations">Reservations</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span>{selectedGuest.email}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span>{selectedGuest.phone || 'Not provided'}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Nationality</Label>
                    <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span>{selectedGuest.nationality || 'Not provided'}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Total Stays</Label>
                    <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span>{selectedGuest.total_stays}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Total Spent</Label>
                    <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <span>KES {selectedGuest.total_spent?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Last Stay</Label>
                    <div className="p-2 bg-slate-50 rounded">
                      <span>{selectedGuest.last_stay ? new Date(selectedGuest.last_stay).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="reservations" className="space-y-4">
                <div className="space-y-2">
                  {reservations
                    .filter(r => r.guests.email === selectedGuest.email)
                    .map((reservation) => (
                      <Card key={reservation.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">Room {reservation.rooms.room_number}</div>
                            <div className="text-sm text-slate-600">{reservation.rooms.room_types.name}</div>
                            <div className="text-sm">
                              {new Date(reservation.check_in_date).toLocaleDateString()} - {new Date(reservation.check_out_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(reservation.status)}>
                              {reservation.status}
                            </Badge>
                            <div className="text-sm font-semibold mt-1">
                              KES {reservation.total_rate.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </TabsContent>
              <TabsContent value="preferences" className="space-y-4">
                <div>
                  <Label>Preferences</Label>
                  <div className="p-3 bg-slate-50 rounded min-h-20">
                    {selectedGuest.preferences || 'No preferences recorded'}
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <div className="p-3 bg-slate-50 rounded min-h-20">
                    {selectedGuest.notes || 'No notes recorded'}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuestManagementSystem;
