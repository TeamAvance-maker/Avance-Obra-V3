REVOKE EXECUTE ON FUNCTION public.handle_new_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_superadmin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;