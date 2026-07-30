DROP TABLE IF EXISTS system_loss CASCADE;

CREATE TABLE system_loss (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    kwh_input           NUMERIC(14, 2) NOT NULL,  -- total kWh received by the co-op
    kwh_billed          NUMERIC(14, 2) NOT NULL,  -- total kWh billed to members
    system_loss_kwh     NUMERIC(14, 2) GENERATED ALWAYS AS (kwh_input - kwh_billed) STORED,
    system_loss_percent NUMERIC(6, 3) GENERATED ALWAYS AS (
        CASE WHEN kwh_input > 0 THEN ((kwh_input - kwh_billed) / kwh_input) * 100 ELSE 0 END
    ) STORED,
    cap_percent         NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- NEA cap, adjustable per branch
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (branch_id, period_start, period_end)
);

CREATE INDEX idx_system_loss_branch_period ON system_loss (branch_id, period_start);

-- Seed (PANELCO I, 3 months)
INSERT INTO system_loss (branch_id, period_start, period_end, kwh_input, kwh_billed)
SELECT b.id, v.period_start, v.period_end, v.kwh_input, v.kwh_billed
FROM branches b
JOIN (VALUES
    ('2026-05-01'::DATE, '2026-05-31'::DATE, 1250000::NUMERIC, 1190000::NUMERIC),
    ('2026-06-01'::DATE, '2026-06-30'::DATE, 1310000::NUMERIC, 1242000::NUMERIC),
    ('2026-07-01'::DATE, '2026-07-31'::DATE, 1280000::NUMERIC, 1224000::NUMERIC)
) AS v(period_start, period_end, kwh_input, kwh_billed) ON true
WHERE b.name = 'PANELCO I';
