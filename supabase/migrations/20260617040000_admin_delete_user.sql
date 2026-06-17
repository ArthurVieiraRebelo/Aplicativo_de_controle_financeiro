-- ============================================================
-- Admin: delete a user directly (no service_role key needed).
-- Runs as the function owner (postgres), which already has
-- delete rights on auth.users — FK cascades remove profiles,
-- categories, transactions, budgets and goals automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account' USING ERRCODE = '23514';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
