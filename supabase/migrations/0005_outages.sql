DROP TABLE IF EXISTS outages CASCADE;

CREATE TABLE outages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    feeder_name         TEXT NOT NULL,
    outage_type         TEXT NOT NULL CHECK (outage_type IN ('scheduled', 'unscheduled', 'force_majeure')),
    cause               TEXT,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    affected_consumers  INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outages_branch_start ON outages (branch_id, start_time);

-- Seed (PANELCO I, a handful of mock outages)
INSERT INTO outages (branch_id, feeder_name, outage_type, cause, start_time, end_time, affected_consumers)
SELECT b.id, v.feeder_name, v.outage_type, v.cause, v.start_time, v.end_time, v.affected_consumers
FROM branches b
JOIN (VALUES
    ('Feeder 1', 'scheduled',   'Line maintenance',        '2026-05-10 08:00+08'::TIMESTAMPTZ, '2026-05-10 14:00+08'::TIMESTAMPTZ, 3200),
    ('Feeder 3', 'unscheduled', 'Transformer failure',     '2026-06-02 19:30+08'::TIMESTAMPTZ, '2026-06-02 23:15+08'::TIMESTAMPTZ, 1850),
    ('Feeder 2', 'force_majeure', 'Typhoon damage',        '2026-07-14 05:00+08'::TIMESTAMPTZ, '2026-07-15 12:00+08'::TIMESTAMPTZ, 9400),
    ('Feeder 4', 'unscheduled', 'Pole fire',                '2026-07-22 10:10+08'::TIMESTAMPTZ, '2026-07-22 13:40+08'::TIMESTAMPTZ, 620)
) AS v(feeder_name, outage_type, cause, start_time, end_time, affected_consumers) ON true
WHERE b.name = 'PANELCO I';
