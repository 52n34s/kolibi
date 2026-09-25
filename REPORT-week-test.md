# Wochentest 1.4.0

Stand `release/1.4`. Simulator „Kolibi QA“ (UDID `56480505-679E-42DF-934D-57326E9F1726`), lokaler Dev-Build, Metro auf 8082, frischer anonymer Nutzer (Schlüsselbund und App-Daten des QA-Simulators zurückgesetzt). Keine Migration aus 1.4 ist in der Datenbank ausgeführt – Funktionen, die eine brauchen, sind bewusst ausgeblendet. Uhrzeit unverändert (Fr, 25.09.2026, abends). Screenshots: `~/Desktop/kolibi-1.4-check/week/`, `…/home/`, `…/sticker/`.

## 1. Code-Simulation (`src/lib/__tests__/week-simulation-1-4.test.ts`)

Montag 28.09. bis Sonntag 04.10.2026 plus Folgemontag, injizierte Daten, Profil Muskelaufbau, Plan aus `buildPlan` (4 Tage, Push und Pull & Legs). Läuft in UTC, Los Angeles und Auckland gleich.

| # | Prüfung | Ergebnis |
|---|---|---|
| 0 | Plan: Push + Pull & Legs, je 6 Übungen | bestanden |
| 1a | Kalorien-/Makroziele je Tag (Trainingstage höher, Protein konstant, Makro-kcal = Tagesziel) | bestanden |
| 1b | Energie ohne Doppelzählung (Kraft-Einheit der Uhr nicht doppelt, Lauf genau einmal) | bestanden |
| 1c | Ohne Health / gemessener Umsatz: Ziel konstant, Muskelaufbau = Erhaltung | bestanden |
| 1e | Aktivenergie kleiner als Workout-Energie | teilweise (Befund 3) |
| 2 | Progression inkl. RIR (hart + RIR ≥ 2 → sofort; RIR 0/ohne → alte Regel) | bestanden |
| 3 | Bestwerte und „Zum ersten Mal“ ohne Selbstvergleich | bestanden |
| 4 | Wochenkarte (Tage und Marker) | bestanden |
| 5 | Rückblick rollierend (Woche, Monat) | bestanden |
| 6 | Alle 7 Sticker-Arten ohne Gewicht, Maße, Last, Kalorienziele | bestanden |
| 7 | Tagesform mit/ohne Check-in | bestanden |
| 8 | Empfehlungen je Tageszeit und Ziel | bestanden (Befund 2 inzwischen behoben) |
| 9 | Muskelgruppen-Zählung | bestanden |
| 10 | Aufbau-Satz metrisch und imperial | bestanden |
| 11 | Skill-Prognose (zu wenig Daten → Hinweis; 4 Wochen → Zeitraum) | bestanden |
| 12 | Mahlzeiten-Gruppierung und Protein nach Tageszeit | bestanden |
| 13 | Imperial-Anzeige | bestanden |

Tests gesamt nach allen Fixes: 940/940 (1 übersprungen: dokumentiert Befund 1).

## 2. Abläufe im Simulator

Maestro-Abläufe: `.maestro/week-1-4/` (Runner `scripts/week-test/maestro.sh`, nur mit `KOLIBI_QA_UDID`).

| Ablauf | Ergebnis | Screenshots |
|---|---|---|
| Onboarding mit „Beides“ (7 Schritte, neue Zielauswahl) | bestanden | `week/tag1/01–04` |
| Plan-Assistent öffnet sich danach, absoluter Einsteiger ohne Ausrüstung | bestanden (Plan = Testfall 1 aus 2.3) | `week/tag1/05–08` |
| Heute: anonym am ersten Tag | bestanden | `home/typ3-anonym-erster-tag-heute.png` |
| Heute: Muskelaufbau mit Training („Als Nächstes · Start“) | bestanden | `home/typ2-muskelaufbau-mit-training-heute.png` |
| Heute: Abnehmen (Reihenfolge Ernährung → Körper → Training, Gewichtskarte, Ballaststoffe) | bestanden nach Fix F2 | `home/typ1-abnehmen-heute.png` |
| Kolibi-Vorlage übernehmen (Push aus „Push / Pull & Legs“) | bestanden | `week/tag2/01–03` |
| Einheit von Heute starten, 2 Sätze, App beenden, neu starten → Einheit wiederhergestellt | bestanden | `week/tag2/05–06` |
| Zusammenfassung „Zum ersten Mal“, kein falscher Bestwert | bestanden | `week/tag2/07` |
| Einheit-Sticker mit Story-Option | bestanden | `week/tag2/08` |
| Fortschritt → Training → Muskeln (Zählung primär 1 / sekundär 0,5) | bestanden | `week/tag2/09` |
| Muskel-Empfehlung → „In Einheit übernehmen“ | bestanden nach Fix F1 | `week/tag2/10–12` |
| Empfehlung wegwischen | bestanden | `week/tag7/05` |
| Sprachen EN / ES (Heute, Ernährung) | bestanden | `week/tag7/01–04` |
| Zielprognose zeigt ein Datum („etwa Anfang Dezember 2026“) | bestanden | Onboarding-Review, Ziel Abnehmen |
| Alle Sticker als PNG, Transparenz und Füllgrad (PIL) | bestanden nach zwei Sticker-Fixes | `sticker/*` |

## 3. Fehler nach Schwere

| Schwere | Fehler | Status |
|---|---|---|
| hoch | **F1** „In Einheit übernehmen“ hob eine Übung von 2 auf 12 Sätze (rotierende Einheiten ohne Wochentage bekamen die ganze Wochenlücke) und schlug Übungen mit fehlender Ausrüstung vor | behoben (de5b031): höchstens +2 Sätze je Übernahme, max. 6 Sätze je Übung, Wochenziel über die Einheiten verteilt, Ausrüstung aus dem Assistenten |
| mittel | **F2** Nach Zieländerung (Ziele → Review) zeigte Heute alte kcal, Reihenfolge und Karten bis zum Neustart (auch auf main) | behoben (139b022) |
| mittel | **F3** Rotierende Pläne (Assistent) bekamen nie „Kohlenhydrate vor dem Training“ / Ruhetag-Hinweis | behoben (ca74aaa), Annahme: Trainingstag, solange das Wochenziel offen ist |
| mittel | Rückblick-Titel auf der Story-Karte winzig | behoben (7d79a8d) |
| niedrig | „650 kcal“ brach beim Mahlzeit-Sticker um | behoben (df8c270) |
| mittel | Verlauf zeigt vergangenen Trainingstagen ein zu niedriges Ziel, wenn die Einheit ohne Workout der Uhr lief (`history.ts:300`) | dokumentiert (Befund 1, lädt nicht unter node) |
| niedrig | Aktivenergie später als Workouts → Makros auf mehr Energie ausgelegt als das kcal-Ziel zeigt | dokumentiert (Befund 3) |
| niedrig | Aufbau-Satz „Bankdips, Knie gebeugt +3“ liest sich wie zwei Einträge; Minuszeichen uneinheitlich | dokumentiert |
| niedrig | Nach einer Einheit zeigt die Muskelansicht für fast jede Gruppe einen Hinweis (10 Sätze Lücke) | dokumentiert, Produktfrage |
| niedrig | Datumsauswahl im Onboarding: ungedreht übernimmt „Fertig“ kein Datum (bekannt aus 1.3) | dokumentiert |
| info | Leertexte wie „No meals yet today“ / „Aún no hay comidas hoy“ sind Verneinungen (vorbestehend) | dokumentiert |

## 4. Nicht testbar

- Ohne ausgeführte Migrationen ausgeblendet: Check-in, eigene Vorlagen / „Als Vorlage speichern“, Wiederholungen in Reserve, „Was war los?“, Maße eintragen, Skill-Ziel, Muskelauswahl eigener Übungen, `strength`-Enum, `usage_purpose`-Spalte, `register_push_token`.
- Foto-Scan/Mahlzeiten-Gruppierung im Simulator: Es gibt nur private Fotos auf dem Mac; die habe ich nicht an die Bildanalyse geschickt. Gruppierung in der Code-Simulation geprüft; in älteren Testdaten als „Snack · 3 Einträge“ sichtbar.
- Paywall nach den kostenlosen Scans (4 Scans nötig, erlaubt waren höchstens 3) und Zugang registrierter Nutzer ohne Abo (kein echter Account).
- Stufenaufstieg annehmen (braucht mehrere Einheiten an der oberen Grenze).
- Live-Aktivität, Dynamic Island, Haptik, Instagram Stories: nur auf dem Gerät (neue native Module fehlen im alten Dev-Client).

## 5. Empfehlung

Nach dem Ausführen der Migrationen einmal auf einem Gerät: Check-in, RIR/„Was war los?“, eigene Vorlagen, Maße, Skill-Ziel und die Live-Aktivität durchspielen. Mit dem Code-Stand von `release/1.4` spricht aus dem Test nichts gegen den 1.4-Build; die offenen Punkte sind niedrig oder Produktfragen.
