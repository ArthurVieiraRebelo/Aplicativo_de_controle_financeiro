
-- Helper trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ENUMS
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.payment_method AS ENUM ('cash','debit','credit','pix','transfer','other');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.transaction_type NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX categories_user_idx ON public.categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method public.payment_method,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tx_user_date_idx ON public.transactions(user_id, occurred_on DESC);
CREATE INDEX tx_user_cat_idx ON public.transactions(user_id, category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tx_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BUDGETS
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_limit NUMERIC(14,2) NOT NULL CHECK (amount_limit > 0),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user trigger: create profile + default categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Salário', 'income', 'wallet', '#10b981', true),
    (NEW.id, 'Freelance', 'income', 'briefcase', '#06b6d4', true),
    (NEW.id, 'Investimentos', 'income', 'trending-up', '#22c55e', true),
    (NEW.id, 'Outros', 'income', 'plus-circle', '#84cc16', true),
    (NEW.id, 'Alimentação', 'expense', 'utensils', '#ef4444', true),
    (NEW.id, 'Transporte', 'expense', 'car', '#f97316', true),
    (NEW.id, 'Moradia', 'expense', 'home', '#a855f7', true),
    (NEW.id, 'Saúde', 'expense', 'heart-pulse', '#ec4899', true),
    (NEW.id, 'Educação', 'expense', 'graduation-cap', '#3b82f6', true),
    (NEW.id, 'Lazer', 'expense', 'gamepad-2', '#8b5cf6', true),
    (NEW.id, 'Assinaturas', 'expense', 'repeat', '#14b8a6', true),
    (NEW.id, 'Outros', 'expense', 'more-horizontal', '#6b7280', true);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
