ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_colors jsonb NOT NULL DEFAULT '{"head":"#F5CD30","torso":"#0D69AC","left_arm":"#F5CD30","right_arm":"#F5CD30","left_leg":"#A4BD47","right_leg":"#A4BD47"}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_items uuid[] NOT NULL DEFAULT '{}';

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