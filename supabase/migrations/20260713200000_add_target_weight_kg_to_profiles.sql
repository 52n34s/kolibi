alter table profiles add column if not exists target_weight_kg numeric(5,2)
  check (target_weight_kg is null or (target_weight_kg > 0 and target_weight_kg < 700));

notify pgrst, 'reload schema';
