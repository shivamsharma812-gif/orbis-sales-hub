
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('system_admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Seed CEO as system_admin (skip if not yet linked to auth account)
INSERT INTO public.user_roles (user_id, role)
SELECT auth_user_id, 'system_admin'::public.app_role
FROM public.users
WHERE designation = 'MD & CEO' AND auth_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Reminder tracking
ALTER TABLE public.meetings   ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.followups  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meetings_reminder_due
  ON public.meetings (meeting_date)
  WHERE reminder_sent_at IS NULL AND status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_followups_reminder_due
  ON public.followups (due_date)
  WHERE reminder_sent_at IS NULL AND status = 'pending';

-- 4. Trigger: when a new auth user is linked to a users row with designation 'MD & CEO',
--    they auto-receive system_admin. (Safety for future CEO invites.)
CREATE OR REPLACE FUNCTION public.grant_admin_on_ceo_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL
     AND NEW.designation = 'MD & CEO'
     AND (OLD.auth_user_id IS NULL OR OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.auth_user_id, 'system_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_admin_on_ceo_link ON public.users;
CREATE TRIGGER trg_grant_admin_on_ceo_link
AFTER INSERT OR UPDATE OF auth_user_id, designation ON public.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_ceo_link();
