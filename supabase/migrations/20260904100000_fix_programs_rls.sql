-- Restore the program RLS policies on the new Supabase project.
-- Inserts are allowed only for an authenticated organization administrator
-- whose profile belongs to the program organization.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programs read" ON public.programs;
CREATE POLICY "programs read" ON public.programs
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "programs write" ON public.programs;
CREATE POLICY "programs write" ON public.programs
FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
);
