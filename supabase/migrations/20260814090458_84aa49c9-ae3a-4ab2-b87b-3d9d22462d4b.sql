-- 1. Soft delete columns
ALTER TABLE public.followups
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Notes must be editable / soft-deletable by users who can access the parent record
DROP POLICY IF EXISTS "notes_update_accessible" ON public.notes;
CREATE POLICY "notes_update_accessible" ON public.notes
  FOR UPDATE TO authenticated
  USING (public.can_access_parent(parent_type, parent_id))
  WITH CHECK (public.can_access_parent(parent_type, parent_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

-- 3. Client field parity with lead creation
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS referral_by text,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS priority public.priority_level NOT NULL DEFAULT 'medium';

ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'onboarded';

-- 4. Force new clients to be onboarded regardless of the submitted payload
CREATE OR REPLACE FUNCTION public.force_client_onboarded_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.status := 'onboarded'::public.client_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_force_onboarded ON public.clients;
CREATE TRIGGER trg_clients_force_onboarded
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.force_client_onboarded_status();