# Wochentest 2 – 1.4.0

Stand `main` (bis `91e9959`). Simulator „Kolibi QA“ (UDID `56480505-679E-42DF-934D-57326E9F1726`), Dev-Client, Metro auf 8082, frischer anonymer Nutzer, Uhrzeit unverändert (Fr, 25.09.2026, abends). Screenshots: `~/Desktop/kolibi-1.4-check/woche2/`.

**Abbruch im Simulator:** Gegen 23:25 lief aus einem Cursor-Terminal `npx expo run:ios --device "Kolibi QA"` (nativer Build und Neuinstallation auf diesem Simulator). Danach stand die App auf dem englischen Anmeldebildschirm, mit `test2@52n34s.com` und einem Passwort im Feld und „Email or password is incorrect.“. Das kam nicht aus diesem Test. Von da an habe ich den Simulator nicht mehr bedient. Was danach noch offen war, steht unten als „nicht geprüft“.

## 0. Migrationen aus App-Sicht

Proben wie in `supabase/checks/release-1.4.sql`, aber über PostgREST mit anonymem Nutzer (`select … limit 0` je Spalte, RPC-Aufruf). Alle 15 Migrationen bestätigt, 9/9 Einsteiger-Stufen vorhanden. Nebeneffekt: Die anonyme Anmeldung des Probe-Skripts hat einen Nutzer in `auth.users` angelegt (kein Profil, keine Daten).

## 1. Code-Simulation (`src/lib/__tests__/week-simulation-1-4.test.ts`, Block „week simulation 2“)

Sechs Wochen mit injizierter Zeit. Ergebnis in `441e343`.

| # | Prüfung | Ergebnis |
|---|---|---|
| W2-1 | Zusatzsätze: 12·12·12·9 schlägt vor, Bonus-Satz an der Obergrenze zählt bei „hart“, zwei Einheiten mit 5 Sätzen → `sets_up` 4 | bestanden |
| W2-2 | Vorbelegung: diese Einheit → letzte Einheit → Untergrenze | bestanden |
| W2-3 | Hinweis nach dem Training: Kraft → Protein zuerst, Lauf → Kohlenhydrate, Fett erst ab 85 % | bestanden |
| W2-4 | Schwerpunkte ändern die Reihenfolge der Empfehlungen | teilweise (Befund 5) |
| W2-5 | Entlastungswoche: beide Auslöser, 28 Tage Sperre, ein Satz weniger, keine Stufenaufstiege, danach zurück | bestanden (nach Fix `0876851`) |
| W2-6 | `is_manual`: echte Nachträge zählen an Einheitstagen, Phantome nicht | bestanden |
| W2-7 | Gespeicherte Sport-Energie ist die, die der Verlauf nutzt | bestanden |
| W2-8 | Makro-Verlauf: Skala ab 0, Zusammenfassung, im Ziel ±10 %, heute zählt nicht, Zielwechsel markiert | bestanden |
| W2-9 | Mehrere Stufenaufstiege in einer Einheit → eine Feier | bestanden |

Tests gesamt: 1137, 0 fehlgeschlagen (1 übersprungen, alt). tsc: 15 Fehler in `src/` (Baseline).

## 2. Abläufe im Simulator

| Ablauf | Ergebnis | Screenshots |
|---|---|---|
| Onboarding „Beides“, Plan-Assistent (Einsteiger) | bestanden | `2026-…_224839/`, `…_224935/` |
| Vorlage übernehmen („Push“), eigene Einheit als Vorlage, „Meine Vorlagen“ | bestanden | `…_225039/` bis `…_225248/`, `b-03-einheit-erstellt.png` |
| Check-in: „Nicht mehr anzeigen“, in den Einstellungen wieder an, beantworten → „Bereit“ | bestanden | `…_225332/`, `…_225503/`, `…_225555/` |
| Check-in „Heute nicht“ | nicht geprüft (am selben Tag schon beantwortet; Logik in Tests abgedeckt) | – |
| Schwerpunkte in den Zielen („Mehr Protein“, „Besser erholen“) | bestanden | `…_225414/`, `g-archiv/g-02-ziele-schwerpunkte.png` |
| Einheit A von Heute: RIR, Vorbelegung, Stufen-Hinweis, Zusatzsatz („Ziel erreicht – Zusatzsätze zählen als Bonus“), „Satz fertig“ frei bei Pausenleiste | bestanden | `…_225645/` bis `…_225917/` |
| „Was war los?“ bei schwacher Einheit | bestanden (Karte erscheint, Gründe wählbar) | `f-zusammenfassung/f-02…` |
| Zusammenfassung: Intensitäts-Pillen, Fußleiste ohne Kasten, Hinweis nach dem Training | bestanden | `f-zusammenfassung/f-01…`, `f-03…` |
| Feier für eine Stufe (Wand → Schräge Liegestütze, 2 von 6) | bestanden | `f-zusammenfassung/f-04-feier.png` |
| Feier für mehrere Stufen | im Simulator nicht erreicht (die zweite Karte habe ich nicht getroffen); Code-Simulation W2-9 grün | – |
| Stufen-Sticker hell und dunkel sichern, mit PIL prüfen | bestanden (RGBA 1080 × 762, transparenter Rand, keine Gewichte oder Maße) | `sticker/` |
| Vorlage während der Einheit archivieren, dann speichern (Fix `49de951`) | bestanden (gespeichert, Zusammenfassung schließt) | `g-archiv/` |
| Pausenleiste beim Start der nächsten Einheit | gescheitert → behoben (`9f165a9`) | `g-archiv/g-01…` |
| „Als Nächstes“ nach archivierter Einheit | gescheitert → behoben (`e5cb13c`) | `g-archiv/g-03…` |
| Skill-Ziel setzen (Liegestütze, 12 Wdh.) | teilweise: gespeichert, aber Tastatur verdeckt das Blatt (Befund 4); „Aktuell“ zeigte die frühere Einheit des Tages → behoben (`91e9959`) | `h-skill/` |
| Aufbau-Karte auf Heute | sichtbar („Du baust auf: +1 Stufe“), Maße nicht mehr eingetragen | – |
| Maße eintragen, Skill-Ziel-Sticker | nicht geprüft (Abbruch) | – |
| Mahlzeiten-Gruppierung, Makro-Verlauf mit Blase/Wischen/Tipp | nicht testbar (anonym: Erfassen nur mit Konto oder Foto-Scan) | – |
| Sprachen DE/EN/ES auf Heute, Ernährung, Training, Zusammenfassung | nicht geprüft (Abbruch) | – |
| Zugang: Paywall erst beim Erfassen, Ansehen und Export frei | nicht testbar mit anonymem Nutzer (kein RevenueCat-Schlüssel im Dev-Client) | – |

## 3. Befunde nach Schwere

| # | Schwere | Befund | Status |
|---|---|---|---|
| 1 | hoch | Start von Heute ignorierte die Entlastungswoche (volle Sätze statt einem weniger) | behoben `0876851` |
| 2 | mittel | Pausen-Timer wurde nur beim Abmelden zurückgesetzt: nächste Einheit startete mit „Weiter geht's“, eine laufende Pause klingelte nach dem Speichern | behoben `9f165a9` (`shouldStopRestTimer`) |
| 3 | mittel | Letzte Einheit archiviert → „Als Nächstes“ springt auf die erste Einheit (A direkt nach A) | behoben `e5cb13c` |
| 4 | mittel | Skill-Ziel-Blatt: Tastatur verdeckt Feld und „Ziel speichern” (`SkillGoalSheet` ohne `KeyboardAvoidingView`, `supplements.tsx` hat einen) | behoben `1458bbd`; alle anderen Blätter mit Zahleneingabe geprüft, nur dieses betroffen |
| 5 | niedrig | Schwerpunkt „Mehr Ballaststoffe” wirkt bei Muskelaufbau nicht, weil keine Ballaststoff-Empfehlung entsteht | behoben `f7ea702` — Produktentscheidung: ein gewählter Schwerpunkt darf jetzt eine Karte zeigen, die das Ziel allein nicht zeigen würde (fiber, carbs_training), noch vor den eigenen Themen des Ziels |
| 6 | niedrig | Skill-Ziel „Aktuell” nahm bei zwei Einheiten am Tag die frühere | behoben `91e9959` |
| 7 | niedrig | Kalorienziel-Karte auf Heute zeigte nach dem Setzen weiter „Kalorienziel festlegen”; nach Neuladen richtig | geprüft: `calorie-goal.tsx` invalidiert `profile-settings`, `home-dashboard`, `macro-goal-editor` bereits korrekt; keine React-Query-Invalidierung ist als Node-Test abbildbar, im Simulator nicht erneut reproduziert |
| 8 | niedrig | Die Einheit scrollt nach, wenn sich die Höhe der Pausenleiste ändert, und verdeckt dabei den Kopf mit „Beenden“ | offen, bewusster Kompromiss |
| 9 | Test | Modale Blätter (Vorlagen-Vorschau, Übersicht, Skill-Ziel) sind für Maestro nur per Koordinate erreichbar; eine System-Rückfrage (Einfügen) schließt das Blatt | offen, VoiceOver-Prüfung auf dem Gerät |

## 4. Nur auf dem Gerät testbar

- Paywall und Kauf (RevenueCat-Schlüssel, Sandbox-Konto)
- Mahlzeiten per Foto-Scan und Barcode, danach Gruppierung und Makro-Verlauf mit echten Tagen
- Haptik beim Wischen im Makro-Verlauf
- Mitteilung und Live Activity der Pause (auch: endet sie nach dem Speichern, Fix `9f165a9`)
- Apple Health (Sport-Energie, `is_manual` neben Uhr-Workouts)
- VoiceOver in den modalen Blättern
- Tastatur im Skill-Ziel-Blatt (Befund 4) auf kleinen Geräten

## 5. Empfehlung für den Build

Build 33 ist vertretbar, sobald Befund 4 behoben ist. Das ist eine Zeile Layout in `SkillGoalSheet.tsx`, ohne sie tippt man den Zielwert blind ein. Die drei neuen Fixes sind klein, mit Tests abgesichert und im Simulator bestätigt. Vor dem Einreichen auf dem Gerät noch nachholen: Sprachen DE/EN/ES, Maße und Skill-Ziel-Sticker, Paywall-Zugang.

## 6. Nachtrag vor dem nächsten Build (26.09.2026)

Vor dem für 23:25 angekündigten Build noch auf `main` erledigt:

- **Befund 4** behoben (`1458bbd`): `SkillGoalSheet` bekommt dasselbe `KeyboardAvoidingView` wie `supplements.tsx`. Dabei alle anderen `GlassBottomSheet`-Blätter mit Text-/Zahleneingabe durchsucht (Maße, Gewicht, Kalorienziel, manuelle Mahlzeit, Vorlagen-Umbenennen, Widerruf): Maße/Gewicht nutzen einen eigenen, bereits funktionierenden `bottom: keyboardHeight`-Ausgleich; Kalorienziel ist ein eigener Screen mit eigenem `KeyboardAvoidingView`; manuelle Mahlzeit/Mahlzeit bearbeiten teilen sich `MealItemsSheetBody`, die bereits eines hat; Vorlagen-Umbenennen läuft über `Alert.prompt` (System, betroffen wäre es nicht); Widerruf nutzt die `center`-Darstellung, die bereits gepolstert wird. `SkillGoalSheet` war die einzige betroffene Stelle.
- **Befund 5** behoben (`f7ea702`), als Produktentscheidung statt „offen": ein gewählter Schwerpunkt kann jetzt eine Karte zeigen, die das Ziel allein nicht zeigen würde (Ballaststoffe, Energie-vor-dem-Training), mit Rang direkt vor den eigenen Themen des Ziels — nicht nur eine Umsortierung bestehender Karten. Ohne eigenen Ziel-Grund (`reason: null`). Test in `recommendations.test.ts` und `week-simulation-1-4.test.ts` (W2-4) angepasst.
- **Befund 7** geprüft, nicht verändert: `calorie-goal.tsx` invalidiert nach dem Speichern bereits `profile-settings`, `home-dashboard` und `macro-goal-editor` — genau die Abfragen, aus denen sich die Heute-Karte speist. Keine Code-Änderung nötig; React-Query-Invalidierung lässt sich nicht als reiner Node-Test abbilden, im Simulator diesmal nicht erneut reproduziert.
- Screenshots der Tastatur-Behebung (Simulator „Kolibi QA" und „Kolibi QA klein") sowie die verbleibenden, im Simulator zu prüfenden Punkte (Maße eintragen, Skill-Ziel-Sticker per PIL, Sprachen DE/EN/ES auf Heute/Ernährung/Training/Zusammenfassung) stehen noch aus.

`npm test`: 1154 bestanden, 0 fehlgeschlagen (1 übersprungen). `tsc`: 73 Fehler gesamt, davon weiterhin 15 in `src/` — unverändert zur Baseline oben, keiner durch diese Änderungen verursacht (per `git stash`-Vergleich geprüft).
