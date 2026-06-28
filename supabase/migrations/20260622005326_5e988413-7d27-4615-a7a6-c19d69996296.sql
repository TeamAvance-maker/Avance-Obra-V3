-- Helper: is current user approved?
create or replace function public.is_approved(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = _user_id and status = 'approved'
  )
$$;

revoke execute on function public.is_approved(uuid) from public, anon;
grant execute on function public.is_approved(uuid) to authenticated;

-- Replace pub_select policies on operational tables
do $$
declare
  t text;
  tables text[] := array[
    'deliveries','delivery_houses','delivery_items',
    'house_exec_overrides','house_material_req','house_types',
    'inventory_counts','materials_v2','project_config',
    'receptions','site_deliveries','site_delivery_items',
    'sites','vale_reqs','vale_stages','vale_types_v2'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists pub_select on public.%I', t);
    execute format(
      'create policy approved_select on public.%I for select to authenticated using (public.is_approved(auth.uid()))',
      t
    );
  end loop;
end $$;

-- inventory_adjustments uses a different policy name
drop policy if exists "read inventory_adjustments" on public.inventory_adjustments;
create policy approved_select on public.inventory_adjustments
  for select to authenticated
  using (public.is_approved(auth.uid()));
