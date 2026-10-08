ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inventory_private boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.inventory_is_private(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce((select inventory_private from public.profiles where id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_private(_private boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null then return 'Not signed in.'; end if;
  update public.profiles set inventory_private = coalesce(_private, false) where id = auth.uid();
  return 'ok';
end $$;

DROP POLICY IF EXISTS "user items readable by authenticated" ON public.user_items;
CREATE POLICY "user items readable by authenticated"
ON public.user_items FOR SELECT TO authenticated
USING (user_id = auth.uid() OR NOT public.inventory_is_private(user_id));