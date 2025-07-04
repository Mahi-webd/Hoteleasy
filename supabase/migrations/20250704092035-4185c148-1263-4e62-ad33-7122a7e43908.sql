
-- Create room types table
CREATE TABLE public.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_rate DECIMAL(10,2) NOT NULL,
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  amenities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create floors table
CREATE TABLE public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_number INTEGER NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room status enum
CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'cleaning', 'maintenance', 'out_of_order');

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type_id UUID REFERENCES public.room_types(id) NOT NULL,
  floor_id UUID REFERENCES public.floors(id) NOT NULL,
  status room_status DEFAULT 'available',
  daily_rate DECIMAL(10,2) NOT NULL,
  max_occupancy INTEGER NOT NULL DEFAULT 2,
  is_smoking BOOLEAN DEFAULT FALSE,
  amenities JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  last_cleaned TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create policies for room_types (viewable by all authenticated users, manageable by admins/managers)
CREATE POLICY "Authenticated users can view room types" ON public.room_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can manage room types" ON public.room_types
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Create policies for floors (viewable by all authenticated users, manageable by admins/managers)
CREATE POLICY "Authenticated users can view floors" ON public.floors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers can manage floors" ON public.floors
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Create policies for rooms (viewable by all authenticated users, manageable by staff)
CREATE POLICY "Authenticated users can view rooms" ON public.rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hotel staff can update room status" ON public.rooms
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'front_desk') OR
    public.has_role(auth.uid(), 'housekeeping')
  );

CREATE POLICY "Admins and managers can manage rooms" ON public.rooms
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- Insert default room types
INSERT INTO public.room_types (name, description, base_rate, max_occupancy, amenities) VALUES
('Standard Single', 'Comfortable single occupancy room', 8000.00, 1, '["Wi-Fi", "TV", "Air Conditioning", "Private Bathroom"]'),
('Standard Double', 'Spacious double occupancy room', 12000.00, 2, '["Wi-Fi", "TV", "Air Conditioning", "Private Bathroom", "Mini Fridge"]'),
('Deluxe Double', 'Premium double room with city view', 15000.00, 2, '["Wi-Fi", "TV", "Air Conditioning", "Private Bathroom", "Mini Fridge", "City View", "Work Desk"]'),
('Suite', 'Luxurious suite with separate living area', 25000.00, 4, '["Wi-Fi", "TV", "Air Conditioning", "Private Bathroom", "Mini Fridge", "Living Area", "Kitchenette", "Balcony"]'),
('Presidential Suite', 'Ultimate luxury accommodation', 45000.00, 6, '["Wi-Fi", "TV", "Air Conditioning", "Private Bathroom", "Full Kitchen", "Living Area", "Dining Area", "Balcony", "Premium View", "Jacuzzi"]');

-- Insert default floors
INSERT INTO public.floors (floor_number, name) VALUES
(1, 'Ground Floor'),
(2, 'Second Floor'),
(3, 'Third Floor');

-- Insert sample rooms
INSERT INTO public.rooms (room_number, room_type_id, floor_id, status, daily_rate, max_occupancy, is_smoking) 
SELECT 
  room_number,
  rt.id,
  f.id,
  status::room_status,
  daily_rate,
  max_occupancy,
  is_smoking
FROM (
  VALUES 
    ('101', 'Standard Single', 1, 'occupied', 8000.00, 1, false),
    ('102', 'Standard Double', 1, 'available', 12000.00, 2, false),
    ('103', 'Deluxe Double', 1, 'cleaning', 15000.00, 2, true),
    ('104', 'Suite', 1, 'maintenance', 25000.00, 4, false),
    ('201', 'Standard Single', 2, 'occupied', 8000.00, 1, false),
    ('202', 'Standard Double', 2, 'available', 12000.00, 2, false),
    ('203', 'Deluxe Double', 2, 'occupied', 15000.00, 2, false),
    ('204', 'Presidential Suite', 2, 'available', 45000.00, 6, true),
    ('301', 'Standard Single', 3, 'occupied', 8000.00, 1, false),
    ('302', 'Standard Double', 3, 'cleaning', 12000.00, 2, false),
    ('303', 'Deluxe Double', 3, 'available', 15000.00, 2, false),
    ('304', 'Suite', 3, 'occupied', 25000.00, 4, false)
) AS room_data(room_number, room_type_name, floor_number, status, daily_rate, max_occupancy, is_smoking)
JOIN public.room_types rt ON rt.name = room_data.room_type_name
JOIN public.floors f ON f.floor_number = room_data.floor_number;

-- Enable realtime for rooms table
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
