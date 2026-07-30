-- ============================================
-- Drop existing tables (safe: mock/seed data only)
-- ============================================
DROP TABLE IF EXISTS power_supply CASCADE;
DROP TABLE IF EXISTS wesm_prices CASCADE;

-- ============================================
-- WESM Prices (grid-level, not tied to a branch)
-- ============================================
CREATE TABLE wesm_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_region     TEXT NOT NULL CHECK (grid_region IN ('Luzon', 'Visayas', 'Mindanao')),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    price_per_kwh   NUMERIC(10, 4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (grid_region, period_start, period_end)
);

-- ============================================
-- Power Supply (per branch, per period)
-- ============================================
CREATE TABLE power_supply (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id             UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    wesm_price_id         UUID REFERENCES wesm_prices(id) ON DELETE SET NULL,
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    kwh_purchased         NUMERIC(14, 2) NOT NULL,
    kwh_sold              NUMERIC(14, 2) NOT NULL,
    purchased_power_cost  NUMERIC(14, 2) NOT NULL,
    generation_charge     NUMERIC(14, 2),
    transmission_charge   NUMERIC(14, 2),
    system_loss_charge    NUMERIC(14, 2),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (branch_id, period_start, period_end)
);

CREATE INDEX idx_power_supply_branch_period ON power_supply (branch_id, period_start);
CREATE INDEX idx_wesm_prices_region_period ON wesm_prices (grid_region, period_start);

-- ============================================
-- Seed: WESM Prices (Luzon grid, 3 months mock data)
-- ============================================
INSERT INTO wesm_prices (grid_region, period_start, period_end, price_per_kwh) VALUES
('Luzon', '2026-05-01', '2026-05-31', 5.8200),
('Luzon', '2026-06-01', '2026-06-30', 6.1500),
('Luzon', '2026-07-01', '2026-07-31', 5.9700);

-- ============================================
-- Seed: Power Supply (assumes a branch named 'PANELCO I' already exists)
-- ============================================
INSERT INTO power_supply (
    branch_id, wesm_price_id, period_start, period_end,
    kwh_purchased, kwh_sold, purchased_power_cost,
    generation_charge, transmission_charge, system_loss_charge
)
SELECT
    b.id,
    w.id,
    w.period_start,
    w.period_end,
    v.kwh_purchased,
    v.kwh_sold,
    v.purchased_power_cost,
    v.generation_charge,
    v.transmission_charge,
    v.system_loss_charge
FROM branches b
JOIN (VALUES
    ('2026-05-01'::DATE, 1250000::NUMERIC, 1120000::NUMERIC, 7275000::NUMERIC, 6100000::NUMERIC, 850000::NUMERIC, 325000::NUMERIC),
    ('2026-06-01'::DATE, 1310000::NUMERIC, 1175000::NUMERIC, 8058150::NUMERIC, 6750000::NUMERIC, 900000::NUMERIC, 408150::NUMERIC),
    ('2026-07-01'::DATE, 1280000::NUMERIC, 1145000::NUMERIC, 7641600::NUMERIC, 6400000::NUMERIC, 875000::NUMERIC, 366600::NUMERIC)
) AS v(period_start, kwh_purchased, kwh_sold, purchased_power_cost, generation_charge, transmission_charge, system_loss_charge)
    ON true
JOIN wesm_prices w ON w.period_start = v.period_start AND w.grid_region = 'Luzon'
WHERE b.name = 'PANELCO I';
