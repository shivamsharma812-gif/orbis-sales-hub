-- true when the target user is in the current user's visible directory scope
CREATE OR REPLACE FUNCTION public.can_view_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN target_user_id IS NULL THEN FALSE
    WHEN public.is_top_of_tree() THEN TRUE
    WHEN public.current_app_user_id() = target_user_id THEN TRUE
    -- my downline
    WHEN public.is_descendant_of(public.current_app_user_id(), target_user_id) THEN TRUE
    -- my upline (managers above me)
    WHEN public.is_descendant_of(target_user_id, public.current_app_user_id()) THEN TRUE
    -- leadership: CEO and vertical heads (presidents) stay visible to everyone
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      LEFT JOIN public.users m ON m.id = u.reports_to_user_id
      WHERE u.id = target_user_id
        AND (u.reports_to_user_id IS NULL OR m.reports_to_user_id IS NULL)
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_user(UUID) TO authenticated;

DROP POLICY IF EXISTS "users_select_all_authenticated" ON public.users;
CREATE POLICY "users_select_hierarchy_scope" ON public.users
  FOR SELECT TO authenticated
  USING (public.can_view_user(id));

-- tasks: assignment target must be inside the caller's downline (not either/or)
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_owner(owner_id)
    AND (assigned_to IS NULL OR public.can_access_owner(assigned_to))
  );
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.can_access_owner(owner_id) OR public.can_access_owner(assigned_to))
  WITH CHECK (
    public.can_access_owner(owner_id)
    AND (assigned_to IS NULL OR public.can_access_owner(assigned_to))
  );