
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_descendant_of(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_owner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_top_of_tree() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_parent(public.parent_kind, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_lead_activity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_client_activity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_meeting_activity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_followup_activity() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
