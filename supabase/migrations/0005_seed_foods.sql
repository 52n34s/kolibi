-- Run manually in Supabase SQL Editor after 0004_foods_search.sql
-- Values taken verbatim from kolibi_foods_seed.json (USDA SR28).

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'White rice, cooked',
  'white rice, cooked',
  '{"de":"Reis, gekocht","en":"White rice, cooked","es":"Arroz blanco, cocido"}'::jsonb,
  ARRAY['arroz', 'arroz blanco', 'reis', 'rice', 'white rice']::text[],
  130,
  2.69,
  0.28,
  28.17,
  'usda_sr28',
  '20045',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Brown rice, cooked',
  'brown rice, cooked',
  '{"de":"Vollkornreis, gekocht","en":"Brown rice, cooked","es":"Arroz integral, cocido"}'::jsonb,
  ARRAY['arroz integral', 'brauner reis', 'brown rice', 'vollkornreis']::text[],
  123,
  2.74,
  0.97,
  25.58,
  'usda_sr28',
  '20037',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Pasta, cooked',
  'pasta, cooked',
  '{"de":"Nudeln, gekocht","en":"Pasta, cooked","es":"Pasta, cocida"}'::jsonb,
  ARRAY['fideos', 'noodles', 'nudeln', 'pasta', 'spaghetti']::text[],
  158,
  5.8,
  0.93,
  30.86,
  'usda_sr28',
  '20121',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Couscous, cooked',
  'couscous, cooked',
  '{"de":"Couscous, gekocht","en":"Couscous, cooked","es":"Cuscús, cocido"}'::jsonb,
  ARRAY['couscous', 'cuscús', 'kuskus']::text[],
  112,
  3.79,
  0.16,
  23.22,
  'usda_sr28',
  '20029',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Whole-wheat bread',
  'whole-wheat bread',
  '{"de":"Vollkornbrot","en":"Whole-wheat bread","es":"Pan integral"}'::jsonb,
  ARRAY['bread', 'brot', 'pan', 'pan integral', 'vollkornbrot', 'whole-wheat bread']::text[],
  252,
  12.45,
  3.5,
  42.71,
  'usda_sr28',
  '18075',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'White bread',
  'white bread',
  '{"de":"Weißbrot","en":"White bread","es":"Pan blanco"}'::jsonb,
  ARRAY['pan blanco', 'weissbrot', 'weißbrot', 'white bread']::text[],
  266,
  8.85,
  3.33,
  49.42,
  'usda_sr28',
  '18069',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Oats, dry',
  'oats, dry',
  '{"de":"Haferflocken","en":"Oats, dry","es":"Avena, seca"}'::jsonb,
  ARRAY['avena', 'hafer', 'haferflocken', 'oatmeal', 'oats']::text[],
  379,
  13.15,
  6.52,
  67.7,
  'usda_sr28',
  '08120',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Potato, boiled',
  'potato, boiled',
  '{"de":"Kartoffeln, gekocht","en":"Potato, boiled","es":"Patata, cocida"}'::jsonb,
  ARRAY['kartoffel', 'kartoffeln', 'papa', 'patata', 'potato']::text[],
  86,
  1.71,
  0.1,
  20.01,
  'usda_sr28',
  '11367',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Chicken breast, cooked',
  'chicken breast, cooked',
  '{"de":"Hähnchenbrust, gebraten","en":"Chicken breast, cooked","es":"Pechuga de pollo, cocida"}'::jsonb,
  ARRAY['chicken', 'chicken breast', 'huhn', 'hähnchen', 'hähnchenbrust', 'pechuga de pollo', 'pollo']::text[],
  165,
  31.02,
  3.57,
  0,
  'usda_sr28',
  '05064',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Turkey breast, roasted',
  'turkey breast, roasted',
  '{"de":"Putenbrust, gebraten","en":"Turkey breast, roasted","es":"Pechuga de pavo, asada"}'::jsonb,
  ARRAY['pavo', 'pechuga de pavo', 'pute', 'putenbrust', 'turkey', 'turkey breast']::text[],
  147,
  30.13,
  2.08,
  0,
  'usda_sr28',
  '05220',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Egg, whole',
  'egg, whole',
  '{"de":"Ei","en":"Egg, whole","es":"Huevo"}'::jsonb,
  ARRAY['egg', 'eggs', 'ei', 'eier', 'huevo', 'huevos']::text[],
  143,
  12.56,
  9.51,
  0.72,
  'usda_sr28',
  '01123',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Salmon, cooked',
  'salmon, cooked',
  '{"de":"Lachs, gebraten","en":"Salmon, cooked","es":"Salmón, cocido"}'::jsonb,
  ARRAY['lachs', 'salmon', 'salmón']::text[],
  206,
  22.1,
  12.35,
  0,
  'usda_sr28',
  '15237',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Tuna, canned in water',
  'tuna, canned in water',
  '{"de":"Thunfisch, in Wasser","en":"Tuna, canned in water","es":"Atún, en agua"}'::jsonb,
  ARRAY['atun', 'atún', 'thunfisch', 'tuna']::text[],
  86,
  19.44,
  0.96,
  0,
  'usda_sr28',
  '15121',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Ground beef, cooked (90/10)',
  'ground beef, cooked (90/10)',
  '{"de":"Rinderhackfleisch, gebraten (90/10)","en":"Ground beef, cooked (90/10)","es":"Carne picada de res, cocida (90/10)"}'::jsonb,
  ARRAY['beef', 'carne de res', 'carne picada', 'carne picada de res', 'ground beef', 'hackfleisch', 'rind', 'rinderhack', 'rinderhackfleisch']::text[],
  217,
  26.11,
  11.75,
  0,
  'usda_sr28',
  '23563',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Pork loin, cooked',
  'pork loin, cooked',
  '{"de":"Schweinefleisch (Lende), gebraten","en":"Pork loin, cooked","es":"Lomo de cerdo, cocido"}'::jsonb,
  ARRAY['cerdo', 'lomo de cerdo', 'pork', 'pork loin', 'schwein', 'schweinefleisch', 'schweinefleisch (lende)']::text[],
  209,
  28.62,
  9.63,
  0,
  'usda_sr28',
  '10027',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Tofu, firm',
  'tofu, firm',
  '{"de":"Tofu","en":"Tofu, firm","es":"Tofu firme"}'::jsonb,
  ARRAY['tofu', 'tofu firme']::text[],
  144,
  17.27,
  8.72,
  2.78,
  'usda_sr28',
  '16426',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Whole milk (3.25%)',
  'whole milk (3.25%)',
  '{"de":"Vollmilch (3,25 %)","en":"Whole milk (3.25%)","es":"Leche entera (3,25%)"}'::jsonb,
  ARRAY['leche', 'leche entera', 'leche entera (3', 'milch', 'milk', 'vollmilch', 'vollmilch (3', 'whole milk', 'whole milk (3.25%)']::text[],
  61,
  3.15,
  3.25,
  4.8,
  'usda_sr28',
  '01077',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Reduced-fat milk (2%)',
  'reduced-fat milk (2%)',
  '{"de":"Fettarme Milch (2 %)","en":"Reduced-fat milk (2%)","es":"Leche semidesnatada (2%)"}'::jsonb,
  ARRAY['fettarme milch', 'fettarme milch (2 %)', 'leche semidesnatada', 'leche semidesnatada (2%)', 'milch 2%', 'reduced fat milk', 'reduced-fat milk (2%)']::text[],
  50,
  3.3,
  1.98,
  4.8,
  'usda_sr28',
  '01079',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Skim milk',
  'skim milk',
  '{"de":"Magermilch","en":"Skim milk","es":"Leche desnatada"}'::jsonb,
  ARRAY['leche desnatada', 'magermilch', 'skim milk']::text[],
  34,
  3.37,
  0.08,
  4.96,
  'usda_sr28',
  '01151',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Greek yogurt, nonfat',
  'greek yogurt, nonfat',
  '{"de":"Griechischer Joghurt, fettarm","en":"Greek yogurt, nonfat","es":"Yogur griego, desnatado"}'::jsonb,
  ARRAY['greek yogurt', 'griechischer joghurt', 'joghurt', 'yogur', 'yogur griego', 'yogurt']::text[],
  59,
  10.19,
  0.39,
  3.6,
  'usda_sr28',
  '01256',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Cottage cheese (2%)',
  'cottage cheese (2%)',
  '{"de":"Hüttenkäse (2 %)","en":"Cottage cheese (2%)","es":"Requesón (2%)"}'::jsonb,
  ARRAY['cottage cheese', 'cottage cheese (2%)', 'huettenkaese', 'hüttenkäse', 'hüttenkäse (2 %)', 'requeson', 'requesón', 'requesón (2%)']::text[],
  81,
  10.45,
  2.27,
  4.76,
  'usda_sr28',
  '01015',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Cheddar cheese',
  'cheddar cheese',
  '{"de":"Cheddar","en":"Cheddar cheese","es":"Queso cheddar"}'::jsonb,
  ARRAY['cheddar', 'cheddar cheese', 'cheese', 'käse', 'queso', 'queso cheddar']::text[],
  404,
  22.87,
  33.31,
  3.09,
  'usda_sr28',
  '01009',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Gouda cheese',
  'gouda cheese',
  '{"de":"Gouda","en":"Gouda cheese","es":"Queso gouda"}'::jsonb,
  ARRAY['cheese', 'gouda', 'gouda cheese', 'käse', 'queso', 'queso gouda']::text[],
  356,
  24.94,
  27.44,
  2.22,
  'usda_sr28',
  '01022',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Mozzarella',
  'mozzarella',
  '{"de":"Mozzarella","en":"Mozzarella","es":"Mozzarella"}'::jsonb,
  ARRAY['cheese', 'käse', 'mozzarella', 'queso']::text[],
  300,
  22.17,
  22.35,
  2.19,
  'usda_sr28',
  '01026',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Butter',
  'butter',
  '{"de":"Butter","en":"Butter","es":"Mantequilla"}'::jsonb,
  ARRAY['butter', 'mantequilla']::text[],
  717,
  0.85,
  81.11,
  0.06,
  'usda_sr28',
  '01001',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Apple',
  'apple',
  '{"de":"Apfel","en":"Apple","es":"Manzana"}'::jsonb,
  ARRAY['apfel', 'apple', 'manzana', 'äpfel']::text[],
  52,
  0.26,
  0.17,
  13.81,
  'usda_sr28',
  '09003',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Banana',
  'banana',
  '{"de":"Banane","en":"Banana","es":"Plátano"}'::jsonb,
  ARRAY['banana', 'banane', 'guineo', 'platano', 'plátano']::text[],
  89,
  1.09,
  0.33,
  22.84,
  'usda_sr28',
  '09040',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Orange',
  'orange',
  '{"de":"Orange","en":"Orange","es":"Naranja"}'::jsonb,
  ARRAY['naranja', 'orange']::text[],
  47,
  0.94,
  0.12,
  11.75,
  'usda_sr28',
  '09200',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Strawberries',
  'strawberries',
  '{"de":"Erdbeeren","en":"Strawberries","es":"Fresas"}'::jsonb,
  ARRAY['erdbeere', 'erdbeeren', 'fresas', 'frutillas', 'strawberries', 'strawberry']::text[],
  32,
  0.67,
  0.3,
  7.68,
  'usda_sr28',
  '09316',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Grapes',
  'grapes',
  '{"de":"Weintrauben","en":"Grapes","es":"Uvas"}'::jsonb,
  ARRAY['grapes', 'trauben', 'uvas', 'weintrauben']::text[],
  67,
  0.63,
  0.35,
  17.15,
  'usda_sr28',
  '09131',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Blueberries',
  'blueberries',
  '{"de":"Heidelbeeren","en":"Blueberries","es":"Arándanos"}'::jsonb,
  ARRAY['arandanos', 'arándanos', 'blaubeeren', 'blueberries', 'heidelbeeren']::text[],
  57,
  0.74,
  0.33,
  14.49,
  'usda_sr28',
  '09050',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Avocado',
  'avocado',
  '{"de":"Avocado","en":"Avocado","es":"Aguacate"}'::jsonb,
  ARRAY['aguacate', 'avocado', 'avocados', 'palta']::text[],
  160,
  2,
  14.66,
  8.53,
  'usda_sr28',
  '09037',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Tomato',
  'tomato',
  '{"de":"Tomate","en":"Tomato","es":"Tomate"}'::jsonb,
  ARRAY['jitomate', 'tomate', 'tomaten', 'tomato']::text[],
  18,
  0.88,
  0.2,
  3.89,
  'usda_sr28',
  '11529',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Cucumber',
  'cucumber',
  '{"de":"Gurke","en":"Cucumber","es":"Pepino"}'::jsonb,
  ARRAY['cucumber', 'gurke', 'pepino']::text[],
  15,
  0.65,
  0.11,
  3.63,
  'usda_sr28',
  '11205',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Carrot',
  'carrot',
  '{"de":"Karotte","en":"Carrot","es":"Zanahoria"}'::jsonb,
  ARRAY['carrot', 'karotte', 'moehre', 'möhre', 'zanahoria']::text[],
  41,
  0.93,
  0.24,
  9.58,
  'usda_sr28',
  '11124',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Broccoli',
  'broccoli',
  '{"de":"Brokkoli","en":"Broccoli","es":"Brócoli"}'::jsonb,
  ARRAY['broccoli', 'brocoli', 'brokkoli', 'brócoli']::text[],
  34,
  2.82,
  0.37,
  6.64,
  'usda_sr28',
  '11090',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Spinach',
  'spinach',
  '{"de":"Spinat","en":"Spinach","es":"Espinaca"}'::jsonb,
  ARRAY['espinaca', 'espinacas', 'spinach', 'spinat']::text[],
  23,
  2.86,
  0.39,
  3.63,
  'usda_sr28',
  '11457',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Onion',
  'onion',
  '{"de":"Zwiebel","en":"Onion","es":"Cebolla"}'::jsonb,
  ARRAY['cebolla', 'onion', 'zwiebel', 'zwiebeln']::text[],
  40,
  1.1,
  0.1,
  9.34,
  'usda_sr28',
  '11282',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Red bell pepper',
  'red bell pepper',
  '{"de":"Paprika (rot)","en":"Red bell pepper","es":"Pimiento rojo"}'::jsonb,
  ARRAY['ají', 'bell pepper', 'paprika', 'paprika (rot)', 'pimiento', 'pimiento rojo', 'red bell pepper', 'red pepper']::text[],
  31,
  0.99,
  0.3,
  6.03,
  'usda_sr28',
  '11821',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Iceberg lettuce',
  'iceberg lettuce',
  '{"de":"Kopfsalat (Eisberg)","en":"Iceberg lettuce","es":"Lechuga"}'::jsonb,
  ARRAY['eisbergsalat', 'iceberg lettuce', 'kopfsalat', 'kopfsalat (eisberg)', 'lechuga', 'lettuce', 'salat']::text[],
  14,
  0.9,
  0.14,
  2.97,
  'usda_sr28',
  '11252',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Zucchini',
  'zucchini',
  '{"de":"Zucchini","en":"Zucchini","es":"Calabacín"}'::jsonb,
  ARRAY['calabacin', 'calabacín', 'zucchini']::text[],
  17,
  1.21,
  0.32,
  3.11,
  'usda_sr28',
  '11477',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Lentils, cooked',
  'lentils, cooked',
  '{"de":"Linsen, gekocht","en":"Lentils, cooked","es":"Lentejas, cocidas"}'::jsonb,
  ARRAY['lentejas', 'lentils', 'linsen']::text[],
  116,
  9.02,
  0.38,
  20.13,
  'usda_sr28',
  '16070',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Chickpeas, cooked',
  'chickpeas, cooked',
  '{"de":"Kichererbsen, gekocht","en":"Chickpeas, cooked","es":"Garbanzos, cocidos"}'::jsonb,
  ARRAY['chickpeas', 'garbanzos', 'kichererbsen']::text[],
  164,
  8.86,
  2.59,
  27.42,
  'usda_sr28',
  '16057',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Kidney beans, cooked',
  'kidney beans, cooked',
  '{"de":"Kidneybohnen, gekocht","en":"Kidney beans, cooked","es":"Frijoles rojos, cocidos"}'::jsonb,
  ARRAY['alubias', 'beans', 'bohnen', 'frijoles', 'frijoles rojos', 'judías', 'kidney beans', 'kidneybohnen']::text[],
  127,
  8.67,
  0.5,
  22.8,
  'usda_sr28',
  '16033',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Almonds',
  'almonds',
  '{"de":"Mandeln","en":"Almonds","es":"Almendras"}'::jsonb,
  ARRAY['almendras', 'almonds', 'mandeln']::text[],
  579,
  21.15,
  49.93,
  21.55,
  'usda_sr28',
  '12061',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Walnuts',
  'walnuts',
  '{"de":"Walnüsse","en":"Walnuts","es":"Nueces"}'::jsonb,
  ARRAY['nueces', 'walnuesse', 'walnuts', 'walnüsse']::text[],
  654,
  15.23,
  65.21,
  13.71,
  'usda_sr28',
  '12155',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Peanut butter',
  'peanut butter',
  '{"de":"Erdnussbutter","en":"Peanut butter","es":"Mantequilla de maní"}'::jsonb,
  ARRAY['crema de cacahuete', 'erdnussbutter', 'mantequilla de maní', 'peanut butter']::text[],
  598,
  22.21,
  51.36,
  22.31,
  'usda_sr28',
  '16098',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Olive oil',
  'olive oil',
  '{"de":"Olivenöl","en":"Olive oil","es":"Aceite de oliva"}'::jsonb,
  ARRAY['aceite', 'aceite de oliva', 'oil', 'olive oil', 'olivenoel', 'olivenöl', 'öl']::text[],
  884,
  0,
  100,
  0,
  'usda_sr28',
  '04053',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Sugar',
  'sugar',
  '{"de":"Zucker","en":"Sugar","es":"Azúcar"}'::jsonb,
  ARRAY['azucar', 'azúcar', 'sugar', 'zucker']::text[],
  387,
  0,
  0,
  99.98,
  'usda_sr28',
  '19335',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;

INSERT INTO public.foods (name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, source, usda_ndb, is_verified, created_by)
VALUES (
  'Honey',
  'honey',
  '{"de":"Honig","en":"Honey","es":"Miel"}'::jsonb,
  ARRAY['honey', 'honig', 'miel']::text[],
  304,
  0.3,
  0,
  82.4,
  'usda_sr28',
  '19296',
  true,
  null
)
ON CONFLICT (usda_ndb) DO NOTHING;
