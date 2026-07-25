
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS shared_with_team boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS leads_select_hierarchy ON public.leads;

CREATE POLICY leads_select_hierarchy ON public.leads
FOR SELECT
USING (
  public.can_access_owner(owner_id)
  OR (
    shared_with_team = true
    AND public.is_descendant_of(owner_id, public.current_app_user_id())
  )
);
