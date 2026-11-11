-- Fix security issue: Restrict pos_orders and pos_order_items access to authenticated staff only

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow all operations on pos_orders" ON public.pos_orders;
DROP POLICY IF EXISTS "Allow all operations on pos_order_items" ON public.pos_order_items;

-- Create secure policies for pos_orders table
CREATE POLICY "Staff can view pos_orders" 
ON public.pos_orders 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can create pos_orders" 
ON public.pos_orders 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can update pos_orders" 
ON public.pos_orders 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can delete pos_orders" 
ON public.pos_orders 
FOR DELETE 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

-- Create secure policies for pos_order_items table
CREATE POLICY "Staff can view pos_order_items" 
ON public.pos_order_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can create pos_order_items" 
ON public.pos_order_items 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can update pos_order_items" 
ON public.pos_order_items 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));

CREATE POLICY "Staff can delete pos_order_items" 
ON public.pos_order_items 
FOR DELETE 
USING (EXISTS (
  SELECT 1 
  FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role, 'front_desk'::user_role])
));