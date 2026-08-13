CREATE OR REPLACE FUNCTION public.list_end_ownership_targets()
RETURNS TABLE (id uuid, full_name text, designation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name, u.designation
  FROM public.users u
  WHERE u.status = 'active'
    AND u.designation = 'President'
    AND u.id <> public.current_app_user_id()
    AND EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = public.current_app_user_id()
        AND me.designation IN ('President', 'MD & CEO')
    )
  ORDER BY u.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_end_ownership_targets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_end_ownership_targets() TO authenticated;