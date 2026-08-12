-- 1. Storage: scope crm-documents access to the parent record hierarchy
DROP POLICY IF EXISTS crm_docs_select ON storage.objects;
DROP POLICY IF EXISTS crm_docs_insert ON storage.objects;
DROP POLICY IF EXISTS crm_docs_delete ON storage.objects;

CREATE POLICY crm_docs_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND (storage.foldername(name))[1] IN ('lead','client')
  AND public.can_access_parent(
    ((storage.foldername(name))[1])::public.parent_kind,
    ((storage.foldername(name))[2])::uuid
  )
);

CREATE POLICY crm_docs_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-documents'
  AND (storage.foldername(name))[1] IN ('lead','client')
  AND public.can_access_parent(
    ((storage.foldername(name))[1])::public.parent_kind,
    ((storage.foldername(name))[2])::uuid
  )
);

CREATE POLICY crm_docs_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'crm-documents'
  AND (storage.foldername(name))[1] IN ('lead','client')
  AND public.can_access_parent(
    ((storage.foldername(name))[1])::public.parent_kind,
    ((storage.foldername(name))[2])::uuid
  )
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = storage.objects.name
      AND (d.owner_id = public.current_app_user_id() OR public.is_top_of_tree())
  )
);

-- 2. can_view_user: drop blanket leadership visibility
CREATE OR REPLACE FUNCTION public.can_view_user(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN target_user_id IS NULL THEN FALSE
    WHEN public.is_top_of_tree() THEN TRUE
    WHEN public.current_app_user_id() = target_user_id THEN TRUE
    WHEN public.is_descendant_of(public.current_app_user_id(), target_user_id) THEN TRUE
    WHEN public.is_descendant_of(target_user_id, public.current_app_user_id()) THEN TRUE
    ELSE FALSE
  END;
$function$;

-- 3. Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.grant_admin_on_ceo_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_client_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_lead_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_meeting_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_followup_activity() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.can_access_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_parent(public.parent_kind, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_descendant_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_top_of_tree() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hierarchy_end_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_user_login() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_parent(public.parent_kind, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_descendant_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_top_of_tree() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hierarchy_end_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_parent(public.parent_kind, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_descendant_of(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_top_of_tree() TO service_role;
GRANT EXECUTE ON FUNCTION public.hierarchy_end_owner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_user_login() TO service_role;