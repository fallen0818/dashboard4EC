DROP TABLE IF EXISTS membership CASCADE;

CREATE TABLE membership (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    total_consumers     INTEGER NOT NULL,          -- active connected accounts at period end
    new_connections     INTEGER NOT NULL DEFAULT 0,
    disconnections      INTEGER NOT NULL DEFAULT 0,
    reconnections       INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (branch_id, period_start, period_end)
);

CREATE INDEX idx_membership_branch_period ON membership (branch_id, period_start);

-- Seed (PANELCO I, 3 months)
INSERT INTO membership (branch_id, period_start, period_end, total_consumers, new_connections, disconnections, reconnections)
SELECT b.id, v.period_start, v.period_end, v.total_consumers, v.new_connections, v.disconnections, v.reconnections
FROM branches b
JOIN (VALUES
    ('2026-05-01'::DATE, '2026-05-31'::DATE, 42150, 180, 45, 12),
    ('2026-06-01'::DATE, '2026-06-30'::DATE, 42310, 210, 50, 15),
    ('2026-07-01'::DATE, '2026-07-31'::DATE, 42480, 195, 25, 20)
) AS v(period_start, period_end, total_consumers, new_connections, disconnections, reconnections) ON true
WHERE b.name = 'PANELCO I';
