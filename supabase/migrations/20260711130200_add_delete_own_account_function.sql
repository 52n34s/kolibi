-- Lets authenticated users permanently delete their own account and related data.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = current_user_id::text;

  DELETE FROM public.calorie_goals WHERE user_id = current_user_id;
  DELETE FROM public.weight_logs WHERE user_id = current_user_id;
  DELETE FROM public.subscriptions WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
