ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'shirt';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'pants';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'tshirt';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'head';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'torso';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'arm';
ALTER TYPE public.item_kind ADD VALUE IF NOT EXISTS 'leg';

CREATE TABLE public.item_accessories (
  item_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  mesh_b64 text,
  texture_data_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.item_accessories TO authenticated;
GRANT ALL ON public.item_accessories TO service_role;
ALTER TABLE public.item_accessories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accessories readable" ON public.item_accessories FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.save_avatar(_colors jsonb, _equipped uuid[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _clean uuid[] := '{}';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF jsonb_typeof(_colors) <> 'object' THEN RAISE EXCEPTION 'Invalid colors'; END IF;
  IF coalesce(array_length(_equipped,1),0) > 12 THEN RAISE EXCEPTION 'Too many accessories equipped'; END IF;
  FOREACH _id IN ARRAY coalesce(_equipped,'{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM user_items WHERE user_id=_uid AND item_id=_id) THEN
      RAISE EXCEPTION 'You do not own one of these items';
    END IF;
    IF NOT (_id = ANY(_clean)) THEN _clean := _clean || _id; END IF;
  END LOOP;
  UPDATE profiles SET avatar_colors=_colors, equipped_items=_clean WHERE id=_uid;
  RETURN 'Avatar saved';
END $$;
REVOKE EXECUTE ON FUNCTION public.save_avatar(jsonb, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_avatar(jsonb, uuid[]) TO authenticated;

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
