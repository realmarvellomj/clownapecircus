-- CLOWN APE CIRCUS / SUPABASE SETUP
-- Run this whole file in Supabase SQL Editor.
-- Then enable Anonymous Sign-Ins in Authentication > Providers > Anonymous.
-- Create your Ringmaster email/password account, then promote its profile to admin
-- with the UPDATE statement at the bottom.

create extension if not exists pgcrypto;

create type public.app_role as enum ('applicant','admin');
create type public.application_status as enum ('pending','approved','rejected');
create type public.application_type as enum ('join','collab');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'applicant',
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references auth.users(id) on delete set null,
  type public.application_type not null,
  status public.application_status not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  proof_path text,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists applications_created_at_idx on public.applications(created_at desc);
create index if not exists applications_status_idx on public.applications(status);
create index if not exists applications_type_idx on public.applications(type);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id) values(new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;

drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "applicant_insert_application" on public.applications;
create policy "applicant_insert_application" on public.applications for insert to authenticated
with check (applicant_id = auth.uid());

drop policy if exists "applicant_read_own_application" on public.applications;
create policy "applicant_read_own_application" on public.applications for select to authenticated
using (applicant_id = auth.uid() or public.is_admin());

drop policy if exists "admin_update_application" on public.applications;
create policy "admin_update_application" on public.applications for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_delete_application" on public.applications;
create policy "admin_delete_application" on public.applications for delete to authenticated
using (public.is_admin());

-- Private storage bucket.
insert into storage.buckets (id, name, public)
values ('application-proof','application-proof',false)
on conflict (id) do update set public=false;

drop policy if exists "applicant_upload_own_proof" on storage.objects;
create policy "applicant_upload_own_proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'application-proof'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admin_read_proof" on storage.objects;
create policy "admin_read_proof"
on storage.objects for select to authenticated
using (bucket_id = 'application-proof' and public.is_admin());

drop policy if exists "applicant_delete_own_proof" on storage.objects;
create policy "applicant_delete_own_proof"
on storage.objects for delete to authenticated
using (bucket_id = 'application-proof' and (storage.foldername(name))[1] = auth.uid()::text);

-- AFTER creating your Ringmaster account, get its UUID from Authentication > Users,
-- then run:
-- update public.profiles set role='admin' where id='YOUR-RINGMASTER-USER-UUID';


-- Optional convenience helper after creating your Ringmaster account:
-- Replace the email, then run this in SQL Editor.
-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where p.id = u.id
--   and u.email = 'YOUR-RINGMASTER-EMAIL';

-- ============================================================
-- CLOWN APE CIRCUS / WHITELIST MANAGEMENT
-- Run this block in Supabase SQL Editor after the existing schema.
-- Public users can check ONE wallet via RPC. The whitelist itself
-- is never exposed to the public. Ringmasters manage entries via
-- admin-only RPCs.
-- ============================================================

create table if not exists public.whitelist_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  wallet_address_normalized text not null unique,
  status text not null default 'whitelisted' check (status in ('whitelisted','revoked')),
  source text not null default 'ringmaster',
  note text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whitelist_entries_status_idx on public.whitelist_entries(status);
create index if not exists whitelist_entries_created_at_idx on public.whitelist_entries(created_at desc);

alter table public.whitelist_entries enable row level security;

drop policy if exists "admin_read_whitelist" on public.whitelist_entries;
create policy "admin_read_whitelist" on public.whitelist_entries
for select to authenticated
using (public.is_admin());

create or replace function public.check_whitelist(p_wallet_address text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wallet text := lower(trim(coalesce(p_wallet_address,'')));
begin
  if v_wallet !~ '^0x[0-9a-f]{40}$' then
    return false;
  end if;
  return exists (
    select 1 from public.whitelist_entries
    where wallet_address_normalized = v_wallet
      and status = 'whitelisted'
  );
end;
$$;

revoke all on function public.check_whitelist(text) from public;
grant execute on function public.check_whitelist(text) to anon, authenticated;

create or replace function public.admin_add_whitelist_wallet(
  p_wallet_address text,
  p_note text default null,
  p_source text default 'ringmaster'
)
returns public.whitelist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet text := lower(trim(coalesce(p_wallet_address,'')));
  v_row public.whitelist_entries;
begin
  if not public.is_admin() then
    raise exception 'Ringmaster admin access required';
  end if;
  if v_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid EVM wallet address';
  end if;

  insert into public.whitelist_entries(
    wallet_address, wallet_address_normalized, status, source, note, added_by, updated_at
  ) values (
    v_wallet, v_wallet, 'whitelisted', coalesce(nullif(trim(p_source),''),'ringmaster'), nullif(trim(p_note),''), auth.uid(), now()
  )
  on conflict (wallet_address_normalized) do update
    set wallet_address = excluded.wallet_address,
        status = 'whitelisted',
        source = excluded.source,
        note = excluded.note,
        added_by = auth.uid(),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_add_whitelist_wallet(text,text,text) from public, anon, authenticated;
grant execute on function public.admin_add_whitelist_wallet(text,text,text) to authenticated;

create or replace function public.admin_revoke_whitelist_wallet(p_entry_id uuid)
returns public.whitelist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.whitelist_entries;
begin
  if not public.is_admin() then
    raise exception 'Ringmaster admin access required';
  end if;

  update public.whitelist_entries
  set status = 'revoked', updated_at = now(), added_by = auth.uid()
  where id = p_entry_id
  returning * into v_row;

  if not found then
    raise exception 'Whitelist entry not found';
  end if;
  return v_row;
end;
$$;

revoke all on function public.admin_revoke_whitelist_wallet(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_whitelist_wallet(uuid) to authenticated;

-- Existing admin read access is intentionally separate from public checking.
-- Do not create an anon SELECT policy on whitelist_entries.
