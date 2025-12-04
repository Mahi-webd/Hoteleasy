-- =============================================
-- EXTEND STAFF TABLE with additional fields
-- =============================================
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_rooms TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT;

-- =============================================
-- EXTEND HOUSEKEEPING_TASKS with checklist items
-- =============================================
ALTER TABLE public.housekeeping_tasks
ADD COLUMN IF NOT EXISTS last_cleaned TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_service TEXT,
ADD COLUMN IF NOT EXISTS checklist_bathroom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_bedroom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_amenities BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_vacuum BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_linens BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_minibar BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS checklist_windows BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_rating INTEGER,
ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER;

-- =============================================
-- EXTEND MAINTENANCE_REQUESTS with additional fields
-- =============================================
ALTER TABLE public.maintenance_requests
ADD COLUMN IF NOT EXISTS parts_needed TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS parts_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS work_order_number SERIAL,
ADD COLUMN IF NOT EXISTS warranty_claim BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS vendor_contact TEXT,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
ADD COLUMN IF NOT EXISTS rating INTEGER,
ADD COLUMN IF NOT EXISTS rating_notes TEXT;

-- =============================================
-- EXTEND INVENTORY_ITEMS with additional fields
-- =============================================
ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS last_restock_date DATE,
ADD COLUMN IF NOT EXISTS last_restock_quantity NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS average_monthly_usage NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS storage_conditions TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =============================================
-- EXTEND INVOICES with additional fields
-- =============================================
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4) DEFAULT 1,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS po_number TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- =============================================
-- EXTEND PAYMENTS with additional fields
-- =============================================
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS card_last_four TEXT,
ADD COLUMN IF NOT EXISTS card_type TEXT,
ADD COLUMN IF NOT EXISTS mpesa_receipt_number TEXT,
ADD COLUMN IF NOT EXISTS bank_reference TEXT,
ADD COLUMN IF NOT EXISTS room_charge_reference TEXT,
ADD COLUMN IF NOT EXISTS refund_status TEXT,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS refund_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- =============================================
-- EXTEND BUDGETS with additional fields
-- =============================================
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS alert_threshold_percent INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- =============================================
-- EXTEND GUEST_FEEDBACK with additional fields
-- =============================================
ALTER TABLE public.guest_feedback
ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER,
ADD COLUMN IF NOT EXISTS service_rating INTEGER,
ADD COLUMN IF NOT EXISTS food_rating INTEGER,
ADD COLUMN IF NOT EXISTS value_rating INTEGER,
ADD COLUMN IF NOT EXISTS amenities_rating INTEGER,
ADD COLUMN IF NOT EXISTS location_rating INTEGER,
ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- =============================================
-- EXTEND CONCIERGE_REQUESTS with additional fields
-- =============================================
ALTER TABLE public.concierge_requests
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS confirmation_number TEXT,
ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dropoff_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS number_of_guests INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS special_requirements TEXT,
ADD COLUMN IF NOT EXISTS rating INTEGER,
ADD COLUMN IF NOT EXISTS feedback TEXT;

-- =============================================
-- EXTEND AUTOMATED_TASKS with additional fields
-- =============================================
ALTER TABLE public.automated_tasks
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS email_on_failure BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_recipients TEXT[];

-- =============================================
-- CREATE FEEDBACK SURVEYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.feedback_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  survey_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  questions JSONB DEFAULT '[]'::jsonb,
  response_count INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2) DEFAULT 0,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE CHAT SESSIONS TABLE (for Digital Concierge)
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  channel TEXT NOT NULL DEFAULT 'web',
  unread_count INTEGER DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  ai_enabled BOOLEAN DEFAULT true,
  ai_resolution_rate NUMERIC(5,2),
  satisfaction_rating INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id UUID,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE CONCIERGE SERVICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.concierge_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  price NUMERIC(10,2),
  price_type TEXT DEFAULT 'fixed',
  duration_minutes INTEGER,
  is_available BOOLEAN DEFAULT true,
  requires_advance_booking BOOLEAN DEFAULT false,
  advance_booking_hours INTEGER,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE AUTOMATION EXECUTION HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.automation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.automated_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  result_summary TEXT,
  items_processed INTEGER DEFAULT 0,
  items_succeeded INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB
);

-- =============================================
-- CREATE STAFF ATTENDANCE TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.staff_schedules(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  break_start TIMESTAMP WITH TIME ZONE,
  break_end TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  hours_worked NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE TIME OFF REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5,2),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE SUPPLIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  tax_id TEXT,
  payment_terms TEXT,
  credit_limit NUMERIC(12,2),
  current_balance NUMERIC(12,2) DEFAULT 0,
  rating NUMERIC(3,2),
  categories TEXT[],
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE PURCHASE ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number SERIAL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_cost NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  notes TEXT,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- CREATE PURCHASE ORDER ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  received_quantity NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON NEW TABLES
-- =============================================
ALTER TABLE public.feedback_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PUBLIC ACCESS POLICIES (for development)
-- =============================================
CREATE POLICY "Allow all on feedback_surveys" ON public.feedback_surveys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chat_sessions" ON public.chat_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on concierge_services" ON public.concierge_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on automation_history" ON public.automation_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on staff_attendance" ON public.staff_attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on time_off_requests" ON public.time_off_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on purchase_order_items" ON public.purchase_order_items FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE TRIGGER update_feedback_surveys_updated_at BEFORE UPDATE ON public.feedback_surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_concierge_services_updated_at BEFORE UPDATE ON public.concierge_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON public.time_off_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();