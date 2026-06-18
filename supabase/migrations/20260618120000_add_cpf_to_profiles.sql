-- Add CPF column for password-recovery-by-CPF flow (no e-mail verification)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE;

-- ============================================================
-- handle_new_user(): redefined to also persist CPF, atomically,
-- as part of the same INSERT that creates the profile row.
-- The client sends the CPF via signUp's raw_user_meta_data instead
-- of issuing a separate UPDATE after signUp() resolves — a second
-- round-trip raced with the SIGNED_IN-triggered redirect to /dashboard
-- and surfaced its error as a stray toast over the dashboard.
-- Normalizes to digits-only as defense in depth (client already does it).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '')
  );

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

-- ============================================================
-- get_user_id_by_cpf(cpf)
-- SECURITY DEFINER so an anonymous (logged-out) user attempting to
-- recover their password can resolve a CPF to a user id, bypassing
-- the "own profile" RLS policy which would otherwise hide every row.
-- Normalizes the input to digits-only so a masked CPF sent by mistake
-- still matches what's stored.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_id_by_cpf(p_cpf text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE cpf = regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g') LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_cpf(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_cpf(text) TO anon, authenticated;
