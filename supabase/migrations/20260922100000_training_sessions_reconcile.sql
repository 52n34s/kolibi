-- Live-Stand (Diagnose 22.09.2026), zur Dokumentation:
--   training_type: Enum training_type (strength/yoga/swimming/cycling/other)
--   intensity:     Enum gym_intensity (easy/normal/hard)
--   duration_min <= 300, estimated_kcal nullable, FK user_id -> auth.users
--   kein UNIQUE (user_id, logged_on)
-- Diese Migration räumt nur doppelte Policy und anon-Rechte ab.

drop policy if exists training_sessions_own on public.training_sessions;
revoke all on public.training_sessions from anon;

notify pgrst, 'reload schema';
