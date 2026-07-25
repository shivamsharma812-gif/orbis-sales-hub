DROP POLICY IF EXISTS leads_delete_ceo ON public.leads;
DROP POLICY IF EXISTS clients_delete_ceo ON public.clients;

CREATE POLICY leads_delete_hierarchy ON public.leads
  FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));

CREATE POLICY clients_delete_hierarchy ON public.clients
  FOR DELETE TO authenticated
  USING (public.can_access_owner(owner_id));