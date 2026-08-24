-- protein_g, carbs_g and fat_g were NOT NULL DEFAULT 0 from the original
-- schema, which forced hardcoded zeros in the client payload. With macro
-- capture, null means "unknown" and 0 means "contains none of that macro",
-- so the NOT NULL / DEFAULT constraints had to go. fiber_g was nullable
-- without a default from the start.

alter table public.meal_items alter column protein_g drop not null;
alter table public.meal_items alter column carbs_g   drop not null;
alter table public.meal_items alter column fat_g     drop not null;

alter table public.meal_items alter column protein_g drop default;
alter table public.meal_items alter column carbs_g   drop default;
alter table public.meal_items alter column fat_g     drop default;

notify pgrst, 'reload schema';
