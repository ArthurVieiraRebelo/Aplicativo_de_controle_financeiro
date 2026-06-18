-- ============================================================
-- Admin panel is no longer gated by the `role` column — access is
-- now controlled by a local password prompt in the frontend
-- (ADMIN_PASSWORD in src/routes/admin/route.tsx). Every admin
-- RPC still funnels through is_admin(), so relaxing this single
-- function reopens get_admin_stats/get_admin_users/set_user_role/
-- admin_delete_user to any authenticated user without touching
-- their individual definitions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
$$;
