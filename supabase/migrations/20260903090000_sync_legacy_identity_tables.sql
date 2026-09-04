-- Bring the new Supabase project in line with the legacy Altis schema.
-- This migration is additive and preserves existing application data.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('ORGANISATION', 'FORMATEUR', 'PARTICIPANT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_kind' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.member_kind AS ENUM ('FORMATEUR', 'PARTICIPANT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.member_kind NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, email)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'ORGANISATION');
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX IF NOT EXISTS idx_members_org ON public.members(organization_id);

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_members_updated ON public.members;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR organization_id = public.current_org_id());

DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR organization_id = public.current_org_id());

DROP POLICY IF EXISTS "members read" ON public.members;
CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "members write" ON public.members;
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated
USING (organization_id = public.current_org_id() AND public.is_org_admin())
WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());
