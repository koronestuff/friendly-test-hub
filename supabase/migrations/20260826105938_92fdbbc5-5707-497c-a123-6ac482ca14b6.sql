
create or replace function public.item_is_limited(_item public.items)
returns boolean language sql stable set search_path = public as $$
  select _item.class <> 'normal' and _item.sale_ends_at is not null and _item.sale_ends_at <= now()
$$;

revoke execute on function public.claim_daily() from public, anon;
revoke execute on function public.buy_item(uuid) from public, anon;
revoke execute on function public.set_resale(uuid, integer) from public, anon;
revoke execute on function public.change_username(text) from public, anon;
revoke execute on function public.update_description(text) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.item_is_limited(public.items) from public, anon;
grant execute on function public.item_is_limited(public.items) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
