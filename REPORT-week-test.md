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

## Block 3: Tag 3 bis 7 in der App

Gleicher Simulator, gleicher anonymer Nutzer. Die Uhr steht weiter auf Freitag, 25.09.2026. Vergangene Tage habe ich nur über „Einheit nachtragen“ (Datum wählbar) erzeugt. Screenshots: `~/Desktop/kolibi-week-test/tag2/21-*`, `tag4/`, `tag5/`, `tag6/`, `tag7/`. Neue Flows: `day4-push.yaml`, `day4-b-intensitaet.yaml`, `day4-c-annehmen.yaml`, `day5-pull-legs-hart.yaml`, `day5-b-einheit-sticker.yaml`, `day6-fortschritt.yaml`, `day7-gewicht.yaml`. Einige Schritte (Sticker-Dialog, Nachtragen, Einstellungen) habe ich von Hand im Simulator bedient, weil die Inhalte von iOS-Sheets in Maestros Hierarchie fehlen.

**Sticker-Dialog (Nachholen aus Block 2)** — Übungs-Sticker Bulgarian Split Squats, „10 · 10 · 9 pro Seite“, Stufe 4 von 6:
- „Dunkel“ schaltet auf dunkle Schrift auf hellem Grund, „Hell“ zurück. ✔
- „Als Bild sichern“ → Status „Gespeichert“. „Kopieren“ → „Kopiert“. ✔
- Schalter „Bester Satz“ blendet die Zeile aus, die Vorschau passt sich an (`tag2/21-sticker-dunkel-ohne-bester-satz.png`). ✔
- Der Dialog schließt nur über Tippen auf den abgedunkelten Bereich; Wischen am Griff tut nichts. Nur notiert.
- `common/share-sheet.yaml` ist auf die gemessenen Positionen korrigiert. Der alte Stand hatte die Vorschau statt der Knöpfe getroffen, `day2-c-sticker.yaml` ist entfernt.

**Tag 4 · Push** (Liegestütze 12 · 12 · 12, Dips 9 · 8 · 8, Pike 8 · 8 · 7, Hollow Hold 2 × 26 s)
- Zusammenfassung: alle vier „Zum ersten Mal“ (Fix F1 wirkt). 84 Wiederholungen, 52 Sekunden.
- Die Intensität war auf „Kaum ein ganzer Satz“ (hart) **vorausgewählt**, abgeleitet aus dem Satztempo (Maestro ist schnell). Mit „hart“ gibt es nur den Hinweis „Oberes Ziel erreicht – bereit für mehr“, keinen Vorschlag.
- Nach Umstellen auf „normal“: Vorschlag „Liegestütze: 3 × 8–12 → Liegestütze auf Parallettes, 3 × 10–12“. Übernommen → „Neue Stufe erreicht! Liegestütze auf Parallettes · Stufe 4 von 6“. Stufen-Sticker mit „vorher: Liegestütze“ ✔ (`tag4/07`–`13`).
- Plan „Push“ enthält danach Parallettes mit **3 × 10–12** (siehe F6).

**Tag 5 · Pull & Legs, hart** (Klimmzüge 8 · 8 · 8, Rudern 11 · 10 · 10, Bulgarian 11 · 10 · 10, Seitstütz 2 × 20 s)
- „hart“: kein Stufenvorschlag für Klimmzüge. „normal“: Vorschlag Archer-Klimmzüge 3 × 2–5. Genau wie Block 1 (`tag5/02`–`05`). Zurück auf „hart“, beendet.
- Klimmzüge, Rudern, Bulgarian „Neuer Bestwert“; Seitstütz ohne Badge (20 s < 30 s). ✔
- Einheiten-Sticker: „Pull & Legs, 25. September 2026, 5 Min, 86 Wiederholungen, 3 Bestwerte“, Top-Übungen Rudern 11, Bulgarian 11, Klimmzüge 8. Keine kcal, kein Gewicht (`tag5/08`). ✔

**Tag 3/6 · Nachtragen und Wochenkarte**
- „Einheit nachtragen“ → Push, Datum 24.09. (Donnerstag), 45 min, Sätze mit den unteren Zielen vorbelegt, gespeichert.
- Wochenkarte „Training 2/3“ mit P am Donnerstag und PL am Freitag. Drei Einheiten am Freitag zählen als ein Tag, wie in Block 1. ✔ Das Wochenziel ist 3, weil das Onboarding keine Trainingshäufigkeit abfragt. Die gewünschten 4 × pro Woche müssten unter Ziele → Training gesetzt werden; das habe ich nicht getan.

**Fortschritt-Tab**
- „Meine Woche“: 4 Einheiten, 312 Wiederholungen (73 + 84 + 86 + 69 nachgetragen), 1 neue Stufe. Die Story-Karte zeigt dasselbe (`tag6/11`, `12`). ✔
- Bestwerte-Liste: nur „Neue Stufe · Liegestütze auf Parallettes“, keine Bestwerte, obwohl die Zusammenfassung von Tag 5 drei neue Bestwerte meldete. Das bestätigt Abweichung 3 aus Block 1 in der App (`tag6/10`).
- Die Übungsliste zeigt Bestwerte und Verlaufslinien (`tag6/13`).

**Tag 7 · Gewicht und Imperial**
- Gewicht 85,6 kg → Heute „85.6 kg“ (`tag7/02`).
- Maßsystem auf Imperial umgestellt → „188.7 lbs“, Zielgewicht „189.6 lbs“ (`tag7/13`). Passt zu Block 1.

### Fehler und Befunde aus Block 3

Keiner davon erfüllt die Regeln für einen Fix (Datenbank, Entwurfsfrage oder unklare Absicht). Es gibt deshalb in diesem Block keinen Code-Commit.

**F4 · Dauer läuft auf der Zusammenfassung weiter und zählt zum Verbrauch** — *nur dokumentiert*.
- Schritte: Einheit bis zum letzten Satz durchführen, Zusammenfassung ein paar Minuten offen lassen (z. B. Sticker teilen), dann „Fertig“.
- Erwartet: Die Dauer endet mit dem letzten Satz.
- Tatsächlich: „Dauer“ steigt weiter (Tag 4: 03:59 → 04:41; Tag 5: 04:27 → 04:38), weil `finishedAt` erst bei „Fertig“ gesetzt wird (`TrainingSummaryView.tsx`, `Date.now()` bis dahin). Die gespeicherte Dauer und damit die Trainings-kcal enthalten die Zeit auf der Zusammenfassung.
- Screenshot: `tag4/05-zusammenfassung.png` gegen `tag4/08-normal-vorschlag.png`.
- Schwere: **mittel**. Unklar, ob gewollt. **1.3-relevant: ja.**

**F5 · Nachtragen nutzt den aktuellen Plan, auch für Tage vor einem Stufenwechsel** — *nur dokumentiert*.
- Schritte: Stufe annehmen (Liegestütze → Parallettes), dann eine Push-Einheit für den Vortag nachtragen, danach den Fortschritts-Sticker für Liegestütze öffnen.
- Erwartet: Fortschritt von Stufe 3 zu Stufe 4.
- Tatsächlich: Die nachgetragene Einheit vom 24.09. enthält schon Parallettes. Der Sticker zeigt „Seit Beginn Stufe 4 von 6 → Heute Stufe 3 von 6“ und „Liegestütze auf Parallettes → Liegestütze“, also einen Rückschritt.
- Screenshot: `tag6/14-sticker-fortschritt-rueckwaerts.png`.
- Schwere: **niedrig** (seltener Ablauf). Die Daten sind chronologisch korrekt; die Frage ist, ob Nachtragen den damaligen Plan kennen soll. **1.3-relevant: ja** für das Nachtragen; der Fortschritts-Sticker kommt erst mit 1.4.

**F6 · Zielbereich der neuen Stufe: App 10–12, Migrationen 8–12** — *nur dokumentiert (Datenbank)*.
- Schritte: Stufenvorschlag Liegestütze → Parallettes übernehmen.
- Erwartet laut Migration `20260922105000_progression.sql`: 3 × 8–12. Block 1 rechnet mit diesen Werten.
- Tatsächlich: 3 × 10–12. `targetFromExerciseDefaults` übernimmt `default_reps`/`default_reps_max` der Übung aus der Datenbank, die Live-Zeile weicht also von den Migrationen ab.
- Screenshot: `tag4/07-normal-gewaehlt.png`.
- Schwere: **niedrig**. Datenbankstand, nicht angefasst. **1.3-relevant: ja**, falls dieselbe Datenbank gilt.

**F7 · Startgewicht wandert am ersten Tag mit jedem neuen Eintrag** — *nur dokumentiert*.
- Schritte: Onboarding mit 86 kg, am selben Tag 86,4 und dann 85,6 eintragen.
- Erwartet: Startgewicht 86 kg.
- Tatsächlich: Startgewicht erst 86.4, dann 85.6. Das Startgewicht ist der erste Gewichtseintrag (`src/lib/home.ts`), und ein Eintrag am selben Tag ersetzt ihn, was der Hinweis im Gewicht-Sheet auch ankündigt.
- Screenshot: `tag1/42-nach-speichern.png`, `tag7/02-heute-nach-gewicht.png`.
- Schwere: **niedrig**. Entwurfsfrage. **1.3-relevant: ja.**

**F8 · Tagesansicht vergangener Tage: „Noch keine Mahlzeiten heute“** — *nur dokumentiert (Text)*.
- Schritte: Fortschritt → Ernährung → Balken „Mi“ antippen.
- Erwartet: Ein Text ohne „heute“ für einen vergangenen Tag.
- Tatsächlich: „Mittwoch, 23. September“ mit „Noch keine Mahlzeiten heute“. `DayMealList.tsx` nutzt `home.meals.emptyTitle`. Darüber steht „Kein Kalorienziel gesetzt · Jetzt festlegen“; das ist für einen Tag vor der Anmeldung plausibel.
- Kein Screenshot gesichert (nur live geprüft).
- Schwere: **niedrig**. **1.3-relevant: ja.**

**Hinweise zum Dev-Build (keine App-Fehler)**
- Der schwebende Expo-Knopf überdeckt die rechte Hälfte von „Fortschritt“ und das Profilbild. Taps dorthin öffnen das Dev-Menü (`tag6/01`–`04` im ersten Lauf). `day6-fortschritt.yaml` tippt deshalb weiter links.
- Im Dev-Build ersetzt `resolveHistoryPreviewData` fehlende Kalorien durch Vorschauwerte (`__DEV__`). Der frische Nutzer sieht deshalb Balken für Sa–Do, „1521 kcal, 5 von 6 Tagen erfasst“. In Produktion greift das nicht, für Tests mit Ernährungsdaten im Dev-Build ist es aber irreführend.
- Mahlzeiten konnte der anonyme Nutzer nicht eintragen: „Manuell“ führt zur Anmeldung, der Foto-Scan erkennt die Apple-Beispielfotos nicht, Barcode braucht eine Kamera. Protein-Tage und Bewertungssatz sind deshalb nur in Block 1 geprüft.
- RevenueCat meldet im Dev-Build „Invalid API key“ (lokaler Schlüssel fehlt).

## Block 3 (Fortsetzung): fehlende Schritte nachgeholt

Nach der vollständigen Aufgabenbeschreibung fehlten Schritte aus Tag 1, 4, 5, 6 und 7. Neue Flows: `day4-plan-bearbeiten.yaml`, `day5-schlechter-tag-a.yaml`, `day5-schlechter-tag-b.yaml`, `day7-sprachen-start.yaml`, `day7-sprache-en.yaml`, `day7-sprache-es.yaml`, `day7-sprache-de.yaml`, `common/set-language.yaml` (Commit „test: maestro week flows“). Sheets und Dialoge habe ich von Hand im Simulator bedient und die Screenshots mit `xcrun simctl io … screenshot` gesichert.

| Tag | Schritt | Ergebnis | Screenshot |
|---|---|---|---|
| 1 | Mahlzeit manuell über die Suche | **nicht möglich.** Die Lupe ist die Barcode-Produktsuche, „Manuell“ führt anonyme Nutzer zur Anmeldung. | `tag1/30`, `tag1/50` |
| 1 | Foto-Scan aus der Galerie | ✔ mit einem echten Foto (Kichererbsen 180 g, Linsen 120 g, 603 kcal) | `tag1/53` |
| 1 | Menge korrigieren | ✔ Kichererbsen 180 → 200 g: 270 → 300 kcal, Gesamt 603 → 633; Heute danach 1890 von 2523 | `tag1/54`, `55` |
| 4 | Imperial: Heute, Ziele, Fortschritt | ✔ 188.7 lbs, Ziel 189.6 lbs überall; zurück auf Metrisch ✔ | `tag4/20`–`26` |
| 4 | Trainingsziel | auf 4 × pro Woche gesetzt, Wochenkarte danach „2 von 4“ | `tag4/24` |
| 4 | Plan bearbeiten: Wochentag So, Reihenfolge, Seitstütz entfernt, Aktives Hängen hinzugefügt | ✔, Plan danach „4 Übungen · Di, Fr, So“ | `tag4/30`–`36` |
| 5 | Schlechter Tag: weniger Wiederholungen, Klimmzüge übersprungen | ✔ Zusammenfassung „1 Übung offen: Klimmzüge“, keine Bestwerte, Aktives Hängen „Zum ersten Mal“ | `tag5/20`–`30` |
| 5 | `xcrun simctl terminate` mitten im Satz, Neustart | ✔ Einheit wiederhergestellt (Übung 3/4, Satz 2/3, erster Satz erhalten); später auch nach Kaltstart | `tag5/25`, `26`, `27` |
| 6 | Fortschritt: Ernährung, Körper, Training je 7 und 30 Tage | ✔ (Ernährung zeigt im Dev-Build Vorschauwerte, siehe Block 3) | `tag6/20`–`23` |
| 6 | Rückblick Woche und Monat, Sticker und Story, Hell und Dunkel | ✔ „Mein Monat“ 5 Einheiten, 347 Wdh., 1 neue Stufe | `tag6/24`–`28` |
| 6 | Fortschritts-Sticker, Zeitraum-Umschalter | Barren-Dips „Seit Beginn 7 → Heute 9“ ✔. Umschalter erscheint nicht, weil es erst eine Woche Historie gibt (so gewollt). | `tag6/30` |
| 6 | Hinweis bei zu wenigen Einheiten | **nicht auslösbar**: Der Sticker zählt Einheiten je Leiter, und jede Leiter hatte ≥ 2 Einheiten. Aktives Hängen (1 Einheit) zeigt stattdessen F10. | `tag6/32` |
| 6 | Bestwerte-Liste: Stufen-Sticker über „Neue Stufe · …“ | ✔ | `tag6/33` |
| 6 | Export als Text | Öffnet ohne Paywall (anonym). Vorschau mit Plan und Einheiten. Siehe F4 und F11. | `tag6/34`, `35` |
| 7 | Englisch und Spanisch: laufende Einheit, Übersicht, Bestwerte, Übungsliste, Sticker | ✔ alle Katalog-Übungen übersetzt („Hollow hold“ steht so im spanischen Katalog). Buchstaben-Symbole der Übungsliste waren deutsch → **F9, behoben**. | `tag7/22`–`46` |
| 7 | Zurück auf Deutsch | ✔ | `tag7/50` |
| 7 | Einheit löschen | ✔ laufende Einheit „Verwerfen“, gespeicherte Einheit über Detail → „Einheit löschen“ (mit Rückfrage) | `tag7/52`–`59` |
| 7 | Paywall nach den kostenlosen Scans | **nicht getestet.** Anonyme Nutzer haben 4 kostenlose Scans (`FREE_SCAN_LIMIT = 4` in `src/lib/scanGate.ts`), die Vorgabe erlaubt höchstens 3 Foto-Scans. Laut Code öffnet sich nach dem 4. erfolgreichen Scan die Paywall (`openPaywallBecauseScanLimit`). Ob Ansehen und Historie danach weiter gehen, konnte ich nicht im Ablauf prüfen. | – |

**Foto-Scans:** zwei von höchstens drei. Scan 1 (Tag 1, synthetisches Bild) → „Nichts erkannt“. Scan 2 mit `commons-edgell-nourish-bowl.jpg`, Quelle Wikimedia Commons, „File:Edgell Nourish Bowl.jpg“ von Mx. Granger, Lizenz **CC0**. Die drei Bilder `meal-*.jpg` in `~/Desktop/kolibi-week-test/media/` hat die vorige Sitzung selbst gezeichnet (keine fremde Lizenz). `simctl addmedia` funktioniert jetzt.

## Block 4: Auswertung

### Sticker-Dateien

Aus der Fotomediathek des Simulators (`…/Devices/56480505-…/data/Media/DCIM/100APPLE/*.PNG`) nach `~/Desktop/kolibi-week-test/sticker/` kopiert und mit PIL geprüft:

| Datei | Inhalt | Größe | Transparenz |
|---|---|---|---|
| IMG_0007.PNG | Übung Bulgarian Split Squats, Hell | 1080 × 1158 | echt, 91 % transparent, Ecke (0,0,0,0) |
| IMG_0008.PNG | Rückblick „Mein Monat“, Dunkel | 1080 × 797 | echt, 94 % |
| IMG_0009.PNG | Story-Karte „Mein Monat“, Dunkel | **1080 × 1920** | deckend (richtig für Story) |
| IMG_0010.PNG | Story-Karte „Mein Monat“, Hell | **1080 × 1920** | deckend |
| IMG_0011.PNG | Fortschritt Barren-Dips, Hell | 1080 × 881 | echt, 90 % |
| IMG_0012.PNG | Stufe Liegestütze auf Parallettes, Hell | 1080 × 870 | echt, 85 % |

- Alle Sticker haben eine Breite von 1080 und einen echten Alphakanal, der Hintergrund ist transparent. Die Story-Karten haben genau 1080 × 1920.
- **Sensible Daten:** Auf keinem Bild und auf keinem Sticker-Screenshot (Übung, Stufe, Einheit, Rückblick, Fortschritt, auch EN/ES) erscheinen Gewicht, kg, lbs, kcal, Kalorienziel, Taille, Körperfett oder Zusatzgewicht. ✔
- Beim Namen der Varianten gilt die Textfarbe: „Hell“ = helle Schrift (Story: Indigo-Hintergrund), „Dunkel“ = dunkle Schrift (Story: heller Hintergrund). Das ist bei Sticker und Story einheitlich, aber zumindest für die Story-Karte nicht selbsterklärend. Nur notiert.
- Der Sticker vom 1. Lauf (Einheit, Tag 5) wurde nicht gesichert, nur angesehen (`tag5/08`).

### Metro-Logs (ohne RevenueCat)

- `WARN Require cycle: src/stores/auth-store.ts -> src/stores/workout-session-store.ts -> src/stores/auth-store.ts` bei jedem Start. Bisher ohne sichtbare Folgen. **F13**, niedrig.
- `WARN [resolve-foods] resolve_foods failed, continuing without enrichment: {"code": "57014", "message": "canceling statement due to statement timeout"}` beim Foto-Scan. Die Datenbankfunktion lief in ein Timeout, der Scan ging ohne Anreicherung weiter. **F12**, Datenbank, nicht angefasst.
- `WARN DateTimePicker: onChange is deprecated` (Bibliothek, beim Nachtragen).
- Der Web-SSR-Fehler „Tried to access storage on the server“ entsteht nur, weil die Metro-Startseite im Browser-Tab gerendert wurde. Kein App-Fehler.

### Wochen-Simulation (Block 1) gegen die App (Block 3)

| Thema | Simulation | App | Bewertung |
|---|---|---|---|
| Kalorienziel ohne Health | 2530 kcal an allen Tagen (30 Jahre) | 2523 kcal an allen Tagen (Geburtstag 25.09.1995, also 31) | stimmt, Altersunterschied |
| Makros | 163 / 312 / 70 | 163 / 310 / 70 | stimmt |
| Erster Stufenvorschlag Liegestütze | Do (erste Einheit mit 3 × 12) | erste Push-Einheit mit 12 · 12 · 12 | stimmt, gleiche Regel |
| „hart“ ohne vorigen Erfolg | kein Vorschlag, bei „normal“ Archer | genauso | stimmt |
| Zielwerte nach Annahme | 3 × 8–12 (Migration) | 3 × 10–12 | **weicht ab (F6)** |
| „Zum ersten Mal“ / Bestwerte je Einheit | wie Tabelle 4 | wie erwartet, **nach Fix F1** | stimmt |
| Wochenkarte zählt Tage, nicht Einheiten | ja | ja (2 von 4 bei 5 Einheiten an 2 Tagen) | stimmt |
| Bestwerte im Rückblick / Bestwerte-Liste in der ersten Woche | 0 | 0 (nur „Neue Stufe“) | stimmt, Entwurfsfrage aus Block 1 |
| Trainings-kcal pro Einheit | 45–55 min Annahme | Dauer bis „Fertig“, einmal 300 bzw. 593 min | **weicht ab (F4)** |
| Sticker ohne sensible Daten | ja | ja | stimmt |
| Imperial: Gewicht in lb, Lebensmittel in g | ja | 188.7 lbs; Mahlzeit in g | stimmt |

### Neue Fehler aus Block 3 (Fortsetzung) und Block 4

**F4 (verschärft) · Dauer läuft auf der Zusammenfassung weiter: 300 bzw. 593 Minuten** — *nur dokumentiert, Schwere jetzt hoch*.
- Die erste Pull-&-Legs-Einheit (Tag 2) dauerte etwa 12 Minuten. Die Zusammenfassung blieb danach stundenlang offen (zwischen zwei Testsitzungen), erst dann kam „Fertig“.
- Die Liste „Letzte Einheiten“ zeigt **300 Min** (gedeckelt in `sessionDurationMinutes`, `src/lib/workouts/session-logic.ts`). Der Text-Export zeigt für dieselbe Einheit **593 min**, die gespeicherte Dauer ist also nicht gedeckelt.
- Mit Health fließt die Dauer in die Trainings-kcal. Bei 86 kg und MET 5 wären 300 min rund 2150 kcal.
- Die Ursache ist eindeutig: `finishedAt` wird erst bei „Fertig“ gesetzt. Nicht behoben, weil die richtige Endzeit eine Produktentscheidung ist (letzter Satz? Öffnen der Zusammenfassung? Deckel?). Nutzer können die Dauer in der Einheit-Detailansicht korrigieren (`tag7/56`).
- Screenshots: `tag6/23-30tage-volumen.png`, `tag6/35-export-text-2.png`.
- **1.3-relevant: ja.**

**F9 · Übungsliste: Buchstaben-Symbole bleiben deutsch** — *behoben* in `31f06fa` „fix(test-week): exercise list thumb letter follows the app language“, Test `src/lib/__tests__/exercise-stub.test.ts`.
- Schritte: App auf Englisch, Fortschritt → Training → Übungen.
- Erwartet: Der Buchstabe passt zum Namen (Pull-ups → P).
- Tatsächlich: K bei „Pull-ups“, B bei „Inverted Rows“ und „Parallel Bar Dips“. `exerciseStubFromSessionSet` nahm den gespeicherten deutschen Satznamen.
- Nach dem Fix: I, B, P, P, P, P (EN) und C, F, R, S, D (ES), erneut geprüft (`tag7/33`, `tag7/44`, `45`). Vorher: `tag7/32-uebungen-en.png`.
- Schwere: niedrig. **1.3-relevant: ja** (gleicher Code auf `main`).

**F10 · Fortschritts-Sticker nimmt die ganze Leiter und zeigt einen Rückschritt** — *nur dokumentiert*.
- Schritte: Aktives Hängen (Leiter `pull_vertical`, Stufe 2) einmal machen, nachdem vorher Klimmzüge (Stufe 5) geloggt waren. Dann in der Übungsliste bei „Aktives Hängen“ oder „Klimmzüge“ auf Teilen tippen.
- Erwartet: Fortschritt der gewählten Übung oder der Hinweis „zu wenige Einheiten“.
- Tatsächlich: „Seit Beginn Stufe 5 von 6 → Heute Stufe 2 von 6, Klimmzüge → Aktives Hängen“. Auch der Sticker für **Klimmzüge** heißt dann „Aktives Hängen“ (auf Spanisch „Colgarse activo“, `tag7/46`). Die Kurve steigt trotzdem an. `buildProgressSticker` nimmt je Einheit die höchste Stufe der Leiter und je Tag die zuletzt geloggte Einheit, Einheiten am selben Tag werden nur nach Datum sortiert.
- Screenshot: `tag6/32-fortschritt-zu-wenig.png`, `tag7/46-sticker-es.png`.
- Schwere: **mittel** für 1.4 (Teilen-Funktion zeigt Rückschritt). Ob eine leichtere Stufe als Rückschritt gelten soll, ist eine Entwurfsfrage. **1.3-relevant: nein** (`sticker-data.ts` gibt es nur auf `feat/share-stickers`).

**F11 · Export: Zurück-Knopf überdeckt den Titel** — *nur dokumentiert (Layout)*.
- Der Titel „Export“ liegt unter dem runden Zurück-Knopf, sichtbar ist nur „port“. Screenshot `tag6/34-export-text.png`. Schwere: niedrig. **1.3-relevant: ja** (Datei unverändert gegenüber `main`).

**F12 · `resolve_foods` Statement-Timeout beim Foto-Scan** — *nur dokumentiert (Datenbank)*. Der Scan lieferte trotzdem ein Ergebnis. Schwere: mittel, weil die Nährwerte ohne Abgleich mit der Lebensmitteldatenbank ungenauer sein können. **1.3-relevant: ja**, falls die Funktion in Produktion genauso langsam ist; das habe ich nicht geprüft.

**F13 · Require-Zyklus auth-store ↔ workout-session-store** — *nur dokumentiert*. Keine sichtbare Folge. Schwere: niedrig. **1.3-relevant: ja.**

## Übersicht der Fehler (vollständig)

| # | Titel | Schwere | Status | 1.3-relevant |
|---|---|---|---|---|
| F1 | Zusammenfassung vergleicht die Einheit mit sich selbst | hoch | behoben `1445e69` | ja |
| F4 | Dauer läuft auf der Zusammenfassung weiter (300/593 min) | hoch | dokumentiert | ja |
| F2 | Geburtsdatum: „Fertig“ ohne Drehen übernimmt nichts | mittel | dokumentiert | ja |
| F10 | Fortschritts-Sticker zeigt Leiter-Rückschritt, falschen Titel | mittel | dokumentiert | nein (1.4) |
| F12 | `resolve_foods` Timeout beim Scan | mittel | dokumentiert (DB) | ja (nicht in Prod geprüft) |
| F3 | Punkt statt Komma bei Gewicht/Distanz | niedrig | dokumentiert | ja |
| F5 | Nachtragen nutzt den aktuellen Plan | niedrig | dokumentiert | ja |
| F6 | Zielbereich neue Stufe: Datenbank ≠ Migrationen | niedrig | dokumentiert (DB) | ja |
| F7 | Startgewicht wandert am ersten Tag | niedrig | dokumentiert | ja |
| F8 | „Noch keine Mahlzeiten heute“ für vergangene Tage | niedrig | dokumentiert | ja |
| F9 | Übungsliste: Buchstaben-Symbole deutsch | niedrig | behoben `31f06fa` | ja |
| F11 | Export: Titel vom Zurück-Knopf überdeckt | niedrig | dokumentiert | ja |
| F13 | Require-Zyklus in den Stores | niedrig | dokumentiert | ja |

Entwurfsfragen aus Block 1 bleiben: kein höheres Ziel an Trainingstagen ohne Health, kein Defizit bei Muskelaufbau, keine Bestwerte in der ersten Woche, kein Laufen im manuellen Training.

## Nicht getestet

- **Paywall nach den kostenlosen Scans:** Dafür wären 4 erfolgreiche Scans nötig, die Vorgabe erlaubt 3.
- **Manuelle Mahlzeit über eine Suche:** Anonyme Nutzer landen bei der Anmeldung; mit Konto wollte ich nicht testen (Vorgabe).
- **Hinweis bei zu wenigen Einheiten** im Fortschritts-Sticker: mit diesen Daten nicht auslösbar (siehe F10).
- **Apple Health:** im Simulator nicht verbunden. Die Kalorienziele mit Health sind nur in Block 1 berechnet.
- **Tagesübergänge und echtes Datum:** Die Uhr wurde nicht verstellt. Alle App-Tage liegen am 24./25.09., der Montag-Rückblick nur in Block 1.
- **Barcode:** Die Simulator-Kamera liefert kein Bild.
- **Teilen ins Netz (Instagram usw.):** Nur „Als Bild sichern“ und „Kopieren“ geprüft, „Teilen“ nicht ausgelöst.

## Block 5: Paywall nach FREE_SCAN_LIMIT

Stand: `main` bei `c4a9c46` (Worktree, unverändert), Dev-Build 1.3.0 im Simulator „Kolibi QA“, Metro 8082. Keine Code-Änderung, kein Kauf, keine Anmeldung, nichts an Datenbank oder `access_override`. Screenshots: `~/Desktop/kolibi-week-test/paywall/`.

**Frischer Nutzer:** Nach Deinstallation und Neuinstallation war **derselbe anonyme Nutzer wieder da** (alle Daten, `paywall/01-start.png`). Die Supabase-Sitzung liegt im iOS-Schlüsselbund, und der überlebt eine Deinstallation. Für einen frischen Nutzer habe ich den Schlüsselbund des QA-Simulators geleert (Maestro `clearKeychain`), dann das Onboarding durchlaufen (2523 kcal). Nebenwirkung für echte Nutzer: Neu installieren setzt das Scan-Limit **nicht** zurück, das ist für die Paywall gewollt. Ein „frischer Start“ ist aber nur über Abmelden bzw. Kontolöschung möglich.

**Bilder** (Wikimedia Commons, alle **CC0**), in `~/Desktop/kolibi-week-test/media/`:
- `commons-edgell-nourish-bowl.jpg`: „Edgell Nourish Bowl“, Mx. Granger
- `commons-rasta-pasta.jpg`: „A dish of Rasta Pasta“, LingLass
- `commons-malaysian-curry-vegetables.jpg`: „Malaysian Curry Mixed Vegetables (with Boiled Rice) – Ho Chiak 2023-09-17“, Andy Li
- `commons-tofu-stir-fry.jpg`: „Stir-fry tofu, waxy corn, okra, tomatoes and carrots in lemon grass 01“, JFVelasquez Floro (hochgeladen, aber nicht gebraucht)
- `meal-1-bowl.jpg`: selbst gezeichnet (vorige Sitzung), für den „Nichts erkannt“-Fall

Scans insgesamt: 5 (4 durchgelaufen, der 5. Versuch öffnet die Paywall ohne Analyse).

| # | Schritt | Erwartet | Tatsächlich | Screenshot |
|---|---|---|---|---|
| 1 | Scan 1: gezeichnetes Bild | „Nichts erkannt“, zählt nicht | **Erkannt** als „Kichererbsen-Hummus“ + „Zitronenkuchen“, 680 kcal. In Block 2 lieferte dasselbe Bild „Nichts erkannt“. Sheet ohne Speichern geschlossen. | `paywall/11` |
| 2 | Scan 2: Kichererbsen-Bowl | Ergebnis, speicherbar | ✔ Kichererbsen 180 g, braune Linsen 150 g, 740 kcal, gespeichert | `paywall/14`, `15` |
| 3 | Scan 3: Gnocchi/Pasta | Ergebnis | ✔ „Gemüse-Kartoffel-Auflauf“ + „Kichererbsen-Eintopf“, 652 kcal, gespeichert | `paywall/17` |
| 3a | Hinweis nach Scan 3 | „Noch 1 kostenloser Scan“ | ✔ erscheint unter den Scan-Knöpfen. **Scan 1 wurde also mitgezählt, obwohl nicht gespeichert.** | `paywall/18` |
| 4 | Scan 4: Curry | Ergebnis | ✔ „Gebratene Nudeln mit Gemüse“ + „Frische Gurke“, 701 kcal, gespeichert. Hinweis danach weg. | `paywall/20`, `21` |
| 5 | Paywall nach dem 4. Scan | öffnet sich | Öffnet sich **nicht sofort** nach Scan 4, sondern beim Tippen auf „Mahlzeit scannen“ (5. Versuch). Erst Nutzen-Seite, dann Preisseite. So im Code (`openPaywallBecauseScanLimit` vor der Scan-Auswahl). | `paywall/22`, `23` |
| 6 | Zählt „Nichts erkannt“? | nein | Nicht prüfbar, das Bild wurde diesmal erkannt. Laut Code (`home.tsx`) zählt nur eine erfolgreiche Analyse; Parse-/API-Fehler zählen nicht. **Abgebrochene** erfolgreiche Scans zählen (siehe 3a). | – |
| 7 | Preise aus StoreKit, Abrechnungsbetrag prominent, Jahresabo 139,99 €, Hinweis 3 Tage Test mit Zahlungsdaten | sichtbar | **Nicht prüfbar:** Preisfeld ist ein grauer Platzhalter, RevenueCat im Dev-Build ohne Schlüssel („Invalid API key“). Nicht umgangen. Braucht TestFlight/Sandbox. | `paywall/23` |
| 8 | „Später“ schließt die Paywall | zurück zur App | ✔ (im Dev-Build liegt der Expo-Knopf über „Später“, habe ihn weggezogen) | `paywall/25` |
| 9 | Heute / vergangene Mahlzeiten | sichtbar | ✔ Heute 430 von 2523, „Essen“ zeigt alle drei Mahlzeiten | `paywall/25`, `30` |
| 10 | Fortschritt | sichtbar | ✔ | `paywall/37` |
| 11 | Export | zugänglich | ✔ Text-Export öffnet mit den Mahlzeiten | `paywall/38` |
| 12 | Neuer Scan | gesperrt | ✔ Paywall | `paywall/22` |
| 13 | Barcode / Manuell | gesperrt | ✔ führen zur Anmeldung | `paywall/35` |
| 14 | Neuer Gewichtseintrag | gesperrt | **✘ möglich**, Sheet öffnet, Speichern ohne Fehler | `paywall/33`, `34` |
| 15 | Training | gesperrt | **✘ möglich**, Training-Tab offen, „Erste Einheit anlegen“ öffnet „Neue Einheit“, Trainingsplan erreichbar | `paywall/31`, `32`, `33b` |
| 16 | Kaltstart, dann Scan | Limit bleibt | ✔ Paywall erscheint wieder | `paywall/40`, `41` |

### Abweichungen (nur dokumentiert, Paywall-/Abo-Logik)

**F14 · Anonym nach 4 Scans: Training und Gewicht bleiben nutzbar** — Schwere **mittel**, **1.3-relevant: ja**.
- Erwartet laut Aufgabe: Neue Einträge und Training gesperrt, nur Ansehen, Historie, Fortschritt und Export offen.
- Tatsächlich: Training (Einheiten anlegen) und Gewichtseintrag funktionieren weiter. Der Code will das so: `switchHomeTab` in `src/app/home.tsx` sperrt Tabs nur für registrierte Nutzer ohne Abo („Anonymous users keep tab access (scan limits are handled separately)“). Gesperrt sind für Anonyme nur Scan, Barcode und Manuell.
- Ob das zu Ziffer 10 Abs. 5 der AGB passt, musst du bzw. rechtlich entscheiden; ich habe den AGB-Text selbst nicht geprüft.

**F15 · Abgebrochener Scan verbraucht einen kostenlosen Scan** — Schwere **niedrig–mittel**, **1.3-relevant: ja**.
- Der Zähler steigt nach jeder erfolgreichen Analyse, auch wenn das Ergebnis verworfen wird. Wer ein falsch erkanntes Bild schließt, hat trotzdem einen der 4 Scans verbraucht.
- Kann gewollt sein (die Analyse kostet), sollte aber bewusst entschieden werden.

**F16 · Nicht-Essen wird als Essen erkannt** — Schwere **mittel**, **1.3-relevant: ja**.
- Ein abstrakt gezeichneter Teller mit drei Farbkreisen wurde als Hummus und Zitronenkuchen (680 kcal) erkannt. Beim ersten Test (Block 2) kam „Nichts erkannt“. Das Ergebnis schwankt also.
- Das betrifft den Prompt bzw. das Modell, nicht den App-Code.

**Hinweis:** Die Fortschritt-Zusammenfassung zeigt „Noch keine erfassten Tage in diesem Zeitraum“, während das Diagramm den heutigen Tag mit 2093 kcal zeigt (`paywall/37`). Vermutlich zählt nur ein abgeschlossener Tag. Nur notiert.

**Nicht geprüft:** Preise und Texte der Paywall (Schritt 7). Dafür braucht es einen Build mit RevenueCat-Schlüssel (TestFlight oder Sandbox), was ich nicht verwenden durfte.
