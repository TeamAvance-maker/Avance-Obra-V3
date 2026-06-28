
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.handle_new_profile() from public, anon, authenticated;
