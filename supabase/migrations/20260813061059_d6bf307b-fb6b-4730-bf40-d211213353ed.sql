-- 1. Reason enum
DO $$ BEGIN
  CREATE TYPE public.lead_lost_reason AS ENUM (
    'requires_bank_custodian',
    'lack_of_follow_ups',
    'inadequate_commercial_quotations',
    'other',
    'not_recorded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Structured lost fields on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason_code public.lead_lost_reason,
  ADD COLUMN IF NOT EXISTS lost_reason_note text,
  ADD COLUMN IF NOT EXISTS lost_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Append-only status history
CREATE TABLE IF NOT EXISTS public.lead_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  reason_code public.lead_lost_reason,
  reason_note text,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_status_events_lead ON public.lead_status_events(lead_id, created_at DESC);

GRANT SELECT, INSERT ON public.lead_status_events TO authenticated;
GRANT ALL ON public.lead_status_events TO service_role;

ALTER TABLE public.lead_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_status_events_select ON public.lead_status_events;
CREATE POLICY lead_status_events_select
  ON public.lead_status_events FOR SELECT TO authenticated
  USING (public.can_access_parent('lead'::public.parent_kind, lead_id));

DROP POLICY IF EXISTS lead_status_events_insert ON public.lead_status_events;
CREATE POLICY lead_status_events_insert
  ON public.lead_status_events FOR INSERT TO authenticated
  WITH CHECK (public.can_access_parent('lead'::public.parent_kind, lead_id));

-- 4. Enforce lost invariants + write history
CREATE OR REPLACE FUNCTION public.sync_lead_lost_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid;
  old_status public.lead_status;
BEGIN
  actor := public.current_app_user_id();
  old_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;

  IF NEW.status = 'lost' THEN
    IF NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
    END IF;
    IF NEW.lost_by_user_id IS NULL THEN
      NEW.lost_by_user_id := actor;
    END IF;
    IF NEW.lost_reason_code IS NULL THEN
      -- derive from legacy free-text when possible
      NEW.lost_reason_code := CASE
        WHEN NEW.lost_reason = 'Requires bank custodian' THEN 'requires_bank_custodian'
        WHEN NEW.lost_reason = 'Lack of follow ups' THEN 'lack_of_follow_ups'
        WHEN NEW.lost_reason = 'Inadequate Commercial quotations' THEN 'inadequate_commercial_quotations'
        WHEN NEW.lost_reason IS NOT NULL AND btrim(NEW.lost_reason) <> '' THEN 'other'
        ELSE 'not_recorded'
      END::public.lead_lost_reason;
      IF NEW.lost_reason_code = 'other' AND (NEW.lost_reason_note IS NULL OR btrim(NEW.lost_reason_note) = '') THEN
        NEW.lost_reason_note := NEW.lost_reason;
      END IF;
    END IF;
    IF NEW.lost_reason_code = 'other' AND (NEW.lost_reason_note IS NULL OR btrim(NEW.lost_reason_note) = '') THEN
      RAISE EXCEPTION 'A note is required when the lost reason is "other"';
    END IF;
    IF NEW.lost_reason_code <> 'other' THEN
      NEW.lost_reason_note := NULL;
    END IF;
    -- keep legacy text column in sync for existing readers
    NEW.lost_reason := CASE NEW.lost_reason_code
      WHEN 'requires_bank_custodian' THEN 'Requires bank custodian'
      WHEN 'lack_of_follow_ups' THEN 'Lack of follow ups'
      WHEN 'inadequate_commercial_quotations' THEN 'Inadequate Commercial quotations'
      WHEN 'other' THEN NEW.lost_reason_note
      ELSE 'Reason not recorded'
    END;
  ELSE
    NEW.lost_at := NULL;
    NEW.lost_by_user_id := NULL;
    NEW.lost_reason_code := NULL;
    NEW.lost_reason_note := NULL;
    NEW.lost_reason := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leads_lost_fields ON public.leads;
CREATE TRIGGER trg_leads_lost_fields
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_lost_fields();

CREATE OR REPLACE FUNCTION public.log_lead_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_status_events (lead_id, from_status, to_status, reason_code, reason_note, actor_id)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      NEW.lost_reason_code,
      NEW.lost_reason_note,
      public.current_app_user_id()
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leads_status_events ON public.leads;
CREATE TRIGGER trg_leads_status_events
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_status_event();

-- 5. Convenience view (inherits leads RLS)
DROP VIEW IF EXISTS public.lost_leads_v;
CREATE VIEW public.lost_leads_v
WITH (security_invoker = on) AS
  SELECT
    l.*,
    o.full_name AS owner_name,
    b.full_name AS lost_by_name
  FROM public.leads l
  LEFT JOIN public.users o ON o.id = l.owner_id
  LEFT JOIN public.users b ON b.id = l.lost_by_user_id
  WHERE l.status = 'lost';

GRANT SELECT ON public.lost_leads_v TO authenticated;