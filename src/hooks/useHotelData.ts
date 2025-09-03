// Custom hook for fetching and managing hotel data dynamically

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { 
  Room, 
  Guest, 
  Reservation, 
  Order, 
  MenuItem, 
  MenuCategory, 
  Table, 
  Invoice,
  KPIData,
  ActivityItem,
  Arrival,
  RoomStatusSummary,
  FinancialSummary,
  SearchFilters,
  SortOptions
} from '@/types/hotel';
import { HOTEL_CONFIG, formatCurrency, calculateTax, calculateTotal } from '@/lib/config';

export const useRooms = (filters?: SearchFilters) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('rooms').select(`
        *,
        room_types (name, base_rate, max_occupancy, amenities),
        floors (floor_number, name)
      `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('room_number');
      
      if (error) throw error;
      setRooms(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
      toast({
        title: "Error",
        description: "Failed to load rooms data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const updateRoomStatus = async (roomId: string, status: Room['status']) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status })
        .eq('id', roomId);

      if (error) throw error;
      
      await fetchRooms();
      toast({
        title: "Success",
        description: "Room status updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update room status",
        variant: "destructive",
      });
    }
  };

  return { rooms, loading, error, refetch: fetchRooms, updateRoomStatus };
};

export const useGuests = (filters?: SearchFilters) => {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('guests').select('*');

      if (filters?.searchTerm) {
        query = query.or(`first_name.ilike.%${filters.searchTerm}%,last_name.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setGuests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch guests');
      toast({
        title: "Error",
        description: "Failed to load guests data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  return { guests, loading, error, refetch: fetchGuests };
};

export const useReservations = (filters?: SearchFilters) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('reservations').select(`
        *,
        guests (first_name, last_name, email, phone),
        rooms (room_number, room_types (name))
      `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setReservations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reservations');
      toast({
        title: "Error",
        description: "Failed to load reservations data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return { reservations, loading, error, refetch: fetchReservations };
};

export const useOrders = (filters?: SearchFilters) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('pos_orders').select(`
        *,
        pos_order_items (
          *,
          menu_items (name, price)
        ),
        restaurant_tables (table_number, area)
      `);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      toast({
        title: "Error",
        description: "Failed to load orders data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
};

export const useMenuData = () => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMenuData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [categoriesResult, itemsResult] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('menu_items').select('*').eq('is_available', true).order('display_order')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setCategories(categoriesResult.data || []);
      setItems(itemsResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch menu data');
      toast({
        title: "Error",
        description: "Failed to load menu data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  return { categories, items, loading, error, refetch: fetchMenuData };
};

export const useTables = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');
      
      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tables');
      toast({
        title: "Error",
        description: "Failed to load tables data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  return { tables, loading, error, refetch: fetchTables };
};

export const useDashboardData = () => {
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch room statistics
      const { data: rooms } = await supabase.from('rooms').select('status');
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id, total_amount, status, check_in_date')
        .gte('check_in_date', new Date().toISOString().split('T')[0]);

      if (rooms) {
        const summary: RoomStatusSummary = {
          total: rooms.length,
          occupied: rooms.filter(r => r.status === 'occupied').length,
          available: rooms.filter(r => r.status === 'available').length,
          cleaning: rooms.filter(r => r.status === 'cleaning').length,
          maintenance: rooms.filter(r => r.status === 'maintenance').length,
          occupancyRate: rooms.length > 0 ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100) : 0
        };
        setRoomSummary(summary);

        // Calculate today's revenue
        const todayRevenue = reservations?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
        
        // Generate KPI data dynamically
        const dynamicKpiData: KPIData[] = [
          {
            title: 'Occupancy Rate',
            value: `${summary.occupancyRate}%`,
            change: '+5.2%', // This would come from comparing with previous period
            trend: 'up' as const,
            icon: () => null, // Will be filled by component
            color: 'bg-blue-500'
          },
          {
            title: 'Revenue Today',
            value: formatCurrency(todayRevenue),
            change: '+12.3%',
            trend: 'up' as const,
            icon: () => null,
            color: 'bg-green-500'
          },
          {
            title: 'Available Rooms',
            value: summary.available.toString(),
            change: '-3',
            trend: 'down' as const,
            icon: () => null,
            color: 'bg-orange-500'
          },
          {
            title: 'Total Guests',
            value: summary.occupied.toString(),
            change: '+8',
            trend: 'up' as const,
            icon: () => null,
            color: 'bg-purple-500'
          }
        ];

        setKpiData(dynamicKpiData);
      }

      // Generate mock recent activities (in a real app, this would come from an activity log)
      const recentActivities: ActivityItem[] = [
        {
          id: '1',
          time: new Date(Date.now() - 30 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          event: 'New check-in completed',
          type: 'checkin'
        },
        {
          id: '2',
          time: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          event: 'Payment received',
          type: 'payment'
        },
        {
          id: '3',
          time: new Date(Date.now() - 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          event: 'Housekeeping completed',
          type: 'housekeeping'
        }
      ];

      setActivities(recentActivities);

      // Generate today's arrivals from reservations
      const todayArrivals: Arrival[] = reservations?.slice(0, 4).map((r, index) => ({
        id: r.id,
        guestName: 'Guest ' + (index + 1), // In real app, this would come from joined guest data
        room: `${100 + index}`,
        time: new Date(Date.now() + index * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        status: r.status === 'confirmed' ? 'confirmed' : 'pending',
        reservationId: r.id
      })) || [];

      setArrivals(todayArrivals);

    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return { 
    kpiData, 
    activities, 
    arrivals, 
    roomSummary, 
    loading, 
    refetch: fetchDashboardData 
  };
};

// Utility hook for currency formatting
export const useCurrency = () => {
  const format = useCallback((amount: number) => formatCurrency(amount), []);
  const calculateVAT = useCallback((amount: number) => calculateTax(amount, 'vat'), []);
  const calculateServiceTax = useCallback((amount: number) => calculateTax(amount, 'serviceTax'), []);
  const calculateTotalWithTax = useCallback((subtotal: number) => calculateTotal(subtotal), []);

  return { format, calculateVAT, calculateServiceTax, calculateTotalWithTax, config: HOTEL_CONFIG };
};