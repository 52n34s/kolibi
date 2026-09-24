# Übungs-Illustrationen

Die Bilder unter `assets/images/exercises/` stammen **nicht** aus einem parametrischen
Python-Generator. Sie sind mit einem Bildgenerator erzeugt worden, gesteuert über
einen gemeinsamen Style-Prompt plus eine Motivbeschreibung pro Übung. Wer das
nachzieht, ohne denselben Style-Block zu verwenden, bekommt sichtbar abweichende
Bilder — Strichstärke, Proportionen und Farbflächen driften sonst schon zwischen
zwei Durchgängen desselben Prompts.

## Technische Eckdaten

| | |
|---|---|
| Format | WebP, 512 × 512, ~6–12 KB |
| Ablage | `assets/images/exercises/<catalog_slug>.webp` |
| Dateiname | exakt der `catalog_slug` bzw. das `image_asset` der Übung in der DB |
| Verdrahtung | `CATALOG_EXERCISE_IMAGES` in [`src/lib/workouts/catalog-images.ts`](../src/lib/workouts/catalog-images.ts) |

`ExerciseThumb` und `ExerciseImageViewer` lösen über
`getCatalogExerciseImage(exercise.imageAsset ?? exercise.catalogSlug)` auf.

- **Slug fehlt in `catalog-images.ts`** → `null` → sauberer Fallback auf den
  Anfangsbuchstaben. Migration und Bilder dürfen getrennt ausgeliefert werden.
  Der Buchstaben-Fallback greift nur bei fehlendem Map-Eintrag, nicht bei
  fehlender Datei.
- **Eintrag in `catalog-images.ts` ohne passende `.webp`** → bricht den
  Bundle-Build: Metro löst `require()` zur Bundle-Zeit auf
  (`Unable to resolve module …`). Reihenfolge deshalb immer: erst die Datei,
  dann die Zeile.

## Regeln für neue Motive

1. **Alle neuen Motive in einem Durchgang generieren.** Über mehrere Sessions
   verteilt driftet der Stil.
2. **Ein bestehendes Bild als Referenz mitgeben** (z. B. `push_up.webp`), damit
   Figur, Strichstärke und Farbflächen an die vorhandenen Bilder andocken.
3. Style-Block unverändert übernehmen, nur die Motivliste tauschen.
4. Danach: Datei nach `assets/images/exercises/` legen, Zeile in
   `catalog-images.ts` ergänzen (Reihenfolge = Leiterreihenfolge), und in
   [`ladder-integrity.ts`](../src/lib/workouts/ladder-integrity.ts) prüfen, ob der
   Slug in `CATALOG_LADDER_RUNGS` steht.

## Style-Block

```
Minimalist line-art fitness illustration, 512x512, flat vector style.
Off-white background #FAFAFA. Figure with indigo #4F46E5 outlines,
mint #7CE7C7 shirt, indigo-toned shorts, light lavender skin.
Equipment in anthracite #2C2C2A. Clean even stroke weight, no shading,
no gradients, no text, no background objects. Single figure, side or
three-quarter view, full body visible within frame.
```

Farbcodes:

| Rolle | Hex |
|---|---|
| Hintergrund | `#FAFAFA` |
| Konturen, Shorts | `#4F46E5` (Brand-Indigo, identisch mit `BRAND_INDIGO`) |
| Shirt | `#7CE7C7` |
| Equipment (Stange, Box, Bank) | `#2C2C2A` |
| Haut | helles Lavendel |

## Motivbeschreibungen

Je Übung eine Zeile, zusammen mit dem Style-Block an den Generator. Die neun
Anfänger-Sprossen aus
[`20260924152000_beginner_ladder_steps.sql`](../supabase/migrations/20260924152000_beginner_ladder_steps.sql)
sind in einem Durchgang entstanden:

1. `dead_hang` – hanging from a horizontal bar, arms completely straight,
   shoulders relaxed up near the ears, legs straight and together
2. `active_hang` – same hang, but shoulders pulled down away from the ears,
   chest slightly lifted, arms still straight
3. `wall_push_up` – standing, both hands flat on a vertical wall at chest
   height, body leaning forward in a straight line, heels on the floor
4. `elevated_hands_pike_push_up` – pike position, hips high in a V shape,
   both hands on a low anthracite box, feet flat on the floor
5. `box_squat` – squatting down onto a low anthracite bench behind, thighs
   just above the seat, arms extended forward for balance
6. `bodyweight_squat` – bottom of a squat, feet shoulder width, thighs
   parallel to the floor, arms extended forward, back straight
7. `lying_leg_raise` – lying on the back on the floor, legs straight and
   raised to about 60 degrees, hands flat beside the hips
8. `bench_dip_bent_knees` – hands on the edge of an anthracite bench behind
   the body, knees bent with feet flat and close in, elbows bent
9. `side_plank_knees` – side plank supported on one forearm and the knees,
   lower legs bent back, hips lifted, body in a straight line from head
   to knees

Stand: alle 48 Katalog-Übungen haben ein Bild.
