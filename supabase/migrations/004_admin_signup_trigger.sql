-- ============================================
-- CALCUTTA APP — ADMIN SIGNUP TRIGGER
-- Migration 004
--
-- Automatically creates an admin_profiles row whenever a new
-- user signs up through Supabase Auth. Without this, the admin
-- portal has no profile row to reference for tournament access.
-- ============================================

create or replace function public.handle_new_admin_user()
returns trigger as $$
begin
  insert into public.admin_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop if exists, then recreate cleanly
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_admin_user();
