create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create type public.friend_request_status as enum ('pending','accepted','declined','cancelled');

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create unique index friend_requests_pending_uniq
  on public.friend_requests (sender_id, receiver_id)
  where status = 'pending';
grant select on public.friend_requests to authenticated;
grant all on public.friend_requests to service_role;
alter table public.friend_requests enable row level security;
create policy "own friend requests readable" on public.friend_requests
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
grant select on public.friendships to authenticated;
grant all on public.friendships to service_role;
alter table public.friendships enable row level security;
create policy "friendships readable by authenticated" on public.friendships
  for select to authenticated using (true);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (follower_id <> following_id),
  unique (follower_id, following_id)
);
grant select on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows readable by authenticated" on public.follows
  for select to authenticated using (true);

create type public.trade_status as enum ('pending','accepted','declined','cancelled');

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status public.trade_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
grant select on public.trades to authenticated;
grant all on public.trades to service_role;
alter table public.trades enable row level security;
create policy "own trades readable" on public.trades
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create table public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  user_item_id uuid not null references public.user_items(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  side text not null check (side in ('offer','request')),
  created_at timestamptz not null default now()
);
create index trade_items_trade_idx on public.trade_items(trade_id);
grant select on public.trade_items to authenticated;
grant all on public.trade_items to service_role;
alter table public.trade_items enable row level security;
create policy "own trade items readable" on public.trade_items
  for select to authenticated
  using (exists (
    select 1 from public.trades t
    where t.id = trade_id and (t.sender_id = auth.uid() or t.receiver_id = auth.uid())
  ));

create table public.promocodes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  rawbux_reward integer not null default 0,
  item_id uuid references public.items(id) on delete set null,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.promocodes to authenticated;
grant all on public.promocodes to service_role;
alter table public.promocodes enable row level security;
create policy "admins manage promocodes" on public.promocodes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table public.promocode_redemptions (
  id uuid primary key default gen_random_uuid(),
  promocode_id uuid not null references public.promocodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (promocode_id, user_id)
);
grant select on public.promocode_redemptions to authenticated;
grant all on public.promocode_redemptions to service_role;
alter table public.promocode_redemptions enable row level security;
create policy "own redemptions readable" on public.promocode_redemptions
  for select to authenticated using (user_id = auth.uid());

create trigger update_friend_requests_updated_at before update on public.friend_requests
  for each row execute function public.update_updated_at_column();
create trigger update_trades_updated_at before update on public.trades
  for each row execute function public.update_updated_at_column();
create trigger update_promocodes_updated_at before update on public.promocodes
  for each row execute function public.update_updated_at_column();

create or replace function public.respond_friend_request(_request_id uuid, _accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid(); _r friend_requests%rowtype;
begin
  if _me is null then return 'Not signed in.'; end if;
  select * into _r from friend_requests where id = _request_id and status = 'pending';
  if not found then return 'Request not found.'; end if;
  if _r.receiver_id <> _me then return 'Not your request.'; end if;
  if _accept then
    update friend_requests set status = 'accepted' where id = _request_id;
    insert into friendships (user_a, user_b)
    values (least(_r.sender_id, _r.receiver_id), greatest(_r.sender_id, _r.receiver_id))
    on conflict do nothing;
  else
    update friend_requests set status = 'declined' where id = _request_id;
  end if;
  return 'ok';
end $$;

create or replace function public.send_friend_request(_target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid(); _a uuid; _b uuid;
begin
  if _me is null then return 'Not signed in.'; end if;
  if _me = _target then return 'You cannot friend yourself.'; end if;
  if not exists (select 1 from profiles where id = _target and is_banned = false) then
    return 'User not found.';
  end if;
  _a := least(_me, _target); _b := greatest(_me, _target);
  if exists (select 1 from friendships where user_a = _a and user_b = _b) then
    return 'You are already friends.';
  end if;
  if exists (select 1 from friend_requests where sender_id = _me and receiver_id = _target and status = 'pending') then
    return 'Request already sent.';
  end if;
  if exists (select 1 from friend_requests where sender_id = _target and receiver_id = _me and status = 'pending') then
    return public.respond_friend_request(
      (select id from friend_requests where sender_id = _target and receiver_id = _me and status = 'pending' limit 1), true);
  end if;
  insert into friend_requests (sender_id, receiver_id) values (_me, _target);
  return 'ok';
end $$;

create or replace function public.cancel_friend_request(_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
begin
  update friend_requests set status = 'cancelled'
  where id = _request_id and sender_id = _me and status = 'pending';
  if not found then return 'Request not found.'; end if;
  return 'ok';
end $$;

create or replace function public.remove_friend(_other uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
begin
  if _me is null then return 'Not signed in.'; end if;
  delete from friendships
  where user_a = least(_me, _other) and user_b = greatest(_me, _other);
  return 'ok';
end $$;

create or replace function public.set_follow(_target uuid, _follow boolean)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
begin
  if _me is null then return 'Not signed in.'; end if;
  if _me = _target then return 'You cannot follow yourself.'; end if;
  if _follow then
    insert into follows (follower_id, following_id) values (_me, _target) on conflict do nothing;
  else
    delete from follows where follower_id = _me and following_id = _target;
  end if;
  return 'ok';
end $$;

create or replace function public.create_trade(_receiver uuid, _offer uuid[], _request uuid[])
returns text language plpgsql security definer set search_path to 'public'
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

create or replace function public.respond_trade(_trade_id uuid, _accept boolean)
 returns text language plpgsql security definer set search_path to 'public'
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

create or replace function public.cancel_trade(_trade_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid();
begin
  update trades set status = 'cancelled'
  where id = _trade_id and sender_id = _me and status = 'pending';
  if not found then return 'Trade not found.'; end if;
  return 'ok';
end $$;

create or replace function public.redeem_promocode(_code text)
returns text language plpgsql security definer set search_path = public as $$
declare _me uuid := auth.uid(); _p promocodes%rowtype; _serial integer;
begin
  if _me is null then return 'Not signed in.'; end if;
  select * into _p from promocodes where lower(code) = lower(trim(_code));
  if not found or not _p.is_active then return 'Invalid promocode.'; end if;
  if _p.expires_at is not null and _p.expires_at <= now() then return 'This promocode has expired.'; end if;
  if _p.max_uses is not null and _p.uses >= _p.max_uses then return 'This promocode has run out.'; end if;
  if exists (select 1 from promocode_redemptions where promocode_id = _p.id and user_id = _me) then
    return 'You already redeemed this promocode.';
  end if;
  insert into promocode_redemptions (promocode_id, user_id) values (_p.id, _me);
  update promocodes set uses = uses + 1 where id = _p.id;
  if _p.rawbux_reward > 0 then
    update profiles set rawbux = rawbux + _p.rawbux_reward where id = _me;
  end if;
  if _p.item_id is not null then
    select coalesce(max(serial), 0) + 1 into _serial from user_items where item_id = _p.item_id;
    insert into user_items (item_id, user_id, serial) values (_p.item_id, _me, _serial);
    update items set copies_sold = copies_sold + 1 where id = _p.item_id;
  end if;
  return 'ok';
end $$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.cancel_friend_request(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.set_follow(uuid, boolean) from public, anon;
revoke execute on function public.create_trade(uuid, uuid[], uuid[]) from public, anon;
revoke execute on function public.respond_trade(uuid, boolean) from public, anon;
revoke execute on function public.cancel_trade(uuid) from public, anon;
revoke execute on function public.redeem_promocode(text) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.set_follow(uuid, boolean) to authenticated;
grant execute on function public.create_trade(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.redeem_promocode(text) to authenticated;
