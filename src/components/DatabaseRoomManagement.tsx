
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
import { Home, User, Settings, Plus, Search, Wrench, Brush, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Room {
  id: string;
  room_number: string;
  status: string;
  daily_rate: number;
  max_occupancy: number;
  is_smoking: boolean;
  notes?: string;
  room_types: {
    name: string;
  };
  floors: {
    floor_number: number;
  };
}

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
  max_occupancy: number;
}

interface Floor {
  id: string;
  floor_number: number;
  name: string;
}

const DatabaseRoomManagement = () => {
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rooms with real-time updates
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *,
          room_types(name),
          floors(floor_number, name)
        `)
        .order('room_number');
      
      if (error) throw error;
      return data as Room[];
    }
  });

  // Fetch room types
  const { data: roomTypes = [] } = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as RoomType[];
    }
  });

  // Fetch floors
  const { data: floors = [] } = useQuery({
    queryKey: ['floors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .order('floor_number');
      
      if (error) throw error;
      return data as Floor[];
    }
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update room status mutation
  const updateRoomStatusMutation = useMutation({
    mutationFn: async ({ roomId, status, notes }: { roomId: string; status: string; notes?: string }) => {
      const updateData: any = { status };
      if (notes !== undefined) updateData.notes = notes;
      
      const { error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast({
        title: "Room Updated",
        description: "Room status has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update room status",
        variant: "destructive",
      });
      console.error('Error updating room:', error);
    }
  });

  // Add room mutation
  const addRoomMutation = useMutation({
    mutationFn: async (roomData: {
      room_number: string;
      room_type_id: string;
      floor_id: string;
      daily_rate: number;
      max_occupancy: number;
      is_smoking: boolean;
    }) => {
      const { error } = await supabase
        .from('rooms')
        .insert([roomData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowAddRoomDialog(false);
      toast({
        title: "Room Added",
        description: "New room has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add room",
        variant: "destructive",
      });
      console.error('Error adding room:', error);
    }
  });

  const handleManageRoom = (room: Room) => {
    setSelectedRoom(room);
    setShowManageDialog(true);
  };

  const handleStatusChange = (newStatus: string, notes?: string) => {
    if (selectedRoom) {
      updateRoomStatusMutation.mutate({
        roomId: selectedRoom.id,
        status: newStatus,
        notes
      });
      setShowManageDialog(false);
    }
  };

  const handleAddRoom = (formData: FormData) => {
    const roomNumber = formData.get('roomNumber') as string;
    const roomTypeId = formData.get('roomType') as string;
    const floorId = formData.get('floor') as string;
    const dailyRate = parseFloat(formData.get('dailyRate') as string);
    const maxOccupancy = parseInt(formData.get('maxOccupancy') as string);
    const isSmoking = formData.get('smoking') === 'on';

    addRoomMutation.mutate({
      room_number: roomNumber,
      room_type_id: roomTypeId,
      floor_id: floorId,
      daily_rate: dailyRate,
      max_occupancy: maxOccupancy,
      is_smoking: isSmoking
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied": return "bg-red-100 text-red-800 border-red-200";
      case "available": return "bg-green-100 text-green-800 border-green-200";
      case "cleaning": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "maintenance": return "bg-orange-100 text-orange-800 border-orange-200";
      case "out_of_order": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "occupied": return "🔴";
      case "available": return "🟢";
      case "cleaning": return "🟡";
      case "maintenance": return "🔧";
      case "out_of_order": return "❌";
      default: return "⚪";
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesFloor = selectedFloor === "all" || room.floors.floor_number.toString() === selectedFloor;
    const matchesStatus = selectedStatus === "all" || room.status === selectedStatus;
    const matchesSearch = searchTerm === "" || 
      room.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.room_types.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFloor && matchesStatus && matchesSearch;
  });

  if (roomsLoading) {
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
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Room Management</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage room status, assignments, and availability</p>
        </div>
        <Dialog open={showAddRoomDialog} onOpenChange={setShowAddRoomDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>Create a new room in the hotel inventory</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleAddRoom(formData);
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Input name="roomNumber" id="roomNumber" placeholder="e.g., 105" required />
                </div>
                <div>
                  <Label htmlFor="roomType">Room Type</Label>
                  <Select name="roomType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="floor">Floor</Label>
                  <Select name="floor" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      {floors.map(floor => (
                        <SelectItem key={floor.id} value={floor.id}>
                          {floor.name || `Floor ${floor.floor_number}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dailyRate">Daily Rate (KES)</Label>
                  <Input name="dailyRate" id="dailyRate" placeholder="e.g., 12000" type="number" required />
                </div>
                <div>
                  <Label htmlFor="maxOccupancy">Max Occupancy</Label>
                  <Input name="maxOccupancy" id="maxOccupancy" placeholder="e.g., 2" type="number" min="1" required />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox name="smoking" id="smoking" />
                  <Label htmlFor="smoking">Smoking Room</Label>
                </div>
                <Button type="submit" className="w-full" disabled={addRoomMutation.isPending}>
                  {addRoomMutation.isPending ? "Adding..." : "Add Room"}
                </Button>
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
                placeholder="Search rooms, types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {floors.map(floor => (
                  <SelectItem key={floor.id} value={floor.floor_number.toString()}>
                    Floor {floor.floor_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="out_of_order">Out of Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map((room) => (
          <Card key={room.id} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Room {room.room_number}
                </CardTitle>
                <div className="text-xl">{getStatusIcon(room.status)}</div>
              </div>
              <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                {room.room_types.name} • Floor {room.floors.floor_number}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={`${getStatusColor(room.status)} text-xs font-medium px-2 py-1`}>
                {room.status.charAt(0).toUpperCase() + room.status.slice(1).replace('_', ' ')}
              </Badge>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Capacity:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{room.max_occupancy} guests</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">KES {room.daily_rate.toLocaleString()}</span>
              </div>
              
              {room.is_smoking && (
                <Badge variant="outline" className="text-xs">
                  🚬 Smoking
                </Badge>
              )}
              
              <div className="flex space-x-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleManageRoom(room)}
                >
                  <Settings className="mr-1 h-3 w-3" />
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "available").length}
            </div>
            <div className="text-sm opacity-90">Available Rooms</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "occupied").length}
            </div>
            <div className="text-sm opacity-90">Occupied Rooms</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "cleaning").length}
            </div>
            <div className="text-sm opacity-90">Being Cleaned</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">
              {rooms.filter(r => r.status === "maintenance").length}
            </div>
            <div className="text-sm opacity-90">Maintenance</div>
          </CardContent>
        </Card>
      </div>

      {/* Manage Room Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Room {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>Update room status and details</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="status">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>
            <TabsContent value="status" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={selectedRoom?.status === "available" ? "default" : "outline"}
                  onClick={() => handleStatusChange("available")}
                  className="flex items-center justify-center"
                  disabled={updateRoomStatusMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Available
                </Button>
                <Button 
                  variant={selectedRoom?.status === "cleaning" ? "default" : "outline"}
                  onClick={() => handleStatusChange("cleaning")}
                  className="flex items-center justify-center"
                  disabled={updateRoomStatusMutation.isPending}
                >
                  <Brush className="mr-2 h-4 w-4" />
                  Cleaning
                </Button>
                <Button 
                  variant={selectedRoom?.status === "maintenance" ? "default" : "outline"}
                  onClick={() => handleStatusChange("maintenance")}
                  className="flex items-center justify-center col-span-2"
                  disabled={updateRoomStatusMutation.isPending}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  Maintenance
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="maintenance" className="space-y-4">
              <div>
                <Label>Maintenance Notes</Label>
                <Textarea 
                  placeholder="Describe the maintenance issue..." 
                  defaultValue={selectedRoom?.notes || ""}
                  onBlur={(e) => {
                    if (selectedRoom && e.target.value !== selectedRoom.notes) {
                      updateRoomStatusMutation.mutate({
                        roomId: selectedRoom.id,
                        status: selectedRoom.status,
                        notes: e.target.value
                      });
                    }
                  }}
                />
              </div>
              <Button 
                className="w-full"
                onClick={() => handleStatusChange("maintenance")}
                disabled={updateRoomStatusMutation.isPending}
              >
                {updateRoomStatusMutation.isPending ? "Updating..." : "Set to Maintenance"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseRoomManagement;
