-- Garantiza que el superadmin siempre quede aprobado
create or replace function public.protect_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'superadmin.controlobra@gmail.com' then
    new.status := 'approved';
    insert into public.user_roles(user_id, role)
      values (new.id, 'superadmin')
      on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_superadmin_upd on public.profiles;
create trigger trg_protect_superadmin_upd
before update on public.profiles
for each row execute function public.protect_superadmin();

drop trigger if exists trg_protect_superadmin_ins on public.profiles;
create trigger trg_protect_superadmin_ins
before insert on public.profiles
for each row execute function public.protect_superadmin();

-- Asegura el estado actual correcto si ya existe la fila
update public.profiles
  set status = 'approved'
  where email = 'superadmin.controlobra@gmail.com'
    and status <> 'approved';