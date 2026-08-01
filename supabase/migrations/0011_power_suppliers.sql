-- ============================================================================
-- 0011_power_suppliers.sql
--
-- Model power supply per SUPPLIER instead of one lump row per period. An EC
-- buys from several sources: bilateral PSAs / IPPs (e.g. TLI, SPI, CAP1), the
-- WESM spot market, and Net Metering exports from member-consumers. Each
-- (branch, supplier, period) now gets its own power_supply row.
--
--   A. New branch-scoped `power_suppliers` reference table (+ RLS).
--   B. Seed PANELCO I's suppliers.
--   C. Restructure `power_supply`: add supplier_id, drop kwh_sold, re-key the
--      unique constraint, reseed per-supplier mock data.
--
-- kwh_sold is removed here: sales to consumers is an EC-wide figure, not a
-- per-supplier one — it lives in system_loss.kwh_billed. Cost-per-kWh is now
-- computed against kWh purchased.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A. power_suppliers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS power_suppliers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code          TEXT NOT NULL,   -- short handle, e.g. 'TLI', 'WESM', 'NETMETER'
    name          TEXT NOT NULL,
    supplier_type TEXT NOT NULL CHECK (supplier_type IN ('bilateral', 'wesm', 'net_metering')),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_power_suppliers_branch ON power_suppliers (branch_id);

-- RLS: branch-scoped, mirroring 0007 / 0008.
ALTER TABLE power_suppliers ENABLE ROW LEVEL SECURITY;

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


-- ----------------------------------------------------------------------------
-- B. Seed suppliers for PANELCO I
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- C. Restructure power_supply
-- ----------------------------------------------------------------------------

-- Old key was one row per (branch, period). Drop it before re-keying.
ALTER TABLE power_supply
  DROP CONSTRAINT IF EXISTS power_supply_branch_id_period_start_period_end_key;

-- kWh sold is an EC-wide figure, not per supplier — remove it.
ALTER TABLE power_supply
  DROP COLUMN IF EXISTS kwh_sold;

-- Link each record to a supplier.
ALTER TABLE power_supply
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES power_suppliers(id) ON DELETE CASCADE;

-- Existing rows are mock aggregates with no supplier; clear and reseed per supplier.
DELETE FROM power_supply;

ALTER TABLE power_supply
  ALTER COLUMN supplier_id SET NOT NULL;

ALTER TABLE power_supply
  ADD CONSTRAINT power_supply_branch_supplier_period_key
  UNIQUE (branch_id, supplier_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_power_supply_supplier_period
  ON power_supply (branch_id, supplier_id, period_start);

-- Reseed: 5 suppliers x 3 months for PANELCO I. WESM rows link to wesm_prices;
-- others carry their contracted cost in purchased_power_cost.
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
    -- code,       period_start,   period_end,     kwh,        cost
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
