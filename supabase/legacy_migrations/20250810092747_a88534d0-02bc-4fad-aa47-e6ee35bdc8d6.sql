-- Create menu_categories table
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create restaurant_tables table
CREATE TABLE public.restaurant_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number INTEGER NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  area TEXT NOT NULL DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_orders table
CREATE TABLE public.pos_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number INTEGER NOT NULL,
  table_id UUID REFERENCES public.restaurant_tables(id),
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'served', 'paid', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pos_order_items table
CREATE TABLE public.pos_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - in production, you'd want proper auth)
CREATE POLICY "Allow all operations on menu_categories" ON public.menu_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on restaurant_tables" ON public.restaurant_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on pos_orders" ON public.pos_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on pos_order_items" ON public.pos_order_items FOR ALL USING (true) WITH CHECK (true);

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) + 1 INTO next_number FROM public.pos_orders;
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    NEW.order_number = public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.pos_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- Create function to calculate order totals
CREATE OR REPLACE FUNCTION public.calculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
  order_subtotal DECIMAL(10,2);
  order_tax DECIMAL(10,2);
  order_total DECIMAL(10,2);
BEGIN
  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(total_price), 0) INTO order_subtotal
  FROM public.pos_order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

  -- Calculate tax (assuming 8.5% tax rate)
  order_tax = order_subtotal * 0.085;
  order_total = order_subtotal + order_tax;

  -- Update the order
  UPDATE public.pos_orders
  SET subtotal = order_subtotal,
      tax = order_tax,
      total = order_total,
      updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for order total calculation
CREATE TRIGGER trigger_calculate_total_on_insert
  AFTER INSERT ON public.pos_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_total();

CREATE TRIGGER trigger_calculate_total_on_update
  AFTER UPDATE ON public.pos_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_total();

CREATE TRIGGER trigger_calculate_total_on_delete
  AFTER DELETE ON public.pos_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_total();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_menu_categories_updated_at
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_orders_updated_at
  BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.menu_categories (name, display_order) VALUES
('Food', 1),
('Bar', 2),
('Conference', 3);

INSERT INTO public.menu_items (category_id, name, description, price, display_order) VALUES
-- Food items
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Margherita Pizza', 'Fresh tomato sauce, mozzarella, basil', 16.99, 1),
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Caesar Salad', 'Romaine lettuce, parmesan, croutons, caesar dressing', 12.99, 2),
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Grilled Salmon', 'Atlantic salmon with herbs and lemon', 24.99, 3),
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Beef Burger', 'Angus beef patty with lettuce, tomato, onion', 18.99, 4),
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Pasta Carbonara', 'Spaghetti with eggs, cheese, pancetta', 19.99, 5),
((SELECT id FROM public.menu_categories WHERE name = 'Food'), 'Chicken Wings', '8 pieces with buffalo sauce', 14.99, 6),

-- Bar items
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'House Wine Red', 'Cabernet Sauvignon', 8.99, 1),
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'House Wine White', 'Chardonnay', 8.99, 2),
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'Beer Draft', 'Local craft beer', 6.99, 3),
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'Mojito', 'White rum, mint, lime, soda', 12.99, 4),
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'Whiskey Sour', 'Bourbon, lemon juice, simple syrup', 13.99, 5),
((SELECT id FROM public.menu_categories WHERE name = 'Bar'), 'Cosmopolitan', 'Vodka, cranberry, lime juice, triple sec', 13.99, 6),

-- Conference items
((SELECT id FROM public.menu_categories WHERE name = 'Conference'), 'Coffee Service', 'Coffee, tea, pastries for 10 people', 45.99, 1),
((SELECT id FROM public.menu_categories WHERE name = 'Conference'), 'Lunch Package', 'Sandwiches, salads, drinks for 10 people', 129.99, 2),
((SELECT id FROM public.menu_categories WHERE name = 'Conference'), 'Meeting Room', 'Conference room rental per hour', 89.99, 3),
((SELECT id FROM public.menu_categories WHERE name = 'Conference'), 'AV Equipment', 'Projector, microphone, speakers', 39.99, 4);

-- Insert sample tables
INSERT INTO public.restaurant_tables (table_number, capacity, area) VALUES
(1, 2, 'main'),
(2, 4, 'main'),
(3, 6, 'main'),
(4, 2, 'terrace'),
(5, 4, 'terrace'),
(6, 8, 'private'),
(7, 2, 'bar'),
(8, 4, 'bar');