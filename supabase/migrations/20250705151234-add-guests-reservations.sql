
-- Create guests table
CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  nationality TEXT,
  id_number TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  country TEXT,
  vip BOOLEAN NOT NULL DEFAULT false,
  preferences TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES public.guests(id) NOT NULL,
  room_id UUID REFERENCES public.rooms(id) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  special_requests TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for guests
CREATE POLICY "Staff can view guests" ON public.guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);
CREATE POLICY "Staff can manage guests" ON public.guests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);

-- Create RLS policies for reservations
CREATE POLICY "Staff can view reservations" ON public.reservations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);
CREATE POLICY "Staff can manage reservations" ON public.reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);

-- Enable realtime
ALTER TABLE public.guests REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- Insert sample guests
INSERT INTO public.guests (first_name, last_name, email, phone, nationality, country, vip) VALUES
('John', 'Doe', 'john.doe@email.com', '+254700123456', 'Kenyan', 'Kenya', false),
('Jane', 'Smith', 'jane.smith@email.com', '+254700234567', 'American', 'USA', true),
('Mike', 'Johnson', 'mike.johnson@email.com', '+254700345678', 'British', 'UK', false);

-- Insert sample reservations
INSERT INTO public.reservations (guest_id, room_id, check_in_date, check_out_date, adults, children, total_amount, status) VALUES
((SELECT id FROM public.guests WHERE email = 'john.doe@email.com'), (SELECT id FROM public.rooms WHERE room_number = '101'), '2025-01-15', '2025-01-18', 2, 0, 24000.00, 'confirmed'),
((SELECT id FROM public.guests WHERE email = 'jane.smith@email.com'), (SELECT id FROM public.rooms WHERE room_number = '201'), '2025-01-16', '2025-01-20', 1, 1, 32000.00, 'checked_in'),
((SELECT id FROM public.guests WHERE email = 'mike.johnson@email.com'), (SELECT id FROM public.rooms WHERE room_number = '202'), '2025-01-17', '2025-01-19', 2, 2, 24000.00, 'confirmed');
