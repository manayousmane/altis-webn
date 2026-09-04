CREATE OR REPLACE FUNCTION public.create_organization(_name TEXT, _timezone TEXT DEFAULT 'Europe/Paris')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _org UUID;
  _existing UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id INTO _existing FROM public.profiles WHERE id = _uid;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  IF coalesce(trim(_name), '') = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  INSERT INTO public.organizations (name, timezone)
  VALUES (trim(_name), coalesce(nullif(trim(_timezone), ''), 'Europe/Paris'))
  RETURNING id INTO _org;

  INSERT INTO public.profiles (id, organization_id)
  VALUES (_uid, _org)
  ON CONFLICT (id) DO UPDATE SET organization_id = _org;

  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (_uid, 'ORGANISATION', _org)
  ON CONFLICT (user_id, role) DO UPDATE SET organization_id = _org;

  RETURN _org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT) TO authenticated, service_role;