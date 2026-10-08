-- safety net: no-op if the live DB already has 'offsale'
ALTER TYPE public.item_class ADD VALUE IF NOT EXISTS 'offsale';

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
