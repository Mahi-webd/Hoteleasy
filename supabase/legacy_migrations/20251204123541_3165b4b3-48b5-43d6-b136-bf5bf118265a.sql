-- Drop existing restrictive policies on pos_orders
DROP POLICY IF EXISTS "Staff can view pos_orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Staff can create pos_orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Staff can update pos_orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Staff can delete pos_orders" ON public.pos_orders;

-- Drop existing restrictive policies on pos_order_items
DROP POLICY IF EXISTS "Staff can view pos_order_items" ON public.pos_order_items;
DROP POLICY IF EXISTS "Staff can create pos_order_items" ON public.pos_order_items;
DROP POLICY IF EXISTS "Staff can update pos_order_items" ON public.pos_order_items;
DROP POLICY IF EXISTS "Staff can delete pos_order_items" ON public.pos_order_items;

-- Create public access policies for pos_orders
CREATE POLICY "Allow all operations on pos_orders" 
ON public.pos_orders 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create public access policies for pos_order_items
CREATE POLICY "Allow all operations on pos_order_items" 
ON public.pos_order_items 
FOR ALL 
USING (true)
WITH CHECK (true);