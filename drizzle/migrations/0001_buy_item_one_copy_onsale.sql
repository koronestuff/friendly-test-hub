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