
-- ============================================================
-- Admin Panel: role system + SECURITY DEFINER access functions
-- ============================================================

-- 1. Role enum
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 2. Add role column to profiles (default = 'user' for everyone)
ALTER TABLE public.profiles
  ADD COLUMN role public.user_role NOT NULL DEFAULT 'user';

-- ============================================================
-- Helper: is_admin()
-- SECURITY DEFINER so it reads profiles bypassing RLS,
-- then checks if the JWT subject (auth.uid()) is an admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- Platform-wide stats (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_users',             (SELECT COUNT(*)                FROM public.profiles),
      'total_transactions',      (SELECT COUNT(*)                FROM public.transactions),
      'total_income',            (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE type = 'income'),
      'total_expense',           (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE type = 'expense'),
      'users_this_month',        (SELECT COUNT(*) FROM public.profiles     WHERE created_at >= date_trunc('month', now())),
      'transactions_this_month', (SELECT COUNT(*) FROM public.transactions  WHERE created_at >= date_trunc('month', now()))
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- ============================================================
-- All users list with email + per-user stats (admin only)
-- Joins auth.users (accessible because SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(u ORDER BY u.created_at DESC), '[]'::json)
    FROM (
      SELECT
        p.id,
        p.full_name,
        p.role::text                AS role,
        p.created_at,
        au.email,
        COUNT(t.id)                 AS transaction_count,
        COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense
      FROM public.profiles p
      JOIN auth.users au ON au.id = p.id
      LEFT JOIN public.transactions t ON t.user_id = p.id
      GROUP BY p.id, p.full_name, p.role, p.created_at, au.email
    ) u
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- ============================================================
-- Promote / demote a user role (admin only, no self-demotion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role public.user_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Admin access required' USING ERRCODE = '42501';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE = '23514';
  END IF;

  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) TO authenticated;
