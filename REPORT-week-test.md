# Bericht: Wochen-Test Kolibi

Branch `test/week-simulation`, abgezweigt von `feat/share-stickers`. Nichts auf `main` oder `feat/share-stickers`, kein EAS, kein OTA, keine Datenbankänderung, keine Uhrzeit verstellt.

## Start

- `feat/share-stickers` aktualisiert (`git pull`), dann `test/week-simulation` angelegt.
- `git status --porcelain` war nicht leer, weil `tmp/de-privacy/`, `tmp/de-terms/` und `tmp/en-terms/` schon vorher als ungetrackte Ordner da waren. Sie sind nicht von mir und bleiben unberührt.

## Block 1: Wochen-Simulation ohne Simulator und Datenbank

Commit `c0f1276` „test: week simulation“, Datei `src/lib/__tests__/week-simulation.test.ts`.

- **Ergebnis:** 15 Testfälle: 12 bestanden, 3 als abweichende Erwartung übersprungen (`skip`, mit tatsächlichem Verhalten und Begründung, siehe unten).
- **Gesamte Suite:** 527 Tests, davon 524 grün und 3 übersprungen. tsc wie auf `main`, also keine neuen Fehler.
- **Zeit:** nur feste Datumsschlüssel (Montag 28.09.2026 bis Sonntag 04.10.2026, danach Montag 05.10.). Die echte Uhr wird nirgends gelesen, auch das Alter ergibt sich aus Geburtsdatum und simuliertem Tag.
- **Katalog:** Leitern und Stufen so, wie die Migrationen sie hinterlassen (`seed_exercise_catalog`, `progression`, `beginner_ladder_steps`). Zum Beispiel: Liegestütze = Stufe 3 von 6 auf `push_horizontal`, Klimmzüge = Stufe 5 von 6.
- **Dünne Hüllen im Test**, weil die Module unter Node nicht laden, da sie über `supabase` oder `expo-localization` `react-native` einbinden:
  - `buildHistorySummaryStats` aus `lib/history.ts` für den Bewertungssatz
  - die Satzsummen aus `components/training/training-panel-utils.ts`
  - der Vergleich mit früheren Bestwerten der Zusammenfassung
  - das Tagesziel mit Health, das die App über `getSportEnergyDay` bildet

  Ansonsten laufen die echten App-Funktionen: `calculateMaintenanceCalories`, `applyGoalAdjustment`, `computeMacroGoals`, `buildSportEnergyDay`, `scaleMacrosForSportCalories`, `resolveEffectiveDailyCalorieGoal`, `calculateTrainingCalories`, `finishActiveSession` (mit Fake-Abhängigkeiten), `suggestProgression`, `applyProgression`, `activeItemToHistoryUnit`, `exerciseMilestone`, `trainingCardSessionCount`, `buildRecapSticker` und die übrigen Sticker-Builder, `computeBalanceSummaryHeadline`, `formatDistanceKm`, `formatWeightForDisplay`.

**Profil:** 30 Jahre, männlich, 180 cm, 86 kg, Ziel Muskelaufbau, Trainingsziel 4 × pro Woche, vegan, Aktivität „leicht aktiv“.

**Plan:**
- „Push“: Liegestütze 3 × 8–12, Barren-Dips 3 × 7–10, Pike Push-ups 3 × 6–10, Hollow Hold 2 × 20–30 s.
- „Pull & Legs“: Klimmzüge 3 × 3–8, Barren-Rudern 3 × 8–12, Bulgarian Split Squats 3 × 8–12 pro Seite, Seitstütz 2 × 20–40 s pro Seite.

### 1. Kalorien- und Makroziel je Tag

**Mit Apple Health** (Quelle HEALTH, angenommene Alltagsbewegung 350 kcal pro Tag):

| Tag | Einheit | Trainings-kcal | aktive kcal | Kalorienziel | Protein | Kohlenhydrate | Fett |
|---|---|---|---|---|---|---|---|
| Mo | Push, normal | 258 | 608 | 2448 | 163 | 265 | 82 |
| Di | Pull & Legs, normal | 287 | 637 | 2477 | 163 | 270 | 83 |
| Mi | Ruhetag | 0 | 350 | 2190 | 163 | 214 | 76 |
| Do | Push, normal | 269 | 619 | 2459 | 163 | 267 | 82 |
| Fr | Pull & Legs, **hart** | 394 | 744 | 2584 | 163 | 305 | 79 |
| Sa | Push + Laufen 30 min | 264 + 172 | 786 | 2626 | 163 | 300 | 86 |
| So | Ruhetag, Gewicht eingetragen | 0 | 350 | 2190 | 163 | 214 | 76 |

- Trainingstage liegen über den Ruhetagen, das Protein bleibt konstant.
- Kohlenhydrate und Fett wachsen mit der Trainingsenergie. An einem harten Tag geht ein größerer Anteil der Zusatzenergie in Kohlenhydrate (Anteil bei „hart“ größer als bei „normal“, geprüft).

**Ohne Apple Health**, also der frische anonyme Nutzer (Quelle Aktivitätsfaktor): an **allen** Tagen 2530 kcal, 163 g Protein, 312 g Kohlenhydrate, 70 g Fett.

### 2. Energie aus Training

- Jede Einheit legt beim Beenden genau eine `training_sessions`-Zeile an. Ein zweites Beenden mit bereits verknüpfter Zeile legt keine weitere an, geprüft für alle fünf Einheiten.
- Kraft: 258 bis 394 kcal (MET 5 bzw. 6 bei „hart“, 86 kg, 45 bis 55 min). Laufen 30 min: 172 kcal.
- Samstag: Einheit und Lauf zählen beide, die Einheit einmal.

### 3. Progression

- **Erster Vorschlag** für die nächste Stufe bei den Liegestützen kommt am **Donnerstag** (3 × 12 an der oberen Grenze, Intensität normal): `variant_up` → Liegestütze auf Parallettes.
- In der Simulation lässt der Nutzer ihn am Donnerstag offen, ohne Entscheidung. Am Samstag kommt er deshalb nach 3 × 12 erneut und wird angenommen.
- **„Hart“:** Klimmzüge 8 · 8 · 8 am Freitag mit Intensität „hart“ ergeben **keinen** Vorschlag, weil der vorige Erfolg fehlt (der Dienstag mit 6 · 5 · 5 war keiner). Dieselbe Einheit mit „normal“ hätte sofort `variant_up` → Archer-Klimmzüge ergeben, geprüft.
- **Nach Annahme:** Der Plan „Push“ enthält jetzt Liegestütze auf Parallettes mit 3 × 8–12, die Standardwerte der neuen Stufe.

### 4. Bestwerte und „Zum ersten Mal“ je Einheit

| Einheit | Kennzeichnung |
|---|---|
| Mo Push | alle vier „Zum ersten Mal“ |
| Di Pull & Legs | alle vier „Zum ersten Mal“ |
| Do Push | Liegestütze und Hollow Hold „Neuer Bestwert“; Dips und Pike kein Badge |
| Fr Pull & Legs | alle vier „Neuer Bestwert“ |
| Sa Push | Dips, Pike und Hollow Hold „Neuer Bestwert“; Liegestütze kein Badge (12 = 12) |

### 5. Wochenkarte „Diese Woche n von 4“

| Mo | Di | Mi | Do | Fr | Sa | So |
|---|---|---|---|---|---|---|
| 1 | 2 | 2 | 3 | 4 | 5 | 5 |

Samstag mit Einheit und Lauf zählt als ein Tag.

### 6. Rückblick

| | Einheiten | Wiederholungen | Bestwerte | neue Stufen | größter Fortschritt | Protein-Tage |
|---|---|---|---|---|---|---|
| „Meine Woche“ am Sonntag (28.09. bis 04.10.) | 6 | 389 | 0 | 1 | – | 3 |
| „Meine Woche“ am Montag danach (29.09. bis 05.10.) | 5 | 321 | 4 | 1 | Liegestütze 10 → 12 | 3 |
| „Mein Monat“ am Sonntag | 6 | 389 | 0 | 1 | – | 3 |

- „Einheiten“ am Sonntag: 5 Einheiten plus der Lauf. Die mit den Einheiten verknüpften Trainingszeilen zählen nicht doppelt.
- Am Montag fällt die Einheit vom Montag der Vorwoche aus dem Fenster. Ihre Werte werden dann zum Vergleichswert, deshalb erscheinen plötzlich 4 Bestwerte.

### 7. Sticker-Daten

Alle fünf Objekte geprüft. Keines enthält Gewicht, kg, kcal, Kalorien, Taille, Körperfett, Größe oder BMI, auch nicht die 10 kg Zusatzgewicht, die an den Split Squats hängen.

| Sticker | Inhalt |
|---|---|
| Übung (Fr) | Bulgarian Split Squats, „11 · 10 · 10“, pro Seite, Stufe 4 von 6, Neuer Bestwert |
| Stufe (Sa) | Liegestütze auf Parallettes, Stufe 4 von 6, vorher: Liegestütze |
| Einheit (Fr) | Pull & Legs, 02.10.2026, 55 Min, 86 Wiederholungen; Top: Barren-Rudern 11, Bulgarian Split Squats 11, Klimmzüge 8 |
| Rückblick | siehe Tabelle oben |
| Fortschritt (So) | Liegestütze, nur „seit Beginn“ (eine Woche Historie), 10 → 12 über drei Einheiten |

### 8. Bewertungssatz

- **Mittwoch:** kein Satz. Zwei abgeschlossene Tage gelten als `very_rough`, dafür macht die App keine Aussage.
- **Sonntag:** „Du bist auf Kurs — etwa 12 g mehr Protein pro Tag würden es abrunden.“ (`small`, Protein, 12 g, unter dem Ziel). Ursache ist der Mittwoch mit 60 % Protein.

### 9. Imperial

- Distanz: 5,2 km werden zu „3.2 mi“.
- Gewicht: 85,6 kg werden zu „188.7 lb“.
- **Lebensmittel bleiben in g:** Belegt nur durch Code-Lesung, nicht durch einen Test. `meals.ts` gibt gespeicherte g/ml aus und ignoriert das Maßsystem (Parameter `_unitSystem`), das Modul ist unter Node nicht ladbar.

### Abweichungen von der Erwartung (als `skip` markiert, nicht angepasst)

1. **1b: Ohne Apple Health ist das Ziel an Trainingstagen nicht höher.**
   - Die Trainingsenergie fließt nur mit verbundenem Health ins Tagesziel und in die Makros. Die App berechnet den Sport-Energie-Tag nur dann (`home.tsx:203`, `enabled: healthConnectedPreference === true && hasMovementGoal`).
   - Für den frischen anonymen Nutzer ohne Health sind alle sieben Tage gleich (2530 kcal).
   - Entwurfsfrage, kein Code-Fehler. **1.3-relevant: ja**, dasselbe Verhalten gilt auf `main`.
2. **1c: „Muskelaufbau mit leichtem Defizit“ gibt es nicht.** `build_muscle` ist Rekomposition auf Erhaltung (`GOAL_WEIGHT_CHANGE_PERCENT_PER_WEEK.build_muscle = 0`). Entwurfsentscheidung. **1.3-relevant: ja.**
3. **6b: In der ersten Woche zeigt „Meine Woche“ 0 Bestwerte und keinen größten Fortschritt**, obwohl Liegestütze, Klimmzüge und die anderen Übungen innerhalb der Woche besser wurden.
   - Bestwerte werden mit dem besten Wert **vor** dem Fenster verglichen, und eine erste Ausführung ist kein Bestwert.
   - Die Bestwerte-Liste im Fortschritt-Tab nutzt dieselbe Logik (`personalBests`).
   - Entwurfsfrage. **1.3-relevant: ja** für die Bestwerte-Liste, der Rückblick-Sticker ist erst 1.4.
4. **Laufen gibt es im manuellen Training nicht.** Zur Auswahl stehen Kraft, Yoga, Schwimmen, Radfahren und Sonstiges. Der Lauf ist als „Sonstiges“ erfasst (MET 5). Nur dokumentiert. **1.3-relevant: ja.**

## Block 2: Tag 1 und 2 in der App (Simulator „Kolibi QA“)

Eigener Simulator „Kolibi QA“ (iPhone 17 Pro, UDID `56480505-679E-42DF-934D-57326E9F1726`), lokaler Dev-Build, Metro auf Port 8082, frischer anonymer Nutzer nach Neuinstallation. Flows unter `.maestro/week/`, Aufruf über `scripts/week-test/maestro.sh` (nur mit `KOLIBI_QA_UDID`, nie ein anderes Gerät). Screenshots: `~/Desktop/kolibi-week-test/tag1/`, `tag2/`.

Die echte Uhr steht auf Freitag, 25.09.2026. Im Simulator laufen deshalb alle „Tage“ am selben Kalendertag; Datumsfragen prüft Block 1.

**Tag 1**
- Onboarding: vegan, männlich, geboren 25.09.1995, 180 cm, 86 kg, leicht aktiv, Muskelaufbau → **2523 kcal**, 163 g Protein, 310 g KH, 70 g Fett (`tag1/07`, `tag1/08`). Passt zu Block 1 (2530 kcal bei 30 statt 31 Jahren).
- Training-Tab leer: drei fertige Pläne plus „Eigenen Plan anlegen“. Eigene Einheit „Push“ (Kürzel P) mit vier Katalog-Übungen, Zielwerten und Mo/Do/Sa angelegt (`tag1/10`–`20`). Danach „Als nächstes: Push“.
- Essen: „Manuell“ führt den anonymen Nutzer auf die Anmeldeseite (`tag1/30`). Foto-Scan aus der Galerie mit einem Apple-Beispielfoto → „Nichts erkannt“ mit „Nochmal scannen“ und „Manuell eingeben“ (`tag1/37`). `simctl addmedia` hing mit den eigenen Essensfotos, deshalb kein echter Mahlzeiten-Scan.
- Gewicht 86,4 kg eingetragen (`tag1/42`).

**Tag 2**
- Zweite Einheit „Pull & Legs“ (PL, Di/Fr) angelegt und gestartet (`tag2/01`–`03`).
- Pausen-Timer nach Satz 1: läuft (01:58), +30 (02:26), Pause hält an, Weiter läuft weiter, Überspringen beendet (`tag2/04`–`08`).
- Bulgarian Split Squats zeigen „pro Seite“ (`tag2/09`), Seitstütz mit Halte-Timer je Seite (`tag2/10`, `11`).
- Zusammenfassung: 12:02 Dauer, 11 Sätze, 73 Wiederholungen, 122 Sekunden (`tag2/12`, `13b`).
- Übungs-Sticker Klimmzüge „6 · 5 · 5“, „Zum ersten Mal“, Stufe 5 von 6 (`tag2/14`). Kein Gewicht, keine kcal.

### Fehler aus Block 2

**F1 · Zusammenfassung vergleicht die Einheit mit sich selbst** — *behoben* in `1445e69` „fix(test-week): summary compares against earlier sessions, not itself“ (Test in `src/lib/workouts/progression-history.test.ts`).
- Schritte: Neue Einheit mit Übungen, die noch nie gemacht wurden, durchführen und beenden.
- Erwartet: Jede Übung „Zum ersten Mal“.
- Tatsächlich: Kein „Zum ersten Mal“ und kein Bestwert. Die Sätze der laufenden Einheit werden schon während des Trainings synchronisiert, deshalb enthält die geladene Historie die Einheit bereits. Eine „harte“ Einheit zählte außerdem als ihr eigener vorheriger Erfolg für den Stufenvorschlag.
- Screenshot: `tag2/13-zusammenfassung-uebungen.png` (vorher), `tag2/13b-nach-fix.png` (nachher).
- Schwere: **hoch**. **1.3-relevant: ja** — `main` liest die Historie in `TrainingSummaryView.tsx` genauso ungefiltert (Bestwert-Badges und Stufenvorschlag).

**F2 · Geburtsdatum: „Fertig“ ohne Drehen übernimmt das angezeigte Datum nicht** — *nur dokumentiert*.
- Schritte: Onboarding Schritt 3, „Geburtsdatum wählen“, Picker zeigt 25. Sept. 2001, direkt „Fertig“, dann „Weiter“.
- Erwartet: Das angezeigte Datum gilt als gewählt.
- Tatsächlich: Feld bleibt „Geburtsdatum wählen“, Fehler „Bitte wähle dein Geburtsdatum“. Erst nach Drehen am Rad wird ein Datum übernommen (`birth-date-picker.tsx` meldet nur `onChange` des Rads, „Fertig“ schließt nur).
- Screenshot: `tag1/02-geburtsdatum-picker.png`, `tag1/03-geburtsdatum-ohne-drehen.png`.
- Schwere: **mittel**. Nicht behoben, weil unklar ist, ob das Erzwingen einer aktiven Wahl gewollt ist (sonst bekämen viele Nutzer stillschweigend „25 Jahre“). **1.3-relevant: ja**, Datei identisch auf `main`.

**F3 · Gewicht mit Punkt statt Komma („86.4 kg“)** — *nur dokumentiert*.
- Schritte: Deutsch, Gewicht „86,4“ eintragen, Heute-Tab ansehen.
- Erwartet: „86,4 kg“, wie eingegeben.
- Tatsächlich: „86.4 kg“ (aktuell und Startgewicht). `formatWeightForDisplay` in `src/lib/weight-parse.ts` formatiert ohne Sprache; dasselbe gilt für Distanzen und rund 30 Aufrufstellen.
- Screenshot: `tag1/42-nach-speichern.png`.
- Schwere: **niedrig**. Nicht behoben: app-weite Formatierungsentscheidung, keine Einzelstelle. **1.3-relevant: ja.**

**Hinweise ohne Fehler**
- „Manuell“ führt anonyme Nutzer zur Anmeldung. Entwurfsentscheidung, nicht bewertet.
- Beim Sticker zeigt „Hell“ einen hellen Sticker auf dunklem Hintergrund. Das ist gewollt (`ShareStickerSheet.tsx`, Kommentar zum Hintergrund).
- Der erste Lauf des Sticker-Flows hat die Knöpfe verfehlt (Punkt-Koordinaten trafen die Vorschau). „Hell/Dunkel“, „Als Bild sichern“ und „Kopieren“ sind deshalb in Block 2 **nicht** geprüft; das holt Block 3 nach.
