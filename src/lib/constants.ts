// Hotel Management System Constants
// All static constants and mappings should be defined here

import { 
  Home, 
  User, 
  CreditCard, 
  Users, 
  MapPin, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Coffee,
  UtensilsCrossed,
  Wine,
  Monitor,
  Smartphone,
  Banknote,
  Receipt,
  CheckCircle,
  AlertCircle,
  Settings,
  Plus,
  Search,
  Filter,
  Eye,
  Download,
  Printer,
  RefreshCw,
  X,
  ArrowLeft,
  Edit,
  Trash2,
  Wrench,
  UserCheck,
  Star,
  MessageCircle,
  Zap,
  Bot,
  Package,
  Menu,
  BarChart3,
  ShoppingCart,
  Calendar,
  Bell,
  Phone,
  Mail,
  Target
} from 'lucide-react';

// Room Status Configuration
export const ROOM_STATUSES = {
  available: {
    label: 'Available',
    color: 'bg-green-100 text-green-800 border-green-200',
    bgClass: 'bg-green-50 border-green-200',
    icon: '🟢',
    statusColor: 'bg-green-500'
  },
  occupied: {
    label: 'Occupied',
    color: 'bg-red-100 text-red-800 border-red-200',
    bgClass: 'bg-red-50 border-red-200',
    icon: '🔴',
    statusColor: 'bg-red-500'
  },
  cleaning: {
    label: 'Cleaning',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    bgClass: 'bg-yellow-50 border-yellow-200',
    icon: '🟡',
    statusColor: 'bg-yellow-500'
  },
  maintenance: {
    label: 'Maintenance',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    bgClass: 'bg-orange-50 border-orange-200',
    icon: '🔧',
    statusColor: 'bg-orange-500'
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    bgClass: 'bg-blue-50 border-blue-200',
    icon: '🔵',
    statusColor: 'bg-blue-500'
  }
} as const;

// Order Status Configuration
export const ORDER_STATUSES = {
  new: {
    label: 'New',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  preparing: {
    label: 'Preparing',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  ready: {
    label: 'Ready',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  served: {
    label: 'Served',
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  },
  paid: {
    label: 'Paid',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 border-red-200'
  }
} as const;

// Reservation Status Configuration
export const RESERVATION_STATUSES = {
  confirmed: {
    label: 'Confirmed',
    color: 'bg-green-100 text-green-800'
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800'
  },
  'checked-in': {
    label: 'Checked In',
    color: 'bg-blue-100 text-blue-800'
  },
  'checked-out': {
    label: 'Checked Out',
    color: 'bg-gray-100 text-gray-800'
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800'
  }
} as const;

// Payment Status Configuration
export const PAYMENT_STATUSES = {
  paid: {
    label: 'Paid',
    color: 'bg-green-100 text-green-800'
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800'
  },
  'deposit-paid': {
    label: 'Deposit Paid',
    color: 'bg-blue-100 text-blue-800'
  },
  'partially-paid': {
    label: 'Partially Paid',
    color: 'bg-blue-100 text-blue-800'
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-red-100 text-red-800'
  }
} as const;

// Payment Method Configuration
export const PAYMENT_METHODS = {
  mpesa: {
    id: 'mpesa',
    name: 'M-Pesa',
    icon: Smartphone,
    color: 'bg-green-500'
  },
  card: {
    id: 'card',
    name: 'Credit/Debit Card',
    icon: CreditCard,
    color: 'bg-blue-500'
  },
  cash: {
    id: 'cash',
    name: 'Cash',
    icon: Banknote,
    color: 'bg-yellow-500'
  },
  bank: {
    id: 'bank',
    name: 'Bank Transfer',
    icon: Receipt,
    color: 'bg-purple-500'
  },
  room: {
    id: 'room',
    name: 'Room Charge',
    icon: Home,
    color: 'bg-indigo-500'
  }
} as const;

// Room Type Configuration
export const ROOM_TYPES = {
  'standard-single': {
    name: 'Standard Single',
    baseRate: 8000,
    maxOccupancy: 1,
    amenities: ['WiFi', 'TV', 'AC', 'Minibar']
  },
  'standard-double': {
    name: 'Standard Double',
    baseRate: 12000,
    maxOccupancy: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Minibar', 'Coffee Maker']
  },
  'deluxe-double': {
    name: 'Deluxe Double',
    baseRate: 15000,
    maxOccupancy: 2,
    amenities: ['WiFi', 'TV', 'AC', 'Minibar', 'Coffee Maker', 'Balcony']
  },
  suite: {
    name: 'Suite',
    baseRate: 25000,
    maxOccupancy: 4,
    amenities: ['WiFi', 'TV', 'AC', 'Minibar', 'Coffee Maker', 'Balcony', 'Living Area']
  },
  'presidential-suite': {
    name: 'Presidential Suite',
    baseRate: 45000,
    maxOccupancy: 6,
    amenities: ['WiFi', 'TV', 'AC', 'Minibar', 'Coffee Maker', 'Balcony', 'Living Area', 'Dining Area', 'Jacuzzi']
  }
} as const;

// Menu Category Icons
export const CATEGORY_ICONS = {
  food: UtensilsCrossed,
  beverages: Coffee,
  bar: Wine,
  conference: Monitor,
  spa: Star,
  laundry: Package,
  default: Coffee
} as const;

// Activity Type Configuration
export const ACTIVITY_TYPES = {
  checkin: {
    color: 'bg-blue-500',
    label: 'Check-in'
  },
  checkout: {
    color: 'bg-red-500',
    label: 'Check-out'
  },
  payment: {
    color: 'bg-green-500',
    label: 'Payment'
  },
  housekeeping: {
    color: 'bg-purple-500',
    label: 'Housekeeping'
  },
  reservation: {
    color: 'bg-orange-500',
    label: 'Reservation'
  },
  maintenance: {
    color: 'bg-yellow-500',
    label: 'Maintenance'
  }
} as const;

// Booking Sources
export const BOOKING_SOURCES = {
  direct: 'Direct',
  phone: 'Phone',
  'booking.com': 'Booking.com',
  expedia: 'Expedia',
  'travel-agent': 'Travel Agent',
  online: 'Online Portal',
  walkin: 'Walk-in'
} as const;

// Navigation Menu Configuration
export const NAVIGATION_SECTIONS = {
  main: [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rooms', label: 'Rooms', icon: MapPin },
    { id: 'guests', label: 'Guests', icon: Users },
    { id: 'reservations', label: 'Reservations', icon: Calendar },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'pos', label: 'POS', icon: ShoppingCart },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ],
  operations: [
    { id: 'housekeeping', label: 'Housekeeping', icon: UserCheck },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'staff', label: 'Staff Schedule', icon: Clock }
  ],
  'guest-experience': [
    { id: 'mobile-checkin', label: 'Mobile Check-in', icon: Smartphone },
    { id: 'feedback', label: 'Guest Feedback', icon: Star },
    { id: 'concierge', label: 'Digital Concierge', icon: MessageCircle }
  ],
  'efficiency-tools': [
    { id: 'quick-actions', label: 'Quick Actions', icon: Zap },
    { id: 'task-automation', label: 'Task Automation', icon: Bot },
    { id: 'inventory', label: 'Inventory Alerts', icon: Package }
  ]
} as const;

// Service Items for Billing
export const SERVICE_ITEMS = {
  room: 'Room Charges',
  restaurant: 'Restaurant',
  minibar: 'Minibar',
  spa: 'Spa Services',
  laundry: 'Laundry Service',
  conference: 'Conference Room',
  parking: 'Parking',
  transport: 'Transport Service',
  catering: 'Catering',
  internet: 'Internet Service',
  telephone: 'Telephone Charges',
  other: 'Other Services'
} as const;

// Table Areas for Restaurant
export const TABLE_AREAS = {
  main: 'Main Dining',
  terrace: 'Terrace',
  private: 'Private Dining',
  bar: 'Bar Area',
  outdoor: 'Outdoor Seating',
  vip: 'VIP Section'
} as const;

// Guest Preferences
export const GUEST_PREFERENCES = {
  'room-type': ['Standard', 'Deluxe', 'Suite'],
  'bed-type': ['Single', 'Double', 'Twin', 'King'],
  'floor-preference': ['Low Floor', 'High Floor', 'No Preference'],
  'view-preference': ['City View', 'Garden View', 'Pool View', 'No Preference'],
  'special-needs': ['Wheelchair Accessible', 'Hearing Impaired', 'Visual Impaired'],
  dietary: ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free', 'No Restrictions'],
  amenities: ['Late Checkout', 'Early Checkin', 'Airport Transfer', 'Spa Services']
} as const;

// Status Badge Variants
export const STATUS_VARIANTS = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800'
} as const;

// Trend Indicators
export const TREND_INDICATORS = {
  up: {
    icon: TrendingUp,
    color: 'text-green-500'
  },
  down: {
    icon: TrendingDown,
    color: 'text-red-500'
  }
} as const;