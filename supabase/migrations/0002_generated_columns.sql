-- Make derived metrics impossible for the client to lie about.
-- Drops the plain columns and re-adds them as GENERATED ALWAYS AS ... STORED.
--
-- Safe on empty / small tables. If you have production data you care
-- about, take a backup first — dropping a column drops its data.

-- system_loss: kwh delta + percent
alter table public.system_loss drop column if exists system_loss_kwh;
alter table public.system_loss drop column if exists system_loss_percent;

alter table public.system_loss
  add column system_loss_kwh numeric
    generated always as (kwh_purchased - kwh_sold) stored,
  add column system_loss_percent numeric
    generated always as (
      case when kwh_purchased > 0
           then round(((kwh_purchased - kwh_sold)::numeric / kwh_purchased) * 100, 2)
           else 0
      end
    ) stored;

-- collections: collection efficiency %
alter table public.collections drop column if exists collection_efficiency_percent;

alter table public.collections
  add column collection_efficiency_percent numeric
    generated always as (
      case when amount_billed > 0
           then round((amount_collected::numeric / amount_billed) * 100, 2)
           else 0
      end
    ) stored;

-- Guardrail: period must be the first of a month.
alter table public.system_loss  drop constraint if exists system_loss_period_first_of_month;
alter table public.collections  drop constraint if exists collections_period_first_of_month;
alter table public.membership   drop constraint if exists membership_period_first_of_month;

alter table public.system_loss
  add constraint system_loss_period_first_of_month
  check (period = date_trunc('month', period));
alter table public.collections
  add constraint collections_period_first_of_month
  check (period = date_trunc('month', period));
alter table public.membership
  add constraint membership_period_first_of_month
  check (period = date_trunc('month', period));

-- Indexes on FKs and the hot filter columns.
create index if not exists system_loss_branch_period_idx on public.system_loss  (branch_id, period);
create index if not exists collections_branch_period_idx on public.collections  (branch_id, period);
create index if not exists membership_branch_period_idx  on public.membership   (branch_id, period);
create index if not exists outages_date_idx              on public.outages      (date);
create index if not exists outages_branch_idx            on public.outages      (branch_id);
create index if not exists wesm_prices_period_idx        on public.wesm_prices  (period desc);
