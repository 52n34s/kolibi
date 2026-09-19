const UA = 'Kolibi/1.1.0 (steffen@52n34s.com)';

const BARCODES = [
  '4002971317909','4003840008690','4337256946599','41047231','4056489486671',
  '4335619214507','23095083','4056489962991','4260335835791','5061062527893',
  '8710448537069','7630294506273','4068134099433','4066447083958','4260654789119',
  '7630294503746','4056489412175','4335619280168','4066447704167','4014829743006',
  '4262354077602','4070765022827','4001686322659','42270379','4104420234109',
  '9002975378956','5060425286545','4002846034962','4260322213106','5411188128311',
  '4335619294578','4071800038810','4000281348521','20130596','5060594777226',
  '4335619096431','8711327578418','4335619130821','4000405005675','4337256698641',
  '4063367448546','4022192009810','9120097310569','7622300292522','4335619039797',
  '5060594777301','26577302','4335619130845','4335619185586','4066447731491',
];

const FIELDS = [
  'energy-kcal_100g','proteins_100g','fat_100g','saturated-fat_100g',
  'carbohydrates_100g','sugars_100g','salt_100g','fiber_100g',
  'calcium_100g','iron_100g','vitamin-b12_100g','vitamin-d_100g',
  'zinc_100g','magnesium_100g','potassium_100g','iodine_100g',
];

const counts: Record<string, number> = {};
let found = 0, notFound = 0;
const vegan = { labeled: 0, inferred: 0, unknown: 0, noIngredients: 0 };

for (const [i, code] of BARCODES.entries()) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`
    + `?fields=code,product_name,nutriments,labels_tags,ingredients_analysis_tags,ingredients_text`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const json = await res.json();
    if (json.status !== 1 || !json.product) {
      notFound++;
    } else {
      found++;
      const n = json.product.nutriments ?? {};
      for (const key of FIELDS) {
        if (typeof n[key] === 'number' && !Number.isNaN(n[key])) {
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
      const labels: string[] = json.product.labels_tags ?? [];
      const analysis: string[] = json.product.ingredients_analysis_tags ?? [];
      if (labels.some((t) => t.includes('vegan'))) vegan.labeled++;
      else if (analysis.includes('en:vegan') || analysis.includes('en:non-vegan')) vegan.inferred++;
      else if (!json.product.ingredients_text) vegan.noIngredients++;
      else vegan.unknown++;
    }
  } catch { notFound++; }
  process.stdout.write(`\r${i + 1}/${BARCODES.length}`);
  await new Promise((r) => setTimeout(r, 700));
}

console.log(`\n\n${found} gefunden, ${notFound} nicht gefunden (von ${BARCODES.length})\n`);
for (const key of FIELDS) {
  const c = counts[key] ?? 0;
  const pct = found ? Math.round((c / found) * 100) : 0;
  console.log(`${key.padEnd(22)} ${String(c).padStart(3)}/${found}  ${String(pct).padStart(3)}%`);
}
console.log(`\nVegan-Status:`);
console.log(`  Label auf Verpackung   ${vegan.labeled}`);
console.log(`  aus Zutaten berechnet  ${vegan.inferred}`);
console.log(`  Zutaten da, unklar     ${vegan.unknown}`);
console.log(`  keine Zutatenliste     ${vegan.noIngredients}`);
