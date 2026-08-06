-- Encrypted per-user connector connection storage
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- Only service_role should access this table; RLS policy blocks authenticated direct access.
CREATE POLICY "service_role_only_app_user_connections" ON public.app_user_connections
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Meeting columns for Outlook sync
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attendees jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS outlook_event_id text,
  ADD COLUMN IF NOT EXISTS outlook_ical_uid text,
  ADD COLUMN IF NOT EXISTS outlook_last_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS outlook_sync_error text,
  ADD COLUMN IF NOT EXISTS outlook_change_key text;

CREATE INDEX IF NOT EXISTS idx_meetings_outlook_event_id ON public.meetings(outlook_event_id);

-- Trigger to keep app_user_connections.updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_user_connections_updated_at
BEFORE UPDATE ON public.app_user_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();