create or replace function public.create_trade(_receiver uuid, _offer uuid[], _request uuid[])
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _me uuid := auth.uid(); _trade uuid; _ui user_items%rowtype; _id uuid;
begin
  if _me is null then return 'Not signed in.'; end if;
  if _me = _receiver then return 'You cannot trade with yourself.'; end if;
  if coalesce(array_length(_offer,1),0) = 0 or coalesce(array_length(_request,1),0) = 0 then
    return 'Both sides need at least one item.';
  end if;
  if not exists (select 1 from profiles where id = _receiver and is_banned = false) then
    return 'User not found.';
  end if;
  insert into trades (sender_id, receiver_id) values (_me, _receiver) returning id into _trade;
  foreach _id in array _offer loop
    select * into _ui from user_items where id = _id;
    if not found or _ui.user_id <> _me then raise exception 'You do not own one of the offered items.'; end if;
    if not (select item_is_limited(i) from items i where i.id = _ui.item_id) then
      raise exception 'Only limited items can be traded.';
    end if;
    insert into trade_items (trade_id, user_item_id, item_id, side) values (_trade, _ui.id, _ui.item_id, 'offer');
  end loop;
  foreach _id in array _request loop
    select * into _ui from user_items where id = _id;
    if not found or _ui.user_id <> _receiver then raise exception 'They do not own one of the requested items.'; end if;
    if not (select item_is_limited(i) from items i where i.id = _ui.item_id) then
      raise exception 'Only limited items can be traded.';
    end if;
    insert into trade_items (trade_id, user_item_id, item_id, side) values (_trade, _ui.id, _ui.item_id, 'request');
  end loop;
  return 'ok';
end $function$;