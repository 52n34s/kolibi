-- =============================================================================
-- Kolibi pre-TestFlight security audit — READ-ONLY verification queries
-- =============================================================================
-- Run this ENTIRE script as ONE query in the Supabase SQL Editor.
-- Returns a SINGLE result set (section + detail) so nothing is lost when the
-- editor only displays the last statement of a multi-statement script.
-- Strictly SELECT-only: no DDL, no writes, no mutations.
-- Paste all rows back to your security reviewer.
-- =============================================================================

SELECT section, detail
FROM (

  -- ---------------------------------------------------------------------------
  -- G1. RLS enabled / forced — every table in public
  -- ---------------------------------------------------------------------------
  SELECT
    'G1_table_rls' AS section,
    jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    )::text AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G2. RLS policies — all public tables
  -- ---------------------------------------------------------------------------
  SELECT
    'G2_policies' AS section,
    jsonb_build_object(
      'tablename', tablename,
      'policyname', policyname,
      'permissive', permissive,
      'roles', roles,
      'cmd', cmd,
      'qual', qual,
      'with_check', with_check
    )::text AS detail
  FROM pg_policies
  WHERE schemaname = 'public'

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G2b. RLS policies — critical tables only (quick scan)
  -- meal_items, rate_limit_counters, scan_logs, subscriptions, profiles, meals
  -- ---------------------------------------------------------------------------
  SELECT
    'G2_policies_critical' AS section,
    jsonb_build_object(
      'tablename', tablename,
      'policyname', policyname,
      'permissive', permissive,
      'roles', roles,
      'cmd', cmd,
      'qual', qual,
      'with_check', with_check
    )::text AS detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'meal_items',
      'rate_limit_counters',
      'scan_logs',
      'subscriptions',
      'profiles',
      'meals'
    )

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G3. Table-level grants — anon and authenticated on ALL public tables
  -- ---------------------------------------------------------------------------
  SELECT
    'G3_role_table_grants' AS section,
    jsonb_build_object(
      'grantee', grantee,
      'table_name', table_name,
      'privilege_type', privilege_type,
      'is_grantable', is_grantable
    )::text AS detail
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G4. Column-level INSERT/UPDATE grants (privilege-escalation paths)
  -- ---------------------------------------------------------------------------
  SELECT
    'G4_column_privileges' AS section,
    jsonb_build_object(
      'grantee', grantee,
      'table_name', table_name,
      'column_name', column_name,
      'privilege_type', privilege_type,
      'is_grantable', is_grantable
    )::text AS detail
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE')
    AND (
      table_name IN (
        'profiles',
        'subscriptions',
        'admin_users',
        'rate_limit_counters',
        'scan_logs',
        'meal_items',
        'meals'
      )
      OR column_name LIKE 'access_override%'
    )

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G5. All public functions — SECURITY DEFINER, search_path, EXECUTE grants
  -- ---------------------------------------------------------------------------
  SELECT
    'G5_functions' AS section,
    jsonb_build_object(
      'function_name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'is_security_definer', p.prosecdef,
      'config_settings', p.proconfig,
      'service_role_can_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE')
    )::text AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G6. Deployed function bodies — check_scan_rate_limit and is_admin
  -- ---------------------------------------------------------------------------
  SELECT
    'G6_function_def' AS section,
    jsonb_build_object(
      'function_name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'definition', pg_get_functiondef(p.oid)
    )::text AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('check_scan_rate_limit', 'is_admin')

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G7. Views — security_invoker option for every public view
  -- ---------------------------------------------------------------------------
  SELECT
    'G7_view_security' AS section,
    jsonb_build_object(
      'view_name', c.relname,
      'view_options', c.reloptions,
      'security_mode',
        CASE
          WHEN c.reloptions IS NULL THEN 'default (security_definer on PG15+)'
          WHEN EXISTS (
            SELECT 1
            FROM unnest(c.reloptions) AS opt
            WHERE opt = 'security_invoker=true'
          ) THEN 'security_invoker=true'
          WHEN EXISTS (
            SELECT 1
            FROM unnest(c.reloptions) AS opt
            WHERE opt = 'security_invoker=false'
          ) THEN 'security_definer'
          ELSE array_to_string(c.reloptions, ', ')
        END
    )::text AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G8. Triggers in public + auth.users (handle_new_user, meal totals)
  -- ---------------------------------------------------------------------------
  SELECT
    'G8_triggers' AS section,
    jsonb_build_object(
      'schema_name', n.nspname,
      'trigger_name', t.tgname,
      'table_name', c.relname,
      'function_name', p.proname,
      'timing',
        CASE t.tgtype & 66
          WHEN 2 THEN 'BEFORE'
          WHEN 64 THEN 'INSTEAD OF'
          ELSE 'AFTER'
        END,
      'event',
        trim(both ' ' FROM
          CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT ' ELSE '' END
          || CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE ' ELSE '' END
          || CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE ' ELSE '' END
        )
    )::text AS detail
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND (
      n.nspname = 'public'
      OR (
        n.nspname = 'auth'
        AND c.relname = 'users'
        AND t.tgname = 'on_auth_user_created'
      )
      OR t.tgname = 'trg_recompute_meal_totals'
      OR p.proname IN ('handle_new_user', 'recompute_meal_totals')
    )

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G9. Indexes on hot tables
  -- ---------------------------------------------------------------------------
  SELECT
    'G9_indexes' AS section,
    jsonb_build_object(
      'table_name', t.relname,
      'index_name', i.relname,
      'index_definition', pg_get_indexdef(ix.indexrelid)
    )::text AS detail
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname IN ('meals', 'meal_items', 'weight_logs', 'scan_logs')

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G10. auth.users without a profiles row (handle_new_user health check)
  -- ---------------------------------------------------------------------------
  SELECT
    g10.section,
    g10.detail
  FROM (
    SELECT
      'G10_orphan_auth_users' AS section,
      jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at
      )::text AS detail
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ORDER BY u.created_at DESC
    LIMIT 50
  ) AS g10

  UNION ALL

  -- ---------------------------------------------------------------------------
  -- G11. Sensitive tables with NO policies (RLS on but zero policies = deny-all)
  -- ---------------------------------------------------------------------------
  SELECT
    'G11_rls_no_policies' AS section,
    jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity,
      'policy_count', COALESCE(pol.policy_count, 0)
    )::text AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT tablename, COUNT(*)::integer AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) pol ON pol.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
    AND COALESCE(pol.policy_count, 0) = 0

) AS audit
ORDER BY section, detail;
