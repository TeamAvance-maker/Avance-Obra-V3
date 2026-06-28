
create type public.app_role as enum ('superadmin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email = 'superadmin.controlobra@gmail.com' then
    new.status := 'approved';
    insert into public.user_roles(user_id, role) values (new.id, 'superadmin')
      on conflict do nothing;
  end if;
  return new;
end; $$;

create trigger trg_handle_new_profile
before insert on public.profiles
for each row execute function public.handle_new_profile();

create trigger trg_profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

create policy "user reads own profile" on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "superadmin reads all profiles" on public.profiles for select to authenticated
  using (public.has_role(auth.uid(),'superadmin'));
create policy "user creates own profile" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "superadmin updates profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'superadmin'))
  with check (public.has_role(auth.uid(),'superadmin'));

create policy "user reads own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id);
create policy "superadmin reads all roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(),'superadmin'));
