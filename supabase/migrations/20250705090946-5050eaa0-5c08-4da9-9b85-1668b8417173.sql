
-- Create room_types table
CREATE TABLE public.room_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_occupancy INTEGER NOT NULL DEFAULT 1,
  amenities TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create floors table
CREATE TABLE public.floors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  floor_number INTEGER NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  room_type_id UUID REFERENCES public.room_types(id) NOT NULL,
  floor_id UUID REFERENCES public.floors(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance', 'out_of_order')),
  daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_occupancy INTEGER NOT NULL DEFAULT 1,
  is_smoking BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for room_types
CREATE POLICY "Anyone can view room types" ON public.room_types FOR SELECT USING (true);
CREATE POLICY "Staff can manage room types" ON public.room_types FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);

-- Create RLS policies for floors
CREATE POLICY "Anyone can view floors" ON public.floors FOR SELECT USING (true);
CREATE POLICY "Staff can manage floors" ON public.floors FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);

-- Create RLS policies for rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Staff can manage rooms" ON public.rooms FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'front_desk'))
);

-- Insert some default room types
INSERT INTO public.room_types (name, description, base_rate, max_occupancy, amenities) VALUES
('Standard Single', 'Basic single occupancy room', 8000.00, 1, ARRAY['WiFi', 'TV', 'Air Conditioning']),
('Standard Double', 'Basic double occupancy room', 12000.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge']),
('Deluxe Double', 'Premium double occupancy room', 15000.00, 2, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge', 'Balcony']),
('Suite', 'Spacious suite with separate living area', 25000.00, 4, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge', 'Balcony', 'Kitchenette']),
('Presidential Suite', 'Luxury suite with premium amenities', 45000.00, 6, ARRAY['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge', 'Balcony', 'Kitchenette', 'Jacuzzi', 'Butler Service']);

-- Insert some default floors
INSERT INTO public.floors (floor_number, name, description) VALUES
(1, 'Ground Floor', 'Main entrance and lobby level'),
(2, 'Second Floor', 'Standard rooms'),
(3, 'Third Floor', 'Premium rooms'),
(4, 'Fourth Floor', 'Suites and luxury rooms');

-- Insert some sample rooms
INSERT INTO public.rooms (room_number, room_type_id, floor_id, daily_rate, max_occupancy, is_smoking) VALUES
('101', (SELECT id FROM public.room_types WHERE name = 'Standard Single'), (SELECT id FROM public.floors WHERE floor_number = 1), 8000.00, 1, false),
('102', (SELECT id FROM public.room_types WHERE name = 'Standard Double'), (SELECT id FROM public.floors WHERE floor_number = 1), 12000.00, 2, false),
('103', (SELECT id FROM public.room_types WHERE name = 'Deluxe Double'), (SELECT id FROM public.floors WHERE floor_number = 1), 15000.00, 2, true),
('104', (SELECT id FROM public.room_types WHERE name = 'Suite'), (SELECT id FROM public.floors WHERE floor_number = 1), 25000.00, 4, false),
('201', (SELECT id FROM public.room_types WHERE name = 'Standard Single'), (SELECT id FROM public.floors WHERE floor_number = 2), 8000.00, 1, false),
('202', (SELECT id FROM public.room_types WHERE name = 'Standard Double'), (SELECT id FROM public.floors WHERE floor_number = 2), 12000.00, 2, false),
('203', (SELECT id FROM public.room_types WHERE name = 'Deluxe Double'), (SELECT id FROM public.floors WHERE floor_number = 2), 15000.00, 2, false),
('204', (SELECT id FROM public.room_types WHERE name = 'Presidential Suite'), (SELECT id FROM public.floors WHERE floor_number = 2), 45000.00, 6, true);

-- Enable realtime for rooms table
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
