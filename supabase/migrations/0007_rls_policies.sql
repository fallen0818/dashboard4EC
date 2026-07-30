-- ============================================================================
-- 0007_rls_policies.sql
-- Row-Level Security for all branch-scoped tables.
--
-- Model: each authenticated user's JWT carries app_metadata.branch_id.
--        Reads are restricted to rows belonging to that branch.
--
-- Prerequisite: users must be stamped with app_metadata.branch_id (via a
--   signup trigger or admin update). If that claim is missing, the branch
--   subqueries resolve to NULL and every read returns zero rows.
--
-- Scope: these policies grant SELECT only. Writes (INSERT/UPDATE/DELETE) remain
--   denied to the `authenticated` role by default once RLS is enabled — perform
--   mutations through a trusted server context (service_role) or add explicit
--   write policies later.
--
-- Helper expression used throughout:
--   (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS
-- ----------------------------------------------------------------------------
ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_supply          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wesm_prices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_loss           ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE members               ENABLE ROW LEVEL SECURITY;
ALTER TABLE meters                ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE disconnection_notices ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- branches: a user sees only their own branch row
-- ----------------------------------------------------------------------------
CREATE POLICY branches_own_read ON branches
  FOR SELECT TO authenticated
  USING (id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- ----------------------------------------------------------------------------
-- Directly branch-scoped tables (have a branch_id column)
-- ----------------------------------------------------------------------------
CREATE POLICY power_supply_branch_read ON power_supply
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY system_loss_branch_read ON system_loss
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY membership_branch_read ON membership
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY outages_branch_read ON outages
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY members_branch_read ON members
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- ----------------------------------------------------------------------------
-- wesm_prices: grid-level market reference data (no branch_id).
-- Scoped to the grid_region of the caller's branch, so a user only sees prices
-- for their own grid region. WESM prices are published market data, so if you
-- prefer, you may replace this with `USING (true)` to allow all authenticated
-- reads.
-- ----------------------------------------------------------------------------
CREATE POLICY wesm_prices_region_read ON wesm_prices
  FOR SELECT TO authenticated
  USING (grid_region IN (
    SELECT grid_region FROM branches
    WHERE id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

-- ----------------------------------------------------------------------------
-- Tables scoped through members (member_id -> members.branch_id)
-- ----------------------------------------------------------------------------
CREATE POLICY meters_branch_read ON meters
  FOR SELECT TO authenticated
  USING (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

CREATE POLICY bills_branch_read ON bills
  FOR SELECT TO authenticated
  USING (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

CREATE POLICY disconnection_notices_branch_read ON disconnection_notices
  FOR SELECT TO authenticated
  USING (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

-- ----------------------------------------------------------------------------
-- Tables scoped through meters (meter_id -> meters -> members.branch_id)
-- ----------------------------------------------------------------------------
CREATE POLICY meter_readings_branch_read ON meter_readings
  FOR SELECT TO authenticated
  USING (meter_id IN (
    SELECT mt.id FROM meters mt
    JOIN members m ON m.id = mt.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

-- ----------------------------------------------------------------------------
-- Tables scoped through bills (bill_id -> bills -> members.branch_id)
-- ----------------------------------------------------------------------------
CREATE POLICY bill_items_branch_read ON bill_items
  FOR SELECT TO authenticated
  USING (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));

CREATE POLICY payments_branch_read ON payments
  FOR SELECT TO authenticated
  USING (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
  ));
