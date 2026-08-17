-- =========================================================
-- USBOOTH PHASE H2 — ACCOUNT FOUNDATION
-- Run this in Supabase SQL Editor.
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile"
on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);


drop policy if exists "Users can create their own profile"
on public.profiles;

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);


drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);


-- =========================================================
-- AUTOMATIC PROFILE CREATION
-- =========================================================

create or replace function public.handle_new_usbooth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;

end;
$$;


drop trigger if exists on_auth_user_created_usbooth
on auth.users;

create trigger on_auth_user_created_usbooth
after insert on auth.users
for each row
execute procedure public.handle_new_usbooth_user();


-- =========================================================
-- H3 WILL ADD:
-- memories table
-- private Storage bucket
-- per-user photo policies
-- =========================================================

-- DO NOT MAKE THE FUTURE MEMORY BUCKET PUBLIC.
