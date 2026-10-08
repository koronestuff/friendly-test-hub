ALTER TABLE public.items ADD COLUMN value integer NOT NULL DEFAULT 0;
UPDATE public.items SET value = rap WHERE value = 0 AND rap > 0;