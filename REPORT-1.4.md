# Kolibi 1.4.0 – Arbeitsbericht

Branch `release/1.4`, abgezweigt vom lokalen `main` (48ea6ab), `feat/share-stickers` hineingemergt (97d4808).
Baseline: `npm test` grün, `npx tsc --noEmit | grep -v supabase/functions` = 15 Fehler (alle vorbestehend, siehe „Aufräumen später“).

## Migrationen (nur Dateien, manuell im SQL-Editor ausführen)

| Reihenfolge | Datei | Zweck | Block |
|---|---|---|---|
| 1 | `20260924152000_beginner_ladder_steps.sql` | Einsteiger-Stufen unter den Leitern (schon auf main, seit Build 32 neu) | 1.3-Inhalt |
| 2 | `20260925180000_register_push_token.sql` | RPC, die den Push-Token eines Geräts dem angemeldeten Nutzer überträgt | 1.3 |
| 3 | `20260925190000_workout_template_flag.sql` | `workout_templates.is_template` für „Meine Vorlagen“ | 2.2 |
| 4 | `20260926120000_rir_shortfall_reasons.sql` | `session_sets.rir` (0–3), `workout_sessions.shortfall_reasons` | 2.5 |
| 5 | `20260926123300_profiles_plan_wizard_answers.sql` | `profiles.plan_wizard_answers jsonb` (Vorbelegung des Assistenten) | 2.3 |
| 6 | `20260926143400_exercise_muscles.sql` | `exercises.primary_muscles` / `secondary_muscles` für eigene Übungen | 3.4 |
| 7 | `20260926153500_body_measurements.sql` | Tabelle `body_measurements` (Brust, Oberarm, Hüfte, Oberschenkel), RLS eigene Zeilen | 3.5 |

---

## Setup – Merge `feat/share-stickers` → `release/1.4` (97d4808)

Konflikte:
- `TrainingSummaryView.tsx`: „Zum ersten Mal“ (`milestones`) aus `feat/share-stickers` bleibt. Neue Bestwerte kommen aus `milestones[index] === 'newBest'`; jeder Vergleich nimmt die laufende Einheit mit `withoutSession` aus dem Verlauf. `bestPriorValue`/`bestSessionValue` kommen aus `lib/workouts/session-bests` (auf main dorthin ausgelagert). `newSessionBest` bleibt als getestete Funktion in `session-bests.ts`, die Zusammenfassung nutzt auf diesem Branch die Milestones.
- `progression-history.test.ts`: beide Seiten übernommen, inkl. Test „Zum ersten Mal trotz synchronisierter Sätze“.

Tests 522/522, tsc 15 (Baseline).

---

## Block 1.1 – 1.3-Inhalte im lokalen main

Stand lokales `main` = 48ea6ab.

| Punkt | Vorhanden | Commit / Ort |
|---|---|---|
| A Übungsnamen über `exercise_id`, aktuelle Sprache | ja | c4a9c46 (`displayExerciseName`, `bestSetByExercise`), Vorschaubild-Buchstabe 762d7bb |
| B Scan-Leiste im Fortschritt-Tab aus | ja | c4a9c46 (`hideScanButtons` … `homeTab === 'history'`) |
| C 7-Tage-Volumen chronologisch | ja | c4a9c46 (`oldestFirst`) |
| D Wiederholungen als Summe | ja | c4a9c46 (`targetActualReps: "{{actual}} Wdh."`) |
| E Timer DE Anhalten/Weiter, ES Detener/Seguir | ja | c4a9c46 |
| F TrialValuePitch mit Training | ja | c4a9c46 (`paywall.valuePitch.training`) |
| G Paywall „Ernährung, Training und Auswertung“ | ja | c4a9c46 (`paywall.planIncludesAll`) |
| H Bestwerte gegen frühere Einheiten, Erstausführung kein Bestwert | ja | 48ea6ab |
| I Keep-Awake auf allen Tabs | nein (main) | f887a97 auf `fix/reminders-keepawake`, in `release/1.4` gemergt (95a98e0) |
| J Push-Token | nein (main) | nie auf main; jetzt in `release/1.4` (Block 1.3) |
| K Zugang AGB Ziffer 10 Abs. 5 | nein | nie gebaut; main sperrt registrierte Nutzer ohne Zugang komplett (siehe Block 1.2) |
| L `TRAINING_RELEASED = true` | ja | `src/lib/workouts/training-release.ts:6` |

---

## Block 1.2 – Zugang nach AGB Ziffer 10 Abs. 5

### Ist (vorher, main 48ea6ab)

| Aktion | Registriert ohne Zugang | Anonym nach den Gratis-Scans |
|---|---|---|
| Heute ansehen | Sperrbildschirm (`RegisteredHomeProductLock`) | frei |
| Essen/Historie ansehen | Sperrbildschirm; Tag-Detail → Weiterleitung zu Einstellungen + Paywall | frei |
| Fortschritt ansehen (inkl. Training) | Sperrbildschirm | frei |
| Export | gesperrt (Route-Gate + eigene Sperre im Screen), auch aus Einstellungen → Datenrechte | frei |
| Foto-Scan | Button ausgeblendet, sonst Paywall | Paywall |
| Barcode | Button ausgeblendet, sonst Paywall | immer Registrierung, auch mit freien Scans |
| Manuelle Mahlzeit | Button ausgeblendet, sonst Paywall | immer Registrierung |
| Gewicht eintragen | Karte unerreichbar; Speichern → Paywall | frei |
| Trainings-Tab ansehen | Sperrbildschirm | frei |
| Einheit starten | unerreichbar (kein eigenes Gate) | frei |
| Einheit nachtragen | Weiterleitung zu Einstellungen + Paywall | frei |
| Plan bearbeiten | Weiterleitung zu Einstellungen + Paywall | frei |
| Einstellungen | frei | frei |
| Account löschen | frei | frei |
| Käufe wiederherstellen | frei (nur in der Paywall) | frei (nur in der Paywall) |

### Soll = umgesetzt (registrierte Nutzer ohne Zugang)

| Aktion | Jetzt |
|---|---|
| Heute, Essen/Historie, Fortschritt inkl. Training, Trainings-Tab im Ruhezustand | frei ansehen, Tabs wechseln ohne Paywall |
| Tag-Detail, Einheit-Detail, Übungs-Fortschritt | frei (Route offen); Bearbeiten im Tag-Detail wie bisher → Paywall |
| Export | frei, auch über Einstellungen → Datenrechte |
| Foto-Scan, Barcode, manuelle Mahlzeit | Scan-Leiste sichtbar, Tipp → Paywall |
| Einheit starten | Paywall (neu: `useRequirePlan('startSession')`) |
| Einheit nachtragen, Plan bearbeiten, Starter-Plan übernehmen, neue Einheit | Paywall vor dem Öffnen; ruft jemand die Route direkt auf, erscheint die Paywall über dem vorherigen Screen |
| Gewicht eintragen | **unverändert**: Speichern → Paywall. Neu ist nur, dass die Karte sichtbar ist. |
| Einstellungen, Account löschen, Käufe wiederherstellen | frei (unverändert) |
| Zugang läuft ab | Paywall einmal beim Öffnen, der Tab bleibt |

Anonyme Nutzer: unverändert (ansehen frei, Foto-Scan nach dem Limit → Paywall, Barcode/manuell → Registrierung).

Technik: `resolveActionAccess` und `koliRouteAccess` in `src/lib/product-access.ts` (reine Funktionen, 7 neue Tests), `useRequirePlan`, app-weiter `GlobalPaywallHost` mit `usePaywallRequestStore`. `RegisteredHomeProductLock` und die Texte `home.productLock` sind entfernt.

Commits: 46f8138, 6b7984e, 7bcc92b, 38198c8, 4dbc6d8, 2b62a5e. Tests 538/538, tsc 15.

**Annahmen / Fragen**
- ❓ Ziele (Kalorien-, Protein-, Makro-, Bewegungs-, Trainingsziel, Zielgewicht), Supplemente, Übungskatalog und Trainingslog (`/koli/training-log`) bleiben hinter dem Zugang. AGB nennt sie nicht ausdrücklich; es sind Einstellungen bzw. neue Einträge.
- ❓ Einheit-Detail (`/koli/workout-session/[id]`) ist offen, inklusive Bearbeiten und Löschen vergangener Sätze. Das Tag-Detail sperrt Bearbeiten dagegen. Soll ich das Einheit-Detail angleichen (nur ansehen)?
- ❓ Anonym: Training bleibt frei. AGB beschränkt für anonyme Nutzung nur die Foto-Analysen.
- Diff: `git diff 0cd2f80..2b62a5e`.

---

## Block 1.3 – Supplement- und Mahlzeiten-Erinnerungen

Umgesetzt:
1. **Migration** `20260925180000_register_push_token.sql`: `register_push_token(p_token text, p_platform text, p_device_id text default null)`, `SECURITY DEFINER`, `search_path = public, pg_temp`. Löscht Zeilen mit demselben Token bei anderen Nutzern und Zeilen derselben `device_id` mit anderem Token, dann Insert/Update für `auth.uid()` (setzt `updated_at`, `last_used_at`). `execute` nur für `authenticated`, entzogen für `public` und `anon`.
2. **Client** (`src/lib/push-token-store.ts`, `notifications.ts`): RPC zuerst. Fehlt sie noch (`PGRST202`/`42883`), der bisherige Weg Delete + Upsert, jetzt mit Fehlerauswertung. RLS-Ablehnung (`42501`, Token gehört einem anderen Account), Upsert ohne Zeile oder sonstiger Fehler → `'token_failed'` plus Sentry-Meldung mit `push_token_failure`, `push_token_via`, `db_error_code`.
3. **Account-Wechsel**: `completeExistingIdentitySignIn` und `signInWithEmail` geben den Token des bisherigen (meist anonymen) Nutzers frei, bevor der Wechsel passiert. Scheitert das Passwort-Login, wird der Token dem bisherigen Nutzer zurückgegeben. Den neuen Account registriert `_layout` beim Wechsel der `userId`. Logout gibt den Token frei (wie bisher, jetzt mit Fehlerauswertung und Rückfall auf die Geräte-ID).
4. **Berechtigung aus**: Speichern ohne Berechtigung legt die Erinnerung ausgeschaltet an und zeigt „Erinnerung gespeichert, noch ausgeschaltet“ mit „Zu den Einstellungen“ (`Linking.openSettings`) und „Später“. Beim Einschalten per Schalter derselbe Hinweis. Schlägt nur die Token-Registrierung fehl, bleibt der Editor mit dem Entwurf offen.
5. **Cron-Migration**: nicht geschrieben. → Frage unten.
6. **Tests**: `push-token-store.test.ts` (6 Tests, u. a. Übernahme über die RPC, RLS-Ablehnung auf dem Rückfallweg).

Commits: 7af32e4, cefe3c3, ca081e0, cf641b2, 0cd2f80. Keep-Awake: f887a97 (Merge 95a98e0).
Tests 531/531, tsc 15 (Baseline).

Doppelte Pushes: `send-supplement-reminders` liest vor dem Senden `supplement_reminder_log` für `(reminder_id, sent_on)` und überspringt bereits gesendete; nach dem Senden `insert` mit `unique (reminder_id, sent_on)`, ein `23505` zählt als bereits gesendet. Pro Erinnerung und lokalem Tag also höchstens ein erfolgreicher Versand. Lücke: Schlägt das Log-Insert nach erfolgreichem Expo-Versand aus anderem Grund fehl, kann der nächste Lauf im selben 30-Minuten-Fenster erneut senden.

Prüfung nach dem Ausführen der Migration (im SQL-Editor, rollt zurück):
```sql
begin;
-- als eingeloggter Nutzer simulieren: set local role authenticated; set local request.jwt.claims = '{"sub":"<deine-user-id>"}';
select public.register_push_token('<dein ExponentPushToken[…]>', 'ios', null);
select user_id, device_id, updated_at from public.push_tokens where expo_push_token = '<dein ExponentPushToken[…]>';
rollback;
```

**Fragen**
- ❓ Cron-Migration (1.3.5): Bitte die Ausgabe von `select jobname, schedule, command from cron.job order by jobid;` schicken. Ohne die exakten Befehle (Vault-Secret-Namen, URL-Quelle) schreibe ich keine Migration, die laufende Jobs ersetzt.
- ❓ `p_device_id` als dritter Parameter mit Default `null` (so von dir in 1.3 beschrieben).

---

## Block 2.1 – Sticker

- Alle fünf Typen sind in `release/1.4`: Übung, Stufe, Einheit, Rückblick (Woche/Monat, rollierendes Fenster), Fortschritt (`src/components/share/stickers/*`, Daten `src/lib/share/sticker-data.ts`).
- Einpassung der Story-Karte kam schon mit `feat/share-stickers` (ee2543e, 24a7507, 60ec34d, 73c4dd3): `StoryFrame` misst den Inhalt und skaliert auf ~70 % Kastenhöhe (sichtbar 65–70 %), 1- bis 2-fach, Titel/Werte einzeilig, Fortschritt ohne Stufenwechsel mit 2,2-facher Kurve. Gemessener Füllgrad laut `REPORT-share-stickers.md`: Rückblick Woche 66,9 %, Monat 67,8 %, Fortschritt 67,4 %, Fortschritt mit Stufenwechsel 68,6 %; kurzer Rückblick 28,5 % (2-fach-Grenze hat Vorrang).
- **Neu:** Story-Karte auch für Übung, Stufe und Einheit (f0c8f98, e3a7d30); die Zusammenfassung bietet das Story-Format an. Titel auf der Story-Karte einzeilig mit Verkleinerung.
- `StickerBrand`: „kolibi.app“ plus markierter Platz (`mark`) für das SVG – unverändert.
- **PNGs nicht erzeugt.** Der Simulator „Kolibi QA“ wird gerade von einer zweiten Sitzung genutzt (Metro aus `~/Dev/Kolibi-wt-f4b`, Branch `fix/session-end`, Port 8082). Ich habe in diese Sitzung nicht eingegriffen. Die QA-Seite zum Export liegt bereit (nicht committet) und läuft in Block 6.1 bzw. sobald der Simulator frei ist. Füllgrad für Übung/Stufe/Einheit als Story daher noch ungemessen.

---

## Block 2.2 – Vorlagen

- Vorhandene Archivierung (a9e0337): `workout_templates.archived_at`, `archiveTemplate`/`restoreTemplate`, Abschnitt „archiviert“ im Plan-Editor. Wird genutzt.
- Ergänzt: Spalte `is_template boolean not null default false` (Migration 3). Einheit = `is_template false` (aktiv ohne `archived_at`, „frühere Einheit“ mit), eigene Vorlage = `is_template true`; Vorlage löschen = archivieren (nichts wird gelöscht).
- RLS bestätigt: `workout_templates` hat vier Policies `select/insert/update/delete … using/with check (user_id = auth.uid())` für `authenticated` (Migration `20260922101000_workout_logger.sql`). Keine Änderung nötig.
- Alle Lesestellen für Training, „Als Nächstes“, Wochenkarte, Fortschritt, Rückblick und Export laufen über `fetchTemplates` → nur Einheiten (`is_template = false`), sobald die Spalte existiert. Ohne Migration: Verhalten wie bisher, „Meine Vorlagen“ ausgeblendet (`hasTemplateFlag`, `createSchemaProbe`).
- Hilfsfunktionen mit Tests (`src/lib/workouts/unit-templates.ts`): `saveAsTemplate`, `createUnitFromTemplate`, `archiveUnit`, `restoreUnit`, `renameTemplate`, `removeTemplate`. Kopien laufen über `save_workout_template`; schlägt das Setzen des Kennzeichens fehl, wird die Kopie sofort archiviert.
- **Oberfläche** (c3f5e76, 0c2be4e, 97d8682; Kolibi-Vorlagen c1: `kolibi-templates.ts` mit Tests): Plan-Screen → „Vorlagen“ mit
  - **Kolibi-Vorlagen**: jede Einheit der vier Presets aus `buildPlan` (Ganzkörper Einsteiger A/B, Push / Pull & Legs Fortgeschritten, Brust und Schultern Fokus, Kurz-Einheit 20 Minuten), mit Übungszahl und geschätzter Dauer.
  - **Meine Vorlagen** (nur mit Migration 3): Umbenennen (Eingabe-Dialog, max. 20 Zeichen), Löschen (= ausblenden).
  - **Meine früheren Einheiten**: archivierte Einheiten mit „Wiederherstellen“ (ersetzt den bisherigen Block „archiviert“, gleiche testIDs).
  - Jede Vorlage öffnet eine Vorschau mit Bild, Sätzen und Zielwerten und „Einheit daraus erstellen“ (Kolibi: `applyBuiltPlan` mit einer Einheit, Wochenziel bleibt; eigene: `createUnitFromTemplate`). Beides prüft `useRequirePlan('editPlan')`.
  - Plan-Editor: „Als Vorlage speichern“ für gespeicherte Einheiten (nur mit Migration 3); kopiert den gespeicherten Stand.
- Commits Datenmodell: 2414c78, b2e828f, 871110e, e05b947, b31942c.

---

## Block 2.4 – Mahlzeiten gruppieren

Branch `block/2.4-meal-groups`, gemergt (Tests danach 590/590, tsc 15). Commits d83911f, fdd5bf1, eccccf3, f5b9223, 26192f8, f039566, b260c1a.
- `groupMeals` (`src/lib/meal-groups.ts`): Kette ≤ 45:00 min zum vorigen Eintrag, nie über den lokalen Tag hinaus, unsortierte Eingabe erlaubt. Namen nach Startzeit: 04:00–10:59 Frühstück, 11:00–14:59 Mittagessen, 15:00–17:29 Snack, ab 17:30 Abendessen.
- Annahmen: 00:00–03:59 = Snack (Nacht); jede Hauptmahlzeit höchstens einmal pro Tag – mehrere Gruppen im selben Fenster: die mit den meisten kcal behält den Namen, die anderen werden Snack. ES: „Merienda“ 15:00–17:29, sonst „Tentempié“; Desayuno/Comida/Cena.
- Essen-Tab und Tagesansicht (`DayMealList`): Gruppen mit Name, Startzeit, kcal, Protein, Anzahl; aufklappbar, Einträge bearbeitbar wie bisher (gleicher `onMealPress`, Premium-Gate beim Aufrufer).
- „Protein verteilt“ (`computeProteinDistributionStats`) zählt Gruppen. Mahlzeit zählt ab 100 kcal Summe.
- Protein nach Tageszeit (`src/lib/meal-protein-timing.ts`): Schnitt pro gegessener Mahlzeit dieser Art über 7 Tage (ohne heute). Hinweis, wenn Frühstück/Mittag/Abend < 60 % von Tagesziel ÷ 3 und an ≥ 3 Tagen vorhanden; höchstens ein Satz (größter Rückstand). Menge = Lücke auf 5 g gerundet, Spanne +5 g.

**Fragen**
- ❓ Die Schwelle für „Protein verteilt“ war nie fest 25 g, sondern 0,3 g/kg Bezugsgewicht (auf 5 g gerundet). Beibehalten – oder fest 25 g?
- ❓ Gruppen sind zugeklappt (Bearbeiten = ein Tipp mehr). Gruppen mit einem Eintrag direkt offen zeigen?
- ❓ Tageszeit-Satz bei allen Zielen oder nur bei Muskelaufbau/Abnehmen?

---

## Block 2.5 – Wiederholungen in Reserve und „Was war los?“

Branch `block/2.5-rir`, gemergt (ef66c32; nur Sprachdateien kollidierten, per JSON-Zusammenführung ohne Wertkonflikte gelöst). Tests danach 634/634, tsc 15.
Commits: f4f499f, 21315a3, f50d48d, 03eb2ff, d648132, 3b0b5d3, 4501dc3, f5e2ab6, fbbb3e9.
- Migration 4: `session_sets.rir smallint null check (0–3)`, `workout_sessions.shortfall_reasons text[] null` (nur tired, pain, technique, short_on_time, too_hard).
- Ohne Migration: Reihe „Wie viele wären noch gegangen?“ und Karte „Was war los?“ ausgeblendet; Sync sendet `rir`/`shortfall_reasons` erst, wenn die Spalte per Probe bestätigt ist (sonst würde jeder Satz-Sync an PGRST204 scheitern).
- Laufende Einheit: Reihe 0 · 1 · 2 · 3+ über „Satz fertig“, nicht getippt = null, bei Zeit-Übungen ausgeblendet.
- Progression: alle Sätze an der Obergrenze und mindestens ein Satz mit rir ≥ 2 → klarer Erfolg, auch bei „hart“ sofort Vorschlag; rir 0 oder ohne Angabe → bisherige Regel.
- Zusammenfassung: Karte einmal pro Einheit, wenn eine Übung deutlich unter Ziel lag (bester Satz < 70 % der Untergrenze oder zwei Sätze darunter). „zu schwer“ in dieser und der vorigen Einheit mit derselben Übung (exercise_id), beide Male deutlich unter Ziel → Vorschlag der leichteren Stufe (`variant_down`).
- **Datenschutz:** „Schmerzen“ ist eine Gesundheitsangabe → Datenschutzerklärung Ziffer 6 (in Block 5.1 ergänzt).

**Fragen**
- ❓ Gründe gelten für die ganze Einheit; „zu schwer“ zählt nur für Übungen, die in der Einheit deutlich unter Ziel lagen. Passt das?
- ❓ Die Reihe erscheint nur bei offenen Sätzen, nicht beim Nachbearbeiten fertiger Sätze.
- Aufräumen: `src/lib/workouts/schema-capabilities.ts` (2.5), `src/lib/missing-schema.ts` (2.3) und `src/lib/db-schema-errors.ts` (2.2) machen dasselbe – später zusammenlegen.

---

## Block 2.3 – Plan-Assistent

Branch `block/2.3-plan-assistant`, gemergt ohne Konflikte (Tests danach 669/669, tsc 15). 13 Commits ffa147b … 8127d05.
- Route `/koli/plan-wizard`; Einstiege: Leerzustand und unten im Trainings-Tab (`PlanWizardEntryCard`), Plan-Screen („Plan erstellen“). Öffnen und Speichern prüfen `useRequirePlan('editPlan')`.
- `buildPlan` rein, mit Katalog-Snapshot (`plan-catalog.ts`, Test auf lückenlose Leitern). Ein Test prüft alle Antwortkombinationen: kein Slug doppelt je Einheit, Ausrüstung passt, Bereiche in der Leiter, Dauer im Zeitbudget.
- Ergebnis: Vorschau mit Bild, Sätzen, Zielen, Dauer; Tauschen/Entfernen; „Zu meinen Einheiten hinzufügen“ / „Meinen Plan ersetzen“ (alte Einheiten werden archiviert, bei Fehler zurückgerollt).
- Antworten werden gespeichert (Migration 5; ohne sie aus MMKV).

### Erzeugte Pläne

1) Absoluter Einsteiger, ohne Ausrüstung, 2 Tage, 30 min (Hinweis „ohne Stange/Ringe: Y-T-W statt Rudern“)

| Einheit | Übung | Sätze | Ziel | Pause |
|---|---|---|---|---|
| Ganzkörper A (~18 min) | wall_push_up | 3 | 10–20 | 60 s |
| | ytw_raise | 3 | 6–10 | 60 s |
| | box_squat | 2 | 8–15 | 60 s |
| | tuck_hollow_hold | 2 | 20–40 s | 60 s |
| Ganzkörper B (~19 min) | ytw_raise | 3 | 6–10 | 60 s |
| | elevated_hands_pike_push_up | 3 | 6–12 | 90 s |
| | glute_bridge | 2 | 12–20 | 60 s |
| | side_plank_knees | 2 | 20–40 s / Seite | 60 s |

2) Fortgeschritten, Stange + Parallettes, 4 Tage, 60 min, Schwerpunkt Brust (Muskelaufbau)

| Einheit | Übung | Sätze | Ziel | Pause |
|---|---|---|---|---|
| Push (~50 min) | parallette_push_up | 4 | 8–12 | 90 s |
| | elevated_pike_push_up | 4 | 6–10 | 90 s |
| | parallel_bar_dip | 4 | 5–10 | 120 s |
| | push_up | 4 | 8–15 | 60 s |
| | pike_push_up | 4 | 6–10 | 90 s |
| | hollow_hold | 3 | 20–30 s | 60 s |
| Pull & Legs (~36 min) | pull_up | 3 | 3–8 | 120 s |
| | split_squat | 3 | 8–12 / Seite | 60 s |
| | feet_elevated_inverted_row | 3 | 8–12 | 90 s |
| | single_leg_glute_bridge | 3 | 10–15 / Seite | 60 s |
| | ytw_raise | 3 | 6–10 | 60 s |
| | hanging_knee_raise | 3 | 8–15 | 60 s |

3) 5 Tage, viel Ausdauer, Fett verlieren, Stange, 45 min

| Einheit | Übung | Sätze | Ziel | Pause |
|---|---|---|---|---|
| Push (~23 min) | push_up | 3 | 8–15 | 45 s |
| | pike_push_up | 3 | 6–10 | 60 s |
| | bench_dip | 3 | 8–12 | 45 s |
| | incline_push_up | 3 | 8–15 | 45 s |
| | hollow_hold | 3 | 20–30 s | 45 s |
| Pull (~25 min) | negative_pull_up | 3 | 3–6 | 75 s |
| | inverted_row | 3 | 8–12 | 60 s |
| | ytw_raise | 3 | 6–10 | 45 s |
| | active_hang | 3 | 15–30 s | 45 s |
| | hanging_knee_raise | 3 | 8–15 | 45 s |
| Beine (~17 min) | split_squat | 2 | 8–12 / Seite | 45 s |
| | single_leg_glute_bridge | 2 | 10–15 / Seite | 45 s |
| | bodyweight_squat | 2 | 10–20 | 45 s |
| | glute_bridge | 2 | 12–20 | 45 s |
| | side_plank | 3 | 20–40 s / Seite | 45 s |

4) Nur eine Einheit, Kraft und Skills, Brust und Schultern, Parallettes + Ringe, 45 min

| Einheit | Übung | Sätze | Ziel | Pause |
|---|---|---|---|---|
| Brust & Schultern (~44 min) | push_up | 4 | 8–12 | 90 s |
| | pike_push_up | 4 | 6–8 | 135 s |
| | bench_dip | 3 | 8–10 | 90 s |
| | incline_push_up | 3 | 8–12 | 90 s |
| | l_sit | 3 | 10–20 s | 135 s |

Regeln/Annahmen: Einsteiger 3 Sätze für die ersten zwei Übungen, dann 2; Fokus = +1 Satz auf Fokus-Übungen, solange das Zeitbudget reicht; viel Ausdauer = −1 Satz je Beinübung (min. 2); Fett verlieren = 0,66 × Pause (min. 30 s); Kraft & Skills = 1,5 × Pause (max. 180 s) und untere Hälfte des Bereichs; Dauer = 45 s Arbeit + Pause pro Satz; 4 Tage = Push und Pull & Legs im Wechsel (2 Einheiten), 5 Tage = 3 Einheiten. Ausrüstungs-Zuordnung ist von mir (die DB hat keine Spalte).

**Fragen**
- ❓ Rudern ohne Stange: Der Katalog hat nur `backpack_row_single_arm` (Rucksack) und `ytw_raise`. Tisch-/Handtuch-Rudern oder Superman in den Katalog aufnehmen?
- ❓ Beine: nur zwei Bein-Leitern (squat_single, bridge) – lange Beineinheiten füllen mit Rumpf auf.
- ❓ Im Push-Plan (Fall 2) stehen zwei Stufen derselben Liegestütz-Leiter (parallette_push_up und push_up). Gewollt als Volumen, oder lieber eine andere Übung?

---

## Block 3.4 – Muskelgruppen

Branch `block/3.4-muscles`, gemergt (5be9620; Tests 735/735, tsc 15). Commits a21eaa9, 1dccfcc, 4a36e3d, 20b99b7, cea659e, 124bba8, e795227, 3be6c22.
- Speicherort Katalog: Code-Konstante `CATALOG_MUSCLES` (Schlüssel `catalog_slug`), weil Katalogzeilen pro Slug fest sind, das zu `catalog-images.ts`/`starter-plans.ts` passt, ohne Datenmigration offline läuft; ein Test prüft, dass alle 48 Slugs der Seed-Migrationen zugeordnet sind. Eigene Übungen: Spalten (Migration 6), Auswahl im Übungs-Editor nur mit Migration.
- Zählung: erledigte Sätze, primär 1, sekundär 0,5, rir 0–3 oder ohne Angabe; 7 Tage und 30 Tage als Wochenschnitt; Richtwert 10 (Muskelaufbau) sonst 6.
- Fortschritt → Training: Segmente „Einheiten · Muskeln · Übungen“, Balken mit Richtwert und 7/30-Umschalter.
- Empfehlung je Gruppe mit Defizit mit einer Übung auf der aktuellen Stufe; „In Einheit übernehmen“ nach bester Übereinstimmung, wenigsten Sätzen, nicht am Vortag einer Einheit mit denselben Muskeln; Vorschau, Bestätigung, Speichern über `saveTemplate`.
- Exporte für den Check-in: `musclesForExercise`, `unitMuscleProfile`.

**Fragen**
- ❓ Zuordnung bitte prüfen, v. a. Dead/Active Hang → Rücken, L-Sit → Trizeps/Beine vorne sekundär, Pseudo-Planche → Brust und Schultern primär.
- ❓ Beine hinten und Waden haben keine Katalogübung als Primärmuskel → keine Empfehlung für diese Gruppen.

---

## Block 3.5 – Körpermaße und Aufbau-Ansicht

Branch `block/3.5-measurements`, gemergt (848be00). Commits 818b243 … 59aaf89.
- Taille liegt bereits in `waist_logs` (Migration 0012) und wird nach Apple Health gespiegelt. Sie bleibt dort; `body_measurements` (Migration 7) hat Brust, Oberarm, Hüfte, Oberschenkel. Das Maße-Sheet schreibt die Taille über denselben Weg wie das Gewichts-Sheet (Health-Export bleibt).
- Fortschritt → Körper: Sheet „Maße“ (cm/in), alles optional, Speichern prüft `useRequirePlan('enterWeight')`. Ohne Migration ist „Maße eintragen“ ausgeblendet; die Aufbau-Karte läuft dann mit Gewicht, Taille, Training.
- Aufbau-Karte (Körper; auf Heute bei `build_muscle`/`gain_weight`), 4/8/12 Wochen. Satz (`src/lib/build-up.ts`): Gewicht als 7-Tage-Schnitt, „stabil“ unter 0,3 kg; Maße „stabil“ unter 0,5 cm (Rundung 0,5 cm bzw. 0,1 in); Kraft = angenommene Stufenaufstiege + Zuwachs der besten Sätze der 3 meisttrainierten Übungen (höchstens 2 genannt). Beispiel: „Du baust auf: Gewicht stabil, Taille −1,5 cm, Brust +1 cm, Liegestütze +4.“
- Für die Maß-Erinnerung (3.3): `daysSinceLastMeasurement`, `usesMeasurements`.

**Fragen**
- ❓ Karte auf Heute auch bei „Kraft und Skills“ (kommt mit 3.1)?
- ❓ Maße immer für heute; Datumswähler gewünscht?

---

## Block 3.8 – Sticker nach dem Foto-Scan

Commits 6be3f94, 2ccc813, 4a54e2d, 4e3206a.
- Ergebnis-Screen des Foto-Scans: Button „Teilen“ → Sticker-Typ `meal` (Zutaten-Labels nach kcal-Anteil, höchstens 6, kcal und Protein mit Portionsfaktor). Story-Karte 1080 × 1920 mit dem Foto im Hintergrund (Verlauf darüber, Inhalt kompakt unten), Sticker ohne Foto.
- Foto: Bisher wurde es direkt nach der Analyse gelöscht. Jetzt bleibt die lokale Datei, solange der Ergebnis-Screen offen ist, und wird beim Schließen oder Speichern gelöscht. Kein Upload, keine Speicherung. Beim Nährwert-Label-Scan wird wie bisher sofort gelöscht (kein Teilen).
- PostHog: `share_sticker_created` mit `type: "meal"`.
- Annahme: Wird die App bei offenem Ergebnis-Screen beendet, bleibt die Datei im Cache-Ordner des Geräts, bis iOS ihn räumt.

---

## Aufräumen später
- ESLint startet nicht: `Cannot find module 'eslint/config'`.
- 15 tsc-Fehler auf main (Auth-Screens TS2769, `supabase.ts`, `language-switcher`, `profile-panel`, `support-panel`, `notifications-settings-section`, `use-theme`, `onboarding-field`).
- **Zweite Sitzung aktiv:** Worktree `~/Dev/Kolibi-wt-f4b` (Branch `fix/session-end`, Commits „session detail accepts at most 300 min“ u. a.) mit eigenem Metro auf 8082 und dem Simulator „Kolibi QA“. Nicht angefasst.
- Worktree `~/Dev/Kolibi-reminders` (`fix/reminders-keepawake`) ist in `release/1.4` aufgegangen und kann weg; `Kolibi-wt-report` (`test/week-simulation`) und `Kolibi-wt-main` bestehen weiter.
