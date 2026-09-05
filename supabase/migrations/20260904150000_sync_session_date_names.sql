-- Keep the legacy `date` column synchronized with the application field `session_date`.
-- The existing database uses `date` as NOT NULL while the application writes `session_date`.

UPDATE public.sessions
SET "date" = session_date
WHERE session_date IS NOT NULL
  AND "date" IS DISTINCT FROM session_date;

CREATE OR REPLACE FUNCTION public.sync_session_date_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_date IS NULL AND NEW."date" IS NOT NULL THEN
    NEW.session_date := NEW."date";
  ELSIF NEW."date" IS NULL AND NEW.session_date IS NOT NULL THEN
    NEW."date" := NEW.session_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_session_date_columns ON public.sessions;
CREATE TRIGGER trg_sync_session_date_columns
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_session_date_columns();

REVOKE ALL ON FUNCTION public.sync_session_date_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_session_date_columns() TO service_role;
