# PROGRESS — Bestandsaufnahme Makro-Zielwerte (vor Prompt 3)

Stand: 2026-09-08. Reine Inventur, kein Umbau. Gilt für den **produktiven Speicherpfad** (`computeMacroGoals` → `calorie_goals`), sofern nicht anders vermerkt.

Es gibt daneben bereits eine **Prompt-3-Empfehlungsschicht** (`computeEmpfohleneMakros` in `src/lib/macro-recommendations.ts`), die der Makroziele-Editor anzeigt. Die gespeicherten Tagesziele werden weiterhin primär über `src/lib/macro-goals.ts` + `upsertDailyCalorieGoal` geschrieben.

---

## 1. Ballaststoffe

**Berechnet**, nicht fest 30 g — mit **Floor bei 30 g**.

```text
fiberG = round(max(30, 14 × dailyCalorieGoal / 1000))
```

- Quelle: `computeMacroGoals` / `fiberGForCalories` in `macro-goals.ts` bzw. `calorie-goals.ts`.
- Basis: **Kalorien**, nicht Körpergewicht.
- Eingangswert: `dailyCalorieGoal` der gespeicherten Zeile in `calorie_goals` (= **Basisziel ohne Sportzuschlag**). Active Energy / Sport-Skalierung schreibt das Basisziel nicht um; Sport-Makros sind Home-Anzeige.
- Korrektheit vs. Prompt-3-Soll: Richtung stimmt (14 g / 1000 kcal Basis). Abweichungen zur Prompt-3-Schicht: dort **ohne Floor 30**, dafür **Rundung auf 5 g** (`FIBER_ROUND_TO_G`).

Bei typischen Zielen ≤ ~2140 kcal landet der Floor oft bei **genau 30 g** — wirkt „fest“, ist aber die Untergrenze der Formel.

---

## 2. Protein

**Bezugsmasse (`proteinRefKg`)** = Minimum aus:

1. aktuellem Gewicht (`weight_logs` / Context),
2. optional BMI-25-Gewicht aus Größe (`25 × h²`),
3. optional Zielgewicht (`profiles.target_weight_kg`).

Kein Startgewicht. Code: `resolveProteinRefKg` in `macro-goals.ts`.

**g/kg** (vor Aufschlägen):

- mit TDEE: aus Defizitanteil (`proteinPerKgFromTdee`),
- sonst aus `goal_type` (z. B. lose 1.6, faster 1.8, maintain 1.2).

Zusätzlich: Alter ≥ 65 → ×1.2; vegan → ×1.12 (siehe Punkt 4).

**Bei Gewichtsänderung:** ja, und **stillschweigend**.

- `upsertTodayWeightLog` / Zielgewichts-Update rufen `refreshMacrosKeepingCalorieGoal` auf.
- Das upsertet denselben kcal-Stand und leitet Makros neu ab.
- `macro_goal_source === 'custom'`: **Protein-Gramm bleiben**, Fett/KH/Ballaststoffe werden aus kcal + Protein neu gerechnet.
- sonst (`calculated`): **alles** neu inkl. Protein — ohne Nachfrage.

Prompt-3-UI fragt bei Gewichts-/Zielwechsel nach „Ziele neu berechnen?“; der **alte** Refresh-Pfad tut das nicht.

---

## 3. Fett

**Prozent der Kalorien**, nicht fester Gramm-Wert, mit Floor:

```text
fatFromCalories = 0.25 × dailyCalorieGoal / 9
fatFloor        = 0.7 × proteinRefKg
fatG            = round(max(fatFromCalories, fatFloor))
```

Also **25 % der Basis-kcal**, mindestens ~0,7 g/kg Bezugsgewicht.

Prompt-3-Schicht: je Ziel 25 % oder 28 % (Halten), **ohne** diesen Floor.

Kohlenhydrate: Residual `(kcal − P×4 − F×9) / 4` in beiden Pfaden.

---

## 4. Ernährungsform / veganer Aufschlag

**Ja, produktiv bereits ein Vegan-Aufschlag** — nicht „zufällig hoch“.

| Pfad | Omnivor | Vegetarisch | Vegan |
|------|---------|-------------|-------|
| `computeMacroGoals` (gespeichert) | — | **kein** Aufschlag | **×1.12** |
| `computeEmpfohleneMakros` (Editor-Empfehlung) | 0 % | **+10 %** | **+15 %** |

Vegetarisch wird im Speicherpfad also noch nicht angehoben; Prompt 3 ist strenger/DIAAS-näher.

---

## 5. Manuell gesetzte Ziele in der DB

Kennzeichnung: `calorie_goals.macro_goal_source = 'custom'` (Protein manuell / Makroziele-Bundle mit Custom).

**Abfrage hier nicht möglich:** Supabase-MCP-Token hat keinen Zugriff auf Projekt `njhnqusxzorasykhaymy` (Kolibi, andere Org). Bitte lokal/Dashboard ausführen:

```sql
-- Latest row per user
with latest as (
  select distinct on (user_id)
    user_id, macro_goal_source, protein_g, fat_g, carbs_g, fiber_g, effective_from
  from calorie_goals
  order by user_id, effective_from desc
)
select
  macro_goal_source,
  count(*) as users
from latest
group by 1
order by 1 nulls first;

select count(*) as custom_users
from (
  select distinct on (user_id) user_id, macro_goal_source
  from calorie_goals
  order by user_id, effective_from desc
) t
where macro_goal_source = 'custom';
```

**Migration Prompt 3:** Wenn `custom_users > 0` (oder historische custom-Zeilen), manuelle Protein-/Makrowerte **nicht überschreiben**. Bestehender Upsert-Pfad erhält bei `macro_goal_source = 'custom'` bereits das Protein; eine Migration auf die neuen Empfehlungsformeln darf nur `calculated`-Zeilen anfassen (oder neu berechnen mit Opt-in).

---

## Kurzfazit für Prompt 3 / 4

| Thema | Produktiv heute | Prompt-3-Soll / Editor-Schicht |
|-------|-----------------|--------------------------------|
| Fiber | 14/1000 Basis + Floor 30 | 14/1000 Basis, Rundung 5 g, kein Floor 30 |
| Protein-Bezug | min(aktuell, BMI25, Ziel) | aktuell, ab BMI>27 Zielgewicht |
| Protein vegan | ×1.12 | +15 %; vegetarisch +10 % |
| Fett | 25 % + Floor 0.7 g/kg | 25–28 % nach Ziel, kein Floor |
| Custom | `macro_goal_source` | muss unangetastet bleiben |
| Gewichtsänderung | stiller Recalc (außer custom Protein) | Nachfrage im Editor |

Sportzuschlag gehört **nicht** in die Ballaststoff-/Basis-Makroformel der gespeicherten Ziele; das ist bereits so getrennt (Home skaliert P/F/C live).
