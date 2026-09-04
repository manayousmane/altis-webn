-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ORGANISATION', 'FORMATEUR', 'PARTICIPANT');
CREATE TYPE public.member_kind AS ENUM ('FORMATEUR', 'PARTICIPANT');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  google_connected BOOLEAN NOT NULL DEFAULT false,
  google_account TEXT,
  present_threshold INTEGER NOT NULL DEFAULT 80,
  partial_threshold INTEGER NOT NULL DEFAULT 10,
  late_threshold INTEGER NOT NULL DEFAULT 10,
  early_leave_threshold INTEGER NOT NULL DEFAULT 10,
  reconnection_threshold INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- HELPERS
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MEMBERS
CREATE TABLE public.members (
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

-- PROGRAMS
CREATE TABLE public.programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.program_participants (
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, member_id)
);

-- MODULES
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SESSIONS
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  trainer_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  meeting_url TEXT,
  meeting_code TEXT,
  google_event_id TEXT,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  integration_error TEXT,
  synced BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.session_participants (
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, member_id)
);

CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'GOOGLE_MEET',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_org ON public.members(organization_id);
CREATE INDEX idx_programs_org ON public.programs(organization_id);
CREATE INDEX idx_modules_program ON public.modules(program_id);
CREATE INDEX idx_sessions_module ON public.sessions(module_id);
CREATE INDEX idx_attendance_session ON public.attendance_records(session_id);

-- UPDATED_AT TRIGGERS
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_programs_updated BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_participants TO authenticated;
GRANT ALL ON public.program_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR organization_id = public.current_org_id());

-- organizations
CREATE POLICY "org read" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "org create" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "org update" ON public.organizations FOR UPDATE TO authenticated USING (id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (id = public.current_org_id() AND public.is_org_admin());

-- members
CREATE POLICY "members read" ON public.members FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "members write" ON public.members FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- programs
CREATE POLICY "programs read" ON public.programs FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "programs write" ON public.programs FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- program_participants
CREATE POLICY "program participants read" ON public.program_participants FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "program participants write" ON public.program_participants FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- modules
CREATE POLICY "modules read" ON public.modules FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "modules write" ON public.modules FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- sessions
CREATE POLICY "sessions read" ON public.sessions FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "sessions write" ON public.sessions FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- session_participants
CREATE POLICY "session participants read" ON public.session_participants FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "session participants write" ON public.session_participants FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());

-- attendance_records
CREATE POLICY "attendance read" ON public.attendance_records FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "attendance write" ON public.attendance_records FOR ALL TO authenticated USING (organization_id = public.current_org_id() AND public.is_org_admin()) WITH CHECK (organization_id = public.current_org_id() AND public.is_org_admin());