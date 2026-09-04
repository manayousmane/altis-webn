-- Table for storing encrypted Google OAuth credentials securely
-- Accessible only by service_role (backend server functions)

CREATE TABLE IF NOT EXISTS public.organization_google_credentials (
  organization_id UUID NOT NULL PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_account_email TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_google_credentials ENABLE ROW LEVEL SECURITY;

-- No SELECT, INSERT, UPDATE, DELETE policies for authenticated/anon.
-- ONLY service_role can access this table!
GRANT ALL ON public.organization_google_credentials TO service_role;

-- Updated at trigger
CREATE TRIGGER trg_org_google_credentials_updated
BEFORE UPDATE ON public.organization_google_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
