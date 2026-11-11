// Type definitions for hotel management system

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  idNumber?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  country?: string;
  preferences?: string;
  notes?: string;
  vip: boolean;
  totalStays: number;
  totalSpent: number;
  lastStay?: string;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floorId: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
  dailyRate: number;
  maxOccupancy: number;
  isSmoking: boolean;
  notes?: string;
  currentGuest?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomType {
  id: string;
  name: string;
  description?: string;
  baseRate: number;
  maxOccupancy: number;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  floorNumber: number;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  status: 'confirmed' | 'pending' | 'checked-in' | 'checked-out' | 'cancelled';
  specialRequests?: string;
  notes?: string;
  bookingSource: string;
  paymentStatus: 'paid' | 'pending' | 'deposit-paid' | 'partially-paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId?: string;
  customerName?: string;
  status: 'new' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  menuItem?: MenuItem;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: string;
  tableNumber: number;
  capacity: number;
  area: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
}

export interface Invoice {
  id: string;
  guestId: string;
  reservationId?: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue' | 'partially-paid';
  paymentMethod?: string;
  paymentDate?: string;
  dueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface KPIData {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ComponentType;
  color: string;
}

export interface ActivityItem {
  id: string;
  time: string;
  event: string;
  type: 'checkin' | 'checkout' | 'payment' | 'housekeeping' | 'reservation' | 'maintenance';
  userId?: string;
  relatedId?: string;
}

export interface Arrival {
  id: string;
  guestName: string;
  room: string;
  time: string;
  status: 'confirmed' | 'pending' | 'vip';
  reservationId: string;
}

export interface RoomStatusSummary {
  occupied: number;
  available: number;
  cleaning: number;
  maintenance: number;
  total: number;
  occupancyRate: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  averageNightlyRate: number;
  averageStayLength: number;
}

export interface UserRole {
  id: string;
  userId: string;
  role: 'admin' | 'manager' | 'front_desk' | 'housekeeping' | 'maintenance' | 'staff';
  createdAt: string;
}

export interface Profile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

// Utility types
export type RoomStatus = Room['status'];
export type ReservationStatus = Reservation['status'];
export type OrderStatus = Order['status'];
export type PaymentStatus = Reservation['paymentStatus'];
export type UserRoleType = UserRole['role'];

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Search and Filter Types
export interface SearchFilters {
  searchTerm?: string;
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  roomType?: string;
  floor?: string;
  paymentStatus?: string;
  bookingSource?: string;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}