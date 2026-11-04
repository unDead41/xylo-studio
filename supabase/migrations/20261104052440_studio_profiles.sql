-- Credentials and authentication state belong to Supabase Auth.
-- Profiles hold only the signed-in user's editable Studio preferences.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (char_length(display_name) <= 80),
  constraint profiles_preferences_object
    check (jsonb_typeof(preferences) = 'object'),
  constraint profiles_preferences_size
    check (octet_length(preferences::text) <= 4096)
);

alter table public.profiles enable row level security;

-- Remove broad default table grants before granting the exact operations.
-- created_at is database-owned; id is supplied only when creating a profile.
revoke all on table public.profiles from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, display_name, preferences)
  on table public.profiles to authenticated;
grant update (display_name, preferences)
  on table public.profiles to authenticated;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Create with SELECT then INSERT if missing. An UPSERT that includes id in its
-- UPDATE list is deliberately denied by the column grants above.
