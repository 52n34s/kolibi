-- ============================================================================
-- Aufräum-SQL für den Trainings-Tab-Testlauf · NICHT AUSGEFÜHRT
-- Test-User: test2@52n34s.com = 7cdfe565-8024-46aa-85e8-4ffadc29125f
--
-- Stand nach dem Tag-6-Lauf vom 2026-09-22 (17:40):
--   9 workout_sessions (15./16./18./19./21.09. + 4x 22.09.) · 161 session_sets
--   9 training_sessions · 2 progression_events (1 accepted, 1 declined)
--   7 eigene exercises: 5 archivierte "Repro-Uebung" + 2x "Test-Uebung"
--     - cd873707-... (reps, nicht archiviert, aus dem Fix-Lauf)
--     - f8321640-... (time/pro Seite, archiviert 15:38, aus Tag 6)
--   3 workout_templates: Pull & Legs, Push, "Legs" (archiviert 15:38,
--     2 template_exercises bleiben daran haengen) · 19 template_exercises
--   Vorlage "Push": Position 1 durch Progression auf archer_push_up;
--   Barren-Dips durch "Als neues Ziel uebernehmen" auf 3 x 7-10 (war 5-10)
--   Tag 6 hat ausserdem geaendert:
--     - Session d62e30e6-... (war 17.09./hart) -> 18.09./normal, 47 kcal,
--       Liegestuetze Satz 2: 7 -> 9. started_at/finished_at stehen weiter
--       auf dem 17.09. (Befund B18) und werden hier mitgeloescht.
--     - Nachtrag 78cabe76-... am 16.09. (Pull & Legs, 45 min, normal)
--   Storage (nach Fix-Block 4, beim Verifizieren angelegt):
--     exercise-images/<uid>/cd873707-...webp   7.828 B  -> exercises.image_path
--     avatars/<uid>/avatar.jpg               131.229 B  -> profiles.avatar_url
--   Session 7b98feb1-... wurde beim Verifizieren von B18 auf den 20.09. und
--   zurueck auf den 19.09. geschoben; finished_at steht dadurch auf
--   12:53:38 statt 12:53:20 (auf ganze Minuten neu berechnet).
--
-- Reihenfolge beachten. Jede Anweisung ist auf den Test-User eingegrenzt.
-- ============================================================================

\set uid '7cdfe565-8024-46aa-85e8-4ffadc29125f'

-- ---------------------------------------------------------------------------
-- 0) VORHER PRÜFEN — betroffene Zeilenzahlen
-- ---------------------------------------------------------------------------
SELECT 'session_sets'       AS tabelle, count(*) FROM session_sets       WHERE user_id = :'uid'
UNION ALL SELECT 'workout_sessions',    count(*) FROM workout_sessions   WHERE user_id = :'uid'
UNION ALL SELECT 'training_sessions',   count(*) FROM training_sessions  WHERE user_id = :'uid'
UNION ALL SELECT 'progression_events',  count(*) FROM progression_events WHERE user_id = :'uid'
UNION ALL SELECT 'eigene exercises',    count(*) FROM exercises          WHERE user_id = :'uid'
UNION ALL SELECT 'workout_templates',   count(*) FROM workout_templates  WHERE user_id = :'uid'
UNION ALL SELECT 'template_exercises',  count(*) FROM template_exercises WHERE user_id = :'uid';

SELECT id, template_name, logged_on, intensity, training_session_id
FROM workout_sessions
WHERE user_id = :'uid' AND logged_on BETWEEN DATE '2026-09-15' AND DATE '2026-09-22'
ORDER BY logged_on;

-- ---------------------------------------------------------------------------
-- 1) Sätze der Test-Einheiten
-- ---------------------------------------------------------------------------
DELETE FROM session_sets
WHERE user_id = :'uid'
  AND session_id IN (
    SELECT id FROM workout_sessions
    WHERE user_id = :'uid'
      AND logged_on BETWEEN DATE '2026-09-15' AND DATE '2026-09-22'
  );

-- ---------------------------------------------------------------------------
-- 2) Verknüpfte training_sessions einsammeln (vor dem Löschen der Workouts!)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _ts_to_delete AS
SELECT DISTINCT training_session_id AS id
FROM workout_sessions
WHERE user_id = :'uid'
  AND logged_on BETWEEN DATE '2026-09-15' AND DATE '2026-09-22'
  AND training_session_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Workout- und Trainingseinheiten
-- ---------------------------------------------------------------------------
DELETE FROM workout_sessions
WHERE user_id = :'uid'
  AND logged_on BETWEEN DATE '2026-09-15' AND DATE '2026-09-22';

DELETE FROM training_sessions
WHERE user_id = :'uid' AND id IN (SELECT id FROM _ts_to_delete);

DROP TABLE _ts_to_delete;

-- Rest prüfen (z. B. aus einem Nachtrag ohne workout_session)
SELECT id, logged_on, duration_min, intensity, estimated_kcal
FROM training_sessions
WHERE user_id = :'uid' AND logged_on BETWEEN DATE '2026-09-15' AND DATE '2026-09-22';

-- Storage-Objekte des Test-Users. Die Zeile in storage.objects verschwindet
-- nur ueber die Storage-API bzw. das Dashboard, nicht per DELETE hier.
SELECT bucket_id, name, (metadata->>'size')::int AS bytes
FROM storage.objects
WHERE (storage.foldername(name))[1] = :'uid'
ORDER BY bucket_id;

-- ---------------------------------------------------------------------------
-- 4) Progressions-Ereignisse des Testlaufs
-- ---------------------------------------------------------------------------
SELECT id, kind, status, created_at FROM progression_events
WHERE user_id = :'uid' AND created_at >= TIMESTAMPTZ '2026-09-22 00:00+00';

DELETE FROM progression_events
WHERE user_id = :'uid' AND created_at >= TIMESTAMPTZ '2026-09-22 00:00+00';

-- ---------------------------------------------------------------------------
-- 5) Vorlage "Push" zurücksetzen: Progression hat Position 1 von
--    parallette_push_up auf archer_push_up umgestellt (3 × 5–8).
--    Ursprung: Liegestütze auf Parallettes, 3 × 8–12.
-- ---------------------------------------------------------------------------
SELECT te.id, te.position, e.catalog_slug, te.target_sets, te.target_reps, te.target_reps_max
FROM template_exercises te
JOIN exercises e ON e.id = te.exercise_id
JOIN workout_templates t ON t.id = te.template_id
WHERE te.user_id = :'uid' AND t.short_label = 'Ps'
ORDER BY te.position;

UPDATE template_exercises te
SET exercise_id = (SELECT id FROM exercises WHERE catalog_slug = 'parallette_push_up'),
    target_sets = 3,
    target_reps = 8,
    target_reps_max = 12
FROM workout_templates t, exercises e
WHERE te.template_id = t.id
  AND te.exercise_id = e.id
  AND te.user_id = :'uid'
  AND t.short_label = 'Ps'
  AND e.catalog_slug = 'archer_push_up';

-- 5b) Barren-Dips zurücksetzen: "Als neues Ziel übernehmen" hat 5 → 7 gehoben.
UPDATE template_exercises te
SET target_reps = 5, target_reps_max = 10
FROM workout_templates t, exercises e
WHERE te.template_id = t.id
  AND te.exercise_id = e.id
  AND te.user_id = :'uid'
  AND t.short_label = 'Ps'
  AND e.catalog_slug = 'parallel_bar_dip';

-- ---------------------------------------------------------------------------
-- 6) Eigene Übungen aus dem Regressionsflow ("Repro-Übung", alle archiviert)
--    und die beiden "Test-Übung" aus Tag 6.
--    cd873707-... hat ein Bild im Bucket — die Datei separat über die
--    Storage-API entfernen, das DELETE hier räumt sie nicht mit ab.
--    Ebenso das Profilbild avatars/<uid>/avatar.jpg, falls gewünscht
--    (dann auch profiles.avatar_url auf NULL setzen).
-- ---------------------------------------------------------------------------
SELECT id, names->>'de' AS name, image_path, archived_at
FROM exercises
WHERE user_id = :'uid';

-- Achtung: beide "Test-Uebung"-Zeilen (cd873707-..., f8321640-...) gehen mit.
DELETE FROM exercises
WHERE user_id = :'uid' AND names->>'de' IN ('Repro-Übung', 'Test-Übung');

-- ---------------------------------------------------------------------------
-- 7) Test-Einheit "Legs" aus dem Plan (Tag 6, archiviert - Zeile existiert noch)
-- ---------------------------------------------------------------------------
DELETE FROM template_exercises
WHERE user_id = :'uid'
  AND template_id IN (SELECT id FROM workout_templates WHERE user_id = :'uid' AND name = 'Legs');

DELETE FROM workout_templates WHERE user_id = :'uid' AND name = 'Legs';

-- ---------------------------------------------------------------------------
-- 8) ENDKONTROLLE — muss der Ausgangslage entsprechen:
--    0 workout_sessions · 0 session_sets · 0 training_sessions
--    0 progression_events · 0 eigene exercises · 2 Vorlagen · 17 Vorlagen-Übungen
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM workout_sessions   WHERE user_id = :'uid') AS workout_sessions,
  (SELECT count(*) FROM session_sets       WHERE user_id = :'uid') AS session_sets,
  (SELECT count(*) FROM training_sessions  WHERE user_id = :'uid') AS training_sessions,
  (SELECT count(*) FROM progression_events WHERE user_id = :'uid') AS progression_events,
  (SELECT count(*) FROM exercises          WHERE user_id = :'uid') AS eigene_uebungen,
  (SELECT count(*) FROM workout_templates  WHERE user_id = :'uid') AS vorlagen,
  (SELECT count(*) FROM template_exercises WHERE user_id = :'uid') AS vorlagen_uebungen;

-- ============================================================================
-- SEPARAT — nicht Teil der Trainings-Testdaten:
-- Zwei anonyme auth.users aus dem ERSTEN Lauf (iPhone-SE-Simulator).
-- Vor dem Löschen bitte selbst prüfen, welche davon wirklich daher stammt.
--   163e36c1-843b-4eb6-80ba-3a799a40f76b  2026-09-22 10:12:45+00  (Herkunft unklar)
--   a8c60ca6-5bbb-4e3a-b321-cf76345cf296  2026-09-22 10:50:08+00  (SE-Simulator)
-- SELECT id, is_anonymous, created_at FROM auth.users
--   WHERE id IN ('163e36c1-843b-4eb6-80ba-3a799a40f76b',
--                'a8c60ca6-5bbb-4e3a-b321-cf76345cf296');
-- ============================================================================
