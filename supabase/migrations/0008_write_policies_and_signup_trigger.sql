-- ============================================================================
-- 0008_write_policies_and_signup_trigger.sql
--
-- Part A: signup trigger that copies branch_id from user_metadata (supplied at
--         signup) into app_metadata, so the RLS policies in 0007 have a claim
--         to read. app_metadata is not user-writable, which is why a
--         SECURITY DEFINER trigger sets it server-side.
--
-- Part B: write policies (INSERT / UPDATE / DELETE) for branch-scoped tables,
--         mirroring the SELECT scoping from 0007. `branches` and `wesm_prices`
--         stay read-only (admin/reference data) and get no write policies here.
--
-- Helper expression:
--   (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid
-- ============================================================================


-- ============================================================================
-- Part A — stamp branch_id onto new users
--
-- Client signs up with:
--   supabase.auth.signUp({ email, password,
--     options: { data: { branch_id: '<uuid>' } } })
-- which lands in raw_user_meta_data. The trigger promotes it into
-- raw_app_meta_data (== app_metadata) before the row is inserted.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.stamp_branch_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.raw_user_meta_data ? 'branch_id' THEN
    new.raw_app_meta_data =
      coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('branch_id', new.raw_user_meta_data ->> 'branch_id');
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS stamp_branch_before_insert ON auth.users;
CREATE TRIGGER stamp_branch_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.stamp_branch_on_signup();

-- NOTE: this stamps NEW users only. Backfill existing users, e.g.:
--   UPDATE auth.users
--   SET raw_app_meta_data =
--         coalesce(raw_app_meta_data, '{}'::jsonb)
--         || jsonb_build_object('branch_id', '<branch-uuid>')
--   WHERE id = '<user-uuid>';


-- ============================================================================
-- Part B — write policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Directly branch-scoped tables (branch_id column)
-- ----------------------------------------------------------------------------

-- power_supply
CREATE POLICY power_supply_branch_insert ON power_supply
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY power_supply_branch_update ON power_supply
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY power_supply_branch_delete ON power_supply
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- system_loss
CREATE POLICY system_loss_branch_insert ON system_loss
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY system_loss_branch_update ON system_loss
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY system_loss_branch_delete ON system_loss
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- membership
CREATE POLICY membership_branch_insert ON membership
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY membership_branch_update ON membership
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY membership_branch_delete ON membership
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- outages
CREATE POLICY outages_branch_insert ON outages
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY outages_branch_update ON outages
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY outages_branch_delete ON outages
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- members
CREATE POLICY members_branch_insert ON members
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY members_branch_update ON members
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);
CREATE POLICY members_branch_delete ON members
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- ----------------------------------------------------------------------------
-- Tables scoped through members (member_id -> members.branch_id)
-- ----------------------------------------------------------------------------

-- meters
CREATE POLICY meters_branch_insert ON meters
  FOR INSERT TO authenticated
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY meters_branch_update ON meters
  FOR UPDATE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY meters_branch_delete ON meters
  FOR DELETE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));

-- bills
CREATE POLICY bills_branch_insert ON bills
  FOR INSERT TO authenticated
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY bills_branch_update ON bills
  FOR UPDATE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY bills_branch_delete ON bills
  FOR DELETE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));

-- disconnection_notices
CREATE POLICY disconnection_notices_branch_insert ON disconnection_notices
  FOR INSERT TO authenticated
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY disconnection_notices_branch_update ON disconnection_notices
  FOR UPDATE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY disconnection_notices_branch_delete ON disconnection_notices
  FOR DELETE TO authenticated
  USING      (member_id IN (
    SELECT id FROM members
    WHERE branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));

-- ----------------------------------------------------------------------------
-- Tables scoped through meters (meter_id -> meters -> members.branch_id)
-- ----------------------------------------------------------------------------

-- meter_readings
CREATE POLICY meter_readings_branch_insert ON meter_readings
  FOR INSERT TO authenticated
  WITH CHECK (meter_id IN (
    SELECT mt.id FROM meters mt
    JOIN members m ON m.id = mt.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY meter_readings_branch_update ON meter_readings
  FOR UPDATE TO authenticated
  USING      (meter_id IN (
    SELECT mt.id FROM meters mt
    JOIN members m ON m.id = mt.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (meter_id IN (
    SELECT mt.id FROM meters mt
    JOIN members m ON m.id = mt.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY meter_readings_branch_delete ON meter_readings
  FOR DELETE TO authenticated
  USING      (meter_id IN (
    SELECT mt.id FROM meters mt
    JOIN members m ON m.id = mt.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));

-- ----------------------------------------------------------------------------
-- Tables scoped through bills (bill_id -> bills -> members.branch_id)
-- ----------------------------------------------------------------------------

-- bill_items
CREATE POLICY bill_items_branch_insert ON bill_items
  FOR INSERT TO authenticated
  WITH CHECK (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY bill_items_branch_update ON bill_items
  FOR UPDATE TO authenticated
  USING      (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY bill_items_branch_delete ON bill_items
  FOR DELETE TO authenticated
  USING      (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));

-- payments
CREATE POLICY payments_branch_insert ON payments
  FOR INSERT TO authenticated
  WITH CHECK (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY payments_branch_update ON payments
  FOR UPDATE TO authenticated
  USING      (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid))
  WITH CHECK (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
CREATE POLICY payments_branch_delete ON payments
  FOR DELETE TO authenticated
  USING      (bill_id IN (
    SELECT b.id FROM bills b
    JOIN members m ON m.id = b.member_id
    WHERE m.branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid));
