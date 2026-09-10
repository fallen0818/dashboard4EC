-- Baseline RLS: enable on every reporting table and give
-- authenticated users read + write. Tighten later once you have
-- a branch_members table / roles.
--
-- ASSUMPTIONS:
--   - All authenticated users of this app are trusted staff.
--   - The anon key must NOT be able to read or write anything.
--   - Public sign-ups are disabled in Supabase Auth settings.

alter table public.branches      enable row level security;
alter table public.system_loss   enable row level security;
alter table public.collections   enable row level security;
alter table public.membership    enable row level security;
alter table public.outages       enable row level security;
alter table public.wesm_prices   enable row level security;

-- Drop-and-recreate so this migration is idempotent-ish.
do $$
declare
  t text;
begin
  foreach t in array array[
    'branches','system_loss','collections','membership','outages','wesm_prices'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_auth_read',  t);
    execute format('drop policy if exists %I on public.%I', t || '_auth_write', t);
  end loop;
end $$;

-- Read: any authenticated user.
create policy branches_auth_read     on public.branches     for select to authenticated using (true);
create policy system_loss_auth_read  on public.system_loss  for select to authenticated using (true);
create policy collections_auth_read  on public.collections  for select to authenticated using (true);
create policy membership_auth_read   on public.membership   for select to authenticated using (true);
create policy outages_auth_read      on public.outages      for select to authenticated using (true);
create policy wesm_prices_auth_read  on public.wesm_prices  for select to authenticated using (true);

-- Write: authenticated users only. Replace with a role/branch check
-- once you introduce a `branch_members` table.
create policy system_loss_auth_write on public.system_loss for all to authenticated
  using (true) with check (true);
create policy collections_auth_write on public.collections for all to authenticated
  using (true) with check (true);
create policy membership_auth_write  on public.membership  for all to authenticated
  using (true) with check (true);
create policy outages_auth_write     on public.outages     for all to authenticated
  using (true) with check (true);

-- Reference data: writes only via service_role migrations, not from the client.
-- (No auth policy = no client access, which is what we want.)
