
-- Create guest status enum
CREATE TYPE public.guest_status AS ENUM ('active', 'checked_in', 'checked_out', 'blacklisted');

-- Create reservation status enum  
CREATE TYPE public.reservation_status AS ENUM ('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out', 'no_show');

-- Create guests table
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  nationality TEXT,
  id_number TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  country TEXT,
  vip BOOLEAN DEFAULT FALSE,
  preferences TEXT,
  notes TEXT,
  total_stays INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  last_stay DATE,
  status guest_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.guests(id) NOT NULL,
  room_id UUID REFERENCES public.rooms(id) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  total_rate DECIMAL(10,2) NOT NULL,
  special_requests TEXT,
  status reservation_status DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date)
);

-- Create guest_stays table for tracking actual stays
CREATE TABLE public.guest_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES public.guests(id) NOT NULL,
  reservation_id UUID REFERENCES public.reservations(id),
  room_id UUID REFERENCES public.rooms(id) NOT NULL,
  actual_check_in TIMESTAMP WITH TIME ZONE,
  actual_check_out TIMESTAMP WITH TIME ZONE,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all guest tables
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_stays ENABLE ROW LEVEL SECURITY;

-- Create policies for guests (viewable and manageable by hotel staff)
CREATE POLICY "Hotel staff can view all guests" ON public.guests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

CREATE POLICY "Hotel staff can manage guests" ON public.guests
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

-- Create policies for reservations
CREATE POLICY "Hotel staff can view all reservations" ON public.reservations
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

CREATE POLICY "Hotel staff can manage reservations" ON public.reservations
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

-- Create policies for guest_stays
CREATE POLICY "Hotel staff can view all guest stays" ON public.guest_stays
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

CREATE POLICY "Hotel staff can manage guest stays" ON public.guest_stays
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk')
  );

-- Insert sample guests
INSERT INTO public.guests (first_name, last_name, email, phone, nationality, id_number, vip, preferences, total_stays, total_spent, last_stay, status) VALUES
('John', 'Doe', 'john.doe@email.com', '+254 700 123 456', 'Kenyan', '12345678', true, 'Ocean view, late checkout', 5, 245000.00, '2025-04-15', 'active'),
('Jane', 'Smith', 'jane.smith@email.com', '+254 700 234 567', 'British', 'AB123456', false, 'Quiet room, early breakfast', 2, 89000.00, '2025-03-10', 'active'),
('Mike', 'Johnson', 'mike.johnson@email.com', '+254 700 345 678', 'American', 'US789123', false, 'Ground floor, no smoking', 1, 67500.00, '2025-06-21', 'checked_in'),
('Sarah', 'Wilson', 'sarah.wilson@email.com', '+254 700 456 789', 'South African', 'SA456789', true, 'Suite room, spa services', 8, 456000.00, '2025-05-18', 'active'),
('Ahmed', 'Hassan', 'ahmed.hassan@email.com', '+254 700 567 890', 'Egyptian', 'EG123789', false, 'Halal meals, prayer mat', 3, 156000.00, '2025-04-22', 'active');

-- Insert sample reservations
INSERT INTO public.reservations (guest_id, room_id, check_in_date, check_out_date, adults, children, total_rate, status) 
SELECT 
  g.id,
  r.id,
  reservation_data.check_in_date::date,
  reservation_data.check_out_date::date,
  reservation_data.adults,
  reservation_data.children,
  reservation_data.total_rate,
  reservation_data.status::reservation_status
FROM (
  VALUES 
    ('john.doe@email.com', '101', '2025-07-15', '2025-07-20', 2, 0, 40000.00, 'confirmed'),
    ('jane.smith@email.com', '201', '2025-07-18', '2025-07-22', 1, 0, 48000.00, 'confirmed'),
    ('sarah.wilson@email.com', '204', '2025-07-20', '2025-07-25', 2, 1, 225000.00, 'confirmed'),
    ('ahmed.hassan@email.com', '102', '2025-07-22', '2025-07-24', 2, 0, 24000.00, 'pending')
) AS reservation_data(guest_email, room_number, check_in_date, check_out_date, adults, children, total_rate, status)
JOIN public.guests g ON g.email = reservation_data.guest_email
JOIN public.rooms r ON r.room_number = reservation_data.room_number;

-- Enable realtime for guest tables
ALTER TABLE public.guests REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.guest_stays REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_stays;

-- Create function to update guest statistics
CREATE OR REPLACE FUNCTION public.update_guest_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update guest stats when a new stay is added
    UPDATE public.guests 
    SET 
      total_stays = total_stays + 1,
      total_spent = total_spent + NEW.total_amount,
      last_stay = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = NEW.guest_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update guest stats
CREATE TRIGGER update_guest_stats_trigger
  AFTER INSERT ON public.guest_stays
  FOR EACH ROW EXECUTE FUNCTION public.update_guest_stats();
