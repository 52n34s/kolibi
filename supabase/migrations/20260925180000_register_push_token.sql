-- register_push_token: moves this device's Expo push token to the signed-in user.
--
-- A device keeps its Expo token across accounts. After signing in to an existing
-- account, the token usually still belongs to the anonymous account the device
-- used before. The client upsert then failed on RLS and the new account never
-- got a push_tokens row, so supplement and meal reminders never arrived.
--
-- SECURITY DEFINER so it can remove the other account's row; it only ever
-- writes a row for auth.uid(). Callable by authenticated (incl. Supabase
-- anonymous sign-ins, which use that role), not by anon.
--
-- push_tokens: id, user_id, platform, device_id, created_at, updated_at,
-- last_used_at, expo_push_token (unique).
-- Run manually in the SQL Editor. Not applied by the app.

begin;

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_device_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_token text := nullif(trim(p_token), '');
begin
  if v_user is null then
    raise exception 'register_push_token requires a signed-in user'
      using errcode = '28000';
  end if;

  if v_token is null then
    raise exception 'register_push_token requires a token'
      using errcode = '22023';
  end if;

  -- Same token still held by another account (e.g. the anonymous one).
  delete from public.push_tokens
   where expo_push_token = v_token
     and user_id <> v_user;

  -- Same device with an older token: one row per device, whoever owned it.
  if p_device_id is not null then
    delete from public.push_tokens
     where device_id = p_device_id
       and expo_push_token <> v_token;
  end if;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, device_id, created_at, updated_at, last_used_at
  )
  values (v_user, v_token, p_platform, p_device_id, now(), now(), now())
  on conflict (expo_push_token) do update
     set user_id      = excluded.user_id,
         platform     = excluded.platform,
         device_id    = coalesce(excluded.device_id, public.push_tokens.device_id),
         updated_at   = now(),
         last_used_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public;
revoke all on function public.register_push_token(text, text, text) from anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
