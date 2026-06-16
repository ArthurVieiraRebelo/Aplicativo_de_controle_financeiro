-- ============================================================
-- SCRIPT COMPLETO — Cole no Supabase SQL Editor e clique RUN
-- Cria todas as tabelas base + painel admin de uma vez
-- É seguro rodar mesmo se algumas coisas já existirem
-- ============================================================

-- ── Trigger helper ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── ENUMs base ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.transaction_type AS ENUM ('income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash','debit','credit','pix','transfer','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own profile" ON public.profiles FOR ALL
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       public.transaction_type NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'tag',
  color      TEXT NOT NULL DEFAULT '#8b5cf6',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS categories_user_idx ON public.categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own categories" ON public.categories FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           public.transaction_type NOT NULL,
  title          TEXT NOT NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  category_id    UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  occurred_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method public.payment_method,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_user_date_idx ON public.transactions(user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS tx_user_cat_idx  ON public.transactions(user_id, category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own transactions" ON public.transactions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS tx_updated ON public.transactions;
CREATE TRIGGER tx_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── BUDGETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_limit NUMERIC(14,2) NOT NULL CHECK (amount_limit > 0),
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own budgets" ON public.budgets FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS budgets_updated ON public.budgets;
CREATE TRIGGER budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── GOALS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  target_amount  NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "own goals" ON public.goals FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP TRIGGER IF EXISTS goals_updated ON public.goals;
CREATE TRIGGER goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Trigger: novo usuário → cria perfil + categorias padrão ─
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id,'Salário','income','wallet','#10b981',true),
    (NEW.id,'Freelance','income','briefcase','#06b6d4',true),
    (NEW.id,'Investimentos','income','trending-up','#22c55e',true),
    (NEW.id,'Outros','income','plus-circle','#84cc16',true),
    (NEW.id,'Alimentação','expense','utensils','#ef4444',true),
    (NEW.id,'Transporte','expense','car','#f97316',true),
    (NEW.id,'Moradia','expense','home','#a855f7',true),
    (NEW.id,'Saúde','expense','heart-pulse','#ec4899',true),
    (NEW.id,'Educação','expense','graduation-cap','#3b82f6',true),
    (NEW.id,'Lazer','expense','gamepad-2','#8b5cf6',true),
    (NEW.id,'Assinaturas','expense','repeat','#14b8a6',true),
    (NEW.id,'Outros','expense','more-horizontal','#6b7280',true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Se você já tem conta mas não tem linha em profiles, cria agora:
INSERT INTO public.profiles (id, full_name)
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1))
  FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- PAINEL ADMIN
-- ════════════════════════════════════════════════════════════

-- Enum de roles
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coluna role (seguro se já existir)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

-- is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- get_admin_stats()
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

-- get_admin_users()
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT COALESCE(json_agg(u ORDER BY u.created_at DESC),'[]'::json)
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

-- set_user_role()
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role public.user_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE = '23514'; END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- PROMOVER O PRIMEIRO USUÁRIO A ADMIN (= você)
-- ════════════════════════════════════════════════════════════
UPDATE public.profiles
SET role = 'admin'
WHERE created_at = (SELECT MIN(created_at) FROM public.profiles);

-- Confirma o resultado:
SELECT p.id, p.full_name, p.role, au.email
FROM public.profiles p
JOIN auth.users au ON au.id = p.id;
