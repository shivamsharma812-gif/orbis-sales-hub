
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS co_owner_id uuid REFERENCES public.users(id);
CREATE INDEX IF NOT EXISTS leads_co_owner_id_idx ON public.leads(co_owner_id);

-- Rebuild SELECT policy to include co_owner + their descendants
DROP POLICY IF EXISTS leads_select_hierarchy ON public.leads;
CREATE POLICY leads_select_hierarchy ON public.leads
FOR SELECT TO authenticated
USING (
  public.can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND public.can_access_owner(co_owner_id))
  OR (shared_with_team = true AND public.is_descendant_of(owner_id, public.current_app_user_id()))
);

-- Allow co_owner (and their managers) to update too
DROP POLICY IF EXISTS leads_update_hierarchy ON public.leads;
CREATE POLICY leads_update_hierarchy ON public.leads
FOR UPDATE TO authenticated
USING (
  public.can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND public.can_access_owner(co_owner_id))
)
WITH CHECK (
  public.can_access_owner(owner_id)
  OR (co_owner_id IS NOT NULL AND public.can_access_owner(co_owner_id))
);
