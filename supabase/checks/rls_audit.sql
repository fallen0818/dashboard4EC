-- Run this in the Supabase SQL editor (or `psql`) to verify RLS coverage.
-- Any row where rls_enabled = false OR policy_count = 0 is a hole.

select
  c.relname                                        as table_name,
  c.relrowsecurity                                 as rls_enabled,
  c.relforcerowsecurity                            as rls_forced,
  coalesce(p.policy_count, 0)                      as policy_count,
  coalesce(p.cmds, '{}')                           as commands_covered
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select
    schemaname, tablename,
    count(*)                          as policy_count,
    array_agg(distinct cmd order by cmd) as cmds
  from pg_policies
  where schemaname = 'public'
  group by schemaname, tablename
) p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in
    ('branches','system_loss','collections','membership','outages','wesm_prices')
order by c.relname;

-- List every policy definition so you can eyeball the USING/WITH CHECK clauses.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
