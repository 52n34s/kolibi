-- Adds build muscle as its own goal: muscle macros without a calorie surplus.
alter type goal_type add value if not exists 'build_muscle';
