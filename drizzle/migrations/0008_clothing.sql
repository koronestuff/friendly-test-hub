ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'shirt';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'pants';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'tshirt';

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE public.clothing_templates (
  item_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  template_data_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clothing_templates TO anon, authenticated;
GRANT ALL ON public.clothing_templates TO service_role;
ALTER TABLE public.clothing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clothing templates readable" ON public.clothing_templates FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.publish_clothing(
  _name text, _kind text, _description text, _price integer, _template text, _thumb text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare _me uuid := auth.uid(); _id uuid;
begin
  if _me is null then return 'Not signed in.'; end if;
  if exists (select 1 from profiles where id = _me and is_banned) then return 'You are banned.'; end if;
  if _kind not in ('shirt','pants','tshirt') then return 'Invalid clothing type.'; end if;
  _name := trim(coalesce(_name,''));
  if length(_name) < 1 or length(_name) > 50 then return 'Name must be 1-50 characters.'; end if;
  if _price is null or _price < 0 or _price > 1000000 then return 'Price must be between 0 and 1,000,000.'; end if;
  if _template is null or left(_template, 22) <> 'data:image/png;base64,' or length(_template) > 3000000 then
    return 'Template must be a PNG under 2 MB.';
  end if;
  if _thumb is null or left(_thumb, 11) <> 'data:image/' or length(_thumb) > 800000 then
    return 'Invalid preview image.';
  end if;
  insert into items (name, kind, class, description, image_url, price, creator_id, rap, value)
  values (_name, _kind::item_kind, 'normal', left(coalesce(_description,''), 1000), _thumb, _price, _me, 0, 0)
  returning id into _id;
  insert into clothing_templates (item_id, template_data_url) values (_id, _template);
  insert into user_items (item_id, user_id, serial) values (_id, _me, null);
  return 'ok';
end $$;

CREATE OR REPLACE FUNCTION public.buy_item(_item_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_item public.items;
  v_limited boolean;
  v_listing public.user_items;
  v_price integer;
  v_balance integer;
begin
  if v_uid is null then return 'Not signed in'; end if;
  select * into v_item from public.items where id = _item_id for update;
  if not found then return 'Item not found'; end if;
  v_limited := public.item_is_limited(v_item);
  select rawbux into v_balance from public.profiles where id = v_uid for update;

  if not v_limited then
    if v_item.stock is not null and v_item.stock <= 0 then return 'Out of stock'; end if;
    if exists (select 1 from public.user_items where item_id = _item_id and user_id = v_uid) then
      return 'You already own this item';
    end if;
    v_price := v_item.price;
    if v_balance < v_price then return 'Not enough Rawbux'; end if;
    update public.profiles set rawbux = rawbux - v_price where id = v_uid;
    if v_item.creator_id is not null and v_item.creator_id <> v_uid then
      update public.profiles set rawbux = rawbux + v_price where id = v_item.creator_id;
    end if;
    if v_item.stock is not null then
      update public.items set stock = stock - 1 where id = _item_id;
    end if;
    update public.items set copies_sold = copies_sold + 1 where id = _item_id
      returning copies_sold into v_price;
    insert into public.user_items (item_id, user_id, serial)
    values (_item_id, v_uid, case when v_item.class = 'normal' then null else v_price end);
    return 'ok';
  end if;

  select * into v_listing from public.user_items
   where item_id = _item_id and sale_price is not null and user_id <> v_uid
   order by sale_price asc limit 1 for update;
  if not found then return 'No one is currently selling this item.'; end if;
  v_price := v_listing.sale_price;
  if v_balance < v_price then return 'Not enough Rawbux'; end if;
  update public.profiles set rawbux = rawbux - v_price where id = v_uid;
  update public.profiles set rawbux = rawbux + v_price where id = v_listing.user_id;
  update public.user_items set user_id = v_uid, sale_price = null, acquired_at = now()
   where id = v_listing.id;
  update public.items
     set rap = case when rap = 0 then v_price else greatest(1, round((rap * 9 + v_price) / 10.0)::int) end
   where id = _item_id;
  return 'ok';
end;
$function$;