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
| 8 | `20260926160000_skill_goals.sql` | Tabelle `skill_goals`, ein aktives Ziel pro Nutzer, RLS eigene Zeilen | 3.7 |
| 9 | `20260926170000_daily_checkins.sql` | Tabelle `daily_checkins`, `profiles.checkin_enabled`, `checkin_reminder_time` | 3.2 |
| 10 | `20260926183100_add_strength_goal_type.sql` | Enum-Wert `goal_type = 'strength'` (Kraft und Skills) | 3.1 |
| 11 | `20260926183200_profiles_usage_purpose.sql` | `profiles.usage_purpose` (nutrition/training/both) | 3.1 |

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
- **PNGs** (nachgeholt, sobald der Simulator frei war; temporäre QA-Seite, nicht committet): 32 Dateien in `~/Desktop/kolibi-1.4-check/sticker/` (Übung, Stufe, Einheit, Rückblick Woche/Monat, Fortschritt ohne/mit Stufenwechsel, Mahlzeit; je Hell, Dunkel, Story Hell, Story Dunkel). Sticker: RGBA, 75–94 % transparent. Füllgrad der Story-Karten (PIL, Zeilen mit Tinte gegenüber dem Randpixel, ohne Marke):

| Story-Karte | Füllgrad | Mitte |
|---|---|---|
| Übung | 70,1 % | 0 px |
| Einheit | 67,1 % | +8 px |
| Rückblick Woche | 67,4 % | −2 px |
| Rückblick Monat | 66,6 % | −1 px |
| Fortschritt | 67,4 % | −4 px |
| Fortschritt mit Stufenwechsel | 68,6 % | +4 px |
| Stufe | 52,5 % | −6 px (2-fach-Grenze) |
| Mahlzeit (ohne Foto) | 55,7 % | +21 px (2-fach-Grenze) |

- **Gefundene Fehler, behoben:** (1) Der Titel „Meine Woche/Mein Monat“ erschien auf der Story-Karte winzig (iOS behielt mit `numberOfLines`/`adjustsFontSizeToFit` ein veraltetes Layout) → Größe wird jetzt berechnet (`StickerFitLine`, 7d79a8d). (2) „650 kcal“ brach beim Mahlzeit-Sticker um → einzeilig (df8c270).

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

## Block 3.1 – Onboarding und Ziele

### Teil A – Diagnose (vorher)

Ein Screen `src/app/onboarding/index.tsx`, 8 feste Schritte, ~76 s:

| # | Schritt | Abgefragt | Verwendung | Sek. |
|---|---|---|---|---|
| 0 | Ernährungsform | omnivor/pescetarisch/vegetarisch/vegan | Makros (Protein ×1,06/×1,12), Anzeige, KI-Prompt der Mahlzeitenerkennung | 8 |
| 1 | Geschlecht | männlich/weiblich/keine Angabe | Kalorienziel (BMR ±83 kcal) | 6 |
| 2 | Geburtsdatum | Datum | Kalorienziel (BMR), Makros (Protein ×1,2 ab 65) | 13 |
| 3 | Größe | cm/ft-in | Kalorienziel, Makro-Bezugsgewicht | 7 |
| 4 | Gewicht | kg/lbs | Kalorienziel, Makros, Prognose (`weight_logs`) | 7 |
| 5 | Aktivität | 4 Stufen | Kalorienziel (Faktor 1,2–1,725; mit Health nur Ersatz) | 10 |
| 6 | Ziel | 7 Werte | Kalorien (%/Woche), Protein g/kg, Zielgewicht | 15 |
| 7 | Zusammenfassung | kcal editierbar | Basis aller Makros | 10 |

Zwingend für Kalorien und Makros: Geburtsdatum, Größe, Gewicht, Aktivität, Ziel (+ Ergebnis kcal). Optional: Geschlecht, Ernährungsform. Analytics: keine. Ziele: alle 7 `goal_type` (maintain, lose_weight, faster_weight_loss, gain_weight, build_muscle, endurance, custom); ungenutzt: `lose`, `faster_loss` (tot).

### Teil B – Umsetzung

Branch `block/3.1-onboarding`, gemergt (f2e0524). Commits 64a5c2a, 03ec996, 0e990ab, e23c073, 531632f, ab2e698, 40e6041.

**Nachher: 7 Schritte, ~68 s**

| Schritt | Pflicht | Sek. |
|---|---|---|
| Wofür nutzt du Kolibi? (Ernährung · Training · Beides, mit Rechtshinweis) | optional | 5 |
| Eckdaten: Geburtsdatum + Geschlecht als Chips | Datum | 17 |
| Größe | ja | 7 |
| Gewicht | ja | 7 |
| Aktivität | ja | 10 |
| Ziel (5 statt 7) | ja | 12 |
| Zusammenfassung | ja | 10 |

- Geschlecht bleibt (als Chips), weil ohne Angabe der BMR bis ±83 kcal danebenliegt. Ernährungsform wandert in eine einmalige Karte oben im Essen-Tab (`DietPreferenceCard`).
- Schrittfolge ist jetzt eine berechnete Liste (`src/lib/onboarding-steps.ts`), Review-Modus kann per `startAt` direkt einen Schritt öffnen (neue Zielzeile im Zielbereich).
- **Ziele:** Abnehmen → lose_weight; Muskelaufbau → build_muscle; Kraft und Skills → `strength` (Migration 10; rechnet exakt wie build_muscle; ohne Migration wird build_muscle geschrieben und die Wahl lokal gemerkt); Halten und gesund essen → maintain; Ausdauer → endurance. Altwerte bleiben mit ihrer Wirkung: faster_weight_loss (Abnehmen), gain_weight (Muskelaufbau), custom („Eigenes Ziel“ nur für Nutzer, die es haben). **Abweichungen in Kalorien/Makros: keine.**
- „Wofür nutzt du Kolibi?“ → `profiles.usage_purpose` (Migration 11; ohne sie lokal). Bei Training/Beides öffnet sich nach dem Onboarding der Plan-Assistent (überspringbar; hinter `useRequirePlan`). Bei Ernährung: lokales Flag `plan_wizard_pending`.

**Ziel → Schwerpunkte der Empfehlungen** (`src/lib/goal-focus.ts`)

| Ziel | Schwerpunkte |
|---|---|
| Abnehmen | Protein (schützt die Muskeln), Ballaststoffe, Krafttraining |
| Muskelaufbau | Protein, Kohlenhydrate rund ums Training, Sätze pro Muskel |
| Kraft und Skills | Kohlenhydrate vor dem Training, Erholung, Tagesform, Protein |
| Halten und gesund essen | Ballaststoffe, Protein über den Tag verteilt, Regelmäßigkeit |
| Ausdauer | Kohlenhydrate an Lauftagen, Protein zur Erholung |
| Eigenes Ziel | Protein, Regelmäßigkeit |

**Fragen**
- ❓ Nach „Training“ kann direkt nach dem Onboarding die Paywall kommen (Assistent liegt hinter dem Zugang, gilt für registrierte Nutzer ohne Zugang). Gewollt?
- ❓ Die Prüfung auf den Enum-Wert `strength` erwartet Fehlercode 22P02 für unbekannte Enum-Werte; gegen die echte DB ungetestet (sonst sicherer Rückfall auf build_muscle).

---

## Block 3.2 – Tagesform mit Morgen-Check-in

Branch `block/3.2-checkin`, gemergt (12b2a99). 11 Commits bc7b8b6 … 8fe331c.
- Migration 9. Ohne sie: alles ausgeblendet, Verhalten wie bisher.
- Karte oben auf Heute bis 12:00, drei Wege (beantworten → danach eine Zeile; „Heute nicht“ lokal bis morgen; „Nicht mehr anzeigen“ → `checkin_enabled = false`, in Einstellungen „Morgen-Check-in“ wieder an). Kein Pop-up. Nicht hinter der Paywall (Annahme).
- Erinnerung: standardmäßig aus, lokale tägliche Mitteilung (`kind: 'checkin'`), Zeitwähler in den Einstellungen, wird beim Start neu geplant, beim Abmelden gelöscht.
- `computeReadiness` (`src/lib/checkin/readiness.ts`): Punktzahl Schlaf + Energie + (6 − Muskelkater) + (6 − Stress). Ab 7 Check-ins gegen den eigenen 14er-Schnitt (+2 gut / −3 schwach), sonst feste Skala mit „Kolibi lernt dich noch kennen“. Last = Minuten × Intensität (3/5/7) über 3 und 7 Tage; Leistungsabfall < 90 % des Schnitts der drei vorigen Einheiten derselben Übung; Ernährung: an ≥ 2 der letzten 3 Tage < 80 % kcal oder < 70 % Protein. Ergebnis bereit/normal/schonen, ohne Check-in nur aus Daten (gekennzeichnet).
- Wirkung: Stufen-Vorschlag nur bei „bereit“ oder „normal“ nach klarem Erfolg; bei „schonen“ schlägt „Als Nächstes“ eine passendere oder leichtere Einheit vor.
- ❓ Muskelkater ist eine Gesamtzahl; der Abgleich „Muskelkater + Einheit mit denselben Muskeln“ braucht die Muskelprofile aus 3.4 (verfügbar) – die Schlüssel von 3.2 (legs, chest, back, shoulders, arms, core, glutes) werden in 3.6 auf die Gruppen von 3.4 abgebildet.

---

## Block 3.7 – Skill-Ziel und Zielprognose

Branch `block/3.7-skill-goal`, gemergt (e5125ff; Konflikte mit dem Mahlzeit-Sticker aufgelöst: beide Typen `meal` und `goal`). Commits b6d2cc1 … 061599a.

**Ursache „Zielprognose ohne Datum“** (je mit zuerst rotem Test):
1. `computeWeightGoalEta` lieferte bei Trend seitwärts/weg vom Ziel (ab 14 Tagen Verlauf) `unavailable`, die Anzeige zeigte dann nichts. Neu: Status `stalled` mit Hinweis und Plandatum aus der Kalorienrechnung.
2. Zielgewicht-Screen und Bilanz: `gain_weight` wurde über das Makro-Mapping als Muskelaufbau behandelt → nie ein Datum. Neu: nur `build_muscle` zählt als Muskelaufbau.
3. Nebenbei: falscher i18n-Schlüssel `weightGoalEta.${part}` → roher Key im Datumstext.

**Skill-Ziel:** Migration 8 (`skill_goals`, ein aktives Ziel). Prognose `skill-goal-forecast.ts`: bester Satz je Einheit, Leiter-Umrechnung (jede Stufe bis zur Zielstufe = eine Einheit; Position läuft von Einstieg bis Ausstieg der Stufe), Theil–Sen-Steigung über 56 Tage; „zu wenig Daten“ = < 4 Einheiten oder < 14 Tage Spanne → ehrlicher Hinweis; Ergebnis als Zeitraum in Monatsdritteln („voraussichtlich Mitte bis Ende November“). Anzeige im Trainings-Tab und in Fortschritt → Training mit Balken. Neuer Sticker `goal` (ohne Last, Gewicht, kcal).

---

## Block 4.1 – Live-Aktivität und Vibration / Block 4.2 – Instagram Stories

Branch `block/4-native`, gemergt (8ef5622). Commits b650f69 … 9a2291d.
- Variante: ActivityConfiguration in der **vorhandenen** Widget-Extension (`targets/widget/RestTimerLiveActivity.swift`) plus lokales Expo-Modul `modules/rest-live-activity`. Gründe: eine Extension statt zwei (expo-widgets hätte ein zweites Target angelegt), echter SwiftUI-Countdown (`Text(timerInterval:)`), kompiliert sauber.
- Start bei Pausenbeginn, Update bei +30/Anhalten/Weiter/Überspringen/Dauer, Ende nach der Pause, beim Beenden/Verwerfen der Einheit und beim Abmelden. Reine Zuordnung in `src/lib/training/rest-live-activity.ts` (Tests).
- Vibration am Pausenende mit `expo-haptics ~57.0.3` (nur im Vordergrund).
- `app.json` → `ios.infoPlist`: `NSSupportsLiveActivities: true`, `LSApplicationQueriesSchemes: ["instagram-stories"]`. Version/buildNumber/runtimeVersion unverändert.
- Compile-Check: `expo prebuild` + `pod install` + `xcodebuild … -sdk iphonesimulator … CODE_SIGNING_ALLOWED=NO` → **BUILD SUCCEEDED** (im Agent-Worktree, ohne Simulator).
- Robust: native Module per `requireOptionalNativeModule`; in einem Binary ohne diesen Code passiert nichts.
- **Nur auf dem Gerät testbar:** Sperrbildschirm und Dynamic Island, selbstlaufender Countdown und „Pause vorbei“, Zuordnung App↔Widget über die duplizierte `RestTimerAttributes`, Haptik, Instagram-Absprung.
- **Instagram:** Variable **`EXPO_PUBLIC_FACEBOOK_APP_ID`** (EAS-Umgebungsvariable). Button nur bei iOS + gültiger ID + Modul + installiertem Instagram; sonst unsichtbar. Sticker als `stickerImage`, Story-Karte als `backgroundImage`, Pasteboard mit 5 min Ablauf (lokales Modul `modules/instagram-stories`). Analytics-Aktion `instagram`.

**Fragen**
- ❓ Live-Aktivität auch für Pausen ohne aktive Einheit (Timer in der Ruheansicht)? Derzeit ja.
- ❓ Tippen auf die Live-Aktivität → direkt zur Einheit springen?

---

## Block 3.3 – Empfehlungs-Engine

Branch `block/3.3-recommendations`, gemergt (a7396d7; Einfügestelle in `home.tsx` in die neue Heute-Struktur übernommen). Commits 6c6d3c0, aaee83b, 6003a89, 29178a0, d09f832, ba50e2b.
- `buildRecommendations(context)` rein (`src/lib/recommendations/`), Schwellen in `RECOMMENDATION_RULES`.
- **Zeitkurve:** erwarteter Anteil 0 % bis 08:00, linear bis 100 % um 21:00; vor 10:00 keine Ernährungshinweise; Hinweis erst unter 80 % des erwarteten Anteils und mit Mindestlücke (15 g Protein, 5 g Ballaststoffe, 30 g Kohlenhydrate).
- Protein für alle Ziele; Ballaststoffe bei Abnehmen/Halten; Kohlenhydrate an Trainingstagen vor der Einheit bei Muskelaufbau/Kraft/Ausdauer. Begründung aus der Ziel-Tabelle (3.1).
- Training: „nächste Stufe bereit“, Muskelgruppe mit Lücke (ab 3 Sätzen, 7 Tage), Ruhetag bei „schonen“ (verdrängt dann die anderen Trainingshinweise).
- Daten: Gewicht nach 7 Tagen (Abnehmen, Muskelaufbau inkl. gain_weight, Halten), Maße nach 14 Tagen (nur wenn genutzt), Check-in offen ab 12:00.
- Höchstens 3, Ernährung vor Training vor Daten; wegwischen → dieselbe Art erst nach 72 h (MMKV je Nutzer).
- Aktionen: Protein/Mahlzeit erfassen → Ernährung, Jetzt wiegen → Gewichts-Sheet, Maße eintragen → Maße-Sheet, Übung ansehen → Übungs-Fortschritt, Training ansehen → Training, Check-in starten.
- Design-Token `RECOMMENDATION_ACCENT = '#0F766E'` (nur Icon und Badge, immer mit Symbol).

**Fragen**
- ❓ Ziele ohne Sport-Anpassung aus Health (Hinweise an Sporttagen eher zurückhaltend). Angepasste Tageszahl verwenden?
- ❓ Strenge Reihenfolge: drei Ernährungshinweise verdrängen Training/Daten. Lieber höchstens einer je Kategorie?

---

## Block 3.6 – Heute und Ernährung

Commits 3bda668, 2f16b6b, 98da2bf, 1135cdf, (Switcher) + „i18n: Ernährung“, 1ba15d8, ac10023, „today: log weight from the build-up card“.
- Tabs: Heute · Ernährung · Training · Fortschritt, jeweils Symbol mit kleiner Beschriftung (Essen heißt jetzt Ernährung / Nutrition / Nutrición).
- **Ernährung:** volle Kalorien- und Makrokarte (bisher Heute), einmalige Ernährungsform-Karte (3.1), gruppierte Mahlzeiten (2.4), Supplemente, Scan-Leiste.
- **Heute:** Tagesform (Karte bis beantwortet, danach eine Zeile) → Empfehlungen (höchstens drei) → Abschnitte nach Ziel:
  - Training: „Als Nächstes: <Einheit> · Start“ (prüft den Zugang, startet die Einheit und wechselt in den Trainings-Tab), Ruhetag (nur wenn der Plan Wochentage nutzt und heute keiner gesetzt ist), erledigt oder „Plan erstellen“; darunter der Wochenfortschritt (bisherige Trainings-/Bewegungszeilen).
  - Ernährung kompakt: kcal übrig (bzw. drüber) und Protein – dieselben berechneten Werte wie die große Karte (Kompaktvariante von `DaySummaryBlock`); Tipp öffnet Ernährung.
  - Körper: Gewichtskarte bei Gewichtszielen, Aufbau-Karte bei Muskelaufbau/Kraft (mit „Gewicht eintragen“).
- Reihenfolge nach Ziel (`todaySectionOrder`): Abnehmen → Ernährung, Körper, Training; Muskelaufbau/Kraft → Training, Ernährung, Körper; sonst Training, Ernährung, Körper. Ziel ist in den Zielen umstellbar (3.1-Zielzeile).
- Nichts entfernt: Gewicht (Karte/Aufbau-Karte/Fortschritt → Körper), Ziele (Koli-Button), Supplemente (Ernährung) bleiben erreichbar.
- Screenshots (Entwicklungsstand) `~/Desktop/kolibi-1.4-check/home/dev-today.png`, `dev-ernaehrung.png`; die drei Nutzertypen folgen im Wochentest (6.1).

---

## Block 5.1 – Datenschutzerklärung (Kolibi-web, Branch `legal/1.4`, gepusht)

- `legal/1.4` von `main` (beaabb1) + Merge `legal/share-stickers` (c4bdc23). Commits 6e56958, e9fac9a. Bearbeitet in eigenem Worktree `~/Dev/Kolibi-web-legal`, weil im Haupt-Checkout eine andere Sitzung auf `feat/landing-1.4-release` stand.
- Ziffer 15b (DE/EN) durch den vorgegebenen Text ersetzt; Ziffer 6 um die fünf Aufzählungspunkte und den Satz zu festen Regeln / Art. 22 ergänzt; Ziffer 11a um Check-in-Erinnerung und Pausen-Vibration/Sperrbildschirm; Ziffer 18 um „Check-ins, Körpermaße, Skill-Ziele, Angaben aus dem Plan-Assistenten“.
- Ziffer 13: Ereignisliste an `src/lib/analytics.ts` angepasst – signup_provider_selected, signup_completed, anonymous_session_started, anonymous_scan_completed, anonymous_limit_reached, anonymous_converted_to_account, share_sticker_created mit Typ (Übung, Stufe, Einheit, Wochen-/Monatsrückblick, Fortschritt, Mahlzeit, Ziel), Variante und Aktion (gespeichert, kopiert, geteilt, Instagram Stories). Keine weiteren Events im Code.
- Stand-Datum nicht gesetzt. `npm run build` erfolgreich.
- Hinweis: `Kolibi-web/main` ist seit dem Abzweig weitergelaufen (Landingpage 1.4, 5075102). `legal/1.4` berührt nur `app/privacy/page.tsx`; beim Release nach `main` mergen und dann das Stand-Datum setzen.

## Block W.1 – Landingpage

Auf `Kolibi-web/main` bereits umgesetzt, heute 16:29–16:47 von einer anderen Sitzung (Hero „Dein Essen weiß, dass Trainingstag ist.“, neue Reihenfolge, `AnalysisSection` mit `public/screens/auswertung.webp`); dazu Branch `feat/landing-1.4-release` mit 1.4-Abschnitten. Ich habe dort nichts geändert. Offen laut Abgleich: Preise 24,99 / 49,99 / 139,99 € stehen nicht im Code (Preise kommen offenbar dynamisch – prüfen), BLS-/Open-Food-Facts-Lizenzsatz im Footer fehlt auf main. ❓ Soll ich W.1 fertigstellen, obwohl dort eine andere Sitzung arbeitet?

## Block A.1 – Aufräumen

Laut Vorgabe nach dem Release auf `chore/cleanup`; nicht begonnen.

---

## Block 6.1 – Wochentest

Details, Tabellen und Screenshots: `REPORT-week-test.md`. Kurz:
- Code-Simulation (Branch `block/6.1-week-sim`, 39aa885, gemergt): 13 Bereiche, alle bestanden, ein Grenzfall teilweise.
- Simulator: Onboarding „Beides“ → Assistent Einsteiger, Kolibi-Vorlage übernehmen, Einheit nach App-Neustart wiederhergestellt, „Zum ersten Mal“, Story-Option, Muskelansicht, Empfehlung wegwischen, EN/ES, drei Nutzertypen auf Heute.
- Behoben: F1 Muskel-Übernahme (de5b031), F2 Heute nach Zieländerung (139b022), F3 Trainingstag bei rotierenden Plänen (ca74aaa), Rückblick-Titel und kcal-Umbruch auf Stickern (7d79a8d, df8c270).
- Nicht testbar ohne Migrationen: Check-in, eigene Vorlagen, RIR/„Was war los?“, Maße, Skill-Ziel. Ohne Gerät: Live-Aktivität, Haptik, Instagram. Foto-Scan: nur private Fotos vorhanden, nicht genutzt.

---

## Aufräumen später
- ESLint startet nicht: `Cannot find module 'eslint/config'`.
- 15 tsc-Fehler auf main (Auth-Screens TS2769, `supabase.ts`, `language-switcher`, `profile-panel`, `support-panel`, `notifications-settings-section`, `use-theme`, `onboarding-field`).
- **Zweite Sitzung aktiv:** Worktree `~/Dev/Kolibi-wt-f4b` (Branch `fix/session-end`, Commits „session detail accepts at most 300 min“ u. a.) mit eigenem Metro auf 8082 und dem Simulator „Kolibi QA“. Nicht angefasst.
- Worktree `~/Dev/Kolibi-reminders` (`fix/reminders-keepawake`) ist in `release/1.4` aufgegangen und kann weg; `Kolibi-wt-report` (`test/week-simulation`) und `Kolibi-wt-main` bestehen weiter.

---

## Block 6.2 – Release 1.4.0 vorbereiten (wartet auf Freigabe)

- Lokales `main` (48ea6ab, inzwischen auch auf `origin/main`) ist vollständig in `release/1.4` enthalten; kein weiterer Merge nötig. Tests 940/940 (1 übersprungen), tsc 15 (Baseline).
- `app.json`: `version` 1.4.0. `runtimeVersion` bleibt `{ policy: "appVersion" }` und folgt damit auf 1.4.0. Build-Nummer: `eas.json` hat `appVersionSource: "remote"` und `production.autoIncrement: true` → EAS setzt die nächste Nummer (nach 32 → 33, falls seitdem kein Production-Build lief; prüfen mit `eas build:version:get -p ios`).
- Nativ neu seit Build 32: Live-Aktivität (Widget-Extension + lokales Modul `modules/rest-live-activity`), `modules/instagram-stories`, `expo-haptics`, `NSSupportsLiveActivities`, `LSApplicationQueriesSchemes`, Health-Text (c4a9c46) → neuer Store-Build nötig (kein OTA).

### Migrationen vor dem Release (SQL-Editor, in dieser Reihenfolge)

| # | Datei | Zweck |
|---|---|---|
| 1 | `20260924152000_beginner_ladder_steps.sql` | Einsteiger-Stufen, Leitern neu nummeriert |
| 2 | `20260925180000_register_push_token.sql` | Push-Token dem angemeldeten Nutzer übertragen (behebt fehlende Erinnerungen) |
| 3 | `20260925190000_workout_template_flag.sql` | `workout_templates.is_template` (Meine Vorlagen) |
| 4 | `20260926120000_rir_shortfall_reasons.sql` | `session_sets.rir`, `workout_sessions.shortfall_reasons` |
| 5 | `20260926123300_profiles_plan_wizard_answers.sql` | Antworten des Plan-Assistenten im Profil |
| 6 | `20260926143400_exercise_muscles.sql` | Muskelgruppen eigener Übungen |
| 7 | `20260926153500_body_measurements.sql` | Körpermaße (RLS eigene Zeilen) |
| 8 | `20260926160000_skill_goals.sql` | Skill-Ziel (RLS eigene Zeilen) |
| 9 | `20260926170000_daily_checkins.sql` | Morgen-Check-in + Profilfelder (RLS eigene Zeilen) |
| 10 | `20260926183100_add_strength_goal_type.sql` | Enum-Wert `strength` |
| 11 | `20260926183200_profiles_usage_purpose.sql` | „Wofür nutzt du Kolibi?“ |

Alle in `begin; … notify pgrst, 'reload schema'; commit;`. Die App läuft ohne jede einzelne weiter (Funktion ausgeblendet). Die Cron-Migration (1.3.5) fehlt noch – dafür brauche ich die Ausgabe von `cron.job`.

### Was mit dem Merge rausgeht (`git log --oneline main..release/1.4`)

```
c67e1e6 release: version 1.4.0
098237b docs: 1.4 report, blocks 5.1, W.1, 6.1 and the week test
ca74aaa fix(test-week): rotating plans get training-day recommendations
c363e45 test(week): maestro flows for templates, restoring a session and languages
139b022 fix(test-week): Today follows a changed goal right away
de5b031 fix(test-week): muscle adoption adds at most two sets and follows the plan's gear
b54658d test(week): maestro flows for the 1.4 onboarding and the plan wizard
462c950 Merge block/6.1-week-sim into release/1.4
39aa885 test(week-sim): seven-day simulation for 1.4 on the pure functions
6bc1091 docs: 1.4 report, blocks 3.3 and 3.6
a7396d7 Merge block/3.3-recommendations into release/1.4
791fbd6 today: log weight from the build-up card
ba50e2b home: place recommendations below the check-in on Today
d09f832 home: RecommendationsCard and TodayRecommendations
ac10023 home: Today and Ernährung split, tabs with icons
1ba15d8 day summary: compact card keeps the glass background
29178a0 recommendations: useRecommendations assembles the context from existing queries
6003a89 checkin: questions can be requested again after the morning window
aaee83b brand: RECOMMENDATION_ACCENT design token
6c6d3c0 recommendations: rule engine, 3-day snooze store and texts
97ed305 i18n: the meals tab is now Ernährung / Nutrition / Nutrición
8e6095a ui: segment switcher with an optional icon above a small label
1135cdf today: training card with next unit, rest day and the week
98da2bf day summary: compact one-line variant for Today
2f16b6b i18n: Today sections (de, en, es)
3bda668 today: training state (none, done, rest, next)
8a0f54c today: section order and body card by goal, compact nutrition summary
84af9c5 docs: 1.4 report, blocks 2.1 PNGs, 3.1, 3.2, 3.7, 4.1, 4.2
8ef5622 Merge block/4-native into release/1.4
f2e0524 Merge block/3.1-onboarding into release/1.4
e5125ff Merge block/3.7-skill-goal into release/1.4
12b2a99 Merge block/3.2-checkin into release/1.4
df8c270 share: meal kcal stays on one line
7d79a8d share: recap title keeps its size on the story card
9a2291d training: paused live activity time looks like the running timer
a329baf share: Instagram Story button when Instagram and an app id are there
ca2deed i18n: Instagram Story share action (de, en, es)
593349a config: query the instagram-stories scheme
1b87296 share: Instagram Stories app id and pasteboard items, pure
6489d57 native: local module for the Instagram Stories pasteboard flow
40e6041 tests: goal mapping, onboarding step list, strength fallback, goal focus
4e9bdd8 training: mirror the rest into the live activity, vibrate at the end
564dca4 widget: rest timer live activity for lock screen and dynamic island
54e6bae native: local module to start, update and end the rest live activity
f8f1b89 i18n: live activity texts for the rest timer (de, en, es)
8671a2b training: rest timer to live activity content, pure
ab2e698 meals: one-time diet card; goals: show the cleaned goal category
061599a skill-goal: card with bar and period in Training and Progress, picker sheet
2beccc1 share: goal sticker (light/dark, story card)
ee0ebe4 skill-goal: texts (de/en/es) and period formatting
531632f onboarding: usage question first, cleaned goals, diet moved out, plan wizard for training
e23c073 i18n: onboarding2 (usage, about, cleaned goals, diet card, goal focus)
8fe331c training: "Als Nächstes" picks a fitting unit on gentle days
681331f training: level-ups follow today's readiness
1d46069 settings: check-in switch and optional wake-up reminder
1835bf6 home: morning check-in card at the top of Today
c4e2654 skill-goal: API behind a schema probe and the useSkillGoal hook
da091ef share: goal sticker data and the goal analytics type
bce83ef docs: 1.4 report, blocks 2.2, 2.3, 3.4, 3.5, 3.8
b650f69 deps: expo-haptics for the end of the rest
4d962ec checkin: data layer, useTodayCheckinStatus, useReadiness, reminder sync on start
861f0d5 checkin: daily local reminder (DAILY trigger, kind checkin)
c4a4e01 i18n: checkin namespace (de, en, es)
0e990ab onboarding: step list, usage purpose and plan wizard hand-off (lib)
03ec996 goals: cleaned goal categories, strength fallback and goal-focus table
64a5c2a goals: strength goal type with the same effect as build_muscle
e48dc2b skill-goal: forecast as a pure function over the ladder scale
5be9620 Merge block/3.4-muscles into release/1.4
848be00 Merge block/3.5-measurements into release/1.4
97d8682 plan editor: save a unit as a template
0c2be4e plan: Vorlagen with Kolibi templates, own templates and previous units
c3f5e76 i18n: templates (de, en, es)
8e11dc8 workouts: Kolibi templates from the plan wizard presets
3be6c22 exercises: optional muscle selection for own exercises
e795227 progress: sessions, muscles and exercises segments in Training
97d6c30 skill-goals: migration file for the skill goal table
37f5ac2 training: readiness gate for level-ups and a fitting next unit on gentle days
59aaf89 today: build-up card for muscle gain goals
2d48070 progress: build-up card and Maße sheet in the body area
c6d65f7 measurements: build-up card with 4/8/12 week sentence
42359a9 measurements: Maße sheet (chest, arm, waist, hip, thigh), gated like weight
0e766de measurements: useBuildUp and useBodyMeasurementsAvailable hooks
a7c949c measurements: body_measurements API with schema probe, build-up data fetch
9eff953 checkin: today's status, card window until 12:00, reminder time helpers
124bba8 i18n: muscles namespace (de, en, es)
79f7bda Merge block/2.3-plan-assistant into release/1.4
15e46c2 checkin: computeReadiness from check-in, training load, last session and nutrition
bba137c weight-eta: plateau shows a stalled note with the plan date
cea659e workouts: read and write muscles of own exercises once the migration ran
20b99b7 db: muscle groups on own exercises (migration file, not run)
b6d2cc1 target-weight: forecast dates for weight gain, fix month-part label
4e3206a scan: share the meal from the result screen
4a54e2d i18n: meal sticker and share button (de, en, es)
2ccc813 share: meal sticker, story card on the scanned photo
6be3f94 share: meal sticker data after the photo scan
8127d05 plan wizard: shared reference cases and a markdown print script
cbebae1 measurements: build-up summary and sentence (pure, tested), i18n namespace
fa3c9f4 plan wizard: drop unused text key
4a36e3d workouts: muscle recommendations and adopting them into a unit
4a7af60 plan: create plan with the wizard from the plan screen
fc4b5c5 training: plan wizard entry in empty states and at the bottom of the tab
bc7b8b6 db: daily_checkins table and profile check-in switches
5e9c118 plan wizard: question steps and editable plan preview at /koli/plan-wizard
1dccfcc workouts: weekly sets per muscle group over 7 and 30 days
536094a measurements: parse, prefill, usesMeasurements, daysSinceLastMeasurement
a21eaa9 workouts: muscle mapping for the catalog and unit muscle profiles
90f10dc docs: 1.4 report, block 2.5
32090f1 plan wizard: texts in de, en and es under planWizard
818b243 measurements: body_measurements table (chest, arm, hip, thigh; waist stays in waist_logs)
cf76183 plan wizard: save a built plan as units, add or replace via archive
8334b95 plan wizard: keep answers in the profile with a device fallback
898f7c9 db: profiles.plan_wizard_answers for wizard pre-fill
8e71dfa lib: detect missing columns and tables from PostgREST errors
ef66c32 Merge block/2.5-rir into release/1.4
fbbb3e9 summary: "Was war los?" after a clear shortfall; too hard twice suggests the easier rung
c154b3c docs: 1.4 report, blocks 2.1, 2.2 data model, 2.4
a871a5c plan wizard: Kolibi template presets built from fixed answers
3db300f plan wizard: rule based buildPlan with swaps and markdown export
f5e2ab6 training: optional "Wie viele wären noch gegangen?" row above Satz fertig
22505c2 Merge block/2.4-meal-groups into release/1.4
b31942c workouts: query and hook for own templates
e05b947 workouts: saveAsTemplate, createUnitFromTemplate, archiveUnit, restoreUnit
871110e workouts: units exclude own templates; own templates and the flag in the API
b2e828f db: recognise columns and tables of migrations that have not run
2414c78 db: workout_templates.is_template for own templates
4501dc3 i18n: rir namespace (de, en, es)
3b0b5d3 sync: write rir and shortfall_reasons only once the columns exist
b260c1a balance: protein-by-time-of-day sentence below the balance rows
f039566 meals tab: show grouped meals with name, time, kcal and protein
e3a7d30 share: offer the story format for every sticker type
f0c8f98 share: story card for exercise, level and session stickers
d648132 session: rir on the open set, carried into the set upsert
26192f8 i18n: meal group names, row meta and protein timing hints (de, en, es)
03eb2ff workouts: per-run capability probe for optional columns, set row builder
f50d48d training: rules for "clearly below target" and "too hard twice"
f5b9223 meals: display label and header totals for grouped meals
21315a3 progression: rir 2+ on an upper-bound session is a clear success; too-hard streak steps down
ffa147b plan wizard: code-side catalog snapshot with ladders, ranges and equipment
eccccf3 balance: protein by time of day with a hint for a clearly low main meal
fdd5bf1 balance: protein distribution counts grouped meals instead of entries
d83911f meals: group entries into meals by a 45-minute chain rule
f4f499f db: session_sets.rir and workout_sessions.shortfall_reasons (file only)
a4f3c49 docs: 1.4 report, blocks 1.1 to 1.3
2b62a5e training: starting, backfilling and editing the plan need an active plan
4dbc6d8 export: open for every registered user
38198c8 home: every tab stays viewable without a plan
7bcc92b access: route gate keeps view routes open, paywall over the previous screen
6b7984e paywall: app-wide request store and host
46f8138 access: rules for AGB Ziffer 10 Abs. 5
0cd2f80 reminders: explain a reminder saved switched off, with a way to the iOS settings
cf641b2 auth: release the push token before switching to another account
ca081e0 push: token_failed with Sentry reason instead of a silent success
cefe3c3 push: save the token through the RPC and report every failure
7af32e4 db: register_push_token moves a device token to the signed-in user
95a98e0 Merge fix/reminders-keepawake into release/1.4
97d4808 Merge feat/share-stickers into release/1.4
4f72011 fix(test-week): summary compares against earlier sessions, not itself
f887a97 fix: keep the screen awake for the whole active session, on every tab
4159b02 docs: report the story card fit and fill per variant
73c4dd3 share: taller progress curve on the story card without a level change
60ec34d share: biggest-gain line stays on one line on the story card
24a7507 share: story card fits its content; stat values sized to fit
2fdb9bd test: story scale target and bounds
ee2543e share: story scale that fills about two thirds of the card, 1x to 2x
7779f3a docs: report the rolling recap window and the progress sticker
cbdc347 history: share progress from the exercise list
35f3810 share: period switch, story card and hint for progress stickers
292c40f share: render the progress sticker
2194347 share: progress sticker with curve and ladder
9feb829 share: expose the content scale to sticker parts
61fbd3a i18n: progress sticker texts (es)
4e06c5d i18n: progress sticker texts (en)
ac8af04 i18n: progress sticker texts (de)
03fc95d analytics: progress as share_sticker_created type
b35ff61 test: progress sticker over time, level change, time, per side, few sessions
431dd20 share: progress sticker data with periods, default and ladder steps
1f3c732 workouts: query key for exercise progress
b561707 workouts: load all sets of a ladder with their session day, paged
7765b86 workouts: the recap no longer shares the sessions card count
f90d024 history: feed the recap raw inputs for its rolling window
1e3e031 test: every recap figure comes from the same window, incl. a Monday
a4c24b6 share: recap figures from one rolling 7- or 30-day window
6b67c29 history: name the protein-goal rule so the recap can reuse it
f4edadd docs: report the decisions on permissions, first-time badge, recap count and story card
98274b6 history: recap sessions from the sessions card inputs
5f099d9 training: first executions show Zum ersten Mal instead of a personal best
60d6173 share: recap title on one line, scaled on the story card
edd72a1 share: session sticker spacing follows the content scale
95f08f4 share: level sticker spacing follows the content scale
7b74adc share: first-time badge and single-line sets on the exercise sticker
f02b359 share: 1.5x content scale on the story card, centred
ceb0948 i18n: first-time badge (es)
275d9f3 i18n: first-time badge (en)
5783227 i18n: first-time badge (de)
a337a31 share: round sticker height in pixels
15ac86b test: first-time badge and recap sessions equal to the sessions card
a211321 share: first-time badge and recap sessions counted like the sessions card
2b325c7 history: sessions card uses the shared day count
f68ae6a test: training-card day count for 7 and 30 days
b8fb3c1 workouts: count training-card days in one place
f42979b share: request add-only photo access without granular read permissions
30416a4 config: drop Face ID and microphone texts (es)
bbb913e config: drop Face ID and microphone texts (en)
bc3b8fe config: drop Face ID and microphone texts (de)
49734b7 config: block Android media reads, drop unused microphone and Face ID permissions
4e18810 config: cap legacy storage permissions at API 32 for add-only photos
a2e5274 docs: report for shareable stickers (1.4)
1278192 history: share menu with image recap next to the text export
6f242e8 history: share personal bests and new levels
1340b11 training: share exercises, the session and a new level from the summary
cbd06e8 share: ShareStickerSheet with preview, variants and actions
862aa48 share: pick the sticker component by kind
3bc2184 share: weekly and monthly recap sticker and story card
b7216c0 share: session sticker
8da8e26 share: level sticker
54f1316 share: exercise sticker
f5b68ce share: sticker frame, palettes and ladder dots
5044979 share: StickerBrand with a slot for the Koli line drawing
e225ee2 i18n: sticker texts (es)
b71fa75 i18n: sticker texts (en)
ff7bc85 i18n: sticker texts (de)
bd197c2 analytics: share_sticker_created without content
d6808f4 share: capture a sticker PNG and save, copy or share it
5ca1a86 test: sticker data builders
7126beb share: pure sticker data builders grouped by exercise_id
8e757fc config: add-only photo permission and English base permission texts
2f766ca config: localized permission texts (es)
236d8ba config: localized permission texts (en)
746d664 config: localized permission texts (de)
ec73311 deps: share sticker libraries
```

`git log --oneline origin/main..main`: leer (main ist bereits gepusht).
