create or replace function public.respond_trade(_trade_id uuid, _accept boolean)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare _me uuid := auth.uid(); _t trades%rowtype; _ti record; _dup record; _item items;
begin
  if _me is null then return 'Not signed in.'; end if;
  select * into _t from trades where id = _trade_id and status = 'pending';
  if not found then return 'Trade not found.'; end if;
  if _t.receiver_id <> _me then return 'Not your trade.'; end if;
  if not _accept then
    update trades set status = 'declined' where id = _trade_id;
    return 'ok';
  end if;
  for _ti in select ti.side, ti.user_item_id, ui.user_id
             from trade_items ti join user_items ui on ui.id = ti.user_item_id
             where ti.trade_id = _trade_id loop
    if (_ti.side = 'offer' and _ti.user_id <> _t.sender_id)
       or (_ti.side = 'request' and _ti.user_id <> _t.receiver_id) then
      update trades set status = 'declined' where id = _trade_id;
      return 'Items are no longer available.';
    end if;
  end loop;

  -- a player may never hold more than one copy of an item that is still on sale
  for _dup in
    select ti.side as tside, i as item_row
      from trade_items ti join items i on i.id = ti.item_id
     where ti.trade_id = _trade_id loop
    _item := _dup.item_row;
    if not public.item_is_limited(_item) then
      if _dup.tside = 'offer' and exists (
        select 1 from user_items ui
         where ui.item_id = _item.id and ui.user_id = _t.receiver_id
           and ui.id not in (select user_item_id from trade_items where trade_id = _trade_id and side = 'request')
      ) then
        return 'One of these items is not limited yet and you already own a copy.';
      end if;
      if _dup.tside = 'request' and exists (
        select 1 from user_items ui
         where ui.item_id = _item.id and ui.user_id = _t.sender_id
           and ui.id not in (select user_item_id from trade_items where trade_id = _trade_id and side = 'offer')
      ) then
        return 'One of these items is not limited yet and the other player already owns a copy.';
      end if;
    end if;
  end loop;

  update user_items set user_id = _t.receiver_id, sale_price = null
  where id in (select user_item_id from trade_items where trade_id = _trade_id and side = 'offer');
  update user_items set user_id = _t.sender_id, sale_price = null
  where id in (select user_item_id from trade_items where trade_id = _trade_id and side = 'request');
  update trades set status = 'accepted' where id = _trade_id;
  return 'ok';
end $function$;