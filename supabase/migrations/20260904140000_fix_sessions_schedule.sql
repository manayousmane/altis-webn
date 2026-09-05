-- Restore the schedule fields required to create training sessions.

ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_date DATE,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

UPDATE public.sessions
SET session_date = COALESCE(session_date, created_at::date, CURRENT_DATE),
    start_time = COALESCE(start_time, TIME '09:00'),
    end_time = COALESCE(end_time, TIME '10:00')
WHERE session_date IS NULL
   OR start_time IS NULL
   OR end_time IS NULL;

ALTER TABLE public.sessions
ALTER COLUMN session_date SET NOT NULL,
ALTER COLUMN start_time SET NOT NULL,
ALTER COLUMN end_time SET NOT NULL;
