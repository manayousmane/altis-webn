-- Restore module ordering required by the application.
-- Existing modules receive a stable order based on creation time.

ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS position INTEGER;

WITH numbered_modules AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY program_id ORDER BY created_at, id)::INTEGER AS module_position
  FROM public.modules
)
UPDATE public.modules AS modules
SET position = numbered_modules.module_position
FROM numbered_modules
WHERE modules.id = numbered_modules.id
  AND modules.position IS NULL;

CREATE OR REPLACE FUNCTION public.assign_module_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.position IS NULL OR NEW.position < 1 THEN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO NEW.position
    FROM public.modules
    WHERE program_id = NEW.program_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modules_position ON public.modules;
CREATE TRIGGER trg_modules_position
BEFORE INSERT ON public.modules
FOR EACH ROW
EXECUTE FUNCTION public.assign_module_position();

ALTER TABLE public.modules
ALTER COLUMN position SET NOT NULL;

ALTER TABLE public.modules
ALTER COLUMN position SET DEFAULT NULL;

REVOKE ALL ON FUNCTION public.assign_module_position() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_module_position() TO service_role;
