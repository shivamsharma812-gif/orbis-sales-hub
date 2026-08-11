-- Helper: resolve the "end owner" (top-most manager below the CEO) for a user
CREATE OR REPLACE FUNCTION public.hierarchy_end_owner(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cur uuid := _user_id;
  mgr uuid;
  guard int := 0;
BEGIN
  IF cur IS NULL THEN RETURN NULL; END IF;
  LOOP
    guard := guard + 1;
    EXIT WHEN guard > 20;
    SELECT reports_to_user_id INTO mgr FROM public.users WHERE id = cur;
    IF mgr IS NULL THEN
      -- cur is the top of the tree (CEO)
      RETURN cur;
    END IF;
    -- if the manager is the top of the tree, cur is a vertical head (President)
    IF (SELECT reports_to_user_id FROM public.users WHERE id = mgr) IS NULL THEN
      RETURN cur;
    END IF;
    cur := mgr;
  END LOOP;
  RETURN cur;
END;
$$;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS end_owner_id uuid REFERENCES public.users(id);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS end_owner_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS co_owner_id uuid REFERENCES public.users(id);

-- Access: end owners / end co-owners (and their managers) can reach the record
DROP POLICY IF EXISTS leads_select_hierarchy ON public.leads;
CREATE POLICY leads_select_hierarchy ON public.leads
FOR SELECT TO authenticated
USING (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
  OR (shared_with_team = true AND is_descendant_of(owner_id, current_app_user_id()))
);

DROP POLICY IF EXISTS leads_update_hierarchy ON public.leads;
CREATE POLICY leads_update_hierarchy ON public.leads
FOR UPDATE TO authenticated
USING (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
)
WITH CHECK (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
);

DROP POLICY IF EXISTS clients_select_hierarchy ON public.clients;
CREATE POLICY clients_select_hierarchy ON public.clients
FOR SELECT TO authenticated
USING (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
);

DROP POLICY IF EXISTS clients_update_hierarchy ON public.clients;
CREATE POLICY clients_update_hierarchy ON public.clients
FOR UPDATE TO authenticated
USING (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
)
WITH CHECK (
  can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND can_access_owner(co_owner_id))
  OR (end_owner_id IS NOT NULL AND can_access_owner(end_owner_id))
);