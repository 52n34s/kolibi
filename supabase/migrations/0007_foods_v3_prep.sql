-- Run manually in Supabase SQL Editor BEFORE 0008_seed_foods_v3.sql
-- Prep for foods v3: slug + source_ref/source_desc, then unique index on curated slugs.
-- Order is intentional: add slug -> backfill from JSON via usda_ndb -> unique index.

-- 1) Columns
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS source_desc text;

-- 2) Backfill slug (+ source_ref/source_desc) for existing curated USDA rows
--    Match over usda_ndb. Values taken verbatim from kolibi_foods_seed_v3.json.

UPDATE public.foods
SET slug = 'white_rice',
    source_ref = '20045',
    source_desc = 'RICE,WHITE,LONG-GRAIN,REG,ENR,CKD'
WHERE usda_ndb = '20045'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'brown_rice',
    source_ref = '20037',
    source_desc = 'RICE,BROWN,LONG-GRAIN,CKD'
WHERE usda_ndb = '20037'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pasta',
    source_ref = '20121',
    source_desc = 'PASTA,CKD,ENR,WO/ ADDED SALT'
WHERE usda_ndb = '20121'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'couscous',
    source_ref = '20029',
    source_desc = 'COUSCOUS,COOKED'
WHERE usda_ndb = '20029'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'quinoa',
    source_ref = '20137',
    source_desc = 'QUINOA,CKD'
WHERE usda_ndb = '20137'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'bulgur',
    source_ref = '20013',
    source_desc = 'BULGUR,COOKED'
WHERE usda_ndb = '20013'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'millet',
    source_ref = '20032',
    source_desc = 'MILLET,COOKED'
WHERE usda_ndb = '20032'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'rice_noodles',
    source_ref = '20134',
    source_desc = 'RICE NOODLES,CKD'
WHERE usda_ndb = '20134'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'egg_noodles',
    source_ref = '20310',
    source_desc = 'NOODLES,EGG,CKD,ENR,W/ SALT'
WHERE usda_ndb = '20310'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cornmeal',
    source_ref = '20022',
    source_desc = 'CORNMEAL,DEGERMED,ENR,YEL'
WHERE usda_ndb = '20022'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'whole_wheat_bread',
    source_ref = '18075',
    source_desc = 'BREAD,WHOLE-WHEAT,COMM. PREPARED'
WHERE usda_ndb = '18075'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'white_bread',
    source_ref = '18069',
    source_desc = 'BREAD,WHITE,COMMLY PREP (INCL SOFT BREAD CRUMBS)'
WHERE usda_ndb = '18069'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'bagel',
    source_ref = '18406',
    source_desc = 'BAGELS,PLN,ENR,WO/CA PROP (INCL ONION,POPPY,SESAME)'
WHERE usda_ndb = '18406'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'corn_tortilla',
    source_ref = '18363',
    source_desc = 'TORTILLAS,RTB OR -FRY,CORN'
WHERE usda_ndb = '18363'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'oats',
    source_ref = '08120',
    source_desc = 'CEREALS,OATS,REG & QUICK,NOT FORT,DRY'
WHERE usda_ndb = '08120'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'potato',
    source_ref = '11367',
    source_desc = 'POTATOES,BLD,CKD WO/ SKN,FLESH,WO/ SALT'
WHERE usda_ndb = '11367'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sweet_potato',
    source_ref = '11508',
    source_desc = 'SWEET POTATO,CKD,BKD IN SKN,FLESH,WO/ SALT'
WHERE usda_ndb = '11508'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sweet_corn',
    source_ref = '11168',
    source_desc = 'CORN,SWT,YEL,CKD,BLD,DRND,WO/SALT'
WHERE usda_ndb = '11168'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'chicken_breast',
    source_ref = '05064',
    source_desc = 'CHICKEN,BROILERS OR FRYERS,BREAST,MEAT ONLY,CKD,RSTD'
WHERE usda_ndb = '05064'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'chicken_thigh',
    source_ref = '05098',
    source_desc = 'CHICKEN,BROILERS OR FRYERS,THIGH,MEAT ONLY,CKD,RSTD'
WHERE usda_ndb = '05098'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'turkey_breast',
    source_ref = '05220',
    source_desc = 'TURKEY,BREAST,FROM WHL BIRD,MEAT ONLY,RSTD'
WHERE usda_ndb = '05220'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'egg',
    source_ref = '01123',
    source_desc = 'EGG,WHL,RAW,FRSH'
WHERE usda_ndb = '01123'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'salmon',
    source_ref = '15237',
    source_desc = 'SALMON,ATLANTIC,FARMED,CKD,DRY HEAT'
WHERE usda_ndb = '15237'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'tuna',
    source_ref = '15121',
    source_desc = 'FISH,TUNA,LT,CND IN H2O,DRND SOL'
WHERE usda_ndb = '15121'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cod',
    source_ref = '15016',
    source_desc = 'COD,ATLANTIC,CKD,DRY HEAT'
WHERE usda_ndb = '15016'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'tilapia',
    source_ref = '15262',
    source_desc = 'FISH,TILAPIA,CKD,DRY HEAT'
WHERE usda_ndb = '15262'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mackerel',
    source_ref = '15047',
    source_desc = 'MACKEREL,ATLANTIC,CKD,DRY HEAT'
WHERE usda_ndb = '15047'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sardines',
    source_ref = '15088',
    source_desc = 'SARDINE,ATLANTIC,CND IN OIL,DRND SOL W/BONE'
WHERE usda_ndb = '15088'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'shrimp',
    source_ref = '15151',
    source_desc = 'CRUSTACEANS,SHRIMP,MXD SP,CKD,MST HT (MAYBE PREVIOUSLY FRZ)'
WHERE usda_ndb = '15151'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'ground_beef',
    source_ref = '23563',
    source_desc = 'BEEF,GROUND,90% LN MEAT / 10% FAT,PATTY,CKD,BRLD'
WHERE usda_ndb = '23563'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'rib_eye_steak',
    source_ref = '23100',
    source_desc = 'BEEF,RIB EYE STK,BNLES,LIP-ON,LN,1/8" FAT,ALL GRDS,CKD,GRLD'
WHERE usda_ndb = '23100'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pork_loin',
    source_ref = '10027',
    source_desc = 'PORK,FRSH,LOIN,WHL,LN,CKD,RSTD'
WHERE usda_ndb = '10027'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'ham',
    source_ref = '10136',
    source_desc = 'PORK,CURED,HAM,BNLESS,REG (APPROX 11% FAT),RSTD'
WHERE usda_ndb = '10136'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'lamb_loin',
    source_ref = '17027',
    source_desc = 'LAMB,DOM,LOIN,LN,1/4"FAT,CHOIC,CKD,BRLD'
WHERE usda_ndb = '17027'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'tofu',
    source_ref = '16426',
    source_desc = 'TOFU,RAW,FIRM,PREP W/CA SULFATE'
WHERE usda_ndb = '16426'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'tempeh',
    source_ref = '16114',
    source_desc = 'TEMPEH'
WHERE usda_ndb = '16114'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'whole_milk_3_25',
    source_ref = '01077',
    source_desc = 'MILK,WHL,3.25% MILKFAT,W/ ADDED VITAMIN D'
WHERE usda_ndb = '01077'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'reduced_fat_milk_2',
    source_ref = '01079',
    source_desc = 'MILK,RED FAT,FLUID,2% MILKFAT,W/ ADDED VIT A & VITAMIN D'
WHERE usda_ndb = '01079'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'skim_milk',
    source_ref = '01151',
    source_desc = 'MILK,NONFAT,FLUID,WO/ ADDED VIT A & VIT D (FAT FREE OR SKIM)'
WHERE usda_ndb = '01151'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'greek_yogurt',
    source_ref = '01256',
    source_desc = 'YOGURT,GREEK,PLN,NONFAT'
WHERE usda_ndb = '01256'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'plain_yogurt',
    source_ref = '01116',
    source_desc = 'YOGURT,PLN,WHL MILK,8 GRAMS PROT PER 8 OZ'
WHERE usda_ndb = '01116'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cottage_cheese_2',
    source_ref = '01015',
    source_desc = 'CHEESE,COTTAGE,LOWFAT,2% MILKFAT'
WHERE usda_ndb = '01015'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cheddar_cheese',
    source_ref = '01009',
    source_desc = 'CHEESE,CHEDDAR'
WHERE usda_ndb = '01009'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'gouda_cheese',
    source_ref = '01022',
    source_desc = 'CHEESE,GOUDA'
WHERE usda_ndb = '01022'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mozzarella',
    source_ref = '01026',
    source_desc = 'CHEESE,MOZZARELLA,WHL MILK'
WHERE usda_ndb = '01026'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mozzarella',
    source_ref = '01028',
    source_desc = 'CHEESE,MOZZARELLA,PART SKIM MILK'
WHERE usda_ndb = '01028'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'parmesan_cheese',
    source_ref = '01033',
    source_desc = 'CHEESE,PARMESAN,HARD'
WHERE usda_ndb = '01033'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'feta_cheese',
    source_ref = '01019',
    source_desc = 'CHEESE,FETA'
WHERE usda_ndb = '01019'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cream_cheese',
    source_ref = '01017',
    source_desc = 'CHEESE,CREAM'
WHERE usda_ndb = '01017'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'heavy_whipping_cream',
    source_ref = '01053',
    source_desc = 'CREAM,FLUID,HVY WHIPPING'
WHERE usda_ndb = '01053'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sour_cream',
    source_ref = '01056',
    source_desc = 'CREAM,SOUR,CULTURED'
WHERE usda_ndb = '01056'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'butter',
    source_ref = '01001',
    source_desc = 'BUTTER,WITH SALT'
WHERE usda_ndb = '01001'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'apple',
    source_ref = '09003',
    source_desc = 'APPLES,RAW,WITH SKIN'
WHERE usda_ndb = '09003'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'banana',
    source_ref = '09040',
    source_desc = 'BANANAS,RAW'
WHERE usda_ndb = '09040'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'orange',
    source_ref = '09200',
    source_desc = 'ORANGES,RAW,ALL COMM VAR'
WHERE usda_ndb = '09200'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'strawberries',
    source_ref = '09316',
    source_desc = 'STRAWBERRIES,RAW'
WHERE usda_ndb = '09316'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'raspberries',
    source_ref = '09302',
    source_desc = 'RASPBERRIES,RAW'
WHERE usda_ndb = '09302'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'blueberries',
    source_ref = '09050',
    source_desc = 'BLUEBERRIES,RAW'
WHERE usda_ndb = '09050'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'grapes',
    source_ref = '09131',
    source_desc = 'GRAPES,AMERICAN TYPE (SLIP SKN),RAW'
WHERE usda_ndb = '09131'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'avocado',
    source_ref = '09037',
    source_desc = 'AVOCADOS,RAW,ALL COMM VAR'
WHERE usda_ndb = '09037'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mango',
    source_ref = '09176',
    source_desc = 'MANGOS,RAW'
WHERE usda_ndb = '09176'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pineapple',
    source_ref = '09266',
    source_desc = 'PINEAPPLE,RAW,ALL VAR'
WHERE usda_ndb = '09266'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'watermelon',
    source_ref = '09326',
    source_desc = 'WATERMELON,RAW'
WHERE usda_ndb = '09326'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cantaloupe_melon',
    source_ref = '09181',
    source_desc = 'MELONS,CANTALOUPE,RAW'
WHERE usda_ndb = '09181'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pear',
    source_ref = '09252',
    source_desc = 'PEARS,RAW'
WHERE usda_ndb = '09252'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'plum',
    source_ref = '09279',
    source_desc = 'PLUMS,RAW'
WHERE usda_ndb = '09279'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cherries',
    source_ref = '09070',
    source_desc = 'CHERRIES,SWEET,RAW'
WHERE usda_ndb = '09070'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'kiwifruit',
    source_ref = '09148',
    source_desc = 'KIWIFRUIT,GRN,RAW'
WHERE usda_ndb = '09148'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'lemon',
    source_ref = '09150',
    source_desc = 'LEMONS,RAW,WITHOUT PEEL'
WHERE usda_ndb = '09150'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'grapefruit',
    source_ref = '09111',
    source_desc = 'GRAPEFRUIT,RAW,PINK&RED&WHITE,ALL AREAS'
WHERE usda_ndb = '09111'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'dates_medjool',
    source_ref = '09421',
    source_desc = 'DATES,MEDJOOL'
WHERE usda_ndb = '09421'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'raisins',
    source_ref = '09298',
    source_desc = 'RAISINS,SEEDLESS'
WHERE usda_ndb = '09298'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'tomato',
    source_ref = '11529',
    source_desc = 'TOMATOES,RED,RIPE,RAW,YEAR RND AVERAGE'
WHERE usda_ndb = '11529'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cucumber',
    source_ref = '11205',
    source_desc = 'CUCUMBER,WITH PEEL,RAW'
WHERE usda_ndb = '11205'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'carrot',
    source_ref = '11124',
    source_desc = 'CARROTS,RAW'
WHERE usda_ndb = '11124'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'broccoli',
    source_ref = '11090',
    source_desc = 'BROCCOLI,RAW'
WHERE usda_ndb = '11090'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cauliflower',
    source_ref = '11135',
    source_desc = 'CAULIFLOWER,RAW'
WHERE usda_ndb = '11135'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'spinach',
    source_ref = '11457',
    source_desc = 'SPINACH,RAW'
WHERE usda_ndb = '11457'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'kale',
    source_ref = '11233',
    source_desc = 'KALE,RAW'
WHERE usda_ndb = '11233'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cabbage',
    source_ref = '11109',
    source_desc = 'CABBAGE,RAW'
WHERE usda_ndb = '11109'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'onion',
    source_ref = '11282',
    source_desc = 'ONIONS,RAW'
WHERE usda_ndb = '11282'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'spring_onion',
    source_ref = '11291',
    source_desc = 'ONIONS,SPRING OR SCALLIONS (INCL TOPS&BULB),RAW'
WHERE usda_ndb = '11291'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'garlic',
    source_ref = '11215',
    source_desc = 'GARLIC,RAW'
WHERE usda_ndb = '11215'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'red_bell_pepper',
    source_ref = '11821',
    source_desc = 'PEPPERS,SWT,RED,RAW'
WHERE usda_ndb = '11821'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'green_bell_pepper',
    source_ref = '11333',
    source_desc = 'PEPPERS,SWT,GRN,RAW'
WHERE usda_ndb = '11333'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'iceberg_lettuce',
    source_ref = '11252',
    source_desc = 'LETTUCE,ICEBERG (INCL CRISPHEAD TYPES),RAW'
WHERE usda_ndb = '11252'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'zucchini',
    source_ref = '11477',
    source_desc = 'SQUASH,SMMR,ZUCCHINI,INCL SKN,RAW'
WHERE usda_ndb = '11477'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'eggplant',
    source_ref = '11209',
    source_desc = 'EGGPLANT,RAW'
WHERE usda_ndb = '11209'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mushrooms',
    source_ref = '11260',
    source_desc = 'MUSHROOMS,WHITE,RAW'
WHERE usda_ndb = '11260'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'green_beans',
    source_ref = '11053',
    source_desc = 'BEANS,SNAP,GRN,CKD,BLD,DRND,WO/SALT'
WHERE usda_ndb = '11053'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'green_peas',
    source_ref = '11305',
    source_desc = 'PEAS,GRN,CKD,BLD,DRND,WO/SALT'
WHERE usda_ndb = '11305'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'asparagus',
    source_ref = '11012',
    source_desc = 'ASPARAGUS,CKD,BLD,DRND'
WHERE usda_ndb = '11012'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'celery',
    source_ref = '11143',
    source_desc = 'CELERY,RAW'
WHERE usda_ndb = '11143'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'beetroot',
    source_ref = '11080',
    source_desc = 'BEETS,RAW'
WHERE usda_ndb = '11080'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pumpkin',
    source_ref = '11422',
    source_desc = 'PUMPKIN,RAW'
WHERE usda_ndb = '11422'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'lentils',
    source_ref = '16070',
    source_desc = 'LENTILS,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16070'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'chickpeas',
    source_ref = '16057',
    source_desc = 'CHICKPEAS ,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16057'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'kidney_beans',
    source_ref = '16033',
    source_desc = 'BEANS,KIDNEY,RED,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16033'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'black_beans',
    source_ref = '16015',
    source_desc = 'BEANS,BLACK,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16015'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pinto_beans',
    source_ref = '16043',
    source_desc = 'BEANS,PINTO,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16043'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'white_beans',
    source_ref = '16050',
    source_desc = 'BEANS,WHITE,MATURE SEEDS,CKD,BLD,WO/SALT'
WHERE usda_ndb = '16050'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'edamame',
    source_ref = '11212',
    source_desc = 'EDAMAME,FRZ,PREP'
WHERE usda_ndb = '11212'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'almonds',
    source_ref = '12061',
    source_desc = 'ALMONDS'
WHERE usda_ndb = '12061'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'walnuts',
    source_ref = '12155',
    source_desc = 'WALNUTS,ENGLISH'
WHERE usda_ndb = '12155'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'cashew_nuts',
    source_ref = '12087',
    source_desc = 'NUTS,CASHEW NUTS,RAW'
WHERE usda_ndb = '12087'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pistachios',
    source_ref = '12151',
    source_desc = 'PISTACHIO NUTS,RAW'
WHERE usda_ndb = '12151'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'peanuts',
    source_ref = '16087',
    source_desc = 'PEANUTS,ALL TYPES,RAW'
WHERE usda_ndb = '16087'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'peanut_butter',
    source_ref = '16098',
    source_desc = 'PEANUT BUTTER,SMOOTH STYLE,W/ SALT'
WHERE usda_ndb = '16098'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sunflower_seeds',
    source_ref = '12036',
    source_desc = 'SUNFLOWER SD KRNLS,DRIED'
WHERE usda_ndb = '12036'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'chia_seeds',
    source_ref = '12006',
    source_desc = 'CHIA SEEDS,DRIED'
WHERE usda_ndb = '12006'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'olive_oil',
    source_ref = '04053',
    source_desc = 'OIL,OLIVE,SALAD OR COOKING'
WHERE usda_ndb = '04053'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sunflower_oil',
    source_ref = '04060',
    source_desc = 'OIL,SUNFLOWER,LINOLEIC (LESS THAN 60%)'
WHERE usda_ndb = '04060'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'mayonnaise',
    source_ref = '04025',
    source_desc = 'SALAD DRSNG,MAYO,REG'
WHERE usda_ndb = '04025'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'sugar',
    source_ref = '19335',
    source_desc = 'SUGARS,GRANULATED'
WHERE usda_ndb = '19335'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'honey',
    source_ref = '19296',
    source_desc = 'HONEY'
WHERE usda_ndb = '19296'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'maple_syrup',
    source_ref = '19353',
    source_desc = 'SYRUPS,MAPLE'
WHERE usda_ndb = '19353'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'jam',
    source_ref = '19297',
    source_desc = 'JAMS AND PRESERVES'
WHERE usda_ndb = '19297'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'milk_chocolate',
    source_ref = '19120',
    source_desc = 'CANDIES,MILK CHOC'
WHERE usda_ndb = '19120'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'hummus',
    source_ref = '16158',
    source_desc = 'HUMMUS,COMMERCIAL'
WHERE usda_ndb = '16158'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'pizza',
    source_ref = '21224',
    source_desc = 'PIZZA,CHS TOPPING,REG CRUST,FRZ,CKD'
WHERE usda_ndb = '21224'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'orange_juice',
    source_ref = '09206',
    source_desc = 'ORANGE JUICE,RAW'
WHERE usda_ndb = '09206'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'beer',
    source_ref = '14003',
    source_desc = 'ALCOHOLIC BEV,BEER,REG,ALL'
WHERE usda_ndb = '14003'
  AND created_by IS NULL;

UPDATE public.foods
SET slug = 'red_wine',
    source_ref = '14096',
    source_desc = 'ALCOHOLIC BEV,WINE,TABLE,RED'
WHERE usda_ndb = '14096'
  AND created_by IS NULL;

-- 3) Unique index for curated (created_by IS NULL) slugs — only after backfill
CREATE UNIQUE INDEX IF NOT EXISTS foods_slug_curated_unique
  ON public.foods (slug)
  WHERE created_by IS NULL AND slug IS NOT NULL;

NOTIFY pgrst, 'reload schema';

