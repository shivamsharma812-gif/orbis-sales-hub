ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivity_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_user_login()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev timestamptz;
  first_today boolean;
BEGIN
  SELECT last_login_at INTO prev
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  first_today := prev IS NULL OR prev < date_trunc('day', now());

  UPDATE public.users
  SET last_login_at = CASE WHEN first_today THEN now() ELSE last_login_at END,
      last_active_at = now(),
      inactivity_email_sent_at = NULL
  WHERE auth_user_id = auth.uid();

  RETURN first_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_login() TO authenticated;