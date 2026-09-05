-- Restore the session fields used by the application.
-- Optional fields are added without removing existing session data.

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS trainer_id UUID,
ADD COLUMN IF NOT EXISTS module_id UUID,
ADD COLUMN IF NOT EXISTS meeting_url TEXT,
ADD COLUMN IF NOT EXISTS meeting_code TEXT,
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS cancelled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS integration_error TEXT,
ADD COLUMN IF NOT EXISTS synced BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.sessions AS sessions
SET organization_id = modules.organization_id
FROM public.modules AS modules
WHERE sessions.module_id = modules.id
  AND sessions.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce sessions.organization_id NOT NULL: one or more sessions have no module organization';
  END IF;
END $$;

ALTER TABLE public.sessions
ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_organization_id_fkey'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_trainer_id_fkey'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_trainer_id_fkey
    FOREIGN KEY (trainer_id)
    REFERENCES public.members(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_org ON public.sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_module ON public.sessions(module_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions read" ON public.sessions;
CREATE POLICY "sessions read" ON public.sessions
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "sessions write" ON public.sessions;
CREATE POLICY "sessions write" ON public.sessions
FOR ALL TO authenticated
USING (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
)
WITH CHECK (
  organization_id = public.current_org_id()
  AND public.is_org_admin()
);
