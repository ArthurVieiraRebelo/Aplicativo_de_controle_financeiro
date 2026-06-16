-- ============================================================
-- COLE ESTE SCRIPT INTEIRO NO SUPABASE SQL EDITOR E CLIQUE RUN
-- Supabase Dashboard → SQL Editor → New Query → Cole → Run
-- ============================================================

-- 1. Enum de roles (seguro para re-executar)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Coluna role na tabela profiles (seguro para re-executar)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

-- 3. Função is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4. Função get_admin_stats()
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT json_build_object(
    'total_users',             (SELECT COUNT(*) FROM public.profiles),
    'total_transactions',      (SELECT COUNT(*) FROM public.transactions),
    'total_income',            (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE type='income'),
    'total_expense',           (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE type='expense'),
    'users_this_month',        (SELECT COUNT(*) FROM public.profiles WHERE created_at>=date_trunc('month',now())),
    'transactions_this_month', (SELECT COUNT(*) FROM public.transactions WHERE created_at>=date_trunc('month',now()))
  ));
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- 5. Função get_admin_users()
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(json_agg(u ORDER BY u.created_at DESC), '[]'::json)
    FROM (SELECT p.id, p.full_name, p.role::text AS role, p.created_at, au.email,
            COUNT(t.id) AS transaction_count,
            COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount ELSE 0 END),0) AS total_income,
            COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) AS total_expense
          FROM public.profiles p
          JOIN auth.users au ON au.id = p.id
          LEFT JOIN public.transactions t ON t.user_id = p.id
          GROUP BY p.id, p.full_name, p.role, p.created_at, au.email) u);
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- 6. Função set_user_role()
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role public.user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE = '23514'; END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) TO authenticated;

-- 7. PROMOVER VOCÊ A ADMIN (o usuário mais antigo = você)
UPDATE public.profiles
SET role = 'admin'
WHERE created_at = (SELECT MIN(created_at) FROM public.profiles);

-- Confirma
SELECT id, full_name, role FROM public.profiles;
