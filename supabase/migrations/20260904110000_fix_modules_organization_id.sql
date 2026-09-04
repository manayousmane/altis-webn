-- Restore the organization scope required by the application for modules.
-- Existing modules inherit their organization from their parent program.

ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE public.modules AS modules
SET organization_id = programs.organization_id
FROM public.programs AS programs
WHERE modules.program_id = programs.id
  AND modules.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.modules
    WHERE organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce modules.organization_id NOT NULL: one or more modules have no parent program organization';
  END IF;
END $$;

ALTER TABLE public.modules
ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'modules_organization_id_fkey'
      AND conrelid = 'public.modules'::regclass
  ) THEN
    ALTER TABLE public.modules
    ADD CONSTRAINT modules_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_modules_org ON public.modules(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modules read" ON public.modules;
CREATE POLICY "modules read" ON public.modules
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "modules write" ON public.modules;
CREATE POLICY "modules write" ON public.modules
FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
);
