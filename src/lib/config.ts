// Hotel Management System Configuration
// Business configuration values that may change based on hotel settings

export const HOTEL_CONFIG = {
  // Hotel Information
  name: 'Olsupat Lodge',
  address: 'Nairobi, Kenya',
  phone: '+254 700 000 000',
  email: 'info@olsupatlodge.com',
  website: 'www.olsupatlodge.com',
  
  // Currency Settings
  currency: {
    code: 'KES',
    symbol: 'KES',
    name: 'Kenyan Shilling'
  },
  
  // Tax Configuration
  taxes: {
    vat: 0.16, // 16% VAT
    serviceTax: 0.085, // 8.5% Service Tax
    cityTax: 0.02 // 2% City Tax
  },
  
  // Business Hours
  businessHours: {
    checkin: '14:00',
    checkout: '11:00',
    restaurant: {
      breakfast: { start: '06:00', end: '10:00' },
      lunch: { start: '12:00', end: '15:00' },
      dinner: { start: '18:00', end: '22:00' }
    },
    housekeeping: {
      start: '08:00',
      end: '18:00'
    }
  },
  
  // Capacity Limits
  capacity: {
    maxRooms: 200,
    maxTables: 50,
    maxGuestsPerRoom: 6,
    maxOrderItems: 50
  },
  
  // Notification Settings
  notifications: {
    lowInventoryThreshold: 10,
    maintenanceReminderDays: 7,
    paymentReminderHours: 24
  },
  
  // Booking Settings
  booking: {
    advanceBookingDays: 365,
    minStayNights: 1,
    maxStayNights: 30,
    cancellationHours: 24
  },
  
  // Payment Settings
  payment: {
    acceptedMethods: ['mpesa', 'card', 'cash', 'bank', 'room'],
    depositPercentage: 0.3, // 30% deposit required
    lateFeePercentage: 0.05 // 5% late fee
  },
  
  // Report Settings
  reports: {
    defaultDateRange: 30, // days
    refreshInterval: 300000, // 5 minutes in milliseconds
    exportFormats: ['pdf', 'excel', 'csv']
  },
  
  // Security Settings
  security: {
    sessionTimeout: 3600000, // 1 hour in milliseconds
    maxLoginAttempts: 5,
    passwordMinLength: 8
  },
  
  // Feature Flags
  features: {
    mobileCheckin: true,
    digitalConcierge: true,
    aiChatbot: true,
    multiLanguage: true,
    loyaltyProgram: true,
    socialLogin: false
  },
  
  // UI Settings
  ui: {
    theme: 'light',
    primaryColor: '#2563eb',
    itemsPerPage: 10,
    autoRefresh: true,
    animationDuration: 300
  },
  
  // Integration Settings
  integrations: {
    bookingCom: false,
    expedia: false,
    paymentGateway: true,
    emailService: true,
    smsService: true
  }
} as const;

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      apiUrl: 'http://localhost:3000/api',
      debug: true,
      mockData: true
    },
    production: {
      apiUrl: '/api',
      debug: false,
      mockData: false
    },
    test: {
      apiUrl: 'http://localhost:3001/api',
      debug: true,
      mockData: true
    }
  };
  
  return configs[env as keyof typeof configs] || configs.development;
};

// Helper functions for configuration
export const formatCurrency = (amount: number): string => {
  return `${HOTEL_CONFIG.currency.symbol} ${amount.toLocaleString()}`;
};

export const calculateTax = (amount: number, taxType: keyof typeof HOTEL_CONFIG.taxes): number => {
  return Math.round(amount * HOTEL_CONFIG.taxes[taxType]);
};

export const calculateTotal = (subtotal: number, includeTaxes: (keyof typeof HOTEL_CONFIG.taxes)[] = ['vat']): number => {
  const totalTax = includeTaxes.reduce((sum, taxType) => sum + calculateTax(subtotal, taxType), 0);
  return subtotal + totalTax;
};

export const isFeatureEnabled = (feature: keyof typeof HOTEL_CONFIG.features): boolean => {
  return HOTEL_CONFIG.features[feature];
};

export const getBusinessHours = (service: keyof typeof HOTEL_CONFIG.businessHours) => {
  return HOTEL_CONFIG.businessHours[service];
};