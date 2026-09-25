-- Distinguishes true manual entries (Trainingslog / Nachtragen without a
-- Kolibi unit) from phantom strength rows left by a finish that wrote the
-- training_sessions row twice. Linked rows stay false. Unlinked rows whose
-- created_at is not within 10 minutes after a finished unit of the same user
-- are backfilled to true.

begin;

alter table public.training_sessions
  add column if not exists is_manual boolean not null default false;

-- Backfill: only rows that are still unlinked. Linked ones stay false.
update public.training_sessions ts
set is_manual = true
where ts.is_manual = false
  and not exists (
    select 1
      from public.workout_sessions ws
     where ws.training_session_id = ts.id
  )
  and not exists (
    select 1
      from public.workout_sessions ws
     where ws.user_id = ts.user_id
       and ws.finished_at is not null
       and ts.created_at >= ws.finished_at
       and ts.created_at < ws.finished_at + interval '10 minutes'
  );

notify pgrst, 'reload schema';

commit;
