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

let found = 0;
let withServing = 0;
let withCount = 0;
let withUnits = 0;

for (const code of BARCODES) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json`
    + `?fields=code,product_name,serving_size,number_of_units,product_quantity`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const json = await res.json();
    if (json.status !== 1 || !json.product) continue;
    found++;

    const p = json.product;
    const serving = (p.serving_size ?? '').trim();
    if (serving) withServing++;
    if (p.number_of_units != null) withUnits++;

    // Stückzahl im Text: "2 Kekse (25 g)", "1 Riegel", "3 Scheiben", "2 pieces"
    const countMatch = serving.match(
      /(\d+(?:[.,]\d+)?)\s*(kekse?|riegel|scheiben?|stück|st\.|portionen?|pieces?|slices?|bars?|cookies?|biscuits?|tablets?|units?)/i,
    );
    if (countMatch) withCount++;

    console.log(
      `${code.padEnd(15)} ${countMatch ? '✓' : ' '} ${(p.number_of_units ?? '').toString().padStart(3)}  ${serving || '—'}   ${(p.product_name ?? '').slice(0, 30)}`,
    );
  } catch { /* ignoriert */ }
  await new Promise((r) => setTimeout(r, 700));
}

console.log(`\n${found} Produkte gefunden`);
console.log(`  serving_size gesetzt        ${withServing}  (${Math.round(withServing / found * 100)}%)`);
console.log(`  Stückzahl im serving_size   ${withCount}  (${Math.round(withCount / found * 100)}%)`);
console.log(`  number_of_units gesetzt     ${withUnits}  (${Math.round(withUnits / found * 100)}%)`);
