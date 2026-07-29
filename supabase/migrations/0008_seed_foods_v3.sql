-- Run manually in Supabase SQL Editor AFTER 0007_foods_v3_prep.sql
-- Values taken verbatim from supabase/seed/kolibi_foods_seed_v3.json (157 foods).
-- ON CONFLICT (slug) DO UPDATE refreshes the existing ~50 curated USDA rows and upserts the rest.
-- NOTE: JSON contains duplicate slug "mozzarella" (NDB 01026 and 01028); second wins on conflict.

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'white_rice',
  'White rice, cooked',
  'white rice, cooked',
  '{"de":"Reis, gekocht","en":"White rice, cooked","es":"Arroz blanco, cocido"}'::jsonb,
  ARRAY['arroz', 'arroz blanco', 'reis', 'rice', 'white rice']::text[],
  130.0,
  2.69,
  0.28,
  28.17,
  'grain',
  'usda_sr28',
  '20045',
  'RICE,WHITE,LONG-GRAIN,REG,ENR,CKD',
  '20045',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'brown_rice',
  'Brown rice, cooked',
  'brown rice, cooked',
  '{"de":"Vollkornreis, gekocht","en":"Brown rice, cooked","es":"Arroz integral, cocido"}'::jsonb,
  ARRAY['arroz integral', 'brauner reis', 'brown rice', 'vollkornreis']::text[],
  123.0,
  2.74,
  0.97,
  25.58,
  'grain',
  'usda_sr28',
  '20037',
  'RICE,BROWN,LONG-GRAIN,CKD',
  '20037',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pasta',
  'Pasta, cooked',
  'pasta, cooked',
  '{"de":"Nudeln, gekocht","en":"Pasta, cooked","es":"Pasta, cocida"}'::jsonb,
  ARRAY['fideos', 'macarrones', 'noodles', 'nudeln', 'pasta', 'spaghetti']::text[],
  158.0,
  5.8,
  0.93,
  30.86,
  'grain',
  'usda_sr28',
  '20121',
  'PASTA,CKD,ENR,WO/ ADDED SALT',
  '20121',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'couscous',
  'Couscous, cooked',
  'couscous, cooked',
  '{"de":"Couscous, gekocht","en":"Couscous, cooked","es":"Cuscús, cocido"}'::jsonb,
  ARRAY['couscous', 'cuscus', 'cuscús', 'kuskus']::text[],
  112.0,
  3.79,
  0.16,
  23.22,
  'grain',
  'usda_sr28',
  '20029',
  'COUSCOUS,COOKED',
  '20029',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'quinoa',
  'Quinoa, cooked',
  'quinoa, cooked',
  '{"de":"Quinoa, gekocht","en":"Quinoa, cooked","es":"Quinoa, cocida"}'::jsonb,
  ARRAY['quinoa', 'quinua']::text[],
  120.0,
  4.4,
  1.92,
  21.3,
  'grain',
  'usda_sr28',
  '20137',
  'QUINOA,CKD',
  '20137',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'bulgur',
  'Bulgur, cooked',
  'bulgur, cooked',
  '{"de":"Bulgur, gekocht","en":"Bulgur, cooked","es":"Bulgur, cocido"}'::jsonb,
  ARRAY['bulgur', 'burghul']::text[],
  83.0,
  3.08,
  0.24,
  18.58,
  'grain',
  'usda_sr28',
  '20013',
  'BULGUR,COOKED',
  '20013',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'millet',
  'Millet, cooked',
  'millet, cooked',
  '{"de":"Hirse, gekocht","en":"Millet, cooked","es":"Mijo, cocido"}'::jsonb,
  ARRAY['hirse', 'mijo', 'millet']::text[],
  119.0,
  3.51,
  1.0,
  23.67,
  'grain',
  'usda_sr28',
  '20032',
  'MILLET,COOKED',
  '20032',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'rice_noodles',
  'Rice noodles, cooked',
  'rice noodles, cooked',
  '{"de":"Reisnudeln, gekocht","en":"Rice noodles, cooked","es":"Fideos de arroz, cocidos"}'::jsonb,
  ARRAY['fideos de arroz', 'reisnudeln', 'rice noodles']::text[],
  108.0,
  1.79,
  0.2,
  24.01,
  'grain',
  'usda_sr28',
  '20134',
  'RICE NOODLES,CKD',
  '20134',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'egg_noodles',
  'Egg noodles, cooked',
  'egg noodles, cooked',
  '{"de":"Eiernudeln, gekocht","en":"Egg noodles, cooked","es":"Fideos al huevo, cocidos"}'::jsonb,
  ARRAY['egg noodles', 'eiernudeln', 'fideos al huevo']::text[],
  138.0,
  4.54,
  2.07,
  25.16,
  'grain',
  'usda_sr28',
  '20310',
  'NOODLES,EGG,CKD,ENR,W/ SALT',
  '20310',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cornmeal',
  'Cornmeal',
  'cornmeal',
  '{"de":"Maismehl","en":"Cornmeal","es":"Harina de maíz"}'::jsonb,
  ARRAY['cornmeal', 'harina de maiz', 'harina de maíz', 'maismehl', 'polenta']::text[],
  370.0,
  7.11,
  1.75,
  79.45,
  'grain',
  'usda_sr28',
  '20022',
  'CORNMEAL,DEGERMED,ENR,YEL',
  '20022',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'whole_wheat_bread',
  'Whole-wheat bread',
  'whole-wheat bread',
  '{"de":"Vollkornbrot","en":"Whole-wheat bread","es":"Pan integral"}'::jsonb,
  ARRAY['bread', 'brot', 'pan', 'pan integral', 'vollkornbrot', 'whole-wheat bread']::text[],
  252.0,
  12.45,
  3.5,
  42.71,
  'grain',
  'usda_sr28',
  '18075',
  'BREAD,WHOLE-WHEAT,COMM. PREPARED',
  '18075',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'white_bread',
  'White bread',
  'white bread',
  '{"de":"Weißbrot","en":"White bread","es":"Pan blanco"}'::jsonb,
  ARRAY['pan blanco', 'toast', 'weissbrot', 'weißbrot', 'white bread']::text[],
  266.0,
  8.85,
  3.33,
  49.42,
  'grain',
  'usda_sr28',
  '18069',
  'BREAD,WHITE,COMMLY PREP (INCL SOFT BREAD CRUMBS)',
  '18069',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'bagel',
  'Bagel',
  'bagel',
  '{"de":"Bagel","en":"Bagel","es":"Bagel"}'::jsonb,
  ARRAY['bagel', 'bagels']::text[],
  275.0,
  10.5,
  1.6,
  53.4,
  'grain',
  'usda_sr28',
  '18406',
  'BAGELS,PLN,ENR,WO/CA PROP (INCL ONION,POPPY,SESAME)',
  '18406',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'corn_tortilla',
  'Corn tortilla',
  'corn tortilla',
  '{"de":"Maistortilla","en":"Corn tortilla","es":"Tortilla de maíz"}'::jsonb,
  ARRAY['corn tortilla', 'maistortilla', 'tortilla', 'tortilla de maiz', 'tortilla de maíz']::text[],
  218.0,
  5.7,
  2.85,
  44.64,
  'grain',
  'usda_sr28',
  '18363',
  'TORTILLAS,RTB OR -FRY,CORN',
  '18363',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'oats',
  'Oats, dry',
  'oats, dry',
  '{"de":"Haferflocken","en":"Oats, dry","es":"Avena, seca"}'::jsonb,
  ARRAY['avena', 'hafer', 'haferflocken', 'oatmeal', 'oats', 'porridge']::text[],
  379.0,
  13.15,
  6.52,
  67.7,
  'grain',
  'usda_sr28',
  '08120',
  'CEREALS,OATS,REG & QUICK,NOT FORT,DRY',
  '08120',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'potato',
  'Potato, boiled',
  'potato, boiled',
  '{"de":"Kartoffeln, gekocht","en":"Potato, boiled","es":"Patata, cocida"}'::jsonb,
  ARRAY['kartoffel', 'kartoffeln', 'papa', 'patata', 'potato', 'potatoes']::text[],
  86.0,
  1.71,
  0.1,
  20.01,
  'vegetable',
  'usda_sr28',
  '11367',
  'POTATOES,BLD,CKD WO/ SKN,FLESH,WO/ SALT',
  '11367',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sweet_potato',
  'Sweet potato, baked',
  'sweet potato, baked',
  '{"de":"Süßkartoffel, gebacken","en":"Sweet potato, baked","es":"Boniato, al horno"}'::jsonb,
  ARRAY['batata', 'boniato', 'camote', 'suesskartoffel', 'sweet potato', 'süßkartoffel']::text[],
  90.0,
  2.01,
  0.15,
  20.71,
  'vegetable',
  'usda_sr28',
  '11508',
  'SWEET POTATO,CKD,BKD IN SKN,FLESH,WO/ SALT',
  '11508',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sweet_corn',
  'Sweet corn, cooked',
  'sweet corn, cooked',
  '{"de":"Mais, gekocht","en":"Sweet corn, cooked","es":"Maíz dulce, cocido"}'::jsonb,
  ARRAY['choclo', 'corn', 'elote', 'mais', 'maiz', 'maíz', 'maíz dulce', 'sweet corn']::text[],
  96.0,
  3.41,
  1.5,
  20.98,
  'vegetable',
  'usda_sr28',
  '11168',
  'CORN,SWT,YEL,CKD,BLD,DRND,WO/SALT',
  '11168',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'chicken_breast',
  'Chicken breast, cooked',
  'chicken breast, cooked',
  '{"de":"Hähnchenbrust, gebraten","en":"Chicken breast, cooked","es":"Pechuga de pollo, cocida"}'::jsonb,
  ARRAY['chicken', 'chicken breast', 'haehnchen', 'huhn', 'hähnchen', 'hähnchenbrust', 'pechuga de pollo', 'pollo']::text[],
  165.0,
  31.02,
  3.57,
  0.0,
  'protein',
  'usda_sr28',
  '05064',
  'CHICKEN,BROILERS OR FRYERS,BREAST,MEAT ONLY,CKD,RSTD',
  '05064',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'chicken_thigh',
  'Chicken thigh, cooked',
  'chicken thigh, cooked',
  '{"de":"Hähnchenschenkel, gebraten","en":"Chicken thigh, cooked","es":"Muslo de pollo, cocido"}'::jsonb,
  ARRAY['chicken thigh', 'haehnchenschenkel', 'hähnchenschenkel', 'muslo de pollo']::text[],
  179.0,
  24.76,
  8.15,
  0.0,
  'protein',
  'usda_sr28',
  '05098',
  'CHICKEN,BROILERS OR FRYERS,THIGH,MEAT ONLY,CKD,RSTD',
  '05098',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'turkey_breast',
  'Turkey breast, roasted',
  'turkey breast, roasted',
  '{"de":"Putenbrust, gebraten","en":"Turkey breast, roasted","es":"Pechuga de pavo, asada"}'::jsonb,
  ARRAY['pavo', 'pechuga de pavo', 'pute', 'putenbrust', 'turkey', 'turkey breast']::text[],
  147.0,
  30.13,
  2.08,
  0.0,
  'protein',
  'usda_sr28',
  '05220',
  'TURKEY,BREAST,FROM WHL BIRD,MEAT ONLY,RSTD',
  '05220',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'egg',
  'Egg, whole',
  'egg, whole',
  '{"de":"Ei","en":"Egg, whole","es":"Huevo"}'::jsonb,
  ARRAY['egg', 'eggs', 'ei', 'eier', 'huevo', 'huevos']::text[],
  143.0,
  12.56,
  9.51,
  0.72,
  'protein',
  'usda_sr28',
  '01123',
  'EGG,WHL,RAW,FRSH',
  '01123',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'salmon',
  'Salmon, cooked',
  'salmon, cooked',
  '{"de":"Lachs, gebraten","en":"Salmon, cooked","es":"Salmón, cocido"}'::jsonb,
  ARRAY['lachs', 'salmon', 'salmón']::text[],
  206.0,
  22.1,
  12.35,
  0.0,
  'protein',
  'usda_sr28',
  '15237',
  'SALMON,ATLANTIC,FARMED,CKD,DRY HEAT',
  '15237',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'tuna',
  'Tuna, canned in water',
  'tuna, canned in water',
  '{"de":"Thunfisch, in Wasser","en":"Tuna, canned in water","es":"Atún, en agua"}'::jsonb,
  ARRAY['atun', 'atún', 'thunfisch', 'tuna']::text[],
  86.0,
  19.44,
  0.96,
  0.0,
  'protein',
  'usda_sr28',
  '15121',
  'FISH,TUNA,LT,CND IN H2O,DRND SOL',
  '15121',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cod',
  'Cod, cooked',
  'cod, cooked',
  '{"de":"Kabeljau, gebraten","en":"Cod, cooked","es":"Bacalao, cocido"}'::jsonb,
  ARRAY['bacalao', 'cod', 'dorsch', 'kabeljau']::text[],
  105.0,
  22.83,
  0.86,
  0.0,
  'protein',
  'usda_sr28',
  '15016',
  'COD,ATLANTIC,CKD,DRY HEAT',
  '15016',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'tilapia',
  'Tilapia, cooked',
  'tilapia, cooked',
  '{"de":"Tilapia, gebraten","en":"Tilapia, cooked","es":"Tilapia, cocida"}'::jsonb,
  ARRAY['tilapia']::text[],
  128.0,
  26.15,
  2.65,
  0.0,
  'protein',
  'usda_sr28',
  '15262',
  'FISH,TILAPIA,CKD,DRY HEAT',
  '15262',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mackerel',
  'Mackerel, cooked',
  'mackerel, cooked',
  '{"de":"Makrele, gebraten","en":"Mackerel, cooked","es":"Caballa, cocida"}'::jsonb,
  ARRAY['caballa', 'mackerel', 'makrele']::text[],
  262.0,
  23.85,
  17.81,
  0.0,
  'protein',
  'usda_sr28',
  '15047',
  'MACKEREL,ATLANTIC,CKD,DRY HEAT',
  '15047',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sardines',
  'Sardines, canned in oil',
  'sardines, canned in oil',
  '{"de":"Sardinen, in Öl","en":"Sardines, canned in oil","es":"Sardinas, en aceite"}'::jsonb,
  ARRAY['sardinas', 'sardinen', 'sardines']::text[],
  208.0,
  24.62,
  11.45,
  0.0,
  'protein',
  'usda_sr28',
  '15088',
  'SARDINE,ATLANTIC,CND IN OIL,DRND SOL W/BONE',
  '15088',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'shrimp',
  'Shrimp, cooked',
  'shrimp, cooked',
  '{"de":"Garnelen, gekocht","en":"Shrimp, cooked","es":"Gambas, cocidas"}'::jsonb,
  ARRAY['camarones', 'gambas', 'garnelen', 'prawns', 'shrimp']::text[],
  119.0,
  22.78,
  1.7,
  1.52,
  'protein',
  'usda_sr28',
  '15151',
  'CRUSTACEANS,SHRIMP,MXD SP,CKD,MST HT (MAYBE PREVIOUSLY FRZ)',
  '15151',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'ground_beef',
  'Ground beef, cooked (90/10)',
  'ground beef, cooked (90/10)',
  '{"de":"Rinderhackfleisch, gebraten (90/10)","en":"Ground beef, cooked (90/10)","es":"Carne picada de res (90/10)"}'::jsonb,
  ARRAY['beef', 'carne de res', 'carne picada', 'carne picada de res (90/10)', 'ground beef', 'hackfleisch', 'rind', 'rinderhack', 'rinderhackfleisch', 'ternera']::text[],
  217.0,
  26.11,
  11.75,
  0.0,
  'protein',
  'usda_sr28',
  '23563',
  'BEEF,GROUND,90% LN MEAT / 10% FAT,PATTY,CKD,BRLD',
  '23563',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'rib_eye_steak',
  'Rib eye steak, grilled',
  'rib eye steak, grilled',
  '{"de":"Rib-Eye-Steak, gegrillt","en":"Rib eye steak, grilled","es":"Chuletón, a la parrilla"}'::jsonb,
  ARRAY['bife', 'chuleton', 'chuletón', 'entrecot', 'rib eye', 'rib eye steak', 'rib-eye-steak', 'ribeye', 'steak']::text[],
  207.0,
  27.97,
  10.57,
  0.0,
  'protein',
  'usda_sr28',
  '23100',
  'BEEF,RIB EYE STK,BNLES,LIP-ON,LN,1/8" FAT,ALL GRDS,CKD,GRLD',
  '23100',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pork_loin',
  'Pork loin, cooked',
  'pork loin, cooked',
  '{"de":"Schweinelende, gebraten","en":"Pork loin, cooked","es":"Lomo de cerdo, cocido"}'::jsonb,
  ARRAY['cerdo', 'lomo de cerdo', 'pork', 'pork loin', 'schwein', 'schweinefleisch', 'schweinelende']::text[],
  209.0,
  28.62,
  9.63,
  0.0,
  'protein',
  'usda_sr28',
  '10027',
  'PORK,FRSH,LOIN,WHL,LN,CKD,RSTD',
  '10027',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'ham',
  'Ham, cooked',
  'ham, cooked',
  '{"de":"Kochschinken","en":"Ham, cooked","es":"Jamón cocido"}'::jsonb,
  ARRAY['ham', 'jamon', 'jamón', 'jamón cocido', 'kochschinken', 'schinken']::text[],
  178.0,
  22.62,
  9.02,
  0.0,
  'protein',
  'usda_sr28',
  '10136',
  'PORK,CURED,HAM,BNLESS,REG (APPROX 11% FAT),RSTD',
  '10136',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'lamb_loin',
  'Lamb loin, cooked',
  'lamb loin, cooked',
  '{"de":"Lammlachs, gebraten","en":"Lamb loin, cooked","es":"Lomo de cordero, cocido"}'::jsonb,
  ARRAY['cordero', 'lamb', 'lamb loin', 'lamm', 'lammfleisch', 'lammlachs', 'lomo de cordero']::text[],
  216.0,
  29.99,
  9.73,
  0.0,
  'protein',
  'usda_sr28',
  '17027',
  'LAMB,DOM,LOIN,LN,1/4"FAT,CHOIC,CKD,BRLD',
  '17027',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'tofu',
  'Tofu, firm',
  'tofu, firm',
  '{"de":"Tofu","en":"Tofu, firm","es":"Tofu firme"}'::jsonb,
  ARRAY['tofu', 'tofu firme']::text[],
  144.0,
  17.27,
  8.72,
  2.78,
  'protein',
  'usda_sr28',
  '16426',
  'TOFU,RAW,FIRM,PREP W/CA SULFATE',
  '16426',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'tempeh',
  'Tempeh',
  'tempeh',
  '{"de":"Tempeh","en":"Tempeh","es":"Tempeh"}'::jsonb,
  ARRAY['tempeh']::text[],
  192.0,
  20.29,
  10.8,
  7.64,
  'protein',
  'usda_sr28',
  '16114',
  'TEMPEH',
  '16114',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'whole_milk_3_25',
  'Whole milk (3.25%)',
  'whole milk (3.25%)',
  '{"de":"Vollmilch (3,25 %)","en":"Whole milk (3.25%)","es":"Leche entera (3,25%)"}'::jsonb,
  ARRAY['leche', 'leche entera', 'leche entera (3', 'milch', 'milk', 'vollmilch', 'vollmilch (3', 'whole milk', 'whole milk (3.25%)']::text[],
  61.0,
  3.15,
  3.25,
  4.8,
  'dairy',
  'usda_sr28',
  '01077',
  'MILK,WHL,3.25% MILKFAT,W/ ADDED VITAMIN D',
  '01077',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'reduced_fat_milk_2',
  'Reduced-fat milk (2%)',
  'reduced-fat milk (2%)',
  '{"de":"Fettarme Milch (2 %)","en":"Reduced-fat milk (2%)","es":"Leche semidesnatada (2%)"}'::jsonb,
  ARRAY['fettarme milch', 'fettarme milch (2 %)', 'leche semidesnatada', 'leche semidesnatada (2%)', 'reduced fat milk', 'reduced-fat milk (2%)']::text[],
  50.0,
  3.3,
  1.98,
  4.8,
  'dairy',
  'usda_sr28',
  '01079',
  'MILK,RED FAT,FLUID,2% MILKFAT,W/ ADDED VIT A & VITAMIN D',
  '01079',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'skim_milk',
  'Skim milk',
  'skim milk',
  '{"de":"Magermilch","en":"Skim milk","es":"Leche desnatada"}'::jsonb,
  ARRAY['leche desnatada', 'magermilch', 'skim milk']::text[],
  34.0,
  3.37,
  0.08,
  4.96,
  'dairy',
  'usda_sr28',
  '01151',
  'MILK,NONFAT,FLUID,WO/ ADDED VIT A & VIT D (FAT FREE OR SKIM)',
  '01151',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'greek_yogurt',
  'Greek yogurt, nonfat',
  'greek yogurt, nonfat',
  '{"de":"Griechischer Joghurt, fettarm","en":"Greek yogurt, nonfat","es":"Yogur griego, desnatado"}'::jsonb,
  ARRAY['greek yogurt', 'griechischer joghurt', 'joghurt', 'yogur', 'yogur griego', 'yogurt']::text[],
  59.0,
  10.19,
  0.39,
  3.6,
  'dairy',
  'usda_sr28',
  '01256',
  'YOGURT,GREEK,PLN,NONFAT',
  '01256',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'plain_yogurt',
  'Plain yogurt, whole milk',
  'plain yogurt, whole milk',
  '{"de":"Naturjoghurt (Vollmilch)","en":"Plain yogurt, whole milk","es":"Yogur natural (entero)"}'::jsonb,
  ARRAY['joghurt', 'naturjoghurt', 'naturjoghurt (vollmilch)', 'plain yogurt', 'yogur natural', 'yogur natural (entero)', 'yogurt']::text[],
  61.0,
  3.47,
  3.25,
  4.66,
  'dairy',
  'usda_sr28',
  '01116',
  'YOGURT,PLN,WHL MILK,8 GRAMS PROT PER 8 OZ',
  '01116',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cottage_cheese_2',
  'Cottage cheese (2%)',
  'cottage cheese (2%)',
  '{"de":"Hüttenkäse (2 %)","en":"Cottage cheese (2%)","es":"Requesón (2%)"}'::jsonb,
  ARRAY['cottage cheese', 'cottage cheese (2%)', 'huettenkaese', 'hüttenkäse', 'hüttenkäse (2 %)', 'requeson', 'requesón', 'requesón (2%)']::text[],
  81.0,
  10.45,
  2.27,
  4.76,
  'dairy',
  'usda_sr28',
  '01015',
  'CHEESE,COTTAGE,LOWFAT,2% MILKFAT',
  '01015',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cheddar_cheese',
  'Cheddar cheese',
  'cheddar cheese',
  '{"de":"Cheddar","en":"Cheddar cheese","es":"Queso cheddar"}'::jsonb,
  ARRAY['cheddar', 'cheddar cheese', 'cheese', 'kaese', 'käse', 'queso', 'queso cheddar']::text[],
  404.0,
  22.87,
  33.31,
  3.09,
  'dairy',
  'usda_sr28',
  '01009',
  'CHEESE,CHEDDAR',
  '01009',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'gouda_cheese',
  'Gouda cheese',
  'gouda cheese',
  '{"de":"Gouda","en":"Gouda cheese","es":"Queso gouda"}'::jsonb,
  ARRAY['cheese', 'gouda', 'gouda cheese', 'kaese', 'käse', 'queso', 'queso gouda']::text[],
  356.0,
  24.94,
  27.44,
  2.22,
  'dairy',
  'usda_sr28',
  '01022',
  'CHEESE,GOUDA',
  '01022',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mozzarella',
  'Mozzarella, whole milk',
  'mozzarella, whole milk',
  '{"de":"Mozzarella","en":"Mozzarella, whole milk","es":"Mozzarella"}'::jsonb,
  ARRAY['cheese', 'kaese', 'käse', 'mozzarella', 'queso']::text[],
  300.0,
  22.17,
  22.35,
  2.19,
  'dairy',
  'usda_sr28',
  '01026',
  'CHEESE,MOZZARELLA,WHL MILK',
  '01026',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mozzarella',
  'Mozzarella, part skim',
  'mozzarella, part skim',
  '{"de":"Mozzarella, fettarm","en":"Mozzarella, part skim","es":"Mozzarella, semidesnatado"}'::jsonb,
  ARRAY['mozzarella', 'mozzarella light', 'mozzarella part skim']::text[],
  254.0,
  24.26,
  15.92,
  2.77,
  'dairy',
  'usda_sr28',
  '01028',
  'CHEESE,MOZZARELLA,PART SKIM MILK',
  '01028',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'parmesan_cheese',
  'Parmesan cheese',
  'parmesan cheese',
  '{"de":"Parmesan","en":"Parmesan cheese","es":"Queso parmesano"}'::jsonb,
  ARRAY['parmesan', 'parmesan cheese', 'parmesano', 'parmigiano', 'queso parmesano']::text[],
  392.0,
  35.75,
  25.83,
  3.22,
  'dairy',
  'usda_sr28',
  '01033',
  'CHEESE,PARMESAN,HARD',
  '01033',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'feta_cheese',
  'Feta cheese',
  'feta cheese',
  '{"de":"Feta","en":"Feta cheese","es":"Queso feta"}'::jsonb,
  ARRAY['feta', 'feta cheese', 'queso feta', 'schafskaese', 'schafskäse']::text[],
  264.0,
  14.21,
  21.28,
  4.09,
  'dairy',
  'usda_sr28',
  '01019',
  'CHEESE,FETA',
  '01019',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cream_cheese',
  'Cream cheese',
  'cream cheese',
  '{"de":"Frischkäse","en":"Cream cheese","es":"Queso crema"}'::jsonb,
  ARRAY['cream cheese', 'frischkaese', 'frischkäse', 'queso crema']::text[],
  350.0,
  6.15,
  34.44,
  5.52,
  'dairy',
  'usda_sr28',
  '01017',
  'CHEESE,CREAM',
  '01017',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'heavy_whipping_cream',
  'Heavy whipping cream',
  'heavy whipping cream',
  '{"de":"Schlagsahne","en":"Heavy whipping cream","es":"Nata para montar"}'::jsonb,
  ARRAY['cream', 'crema de leche', 'heavy whipping cream', 'nata', 'nata para montar', 'sahne', 'schlagsahne', 'whipping cream']::text[],
  340.0,
  2.84,
  36.08,
  2.74,
  'dairy',
  'usda_sr28',
  '01053',
  'CREAM,FLUID,HVY WHIPPING',
  '01053',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sour_cream',
  'Sour cream',
  'sour cream',
  '{"de":"Saure Sahne","en":"Sour cream","es":"Crema agria"}'::jsonb,
  ARRAY['crema agria', 'saure sahne', 'schmand', 'sour cream']::text[],
  198.0,
  2.44,
  19.35,
  4.63,
  'dairy',
  'usda_sr28',
  '01056',
  'CREAM,SOUR,CULTURED',
  '01056',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'butter',
  'Butter',
  'butter',
  '{"de":"Butter","en":"Butter","es":"Mantequilla"}'::jsonb,
  ARRAY['butter', 'mantequilla']::text[],
  717.0,
  0.85,
  81.11,
  0.06,
  'fat',
  'usda_sr28',
  '01001',
  'BUTTER,WITH SALT',
  '01001',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'apple',
  'Apple',
  'apple',
  '{"de":"Apfel","en":"Apple","es":"Manzana"}'::jsonb,
  ARRAY['aepfel', 'apfel', 'apple', 'apples', 'manzana', 'äpfel']::text[],
  52.0,
  0.26,
  0.17,
  13.81,
  'fruit',
  'usda_sr28',
  '09003',
  'APPLES,RAW,WITH SKIN',
  '09003',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'banana',
  'Banana',
  'banana',
  '{"de":"Banane","en":"Banana","es":"Plátano"}'::jsonb,
  ARRAY['banana', 'banane', 'banano', 'guineo', 'platano', 'plátano']::text[],
  89.0,
  1.09,
  0.33,
  22.84,
  'fruit',
  'usda_sr28',
  '09040',
  'BANANAS,RAW',
  '09040',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'orange',
  'Orange',
  'orange',
  '{"de":"Orange","en":"Orange","es":"Naranja"}'::jsonb,
  ARRAY['apfelsine', 'naranja', 'orange']::text[],
  47.0,
  0.94,
  0.12,
  11.75,
  'fruit',
  'usda_sr28',
  '09200',
  'ORANGES,RAW,ALL COMM VAR',
  '09200',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'strawberries',
  'Strawberries',
  'strawberries',
  '{"de":"Erdbeeren","en":"Strawberries","es":"Fresas"}'::jsonb,
  ARRAY['erdbeere', 'erdbeeren', 'fresas', 'frutillas', 'strawberries', 'strawberry']::text[],
  32.0,
  0.67,
  0.3,
  7.68,
  'fruit',
  'usda_sr28',
  '09316',
  'STRAWBERRIES,RAW',
  '09316',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'raspberries',
  'Raspberries',
  'raspberries',
  '{"de":"Himbeeren","en":"Raspberries","es":"Frambuesas"}'::jsonb,
  ARRAY['frambuesas', 'himbeeren', 'raspberries']::text[],
  52.0,
  1.2,
  0.65,
  11.94,
  'fruit',
  'usda_sr28',
  '09302',
  'RASPBERRIES,RAW',
  '09302',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'blueberries',
  'Blueberries',
  'blueberries',
  '{"de":"Heidelbeeren","en":"Blueberries","es":"Arándanos"}'::jsonb,
  ARRAY['arandanos', 'arándanos', 'blaubeeren', 'blueberries', 'heidelbeeren']::text[],
  57.0,
  0.74,
  0.33,
  14.49,
  'fruit',
  'usda_sr28',
  '09050',
  'BLUEBERRIES,RAW',
  '09050',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'grapes',
  'Grapes',
  'grapes',
  '{"de":"Weintrauben","en":"Grapes","es":"Uvas"}'::jsonb,
  ARRAY['grapes', 'trauben', 'uvas', 'weintrauben']::text[],
  67.0,
  0.63,
  0.35,
  17.15,
  'fruit',
  'usda_sr28',
  '09131',
  'GRAPES,AMERICAN TYPE (SLIP SKN),RAW',
  '09131',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'avocado',
  'Avocado',
  'avocado',
  '{"de":"Avocado","en":"Avocado","es":"Aguacate"}'::jsonb,
  ARRAY['aguacate', 'avocado', 'avocados', 'palta']::text[],
  160.0,
  2.0,
  14.66,
  8.53,
  'fruit',
  'usda_sr28',
  '09037',
  'AVOCADOS,RAW,ALL COMM VAR',
  '09037',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mango',
  'Mango',
  'mango',
  '{"de":"Mango","en":"Mango","es":"Mango"}'::jsonb,
  ARRAY['mango', 'mangos']::text[],
  60.0,
  0.82,
  0.38,
  14.98,
  'fruit',
  'usda_sr28',
  '09176',
  'MANGOS,RAW',
  '09176',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pineapple',
  'Pineapple',
  'pineapple',
  '{"de":"Ananas","en":"Pineapple","es":"Piña"}'::jsonb,
  ARRAY['ananas', 'pina', 'pineapple', 'piña']::text[],
  50.0,
  0.54,
  0.12,
  13.12,
  'fruit',
  'usda_sr28',
  '09266',
  'PINEAPPLE,RAW,ALL VAR',
  '09266',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'watermelon',
  'Watermelon',
  'watermelon',
  '{"de":"Wassermelone","en":"Watermelon","es":"Sandía"}'::jsonb,
  ARRAY['sandia', 'sandía', 'wassermelone', 'watermelon']::text[],
  30.0,
  0.61,
  0.15,
  7.55,
  'fruit',
  'usda_sr28',
  '09326',
  'WATERMELON,RAW',
  '09326',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cantaloupe_melon',
  'Cantaloupe melon',
  'cantaloupe melon',
  '{"de":"Melone (Cantaloupe)","en":"Cantaloupe melon","es":"Melón cantalupo"}'::jsonb,
  ARRAY['cantaloupe', 'cantaloupe melon', 'honigmelone', 'melon', 'melone', 'melone (cantaloupe)', 'melón', 'melón cantalupo']::text[],
  34.0,
  0.84,
  0.19,
  8.16,
  'fruit',
  'usda_sr28',
  '09181',
  'MELONS,CANTALOUPE,RAW',
  '09181',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pear',
  'Pear',
  'pear',
  '{"de":"Birne","en":"Pear","es":"Pera"}'::jsonb,
  ARRAY['birne', 'birnen', 'pear', 'pears', 'pera']::text[],
  57.0,
  0.36,
  0.14,
  15.23,
  'fruit',
  'usda_sr28',
  '09252',
  'PEARS,RAW',
  '09252',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'plum',
  'Plum',
  'plum',
  '{"de":"Pflaume","en":"Plum","es":"Ciruela"}'::jsonb,
  ARRAY['ciruela', 'pflaume', 'pflaumen', 'plum', 'plums', 'zwetschge']::text[],
  46.0,
  0.7,
  0.28,
  11.42,
  'fruit',
  'usda_sr28',
  '09279',
  'PLUMS,RAW',
  '09279',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cherries',
  'Cherries',
  'cherries',
  '{"de":"Kirschen","en":"Cherries","es":"Cerezas"}'::jsonb,
  ARRAY['cerezas', 'cherries', 'cherry', 'kirsche', 'kirschen']::text[],
  63.0,
  1.06,
  0.2,
  16.01,
  'fruit',
  'usda_sr28',
  '09070',
  'CHERRIES,SWEET,RAW',
  '09070',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'kiwifruit',
  'Kiwifruit',
  'kiwifruit',
  '{"de":"Kiwi","en":"Kiwifruit","es":"Kiwi"}'::jsonb,
  ARRAY['kiwi', 'kiwifruit']::text[],
  61.0,
  1.14,
  0.52,
  14.66,
  'fruit',
  'usda_sr28',
  '09148',
  'KIWIFRUIT,GRN,RAW',
  '09148',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'lemon',
  'Lemon',
  'lemon',
  '{"de":"Zitrone","en":"Lemon","es":"Limón"}'::jsonb,
  ARRAY['lemon', 'limon', 'limón', 'zitrone']::text[],
  29.0,
  1.1,
  0.3,
  9.32,
  'fruit',
  'usda_sr28',
  '09150',
  'LEMONS,RAW,WITHOUT PEEL',
  '09150',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'grapefruit',
  'Grapefruit',
  'grapefruit',
  '{"de":"Grapefruit","en":"Grapefruit","es":"Pomelo"}'::jsonb,
  ARRAY['grapefruit', 'pampelmuse', 'pomelo', 'toronja']::text[],
  32.0,
  0.63,
  0.1,
  8.08,
  'fruit',
  'usda_sr28',
  '09111',
  'GRAPEFRUIT,RAW,PINK&RED&WHITE,ALL AREAS',
  '09111',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'dates_medjool',
  'Dates (Medjool)',
  'dates (medjool)',
  '{"de":"Datteln (Medjool)","en":"Dates (Medjool)","es":"Dátiles (Medjool)"}'::jsonb,
  ARRAY['dates', 'dates (medjool)', 'datiles', 'dattel', 'datteln', 'datteln (medjool)', 'dátiles', 'dátiles (medjool)']::text[],
  277.0,
  1.81,
  0.15,
  74.97,
  'fruit',
  'usda_sr28',
  '09421',
  'DATES,MEDJOOL',
  '09421',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'raisins',
  'Raisins',
  'raisins',
  '{"de":"Rosinen","en":"Raisins","es":"Pasas"}'::jsonb,
  ARRAY['pasas', 'raisins', 'rosinen', 'uvas pasas']::text[],
  299.0,
  3.07,
  0.46,
  79.18,
  'fruit',
  'usda_sr28',
  '09298',
  'RAISINS,SEEDLESS',
  '09298',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'tomato',
  'Tomato',
  'tomato',
  '{"de":"Tomate","en":"Tomato","es":"Tomate"}'::jsonb,
  ARRAY['jitomate', 'tomate', 'tomaten', 'tomato', 'tomatoes']::text[],
  18.0,
  0.88,
  0.2,
  3.89,
  'vegetable',
  'usda_sr28',
  '11529',
  'TOMATOES,RED,RIPE,RAW,YEAR RND AVERAGE',
  '11529',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cucumber',
  'Cucumber',
  'cucumber',
  '{"de":"Gurke","en":"Cucumber","es":"Pepino"}'::jsonb,
  ARRAY['cucumber', 'gurke', 'gurken', 'pepino']::text[],
  15.0,
  0.65,
  0.11,
  3.63,
  'vegetable',
  'usda_sr28',
  '11205',
  'CUCUMBER,WITH PEEL,RAW',
  '11205',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'carrot',
  'Carrot',
  'carrot',
  '{"de":"Karotte","en":"Carrot","es":"Zanahoria"}'::jsonb,
  ARRAY['carrot', 'carrots', 'karotte', 'karotten', 'moehre', 'möhre', 'möhren', 'zanahoria']::text[],
  41.0,
  0.93,
  0.24,
  9.58,
  'vegetable',
  'usda_sr28',
  '11124',
  'CARROTS,RAW',
  '11124',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'broccoli',
  'Broccoli',
  'broccoli',
  '{"de":"Brokkoli","en":"Broccoli","es":"Brócoli"}'::jsonb,
  ARRAY['broccoli', 'brocoli', 'brokkoli', 'brócoli']::text[],
  34.0,
  2.82,
  0.37,
  6.64,
  'vegetable',
  'usda_sr28',
  '11090',
  'BROCCOLI,RAW',
  '11090',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cauliflower',
  'Cauliflower',
  'cauliflower',
  '{"de":"Blumenkohl","en":"Cauliflower","es":"Coliflor"}'::jsonb,
  ARRAY['blumenkohl', 'cauliflower', 'coliflor']::text[],
  25.0,
  1.92,
  0.28,
  4.97,
  'vegetable',
  'usda_sr28',
  '11135',
  'CAULIFLOWER,RAW',
  '11135',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'spinach',
  'Spinach',
  'spinach',
  '{"de":"Spinat","en":"Spinach","es":"Espinaca"}'::jsonb,
  ARRAY['espinaca', 'espinacas', 'spinach', 'spinat']::text[],
  23.0,
  2.86,
  0.39,
  3.63,
  'vegetable',
  'usda_sr28',
  '11457',
  'SPINACH,RAW',
  '11457',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'kale',
  'Kale',
  'kale',
  '{"de":"Grünkohl","en":"Kale","es":"Col rizada"}'::jsonb,
  ARRAY['col rizada', 'gruenkohl', 'grünkohl', 'kale']::text[],
  49.0,
  4.28,
  0.93,
  8.75,
  'vegetable',
  'usda_sr28',
  '11233',
  'KALE,RAW',
  '11233',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cabbage',
  'Cabbage',
  'cabbage',
  '{"de":"Weißkohl","en":"Cabbage","es":"Repollo"}'::jsonb,
  ARRAY['cabbage', 'col', 'kohl', 'repollo', 'weisskohl', 'weißkohl']::text[],
  25.0,
  1.28,
  0.1,
  5.8,
  'vegetable',
  'usda_sr28',
  '11109',
  'CABBAGE,RAW',
  '11109',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'onion',
  'Onion',
  'onion',
  '{"de":"Zwiebel","en":"Onion","es":"Cebolla"}'::jsonb,
  ARRAY['cebolla', 'onion', 'onions', 'zwiebel', 'zwiebeln']::text[],
  40.0,
  1.1,
  0.1,
  9.34,
  'vegetable',
  'usda_sr28',
  '11282',
  'ONIONS,RAW',
  '11282',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'spring_onion',
  'Spring onion',
  'spring onion',
  '{"de":"Frühlingszwiebel","en":"Spring onion","es":"Cebolleta"}'::jsonb,
  ARRAY['cebolleta', 'cebollin', 'fruehlingszwiebel', 'frühlingszwiebel', 'lauchzwiebel', 'scallion', 'spring onion']::text[],
  32.0,
  1.83,
  0.19,
  7.34,
  'vegetable',
  'usda_sr28',
  '11291',
  'ONIONS,SPRING OR SCALLIONS (INCL TOPS&BULB),RAW',
  '11291',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'garlic',
  'Garlic',
  'garlic',
  '{"de":"Knoblauch","en":"Garlic","es":"Ajo"}'::jsonb,
  ARRAY['ajo', 'garlic', 'knoblauch']::text[],
  149.0,
  6.36,
  0.5,
  33.06,
  'vegetable',
  'usda_sr28',
  '11215',
  'GARLIC,RAW',
  '11215',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'red_bell_pepper',
  'Red bell pepper',
  'red bell pepper',
  '{"de":"Paprika (rot)","en":"Red bell pepper","es":"Pimiento rojo"}'::jsonb,
  ARRAY['aji', 'bell pepper', 'paprika', 'paprika (rot)', 'paprika rot', 'pimiento', 'pimiento rojo', 'red bell pepper', 'red pepper']::text[],
  31.0,
  0.99,
  0.3,
  6.03,
  'vegetable',
  'usda_sr28',
  '11821',
  'PEPPERS,SWT,RED,RAW',
  '11821',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'green_bell_pepper',
  'Green bell pepper',
  'green bell pepper',
  '{"de":"Paprika (grün)","en":"Green bell pepper","es":"Pimiento verde"}'::jsonb,
  ARRAY['green bell pepper', 'green pepper', 'paprika (grün)', 'paprika gruen', 'paprika grün', 'pimiento verde']::text[],
  20.0,
  0.86,
  0.17,
  4.64,
  'vegetable',
  'usda_sr28',
  '11333',
  'PEPPERS,SWT,GRN,RAW',
  '11333',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'iceberg_lettuce',
  'Iceberg lettuce',
  'iceberg lettuce',
  '{"de":"Kopfsalat (Eisberg)","en":"Iceberg lettuce","es":"Lechuga iceberg"}'::jsonb,
  ARRAY['eisbergsalat', 'iceberg lettuce', 'kopfsalat', 'kopfsalat (eisberg)', 'lechuga', 'lechuga iceberg', 'lettuce', 'salat']::text[],
  14.0,
  0.9,
  0.14,
  2.97,
  'vegetable',
  'usda_sr28',
  '11252',
  'LETTUCE,ICEBERG (INCL CRISPHEAD TYPES),RAW',
  '11252',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'zucchini',
  'Zucchini',
  'zucchini',
  '{"de":"Zucchini","en":"Zucchini","es":"Calabacín"}'::jsonb,
  ARRAY['calabacin', 'calabacín', 'courgette', 'zucchini']::text[],
  17.0,
  1.21,
  0.32,
  3.11,
  'vegetable',
  'usda_sr28',
  '11477',
  'SQUASH,SMMR,ZUCCHINI,INCL SKN,RAW',
  '11477',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'eggplant',
  'Eggplant',
  'eggplant',
  '{"de":"Aubergine","en":"Eggplant","es":"Berenjena"}'::jsonb,
  ARRAY['aubergine', 'berenjena', 'eggplant']::text[],
  25.0,
  0.98,
  0.18,
  5.88,
  'vegetable',
  'usda_sr28',
  '11209',
  'EGGPLANT,RAW',
  '11209',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mushrooms',
  'Mushrooms, white',
  'mushrooms, white',
  '{"de":"Champignons","en":"Mushrooms, white","es":"Champiñones"}'::jsonb,
  ARRAY['champignons', 'champinones', 'champiñones', 'mushroom', 'mushrooms', 'pilze', 'setas']::text[],
  22.0,
  3.09,
  0.34,
  3.26,
  'vegetable',
  'usda_sr28',
  '11260',
  'MUSHROOMS,WHITE,RAW',
  '11260',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'green_beans',
  'Green beans, cooked',
  'green beans, cooked',
  '{"de":"Grüne Bohnen, gekocht","en":"Green beans, cooked","es":"Judías verdes, cocidas"}'::jsonb,
  ARRAY['ejotes', 'green beans', 'gruene bohnen', 'grüne bohnen', 'judias verdes', 'judías verdes']::text[],
  35.0,
  1.89,
  0.28,
  7.88,
  'vegetable',
  'usda_sr28',
  '11053',
  'BEANS,SNAP,GRN,CKD,BLD,DRND,WO/SALT',
  '11053',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'green_peas',
  'Green peas, cooked',
  'green peas, cooked',
  '{"de":"Erbsen, gekocht","en":"Green peas, cooked","es":"Guisantes, cocidos"}'::jsonb,
  ARRAY['arvejas', 'erbsen', 'green peas', 'guisantes', 'peas']::text[],
  84.0,
  5.36,
  0.22,
  15.63,
  'vegetable',
  'usda_sr28',
  '11305',
  'PEAS,GRN,CKD,BLD,DRND,WO/SALT',
  '11305',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'asparagus',
  'Asparagus, cooked',
  'asparagus, cooked',
  '{"de":"Spargel, gekocht","en":"Asparagus, cooked","es":"Espárragos, cocidos"}'::jsonb,
  ARRAY['asparagus', 'esparragos', 'espárragos', 'spargel']::text[],
  22.0,
  2.4,
  0.22,
  4.11,
  'vegetable',
  'usda_sr28',
  '11012',
  'ASPARAGUS,CKD,BLD,DRND',
  '11012',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'celery',
  'Celery',
  'celery',
  '{"de":"Sellerie","en":"Celery","es":"Apio"}'::jsonb,
  ARRAY['apio', 'celery', 'sellerie', 'staudensellerie']::text[],
  16.0,
  0.69,
  0.17,
  2.97,
  'vegetable',
  'usda_sr28',
  '11143',
  'CELERY,RAW',
  '11143',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'beetroot',
  'Beetroot',
  'beetroot',
  '{"de":"Rote Bete","en":"Beetroot","es":"Remolacha"}'::jsonb,
  ARRAY['beetroot', 'beets', 'betabel', 'remolacha', 'rote beete', 'rote bete']::text[],
  43.0,
  1.61,
  0.17,
  9.56,
  'vegetable',
  'usda_sr28',
  '11080',
  'BEETS,RAW',
  '11080',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pumpkin',
  'Pumpkin',
  'pumpkin',
  '{"de":"Kürbis","en":"Pumpkin","es":"Calabaza"}'::jsonb,
  ARRAY['calabaza', 'kuerbis', 'kürbis', 'pumpkin']::text[],
  26.0,
  1.0,
  0.1,
  6.5,
  'vegetable',
  'usda_sr28',
  '11422',
  'PUMPKIN,RAW',
  '11422',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'lentils',
  'Lentils, cooked',
  'lentils, cooked',
  '{"de":"Linsen, gekocht","en":"Lentils, cooked","es":"Lentejas, cocidas"}'::jsonb,
  ARRAY['lentejas', 'lentils', 'linsen']::text[],
  116.0,
  9.02,
  0.38,
  20.13,
  'legume',
  'usda_sr28',
  '16070',
  'LENTILS,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16070',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'chickpeas',
  'Chickpeas, cooked',
  'chickpeas, cooked',
  '{"de":"Kichererbsen, gekocht","en":"Chickpeas, cooked","es":"Garbanzos, cocidos"}'::jsonb,
  ARRAY['chickpeas', 'garbanzos', 'kichererbsen']::text[],
  164.0,
  8.86,
  2.59,
  27.42,
  'legume',
  'usda_sr28',
  '16057',
  'CHICKPEAS ,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16057',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'kidney_beans',
  'Kidney beans, cooked',
  'kidney beans, cooked',
  '{"de":"Kidneybohnen, gekocht","en":"Kidney beans, cooked","es":"Frijoles rojos, cocidos"}'::jsonb,
  ARRAY['alubias', 'beans', 'bohnen', 'frijoles', 'frijoles rojos', 'judias', 'judías', 'kidney beans', 'kidneybohnen']::text[],
  127.0,
  8.67,
  0.5,
  22.8,
  'legume',
  'usda_sr28',
  '16033',
  'BEANS,KIDNEY,RED,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16033',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'black_beans',
  'Black beans, cooked',
  'black beans, cooked',
  '{"de":"Schwarze Bohnen, gekocht","en":"Black beans, cooked","es":"Frijoles negros, cocidos"}'::jsonb,
  ARRAY['black beans', 'frijoles negros', 'schwarze bohnen']::text[],
  132.0,
  8.86,
  0.54,
  23.71,
  'legume',
  'usda_sr28',
  '16015',
  'BEANS,BLACK,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16015',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pinto_beans',
  'Pinto beans, cooked',
  'pinto beans, cooked',
  '{"de":"Pintobohnen, gekocht","en":"Pinto beans, cooked","es":"Frijoles pintos, cocidos"}'::jsonb,
  ARRAY['frijoles pintos', 'pinto beans', 'pintobohnen']::text[],
  143.0,
  9.01,
  0.65,
  26.22,
  'legume',
  'usda_sr28',
  '16043',
  'BEANS,PINTO,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16043',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'white_beans',
  'White beans, cooked',
  'white beans, cooked',
  '{"de":"Weiße Bohnen, gekocht","en":"White beans, cooked","es":"Alubias blancas, cocidas"}'::jsonb,
  ARRAY['alubias blancas', 'habichuelas', 'weisse bohnen', 'weiße bohnen', 'white beans']::text[],
  139.0,
  9.73,
  0.35,
  25.09,
  'legume',
  'usda_sr28',
  '16050',
  'BEANS,WHITE,MATURE SEEDS,CKD,BLD,WO/SALT',
  '16050',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'edamame',
  'Edamame, cooked',
  'edamame, cooked',
  '{"de":"Edamame, gekocht","en":"Edamame, cooked","es":"Edamame, cocido"}'::jsonb,
  ARRAY['edamame', 'sojabohnen', 'soybeans']::text[],
  121.0,
  11.91,
  5.2,
  8.91,
  'legume',
  'usda_sr28',
  '11212',
  'EDAMAME,FRZ,PREP',
  '11212',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'almonds',
  'Almonds',
  'almonds',
  '{"de":"Mandeln","en":"Almonds","es":"Almendras"}'::jsonb,
  ARRAY['almendras', 'almonds', 'mandeln']::text[],
  579.0,
  21.15,
  49.93,
  21.55,
  'nut',
  'usda_sr28',
  '12061',
  'ALMONDS',
  '12061',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'walnuts',
  'Walnuts',
  'walnuts',
  '{"de":"Walnüsse","en":"Walnuts","es":"Nueces"}'::jsonb,
  ARRAY['nueces', 'walnuesse', 'walnuts', 'walnüsse']::text[],
  654.0,
  15.23,
  65.21,
  13.71,
  'nut',
  'usda_sr28',
  '12155',
  'WALNUTS,ENGLISH',
  '12155',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cashew_nuts',
  'Cashew nuts',
  'cashew nuts',
  '{"de":"Cashewkerne","en":"Cashew nuts","es":"Anacardos"}'::jsonb,
  ARRAY['anacardos', 'cashew', 'cashew nuts', 'cashewkerne', 'cashews', 'marañón']::text[],
  553.0,
  18.22,
  43.85,
  30.19,
  'nut',
  'usda_sr28',
  '12087',
  'NUTS,CASHEW NUTS,RAW',
  '12087',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pistachios',
  'Pistachios',
  'pistachios',
  '{"de":"Pistazien","en":"Pistachios","es":"Pistachos"}'::jsonb,
  ARRAY['pistachios', 'pistachos', 'pistazien']::text[],
  560.0,
  20.16,
  45.32,
  27.17,
  'nut',
  'usda_sr28',
  '12151',
  'PISTACHIO NUTS,RAW',
  '12151',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'peanuts',
  'Peanuts',
  'peanuts',
  '{"de":"Erdnüsse","en":"Peanuts","es":"Cacahuetes"}'::jsonb,
  ARRAY['cacahuetes', 'erdnuesse', 'erdnüsse', 'mani', 'maní', 'peanuts']::text[],
  567.0,
  25.8,
  49.24,
  16.13,
  'nut',
  'usda_sr28',
  '16087',
  'PEANUTS,ALL TYPES,RAW',
  '16087',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'peanut_butter',
  'Peanut butter',
  'peanut butter',
  '{"de":"Erdnussbutter","en":"Peanut butter","es":"Mantequilla de cacahuete"}'::jsonb,
  ARRAY['crema de mani', 'erdnussbutter', 'mantequilla de cacahuete', 'peanut butter']::text[],
  598.0,
  22.21,
  51.36,
  22.31,
  'nut',
  'usda_sr28',
  '16098',
  'PEANUT BUTTER,SMOOTH STYLE,W/ SALT',
  '16098',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sunflower_seeds',
  'Sunflower seeds',
  'sunflower seeds',
  '{"de":"Sonnenblumenkerne","en":"Sunflower seeds","es":"Semillas de girasol"}'::jsonb,
  ARRAY['pipas', 'semillas de girasol', 'sonnenblumenkerne', 'sunflower seeds']::text[],
  584.0,
  20.78,
  51.46,
  20.0,
  'seed',
  'usda_sr28',
  '12036',
  'SUNFLOWER SD KRNLS,DRIED',
  '12036',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'chia_seeds',
  'Chia seeds',
  'chia seeds',
  '{"de":"Chiasamen","en":"Chia seeds","es":"Semillas de chía"}'::jsonb,
  ARRAY['chia', 'chia seeds', 'chiasamen', 'semillas de chia', 'semillas de chía']::text[],
  486.0,
  16.54,
  30.74,
  42.12,
  'seed',
  'usda_sr28',
  '12006',
  'CHIA SEEDS,DRIED',
  '12006',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'olive_oil',
  'Olive oil',
  'olive oil',
  '{"de":"Olivenöl","en":"Olive oil","es":"Aceite de oliva"}'::jsonb,
  ARRAY['aceite', 'aceite de oliva', 'oel', 'oil', 'olive oil', 'olivenoel', 'olivenöl', 'öl']::text[],
  884.0,
  0.0,
  100.0,
  0.0,
  'fat',
  'usda_sr28',
  '04053',
  'OIL,OLIVE,SALAD OR COOKING',
  '04053',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sunflower_oil',
  'Sunflower oil',
  'sunflower oil',
  '{"de":"Sonnenblumenöl","en":"Sunflower oil","es":"Aceite de girasol"}'::jsonb,
  ARRAY['aceite de girasol', 'sonnenblumenoel', 'sonnenblumenöl', 'sunflower oil']::text[],
  884.0,
  0.0,
  100.0,
  0.0,
  'fat',
  'usda_sr28',
  '04060',
  'OIL,SUNFLOWER,LINOLEIC (LESS THAN 60%)',
  '04060',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mayonnaise',
  'Mayonnaise',
  'mayonnaise',
  '{"de":"Mayonnaise","en":"Mayonnaise","es":"Mayonesa"}'::jsonb,
  ARRAY['mayo', 'mayonesa', 'mayonnaise']::text[],
  680.0,
  0.96,
  74.85,
  0.57,
  'fat',
  'usda_sr28',
  '04025',
  'SALAD DRSNG,MAYO,REG',
  '04025',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'sugar',
  'Sugar',
  'sugar',
  '{"de":"Zucker","en":"Sugar","es":"Azúcar"}'::jsonb,
  ARRAY['azucar', 'azúcar', 'sugar', 'zucker']::text[],
  387.0,
  0.0,
  0.0,
  99.98,
  'other',
  'usda_sr28',
  '19335',
  'SUGARS,GRANULATED',
  '19335',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'honey',
  'Honey',
  'honey',
  '{"de":"Honig","en":"Honey","es":"Miel"}'::jsonb,
  ARRAY['honey', 'honig', 'miel']::text[],
  304.0,
  0.3,
  0.0,
  82.4,
  'other',
  'usda_sr28',
  '19296',
  'HONEY',
  '19296',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'maple_syrup',
  'Maple syrup',
  'maple syrup',
  '{"de":"Ahornsirup","en":"Maple syrup","es":"Sirope de arce"}'::jsonb,
  ARRAY['ahornsirup', 'jarabe de arce', 'maple syrup', 'sirope de arce']::text[],
  260.0,
  0.04,
  0.06,
  67.04,
  'other',
  'usda_sr28',
  '19353',
  'SYRUPS,MAPLE',
  '19353',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'jam',
  'Jam',
  'jam',
  '{"de":"Marmelade","en":"Jam","es":"Mermelada"}'::jsonb,
  ARRAY['jam', 'konfituere', 'konfitüre', 'marmelade', 'mermelada', 'preserves']::text[],
  278.0,
  0.37,
  0.07,
  68.86,
  'other',
  'usda_sr28',
  '19297',
  'JAMS AND PRESERVES',
  '19297',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'milk_chocolate',
  'Milk chocolate',
  'milk chocolate',
  '{"de":"Vollmilchschokolade","en":"Milk chocolate","es":"Chocolate con leche"}'::jsonb,
  ARRAY['chocolate', 'chocolate con leche', 'milk chocolate', 'schokolade', 'vollmilchschokolade']::text[],
  535.0,
  7.65,
  29.66,
  59.4,
  'other',
  'usda_sr28',
  '19120',
  'CANDIES,MILK CHOC',
  '19120',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'hummus',
  'Hummus',
  'hummus',
  '{"de":"Hummus","en":"Hummus","es":"Hummus"}'::jsonb,
  ARRAY['houmous', 'hummus']::text[],
  166.0,
  7.9,
  9.6,
  14.29,
  'other',
  'usda_sr28',
  '16158',
  'HUMMUS,COMMERCIAL',
  '16158',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'pizza',
  'Pizza, cheese',
  'pizza, cheese',
  '{"de":"Pizza (Käse)","en":"Pizza, cheese","es":"Pizza de queso"}'::jsonb,
  ARRAY['pizza', 'pizza (käse)', 'pizza de queso', 'pizza margherita']::text[],
  268.0,
  10.36,
  12.28,
  29.02,
  'other',
  'usda_sr28',
  '21224',
  'PIZZA,CHS TOPPING,REG CRUST,FRZ,CKD',
  '21224',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'orange_juice',
  'Orange juice',
  'orange juice',
  '{"de":"Orangensaft","en":"Orange juice","es":"Zumo de naranja"}'::jsonb,
  ARRAY['jugo de naranja', 'orange juice', 'orangensaft', 'zumo de naranja']::text[],
  45.0,
  0.7,
  0.2,
  10.4,
  'beverage',
  'usda_sr28',
  '09206',
  'ORANGE JUICE,RAW',
  '09206',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'beer',
  'Beer',
  'beer',
  '{"de":"Bier","en":"Beer","es":"Cerveza"}'::jsonb,
  ARRAY['beer', 'bier', 'cerveza']::text[],
  43.0,
  0.46,
  0.0,
  3.55,
  'beverage',
  'usda_sr28',
  '14003',
  'ALCOHOLIC BEV,BEER,REG,ALL',
  '14003',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'red_wine',
  'Red wine',
  'red wine',
  '{"de":"Rotwein","en":"Red wine","es":"Vino tinto"}'::jsonb,
  ARRAY['red wine', 'rotwein', 'vino', 'vino tinto', 'wein', 'wine']::text[],
  85.0,
  0.07,
  0.0,
  2.61,
  'beverage',
  'usda_sr28',
  '14096',
  'ALCOHOLIC BEV,WINE,TABLE,RED',
  '14096',
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'quark',
  'Quark, low-fat',
  'quark, low-fat',
  '{"de":"Magerquark","en":"Quark, low-fat","es":"Quark desnatado"}'::jsonb,
  ARRAY['magerquark', 'quark', 'quark desnatado', 'speisequark', 'topfen']::text[],
  66.0,
  11.85,
  0.18,
  3.68,
  'dairy',
  'bls_4_0',
  'M713100',
  'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'quark_20_fat',
  'Quark (20% fat)',
  'quark (20% fat)',
  '{"de":"Quark (20 % Fett)","en":"Quark (20% fat)","es":"Quark semigraso"}'::jsonb,
  ARRAY['halbfettquark', 'quark (20 % fett)', 'quark (20% fat)', 'quark 20', 'quark semigraso', 'speisequark']::text[],
  110.0,
  12.24,
  5.1,
  3.04,
  'dairy',
  'bls_4_0',
  'M713300',
  'Speisequark Halbfettstufe, 20 % Fett i. Tr.',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'emmental_cheese',
  'Emmental cheese',
  'emmental cheese',
  '{"de":"Emmentaler","en":"Emmental cheese","es":"Queso emmental"}'::jsonb,
  ARRAY['cheese', 'emmental', 'emmental cheese', 'emmentaler', 'kaese', 'käse', 'queso', 'queso emmental']::text[],
  374.0,
  27.5,
  29.15,
  0.0,
  'dairy',
  'bls_4_0',
  'M304600',
  'Emmentaler mind. 45 % Fett i. Tr.',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'camembert_cheese',
  'Camembert cheese',
  'camembert cheese',
  '{"de":"Camembert","en":"Camembert cheese","es":"Queso camembert"}'::jsonb,
  ARRAY['camembert', 'camembert cheese', 'cheese', 'kaese', 'käse', 'queso', 'queso camembert']::text[],
  257.0,
  19.58,
  19.82,
  0.05,
  'dairy',
  'bls_4_0',
  'M602600',
  'Camembert mind. 45 % Fett i. Tr.',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'butterk_se_cheese',
  'Butterkäse cheese',
  'butterkäse cheese',
  '{"de":"Butterkäse","en":"Butterkäse cheese","es":"Queso butterkäse"}'::jsonb,
  ARRAY['butterkaese', 'butterkäse', 'butterkäse cheese', 'queso butterkäse']::text[],
  310.0,
  23.61,
  23.5,
  0.1,
  'dairy',
  'bls_4_0',
  'M501600',
  'Butterkäse mind. 45 % Fett i. Tr.',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'fruit_yogurt',
  'Fruit yogurt',
  'fruit yogurt',
  '{"de":"Fruchtjoghurt","en":"Fruit yogurt","es":"Yogur de frutas"}'::jsonb,
  ARRAY['fruchtjoghurt', 'fruit yogurt', 'joghurt', 'yogur de frutas']::text[],
  96.0,
  3.01,
  2.96,
  13.0,
  'dairy',
  'bls_4_0',
  'M241300',
  'Joghurt mild, max. 3,8 % Fett, mit Fruchtzubereitung, gesüßt',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'rye_bread',
  'Rye bread',
  'rye bread',
  '{"de":"Roggenbrot","en":"Rye bread","es":"Pan de centeno"}'::jsonb,
  ARRAY['brot', 'pan de centeno', 'roggenbrot', 'rye bread']::text[],
  220.0,
  6.0,
  1.24,
  43.04,
  'grain',
  'bls_4_0',
  'B221000',
  'Roggenbrot',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'wheat_rye_bread',
  'Wheat-rye bread',
  'wheat-rye bread',
  '{"de":"Mischbrot","en":"Wheat-rye bread","es":"Pan mixto"}'::jsonb,
  ARRAY['brot', 'graubrot', 'mischbrot', 'pan mixto', 'weizenmischbrot', 'wheat-rye bread']::text[],
  207.0,
  8.61,
  1.51,
  37.33,
  'grain',
  'bls_4_0',
  'B251000',
  'Weizenmischbrot',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'bread_roll',
  'Bread roll',
  'bread roll',
  '{"de":"Brötchen","en":"Bread roll","es":"Panecillo"}'::jsonb,
  ARRAY['bollo', 'bread roll', 'broetchen', 'brötchen', 'panecillo', 'roll', 'semmel']::text[],
  280.0,
  10.09,
  1.81,
  53.97,
  'grain',
  'bls_4_0',
  'B511000',
  'Weizenbrötchen',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'croissant',
  'Croissant',
  'croissant',
  '{"de":"Croissant","en":"Croissant","es":"Cruasán"}'::jsonb,
  ARRAY['croissant', 'cruasan', 'cruasán', 'hoernchen', 'hörnchen']::text[],
  426.0,
  8.0,
  23.57,
  44.0,
  'grain',
  'bls_4_0',
  'D771600',
  'Croissant (Hefeblätterteig/Plunderteig)',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'rice_cakes',
  'Rice cakes',
  'rice cakes',
  '{"de":"Reiswaffeln","en":"Rice cakes","es":"Tortitas de arroz"}'::jsonb,
  ARRAY['reiswaffeln', 'rice cakes', 'tortitas de arroz']::text[],
  371.0,
  8.0,
  2.42,
  77.47,
  'grain',
  'bls_4_0',
  'C532700',
  'Reiswaffeln ungesalzen',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'muesli_with_dried_fruit',
  'Muesli with dried fruit',
  'muesli with dried fruit',
  '{"de":"Müsli mit Trockenfrüchten","en":"Muesli with dried fruit","es":"Muesli con fruta seca"}'::jsonb,
  ARRAY['granola', 'muesli', 'muesli con fruta seca', 'muesli with dried fruit', 'müsli', 'müsli mit trockenfrüchten']::text[],
  327.0,
  9.0,
  4.9,
  55.9,
  'grain',
  'bls_4_0',
  'C512300',
  'Müslimischung mit Trockenfrüchten, ungesüßt',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cornflakes',
  'Cornflakes, unsweetened',
  'cornflakes, unsweetened',
  '{"de":"Cornflakes, ungesüßt","en":"Cornflakes, unsweetened","es":"Copos de maíz"}'::jsonb,
  ARRAY['copos de maiz', 'copos de maíz', 'cornflakes']::text[],
  376.0,
  7.18,
  0.84,
  82.96,
  'grain',
  'bls_4_0',
  'C515400',
  'Cornflakes ungesüßt',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'french_fries',
  'French fries',
  'french fries',
  '{"de":"Pommes frites","en":"French fries","es":"Patatas fritas"}'::jsonb,
  ARRAY['french fries', 'fries', 'fritten', 'papas fritas', 'patatas fritas', 'pommes', 'pommes frites']::text[],
  203.0,
  2.9,
  9.04,
  25.94,
  'vegetable',
  'bls_4_0',
  'K130492',
  'Pommes frites tiefgefroren, frittiert',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'mashed_potato',
  'Mashed potato',
  'mashed potato',
  '{"de":"Kartoffelpüree","en":"Mashed potato","es":"Puré de patata"}'::jsonb,
  ARRAY['kartoffelbrei', 'kartoffelpueree', 'kartoffelpüree', 'mashed potato', 'pure de patata', 'puré de patata']::text[],
  88.0,
  2.35,
  2.98,
  12.43,
  'vegetable',
  'bls_4_0',
  'X634012',
  'Kartoffelpüree mit Milch 3,5 % Fett',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'salami',
  'Salami',
  'salami',
  '{"de":"Salami","en":"Salami","es":"Salami"}'::jsonb,
  ARRAY['salami', 'salchichon', 'salchichón']::text[],
  374.0,
  23.54,
  30.9,
  0.0,
  'protein',
  'bls_4_0',
  'W140000',
  'Salami',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'liver_sausage',
  'Liver sausage',
  'liver sausage',
  '{"de":"Leberwurst","en":"Liver sausage","es":"Paté de hígado"}'::jsonb,
  ARRAY['leberwurst', 'liver sausage', 'pate de higado', 'paté de hígado']::text[],
  236.0,
  17.59,
  18.08,
  0.62,
  'protein',
  'bls_4_0',
  'W327000',
  'Leberwurst einfach',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'vienna_sausage',
  'Vienna sausage',
  'vienna sausage',
  '{"de":"Wiener Würstchen","en":"Vienna sausage","es":"Salchicha de Viena"}'::jsonb,
  ARRAY['salchicha', 'salchicha de viena', 'vienna sausage', 'wiener', 'wiener würstchen', 'wuerstchen', 'würstchen']::text[],
  289.0,
  12.9,
  26.15,
  0.0,
  'protein',
  'bls_4_0',
  'W211200',
  'Wiener Würstchen',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'bockwurst',
  'Bockwurst',
  'bockwurst',
  '{"de":"Bockwurst","en":"Bockwurst","es":"Bockwurst"}'::jsonb,
  ARRAY['bockwurst']::text[],
  273.0,
  13.1,
  24.5,
  0.0,
  'protein',
  'bls_4_0',
  'W211100',
  'Bockwurst',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'bratwurst',
  'Bratwurst',
  'bratwurst',
  '{"de":"Bratwurst","en":"Bratwurst","es":"Salchicha para freír"}'::jsonb,
  ARRAY['bratwurst', 'salchicha para freir', 'salchicha para freír']::text[],
  292.0,
  15.2,
  25.6,
  0.08,
  'protein',
  'bls_4_0',
  'W222100',
  'Bratwurst mittelgrob',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'beef_meatballs',
  'Beef meatballs',
  'beef meatballs',
  '{"de":"Frikadelle (Rind)","en":"Beef meatballs","es":"Albóndigas de ternera"}'::jsonb,
  ARRAY['albondigas', 'albóndigas', 'albóndigas de ternera', 'beef meatballs', 'bulette', 'frikadelle', 'frikadelle (rind)', 'frikadellen', 'meatballs']::text[],
  299.0,
  21.24,
  21.05,
  5.98,
  'protein',
  'bls_4_0',
  'Y036610',
  'Frikadellen aus Rindfleisch gebraten',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'peach',
  'Peach',
  'peach',
  '{"de":"Pfirsich","en":"Peach","es":"Melocotón"}'::jsonb,
  ARRAY['durazno', 'melocoton', 'melocotón', 'peach', 'pfirsich']::text[],
  39.0,
  0.7,
  0.11,
  8.02,
  'fruit',
  'bls_4_0',
  'F203100',
  'Pfirsich roh',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'green_olives',
  'Green olives',
  'green olives',
  '{"de":"Grüne Oliven","en":"Green olives","es":"Aceitunas verdes"}'::jsonb,
  ARRAY['aceitunas', 'aceitunas verdes', 'green olives', 'grüne oliven', 'oliven', 'olives']::text[],
  132.0,
  1.21,
  13.55,
  0.0,
  'vegetable',
  'bls_4_0',
  'H510802',
  'Oliven grün, gesäuert, abgetropft',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'black_olives',
  'Black olives',
  'black olives',
  '{"de":"Schwarze Oliven","en":"Black olives","es":"Aceitunas negras"}'::jsonb,
  ARRAY['aceitunas negras', 'black olives', 'oliven schwarz', 'schwarze oliven']::text[],
  140.0,
  0.84,
  14.84,
  0.0,
  'vegetable',
  'bls_4_0',
  'H520800',
  'Oliven geschwärzt, in Salzlake, abgetropft',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'coconut_oil',
  'Coconut oil',
  'coconut oil',
  '{"de":"Kokosöl","en":"Coconut oil","es":"Aceite de coco"}'::jsonb,
  ARRAY['aceite de coco', 'coconut oil', 'kokosfett', 'kokosoel', 'kokosöl']::text[],
  900.0,
  0.0,
  100.0,
  0.0,
  'fat',
  'bls_4_0',
  'Q550000',
  'Kokosöl',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'dark_chocolate',
  'Dark chocolate',
  'dark chocolate',
  '{"de":"Zartbitterschokolade","en":"Dark chocolate","es":"Chocolate negro"}'::jsonb,
  ARRAY['bitterschokolade', 'chocolate negro', 'dark chocolate', 'schokolade', 'zartbitterschokolade']::text[],
  563.0,
  9.1,
  41.33,
  33.7,
  'other',
  'bls_4_0',
  'S570000',
  'Bitterschokolade',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'nut_nougat_spread',
  'Nut nougat spread',
  'nut nougat spread',
  '{"de":"Nuss-Nougat-Creme","en":"Nut nougat spread","es":"Crema de avellanas y cacao"}'::jsonb,
  ARRAY['crema de avellanas', 'crema de avellanas y cacao', 'hazelnut spread', 'nuss nougat creme', 'nuss-nougat-creme', 'nussnougatcreme', 'nut nougat spread']::text[],
  530.0,
  6.9,
  30.55,
  54.75,
  'other',
  'bls_4_0',
  'S145000',
  'Nuss-Nougat-Creme',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'muesli_bar',
  'Muesli bar',
  'muesli bar',
  '{"de":"Müsliriegel","en":"Muesli bar","es":"Barrita de muesli"}'::jsonb,
  ARRAY['barrita de muesli', 'granola bar', 'muesli bar', 'muesliriegel', 'müsliriegel']::text[],
  428.0,
  8.4,
  15.4,
  58.5,
  'other',
  'bls_4_0',
  'S830000',
  'Müsli-Riegel',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'cola_drink',
  'Cola drink',
  'cola drink',
  '{"de":"Cola","en":"Cola drink","es":"Refresco de cola"}'::jsonb,
  ARRAY['coke', 'cola', 'cola drink', 'colagetraenk', 'colagetränk', 'refresco de cola']::text[],
  41.0,
  0.0,
  0.0,
  10.3,
  'beverage',
  'bls_4_0',
  'N330000',
  'Colagetränk koffeinhaltig',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'apple_juice',
  'Apple juice',
  'apple juice',
  '{"de":"Apfelsaft","en":"Apple juice","es":"Zumo de manzana"}'::jsonb,
  ARRAY['apfelsaft', 'apple juice', 'jugo de manzana', 'zumo de manzana']::text[],
  44.0,
  0.1,
  0.0,
  10.59,
  'beverage',
  'bls_4_0',
  'F110600',
  'Apfelsaft',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'coffee',
  'Coffee, black',
  'coffee, black',
  '{"de":"Kaffee, schwarz","en":"Coffee, black","es":"Café solo"}'::jsonb,
  ARRAY['cafe', 'café', 'café solo', 'coffee', 'kaffee']::text[],
  1.0,
  0.12,
  0.0,
  0.0,
  'beverage',
  'bls_4_0',
  'N410100',
  'Kaffee (Getränk)',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'doner_kebab',
  'Doner kebab',
  'doner kebab',
  '{"de":"Döner Kebab","en":"Doner kebab","es":"Döner kebab"}'::jsonb,
  ARRAY['doener', 'doner', 'doner kebab', 'döner', 'döner kebab', 'kebab']::text[],
  177.0,
  11.2,
  5.3,
  20.0,
  'other',
  'bls_4_0',
  'Y921062',
  'Döner Kebab, Fladenbrot gefüllt mit Grillfleisch (Kalb/Rind), Rohkost und Sauce',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'currywurst',
  'Currywurst',
  'currywurst',
  '{"de":"Currywurst","en":"Currywurst","es":"Currywurst"}'::jsonb,
  ARRAY['curry wurst', 'currywurst']::text[],
  202.0,
  8.77,
  14.66,
  8.16,
  'other',
  'bls_4_0',
  'Y943032',
  'Currywurst mit Curryketchup',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

INSERT INTO public.foods (slug, name, name_normalized, names, search_terms, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category, source, source_ref, source_desc, usda_ndb, is_verified, created_by)
VALUES (
  'potato_salad',
  'Potato salad',
  'potato salad',
  '{"de":"Kartoffelsalat","en":"Potato salad","es":"Ensaladilla de patata"}'::jsonb,
  ARRAY['ensaladilla de patata', 'kartoffelsalat', 'potato salad']::text[],
  83.0,
  1.52,
  3.0,
  11.42,
  'other',
  'bls_4_0',
  'X1A2010',
  'Kartoffelsalat mit Marinade (Gemüsebrühe)',
  NULL,
  true,
  null
)
ON CONFLICT (slug) WHERE created_by IS NULL AND slug IS NOT NULL
DO UPDATE SET
  name = EXCLUDED.name,
  name_normalized = EXCLUDED.name_normalized,
  names = EXCLUDED.names,
  search_terms = EXCLUDED.search_terms,
  kcal_per_100g = EXCLUDED.kcal_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  category = EXCLUDED.category,
  source = EXCLUDED.source,
  source_ref = EXCLUDED.source_ref,
  source_desc = EXCLUDED.source_desc,
  usda_ndb = EXCLUDED.usda_ndb,
  is_verified = EXCLUDED.is_verified,
  created_by = EXCLUDED.created_by;

NOTIFY pgrst, 'reload schema';
