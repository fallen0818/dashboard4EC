-- ============================================================================
-- apply_pending.sql — convenience bundle of the pending migrations 0010 + 0011.
--
-- Paste this whole file into the Supabase SQL Editor and Run it ONCE. It is
-- wrapped in a single transaction, so if anything fails the whole thing rolls
-- back and your schema is left untouched.
--
-- This is a copy of:
--   supabase/migrations/0010_billing_integrity.sql
--   supabase/migrations/0011_power_suppliers.sql
-- The migration files remain the source of truth; keep new changes there.
--
-- WARNING: the 0011 section rebuilds `power_supply` per supplier and DELETEs the
-- existing power_supply rows (mock aggregates) before reseeding. Only run this
-- while that table still holds seed data you don't need.
-- ============================================================================

BEGIN;

-- ############################################################################
-- 0010 — billing integrity
-- ############################################################################

-- A. bill_items.item_type — enum-style CHECK
ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE bill_items
  DROP CONSTRAINT IF EXISTS bill_items_item_type_check;

ALTER TABLE bill_items
  ADD CONSTRAINT bill_items_item_type_check CHECK (item_type IN (
    'generation_charge',
    'transmission_charge',
    'system_loss_charge',
    'distribution_charge',
    'supply_charge',
    'metering_charge',
    'subsidies',
    'government_taxes',
    'universal_charge',
    'fit_allowance',
    'other'
  ));

-- B. record_payment — atomic payment + bill reconciliation
CREATE OR REPLACE FUNCTION public.record_payment(
  p_bill_id        uuid,
  p_amount         numeric,
  p_payment_method text DEFAULT NULL
)
RETURNS payments
LANGUAGE plpgsql
AS $$
DECLARE
  v_bill    bills;
  v_payment payments;
  v_paid    numeric;
  v_status  text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive (got %)', p_amount;
  END IF;

  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill % not found or not visible', p_bill_id;
  END IF;

  INSERT INTO payments (bill_id, amount, payment_method)
  VALUES (p_bill_id, p_amount, p_payment_method)
  RETURNING * INTO v_payment;

  v_paid := v_bill.amount_paid + p_amount;
  v_status := CASE
    WHEN v_paid >= v_bill.total_amount THEN 'paid'
    WHEN v_paid > 0                    THEN 'partial'
    ELSE 'unpaid'
  END;

  UPDATE bills SET amount_paid = v_paid, status = v_status WHERE id = p_bill_id;

  RETURN v_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment(uuid, numeric, text) TO authenticated;

-- C. mark_overdue_bills — derive 'overdue' from due_date + balance
CREATE OR REPLACE FUNCTION public.mark_overdue_bills()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE bills
  SET status = 'overdue'
  WHERE status IN ('unpaid', 'partial')
    AND due_date < current_date
    AND amount_paid < total_amount;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ############################################################################
-- 0011 — power suppliers + per-supplier power_supply
-- ############################################################################

-- A. power_suppliers reference table
CREATE TABLE IF NOT EXISTS power_suppliers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code          TEXT NOT NULL,
    name          TEXT NOT NULL,
    supplier_type TEXT NOT NULL CHECK (supplier_type IN ('bilateral', 'wesm', 'net_metering')),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_power_suppliers_branch ON power_suppliers (branch_id);

ALTER TABLE power_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS power_suppliers_branch_read   ON power_suppliers;
DROP POLICY IF EXISTS power_suppliers_branch_insert ON power_suppliers;
DROP POLICY IF EXISTS power_suppliers_branch_update ON power_suppliers;
DROP POLICY IF EXISTS power_suppliers_branch_delete ON power_suppliers;

CREATE POLICY power_suppliers_branch_read ON power_suppliers
  FOR SELECT TO authenticated
  USING (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY power_suppliers_branch_insert ON power_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY power_suppliers_branch_update ON power_suppliers
  FOR UPDATE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid)
  WITH CHECK (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

CREATE POLICY power_suppliers_branch_delete ON power_suppliers
  FOR DELETE TO authenticated
  USING      (branch_id = (auth.jwt() -> 'app_metadata' ->> 'branch_id')::uuid);

-- B. Seed suppliers for PANELCO I
INSERT INTO power_suppliers (branch_id, code, name, supplier_type)
SELECT b.id, v.code, v.name, v.supplier_type
FROM branches b
JOIN (VALUES
    ('TLI',      'Therma Luzon Inc. (PSA)',   'bilateral'),
    ('SPI',      'SPI Power Corp. (PSA)',     'bilateral'),
    ('CAP1',     'CAP1 Plant (PSA)',          'bilateral'),
    ('WESM',     'Wholesale Electricity Spot Market', 'wesm'),
    ('NETMETER', 'Net Metering (member exports)',     'net_metering')
) AS v(code, name, supplier_type) ON true
WHERE b.name = 'PANELCO I'
ON CONFLICT (branch_id, code) DO NOTHING;

-- C. Restructure power_supply
ALTER TABLE power_supply
  DROP CONSTRAINT IF EXISTS power_supply_branch_id_period_start_period_end_key;

ALTER TABLE power_supply
  DROP COLUMN IF EXISTS kwh_sold;

ALTER TABLE power_supply
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES power_suppliers(id) ON DELETE CASCADE;

DELETE FROM power_supply;

ALTER TABLE power_supply
  ALTER COLUMN supplier_id SET NOT NULL;

ALTER TABLE power_supply
  DROP CONSTRAINT IF EXISTS power_supply_branch_supplier_period_key;

ALTER TABLE power_supply
  ADD CONSTRAINT power_supply_branch_supplier_period_key
  UNIQUE (branch_id, supplier_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_power_supply_supplier_period
  ON power_supply (branch_id, supplier_id, period_start);

INSERT INTO power_supply (
    branch_id, supplier_id, wesm_price_id,
    period_start, period_end, kwh_purchased, purchased_power_cost
)
SELECT
    ps.branch_id,
    ps.id,
    CASE WHEN ps.supplier_type = 'wesm' THEN w.id ELSE NULL END,
    v.period_start, v.period_end, v.kwh_purchased, v.purchased_power_cost
FROM power_suppliers ps
JOIN branches b ON b.id = ps.branch_id AND b.name = 'PANELCO I'
JOIN (VALUES
    ('TLI',      '2026-05-01'::DATE, '2026-05-31'::DATE, 500000::NUMERIC, 2750000::NUMERIC),
    ('SPI',      '2026-05-01'::DATE, '2026-05-31'::DATE, 350000::NUMERIC, 2170000::NUMERIC),
    ('CAP1',     '2026-05-01'::DATE, '2026-05-31'::DATE, 250000::NUMERIC, 1450000::NUMERIC),
    ('WESM',     '2026-05-01'::DATE, '2026-05-31'::DATE, 145000::NUMERIC,  843900::NUMERIC),
    ('NETMETER', '2026-05-01'::DATE, '2026-05-31'::DATE,   5000::NUMERIC,   25000::NUMERIC),

    ('TLI',      '2026-06-01'::DATE, '2026-06-30'::DATE, 520000::NUMERIC, 2860000::NUMERIC),
    ('SPI',      '2026-06-01'::DATE, '2026-06-30'::DATE, 360000::NUMERIC, 2232000::NUMERIC),
    ('CAP1',     '2026-06-01'::DATE, '2026-06-30'::DATE, 260000::NUMERIC, 1508000::NUMERIC),
    ('WESM',     '2026-06-01'::DATE, '2026-06-30'::DATE, 165000::NUMERIC, 1014750::NUMERIC),
    ('NETMETER', '2026-06-01'::DATE, '2026-06-30'::DATE,   5000::NUMERIC,   25000::NUMERIC),

    ('TLI',      '2026-07-01'::DATE, '2026-07-31'::DATE, 510000::NUMERIC, 2805000::NUMERIC),
    ('SPI',      '2026-07-01'::DATE, '2026-07-31'::DATE, 355000::NUMERIC, 2201000::NUMERIC),
    ('CAP1',     '2026-07-01'::DATE, '2026-07-31'::DATE, 255000::NUMERIC, 1479000::NUMERIC),
    ('WESM',     '2026-07-01'::DATE, '2026-07-31'::DATE, 155000::NUMERIC,  925350::NUMERIC),
    ('NETMETER', '2026-07-01'::DATE, '2026-07-31'::DATE,   5000::NUMERIC,   25000::NUMERIC)
) AS v(code, period_start, period_end, kwh_purchased, purchased_power_cost) ON v.code = ps.code
LEFT JOIN wesm_prices w
  ON w.grid_region = 'Luzon' AND w.period_start = v.period_start;

COMMIT;
