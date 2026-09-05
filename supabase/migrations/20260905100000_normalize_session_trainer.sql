-- Prevent stale or legacy trainer IDs from breaking session creation.
-- A trainer is optional at database level; invalid references are cleared.

CREATE OR REPLACE FUNCTION public.normalize_session_trainer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trainer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.members
    WHERE id = NEW.trainer_id
      AND organization_id = NEW.organization_id
      AND kind = 'FORMATEUR'::public.member_kind
  ) THEN
    NEW.trainer_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_session_trainer ON public.sessions;
CREATE TRIGGER trg_normalize_session_trainer
BEFORE INSERT OR UPDATE OF trainer_id, organization_id ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.normalize_session_trainer();

-- Clean legacy invalid references already present in the database.
UPDATE public.sessions AS sessions
SET trainer_id = NULL
WHERE trainer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.members AS members
    WHERE members.id = sessions.trainer_id
      AND members.organization_id = sessions.organization_id
      AND members.kind = 'FORMATEUR'::public.member_kind
  );

REVOKE ALL ON FUNCTION public.normalize_session_trainer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_session_trainer() TO service_role;
