-- Applied to project gcikvintognebzirvhyk on 2026-09-10.
-- Anchors on the calendar month of the newest system_loss row and
-- aggregates every reporting table over that month window in one call.

create or replace function public.dashboard_summary()
returns table (
  period                        date,
  total_kwh_purchased           numeric,
  total_kwh_sold                numeric,
  system_loss_percent           numeric,
  total_billed                  numeric,
  total_collected               numeric,
  collection_efficiency_percent numeric,
  total_consumers               bigint,
  outage_count                  bigint,
  total_outage_minutes          bigint,
  latest_wesm_price             numeric,
  wesm_grid                     text,
  branch_count                  bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with p as (
    select date_trunc('month', max(period_start))::date as month
    from public.system_loss
  ),
  bounds as (select month, (month + interval '1 month')::date as next from p),
  sl as (
    select coalesce(sum(kwh_input), 0)  as purchased,
           coalesce(sum(kwh_billed), 0) as sold
    from public.system_loss, bounds
    where period_start >= bounds.month and period_start < bounds.next
  ),
  bl as (
    select coalesce(sum(total_amount), 0) as billed,
           coalesce(sum(amount_paid), 0)  as collected
    from public.bills, bounds
    where billing_period_start >= bounds.month and billing_period_start < bounds.next
  ),
  mem as (
    select coalesce(sum(total_consumers), 0)::bigint as consumers
    from public.membership, bounds
    where period_start >= bounds.month and period_start < bounds.next
  ),
  ot as (
    select count(*)::bigint as cnt,
           coalesce(sum(greatest(0, extract(epoch from (end_time - start_time)) / 60)), 0)::bigint as minutes
    from public.outages, bounds
    where start_time >= bounds.month::timestamptz
      and start_time <  bounds.next::timestamptz
      and end_time is not null
  ),
  wesm as (
    select price_per_kwh, grid_region
    from public.wesm_prices order by period_start desc limit 1
  ),
  br as (select count(*)::bigint as cnt from public.branches)
  select
    (select month from p),
    sl.purchased, sl.sold,
    case when sl.purchased > 0 then round(((sl.purchased - sl.sold) / sl.purchased) * 100, 2) else 0 end,
    bl.billed, bl.collected,
    case when bl.billed > 0 then round((bl.collected / bl.billed) * 100, 2) else 0 end,
    mem.consumers, ot.cnt, ot.minutes,
    (select price_per_kwh from wesm),
    (select grid_region   from wesm),
    br.cnt
  from sl, bl, mem, ot, br
  where (select month from p) is not null;
$$;

grant execute on function public.dashboard_summary() to authenticated;
