
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.pipeline_stage AS ENUM (
  'Prospect','Contacted','Meeting Scheduled','Meeting Completed',
  'Proposal Sent','Negotiation','Mandate Signed','Onboarding','Won','Lost'
);
CREATE TYPE public.lead_status AS ENUM ('active','won','lost','archived');
CREATE TYPE public.client_status AS ENUM ('active','inactive');
CREATE TYPE public.user_status AS ENUM ('active','inactive');
CREATE TYPE public.parent_kind AS ENUM ('lead','client');
CREATE TYPE public.meeting_status AS ENUM ('scheduled','completed','cancelled');
CREATE TYPE public.followup_status AS ENUM ('pending','completed');
CREATE TYPE public.task_status AS ENUM ('open','in_progress','completed','cancelled');
CREATE TYPE public.priority_level AS ENUM ('low','medium','high');

-- =====================================================
-- USERS  (org directory; linked to auth.users only when login enabled)
-- =====================================================
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  designation TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Sales',
  reports_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_users_reports_to ON public.users(reports_to_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HIERARCHY FUNCTIONS  (security definer to avoid RLS recursion)
-- =====================================================

-- returns the public.users.id for the current auth user
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- true when target_user_id is a descendant of manager_user_id in the reporting tree
CREATE OR REPLACE FUNCTION public.is_descendant_of(manager_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT id, reports_to_user_id FROM public.users WHERE reports_to_user_id = manager_user_id
    UNION ALL
    SELECT u.id, u.reports_to_user_id
    FROM public.users u
    JOIN tree t ON u.reports_to_user_id = t.id
  )
  SELECT EXISTS (SELECT 1 FROM tree WHERE id = target_user_id);
$$;

-- true when the current auth user can access records owned by target_owner_id
CREATE OR REPLACE FUNCTION public.can_access_owner(target_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN target_owner_id IS NULL THEN FALSE
      WHEN public.current_app_user_id() = target_owner_id THEN TRUE
      WHEN public.is_descendant_of(public.current_app_user_id(), target_owner_id) THEN TRUE
      ELSE FALSE
    END;
$$;

-- true when current user is at top of tree (MD & CEO)
CREATE OR REPLACE FUNCTION public.is_top_of_tree()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = public.current_app_user_id() AND reports_to_user_id IS NULL
  );
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Users RLS: everyone authenticated can read the directory; only CEO can insert/update/delete
CREATE POLICY "users_select_all_authenticated" ON public.users
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_ceo_insert" ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.is_top_of_tree());
CREATE POLICY "users_ceo_update" ON public.users
  FOR UPDATE TO authenticated USING (public.is_top_of_tree()) WITH CHECK (public.is_top_of_tree());
CREATE POLICY "users_ceo_delete" ON public.users
  FOR DELETE TO authenticated USING (public.is_top_of_tree());

-- =====================================================
-- PIPELINE STAGES  (configurable)
-- =====================================================
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_read_all" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "stages_ceo_write" ON public.pipeline_stages FOR ALL TO authenticated
  USING (public.is_top_of_tree()) WITH CHECK (public.is_top_of_tree());

-- =====================================================
-- CLIENTS  (created before leads because leads.converted_client_id → clients)
-- =====================================================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  client_type TEXT,
  industry TEXT,
  service_type TEXT,
  auc NUMERIC(18,2) DEFAULT 0,
  annual_revenue NUMERIC(18,2) DEFAULT 0,
  website TEXT,
  address TEXT,
  remarks TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status public.client_status NOT NULL DEFAULT 'active',
  originating_lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_owner ON public.clients(owner_id);
CREATE INDEX idx_clients_status ON public.clients(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "clients_select_hierarchy" ON public.clients FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "clients_insert_self" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "clients_update_hierarchy" ON public.clients FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "clients_delete_ceo" ON public.clients FOR DELETE TO authenticated
  USING (public.is_top_of_tree());

-- =====================================================
-- LEADS
-- =====================================================
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  client_type TEXT,
  industry TEXT,
  lead_source TEXT,
  pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'Prospect',
  estimated_deal_value NUMERIC(18,2) DEFAULT 0,
  status public.lead_status NOT NULL DEFAULT 'active',
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  converted_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_owner ON public.leads(owner_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_stage ON public.leads(pipeline_stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "leads_select_hierarchy" ON public.leads FOR SELECT TO authenticated
  USING (public.can_access_owner(owner_id));
CREATE POLICY "leads_insert_self" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "leads_update_hierarchy" ON public.leads FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id)) WITH CHECK (public.can_access_owner(owner_id));
CREATE POLICY "leads_delete_ceo" ON public.leads FOR DELETE TO authenticated
  USING (public.is_top_of_tree());

ALTER TABLE public.clients
  ADD CONSTRAINT clients_originating_lead_fk
  FOREIGN KEY (originating_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

-- =====================================================
-- Reusable helper: check access via a lead OR client parent
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_access_parent(p_type public.parent_kind, p_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_type = 'lead' THEN public.can_access_owner((SELECT owner_id FROM public.leads WHERE id = p_id))
    WHEN p_type = 'client' THEN public.can_access_owner((SELECT owner_id FROM public.clients WHERE id = p_id))
    ELSE FALSE
  END;
$$;

-- =====================================================
-- CONTACTS
-- =====================================================
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind NOT NULL,
  parent_id UUID NOT NULL,
  name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_parent ON public.contacts(parent_type, parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "contacts_all_hierarchy" ON public.contacts FOR ALL TO authenticated
  USING (public.can_access_parent(parent_type, parent_id))
  WITH CHECK (public.can_access_parent(parent_type, parent_id));

-- =====================================================
-- MEETINGS
-- =====================================================
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind NOT NULL,
  parent_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  meeting_date TIMESTAMPTZ NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT 'In-Person',
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  agenda TEXT,
  discussion_summary TEXT,
  action_items TEXT,
  next_followup_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_parent ON public.meetings(parent_type, parent_id);
CREATE INDEX idx_meetings_owner ON public.meetings(owner_id);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "meetings_all_hierarchy" ON public.meetings FOR ALL TO authenticated
  USING (public.can_access_owner(owner_id))
  WITH CHECK (public.can_access_owner(owner_id));

-- =====================================================
-- FOLLOWUPS
-- =====================================================
CREATE TABLE public.followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind NOT NULL,
  parent_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  due_date DATE NOT NULL,
  status public.followup_status NOT NULL DEFAULT 'pending',
  priority public.priority_level NOT NULL DEFAULT 'medium',
  description TEXT,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_owner ON public.followups(owner_id);
CREATE INDEX idx_followups_due ON public.followups(due_date);
CREATE INDEX idx_followups_parent ON public.followups(parent_type, parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followups TO authenticated;
GRANT ALL ON public.followups TO service_role;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_followups_updated_at BEFORE UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "followups_all_hierarchy" ON public.followups FOR ALL TO authenticated
  USING (public.can_access_owner(owner_id))
  WITH CHECK (public.can_access_owner(owner_id));

-- =====================================================
-- TASKS
-- =====================================================
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind,
  parent_id UUID,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "tasks_all_hierarchy" ON public.tasks FOR ALL TO authenticated
  USING (public.can_access_owner(owner_id) OR public.can_access_owner(assigned_to))
  WITH CHECK (public.can_access_owner(owner_id) OR public.can_access_owner(assigned_to));

-- =====================================================
-- NOTES (append-only)
-- =====================================================
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind NOT NULL,
  parent_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_parent ON public.notes(parent_type, parent_id);
GRANT SELECT, INSERT ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_select_hierarchy" ON public.notes FOR SELECT TO authenticated
  USING (public.can_access_parent(parent_type, parent_id));
CREATE POLICY "notes_insert_hierarchy" ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_parent(parent_type, parent_id) AND owner_id = public.current_app_user_id());

-- =====================================================
-- DOCUMENTS  (metadata; files live in Storage bucket)
-- =====================================================
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_type public.parent_kind NOT NULL,
  parent_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_parent ON public.documents(parent_type, parent_id);
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_hierarchy" ON public.documents FOR SELECT TO authenticated
  USING (public.can_access_parent(parent_type, parent_id));
CREATE POLICY "documents_insert_hierarchy" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.can_access_parent(parent_type, parent_id) AND owner_id = public.current_app_user_id());
CREATE POLICY "documents_delete_own_or_ceo" ON public.documents FOR DELETE TO authenticated
  USING (owner_id = public.current_app_user_id() OR public.is_top_of_tree());

-- =====================================================
-- ACTIVITY LOG (append-only)
-- =====================================================
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  parent_type public.parent_kind,
  parent_id UUID,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_parent ON public.activity_log(parent_type, parent_id);
CREATE INDEX idx_activity_actor ON public.activity_log(actor_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select_hierarchy" ON public.activity_log FOR SELECT TO authenticated
  USING (
    parent_id IS NULL
    OR public.can_access_parent(parent_type, parent_id)
    OR (actor_id IS NOT NULL AND public.can_access_owner(actor_id))
  );
CREATE POLICY "activity_insert_self" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = public.current_app_user_id() OR actor_id IS NULL);

-- =====================================================
-- Auto activity_log via triggers
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID; act TEXT; meta JSONB := '{}'::jsonb;
BEGIN
  actor := public.current_app_user_id();
  IF TG_OP = 'INSERT' THEN
    act := 'Lead Created';
    meta := jsonb_build_object('company_name', NEW.company_name, 'stage', NEW.pipeline_stage);
    INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
      VALUES (actor, 'lead', NEW.id, act, meta);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
      INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
        VALUES (actor, 'lead', NEW.id,
          'Stage Changed',
          jsonb_build_object('from', OLD.pipeline_stage, 'to', NEW.pipeline_stage));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
        VALUES (actor, 'lead', NEW.id, 'Status Changed',
          jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
        VALUES (actor, 'lead', NEW.id, 'Reassigned',
          jsonb_build_object('from_user', OLD.owner_id, 'to_user', NEW.owner_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_leads_activity AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_activity();

CREATE OR REPLACE FUNCTION public.log_client_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID;
BEGIN
  actor := public.current_app_user_id();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
      VALUES (actor, 'client', NEW.id, 'Client Created',
        jsonb_build_object('company_name', NEW.company_name));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
        VALUES (actor, 'client', NEW.id, 'Reassigned',
          jsonb_build_object('from_user', OLD.owner_id, 'to_user', NEW.owner_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_clients_activity AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_activity();

CREATE OR REPLACE FUNCTION public.log_meeting_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID;
BEGIN
  actor := public.current_app_user_id();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
      VALUES (actor, NEW.parent_type, NEW.parent_id, 'Meeting Scheduled',
        jsonb_build_object('meeting_date', NEW.meeting_date, 'type', NEW.meeting_type));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
      VALUES (actor, NEW.parent_type, NEW.parent_id, 'Meeting Completed',
        jsonb_build_object('meeting_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_meetings_activity AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.log_meeting_activity();

CREATE OR REPLACE FUNCTION public.log_followup_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID;
BEGIN
  actor := public.current_app_user_id();
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    INSERT INTO public.activity_log(actor_id, parent_type, parent_id, action, metadata)
      VALUES (actor, NEW.parent_type, NEW.parent_id, 'Follow-up Completed',
        jsonb_build_object('followup_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_followups_activity AFTER UPDATE ON public.followups
  FOR EACH ROW EXECUTE FUNCTION public.log_followup_activity();

-- =====================================================
-- Seed pipeline stages
-- =====================================================
INSERT INTO public.pipeline_stages(name, display_order, is_terminal) VALUES
  ('Prospect', 1, FALSE),
  ('Contacted', 2, FALSE),
  ('Meeting Scheduled', 3, FALSE),
  ('Meeting Completed', 4, FALSE),
  ('Proposal Sent', 5, FALSE),
  ('Negotiation', 6, FALSE),
  ('Mandate Signed', 7, FALSE),
  ('Onboarding', 8, FALSE),
  ('Won', 9, TRUE),
  ('Lost', 10, TRUE);
