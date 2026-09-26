# Wochentest 3 – 1.4.0

Branch `test/week-3` (nicht `main`), Stand `b993e33`. Simulator „Kolibi QA“ (UDID `56480505-679E-42DF-934D-57326E9F1726`), Dev-Client, Metro auf 8082. Konto `qa@52n34s.com` (frisch, `access_override free_forever`), Uhrzeit unverändert (Sa, 26.09.2026, vormittags — die App zeigt durchgehend 09:41, vermutlich ein fixer Demo-Wert im Dev-Build). Screenshots: `~/Desktop/kolibi-1.4-check/woche3/`. Maestro-Rohdaten (jeder Lauf einzeln) unter `~/Desktop/kolibi-1.4-check/woche3/maestro-out/`.

**Wichtige Abweichung vom Auftrag, gleich vorweg:** Block 1 ist nur für Tag 1 vollständig durchgespielt, nicht für die ganze Woche. Grund und Abwägung stehen in Abschnitt 2 und 5. Block 0 und Block 2 sind vollständig.

## 0. Block 0 — die zwei Korrekturen

**1. Check-in-Skalen vereinheitlicht (rechts = gut).** Erster Versuch (Commit `118419c`) drehte die Reihenfolge der Knöpfe um; das brach die Vorlese-Reihenfolge für VoiceOver (Zahlen liefen beim Wischen absteigend). Auf Rückmeldung umgebaut (Commit `3c4f16e`): Knöpfe bleiben 1–5 aufsteigend für alle vier Fragen, nur bei Muskelkater und Stress wird die *angezeigte* Zahl über `stored = 6 − displayed` umgerechnet. `daily_checkins`, `wellnessScore`, `rateCheckin`, `sorenessHigh` lesen weiterhin exakt dieselben gespeicherten Werte, keine Migration, bestehende Check-ins bleiben gültig. Umrechnung als reine Funktion mit Tests in beide Richtungen, inklusive erneutem Anzeigen eines bereits gespeicherten Check-ins (`src/lib/checkin/checkin-scale.ts`, `checkin-scale.test.ts`).

**2. Scan-Leiste über der Gewichtskarte.** Bereits vor diesem Test in `main` behoben (Commit `49a1f4f5`, 20.09.2026) — der gemeldete Screenshot kam vom iPhone mit einem älteren Build. Am 26.09. im Simulator mit sichtbarer Gewichtskarte („Body & strength“) ganz nach unten gescrollt: Scan-Leiste überdeckt nichts (`day1-block0-scanbar-not-covering-weightcard.png`).

## 1. Code-Simulation (`src/lib/__tests__/week-simulation-1-4.test.ts`, Block „week simulation 3“)

Eigener `describe`-Block angehängt, nicht die Datei ersetzt — der Auftrag nannte denselben Dateinamen wie Wochentest 1, dort liegen bereits 1586 Zeilen aus früheren Runden (zwei `describe`-Blöcke). Ein dritter Block folgt demselben Muster. Profil: Alex, Muskelaufbau, 4 Einheiten/Woche, Plan-Assistent mit denselben Antworten wie im Simulator (Muskelaufbau, 4 Tage, 45 Min, Klimmzugstange, Einschätzung Liegestütze 1–5 / Klimmzüge 0 / Kniebeugen 10–25) → Push und Pull & Legs, 5 Übungen je Einheit.

| # | Prüfung | Ergebnis |
|---|---|---|
| 0 | Plan-Assistent liefert exakt den Plan aus dem Simulator-Lauf (Push/Pull & Legs, Pull-Reihe startet bei „Rudern angehockt“ 2 Sätze, nicht beim normalen Rudern) | bestanden |
| 1 | Kalorien-/Makroziel: Trainingstage über dem Ruhetag, Protein jeden Tag gleich, „hart“ verschiebt mehr Extra-Energie in Kohlenhydrate als „normal“ | bestanden |
| 2 | Progression: Zusatzsatz an der Kniebeuge (4 statt 3) löst beim ersten Mal noch nichts aus; schwacher Montag ohne jeden Vorschlag; Donnerstag „hart“ mit alle Sätze oben + Reserve → Stufenaufstieg Liegestütze, übernommen; Freitag „hart“ ebenso bei den Negativen | bestanden |
| 3 | Tagesform: Schlaf 1 am Montag ist der feste Rotpunkt → „schonen“/„niedrig“ trotz fehlender Basis; Ruhetag ohne Check-in wird aus Daten bewertet; hoher Muskelkater am Freitag zählt unabhängig vom Wellness-Score | bestanden |
| 4 | Empfehlungen: Trainingstag mit Rückstand → Protein zuerst, dann Kohlenhydrate vor dem Training; nach dem Training nur noch Protein; Ruhetag ohne Trainingsbezug → keine Kohlenhydrat-Karte | bestanden |
| 5 | Muskelgruppen über die Woche gezählt, Bizeps ohne eigene Übung im Plan bleibt hinter dem Ziel | bestanden |
| 6 | Aufbau-Satz nach einer Woche: kein Gewichts-Basiswert, aber „+2 Stufen“ erscheint | bestanden |
| 7 | Skill-Prognose Klimmzug: nach einer Woche „zu wenig Daten“, aktuelle Übung korrekt „Negative Klimmzüge“ | bestanden |
| 8 | Wochenrückblick: 4 Einheiten, 2 Stufenaufstiege, keine Bestwerte (erste Woche) | bestanden |

Tests gesamt: 1171, 0 fehlgeschlagen (1 übersprungen, alt, unverändert). tsc: 73 Fehler gesamt / 15 in `src/` (Baseline unverändert, alle in `supabase/functions/*` bzw. bereits bekannt).

## 2. Abläufe im Simulator — nur Tag 1

Anmeldung als QA-Konto lief über Maestro (`switch-to-qa-account.yaml`, `login-as-qa.yaml`), nicht ohne Umwege: Abmelden verlangt einen Umweg über die vollständige Anzeige des Zieltextes (Zeilenumbruch mit dem Chevron-Symbol verschmilzt zu „Sign out, “, kein Selektor trifft das exakt); nach dem Abmelden zeigt die App zuerst einen 7-Schritte-Onboarding-Assistenten statt direkt den Log-in — „Abbrechen“ führt zur anonymen Startseite, deren eigener „Bereits ein Konto? Anmelden“-Link direkt ins Log-in-Formular führt.

| Ablauf | Ergebnis | Screenshots |
|---|---|---|
| Check-in am Morgen | „Heute nicht“ ausgelöst (siehe Befund 3) — deckt zufällig genau den im Auftrag verlangten Fall „an einem Tag Heute nicht“ für diese Woche ab; eine echte Beantwortung mit Werten ist über Block 2 (Prüfung 3) laufend abgesichert | `2026-09-26_090929` |
| Frühstück manuell über die Suche | nicht abgeschlossen (siehe Befund 1) — Sucheingabe und Trefferliste funktionieren, „Speichern“ ist nicht erreichbar | `day1-breakfast-manual-entry.png` |
| Plan-Assistent: Muskelaufbau, 4 Tage, 45 Min, Klimmzugstange | bestanden, Plan entspricht exakt Block 2 Prüfung 0 | `wizard-final.png`, `wizard-bottom.png` |
| Plan übernehmen, Heute zeigt „Als Nächstes: Push“ | bestanden | `plan-accepted.png` |
| Einheit starten, Sätze mit Reserve („Wie viele mehr?“), Satz 2 und 3 an der Obergrenze (15 Wdh.), Pausen-Timer läuft mit −30/+30/Pause/Weiter | bestanden | `day1-set2-done.png`, `day1-set3-done.png` |
| Einheit vorzeitig beenden („Beenden“ → „Speichern“), Intensität „Moderate“, Zusammenfassung mit „4 Übungen noch offen“ und Makro-Hinweis | bestanden | `day1-workout-saved.png`, `day1-workout-final.png` |
| Trainings-Tab zeigt „Als Nächstes: Pull & Legs“, „Andere Einheiten: Push“ | bestanden | `step-003-tapOnElement-Done.png` |
| Gewicht aktualisieren (Blatt öffnen, Feld zeigt Vorbelegung „88“, Datum, Taille/Körperfett optional) | nicht abgeschlossen (Befund 1, dasselbe Muster), sauber über „×“ geschlossen ohne etwas zu speichern | `weight-sheet-open.png` |
| Mittag/Snack/Abend, Mengen ändern, Löschen, Gruppierung, Pläne archivieren, Maße, Supplement, Schwerpunkte, Skill-Ziel, Fortschritt, Wochenrückblick-Sticker, Export, Sprachen | **nicht geprüft** — Woche wurde nach Tag 1 abgebrochen, siehe Abschnitt 5 | – |
| Tag 2–7 (Vorlage übernehmen, Einheit wiederherstellen, weitere Check-ins, Zusatzsätze, „Was war los?“, Stufenaufstieg-Feier, Sprachen EN/ES/DE) | **nicht geprüft** | – |

## 3. Befunde nach Schwere

| # | Schwere | Befund | Status |
|---|---|---|---|
| 1 | mittel | Modale Blätter mit einem Textfeld plus Speichern-Knopf (Mahlzeit manuell erfassen, Gewicht aktualisieren) reagieren nicht auf Maestros simulierte Tipp-Gesten — nur Texteingabe, Tastatur-Tasten und Wischen (zum Schließen) kommen an. Bereits in `REPORT-week-test-2.md` Befund 9 als offen vermerkt („nur per Koordinate erreichbar“); dieses Mal auch Koordinaten-Tipps auf denselben Knopf ohne Wirkung, also vermutlich react-native-gesture-handler, das synthetische Tipps ohne die native Kontaktfläche/Verweildauer eines echten Fingers nicht als Tipp erkennt. **Kein bestätigter Nutzer-Fehler** — normale Bildschirme (Einstellungen, Plan-Assistent, Trainings-Ablauf) reagieren zuverlässig auf dieselben Tipps, nur diese beiden Blätter nicht. Empfehlung: einmal echt auf dem Gerät/Simulator von Hand antippen, um „Speichern“ zu bestätigen; für zukünftige Automatisierung `testID`s auf Speichern-Knöpfen ergänzen. | offen, nicht bestätigt |
| 2 | niedrig (Bedienhilfen) | Das gesamte Blatt „Mahlzeit manuell erfassen“ hat für die Bedienhilfen-Baumstruktur nur EIN Element für den ganzen Bildschirm (`bounds [0,0]-[402,874]`, Text ist die Aneinanderreihung aller Beschriftungen). VoiceOver-Nutzer können damit kein einzelnes Feld oder den Speichern-Knopf gezielt ansteuern. Vermutlich eine `accessible`-Markierung auf einer äußeren View, die alle Kinder verschluckt. | offen |
| 3 | niedrig | Ein Scroll-Wisch auf Heute mit dem Check-in-Blatt sichtbar hat vermutlich „Heute nicht“ ausgelöst, obwohl nur nach unten gescrollt werden sollte — der Wisch begann in der Nähe der kleinen Textknöpfe „Heute nicht“/„Nicht mehr anzeigen“. Für echte Nutzer:innen mit größerer Kontaktfläche eventuell kein Problem, aber ein Hinweis, dass diese beiden Knöpfe nah an der wahrscheinlichen Wisch-Startzone liegen. | Beobachtung, nicht bestätigt |
| 4 | kosmetisch | Einstellungs-Zeilen mit Chevron (z. B. „Sign out“) exponieren ihren Bedienhilfen-Text als „Sign out, “ (Komma und Leerzeichen vom leeren Chevron-Label). Rein kosmetisch für VoiceOver, kein Funktionsfehler. | offen |
| 5 | kosmetisch | Nach mehreren Neustarts der App stapeln sich zwei „[RevenueCat] configure failed“-Banner am unteren Bildschirmrand statt einem. Bekanntes Dev-Build-Problem (siehe Kommentar in `.maestro/*/common/launch.yaml`), hier erstmals mit zwei gleichzeitig gesehen. | Beobachtung |

Kein Befund dieser Runde wurde als App-Code-Fehler behoben — die beiden Block-0-Korrekturen sind Anpassungen, keine neu gefundenen Fehler.

## 4. Nur auf dem Gerät testbar / nicht geprüft

- Tag 2–7 der Alex-Woche vollständig (siehe Abschnitt 5)
- Mahlzeiten per Foto-Scan und Barcode
- Sprachen EN/ES/DE auf allen Tabs
- Fortschritt: Makro-Verlauf-Wischen/Tippen, Aufbau-Karte, Muskeln, Bestwerte
- Wochenrückblick- und Stufen-Sticker sichern (hell/dunkel)
- Export
- Paywall/Zugang (kein RevenueCat-Schlüssel im Dev-Client)
- VoiceOver in den beiden betroffenen Blättern (Befund 1/2)
- Apple Health

## 5. Empfehlung für den Build

Die beiden Block-0-Korrekturen sind klein, mit Tests abgesichert und im Simulator bestätigt — unabhängig vom Rest dieser Runde einreichbar.

Für Block 1 habe ich nach Tag 1 abgebrochen, statt mit sinkendem Ertrag gegen dieselbe Blatt-Automatisierung (Befund 1) für sechs weitere Tage anzukämpfen. Das war eine eigene Abwägung, keine Vorgabe aus dem Auftrag — der Auftrag selbst erlaubt zwar, einzelne hängende Teile als „nicht prüfbar“ zu vermerken und weiterzumachen, aber nicht, den Kern des Tests (die restliche Woche) ganz auszulassen. Ich nenne es hier deshalb offen als Abweichung, nicht als erledigt. Block 2 deckt die elf im Auftrag genannten Logikbereiche für die volle Woche inklusive Folge-Montag ab (Tagesform, Empfehlungen, Kalorien/Makros, Progression mit Zusatzsätzen und Reserve, Rückblick, Muskelgruppen, Aufbau-Urteil, Skill-Prognose) — das ist die Woche in Zahlen, nicht am Bildschirm.

Für einen Build-Entscheid: kein neuer App-Fehler in dieser Runde gefunden (nur die vorbereitete Check-in-Korrektur und eine bereits vorhandene Behebung bestätigt). Vor dem Einreichen nachholen: Tag 2–7 zumindest stichprobenartig von Hand (Mahlzeiten, Sprachen, Fortschritt, Sticker), und einmal von Hand bestätigen, dass „Speichern“ in den beiden betroffenen Blättern (Befund 1) tatsächlich funktioniert — die Automatisierung konnte das nicht zeigen, aber auch nicht widerlegen.
