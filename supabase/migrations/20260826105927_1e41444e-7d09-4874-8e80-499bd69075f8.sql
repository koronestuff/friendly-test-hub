
create type public.app_role as enum ('admin','user');
create type public.item_kind as enum ('hat','hair','face','neck','shoulder','front','back','waist','gear');
create type public.item_class as enum ('normal','limited','limitedu');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  description text not null default '',
  rawbux integer not null default 100,
  last_daily_at timestamptz not null default now(),
  is_banned boolean not null default false,
  ban_reason text,
  ban_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.item_kind not null,
  class public.item_class not null default 'normal',
  description text not null default '',
  image_url text,
  price integer not null default 0,
  sale_ends_at timestamptz,
  copies_sold integer not null default 0,
  rap integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.items to authenticated;
grant select on public.items to anon;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "items readable" on public.items for select using (true);

create table public.user_items (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  serial integer,
  sale_price integer,
  acquired_at timestamptz not null default now()
);
create index user_items_item_idx on public.user_items(item_id);
create index user_items_user_idx on public.user_items(user_id);
grant select on public.user_items to authenticated;
grant all on public.user_items to service_role;
alter table public.user_items enable row level security;
create policy "user items readable by authenticated" on public.user_items for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text,1,8)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- true when an item is past its sale window and has gone limited
create or replace function public.item_is_limited(_item public.items)
returns boolean language sql stable as $$
  select _item.class <> 'normal' and _item.sale_ends_at is not null and _item.sale_ends_at <= now()
$$;

create or replace function public.claim_daily()
returns integer language plpgsql security definer set search_path = public as $$
declare v_rawbux integer;
begin
  update public.profiles
     set rawbux = rawbux + 100, last_daily_at = now()
   where id = auth.uid() and last_daily_at <= now() - interval '24 hours'
  returning rawbux into v_rawbux;
  if v_rawbux is null then
    select rawbux into v_rawbux from public.profiles where id = auth.uid();
  end if;
  return v_rawbux;
end;
$$;
grant execute on function public.claim_daily() to authenticated;

create or replace function public.buy_item(_item_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item public.items;
  v_limited boolean;
  v_listing public.user_items;
  v_price integer;
  v_balance integer;
begin
  if v_uid is null then return 'Not signed in'; end if;
  select * into v_item from public.items where id = _item_id;
  if not found then return 'Item not found'; end if;
  v_limited := public.item_is_limited(v_item);
  select rawbux into v_balance from public.profiles where id = v_uid for update;

  if not v_limited then
    v_price := v_item.price;
    if v_balance < v_price then return 'Not enough Rawbux'; end if;
    update public.profiles set rawbux = rawbux - v_price where id = v_uid;
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
$$;
grant execute on function public.buy_item(uuid) to authenticated;

create or replace function public.set_resale(_user_item_id uuid, _price integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_item public.items;
begin
  select i.* into v_item from public.items i
    join public.user_items ui on ui.item_id = i.id
   where ui.id = _user_item_id and ui.user_id = auth.uid();
  if not found then return 'Not your item'; end if;
  if not public.item_is_limited(v_item) then return 'This item is not limited yet'; end if;
  if _price is not null and _price < 1 then return 'Invalid price'; end if;
  update public.user_items set sale_price = _price where id = _user_item_id;
  return 'ok';
end;
$$;
grant execute on function public.set_resale(uuid, integer) to authenticated;

create or replace function public.change_username(_new text)
returns text language plpgsql security definer set search_path = public as $$
declare v_bal integer;
begin
  if _new !~ '^[A-Za-z0-9_]{3,20}$' then return 'Username must be 3-20 letters, numbers or underscores'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(_new)) then return 'Username already taken'; end if;
  select rawbux into v_bal from public.profiles where id = auth.uid() for update;
  if v_bal < 1000 then return 'Changing your username costs 1000 Rawbux'; end if;
  update public.profiles set username = _new, rawbux = rawbux - 1000 where id = auth.uid();
  return 'ok';
end;
$$;
grant execute on function public.change_username(text) to authenticated;

create or replace function public.update_description(_desc text)
returns text language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set description = left(coalesce(_desc,''), 1000) where id = auth.uid();
  return 'ok';
end;
$$;
grant execute on function public.update_description(text) to authenticated;
