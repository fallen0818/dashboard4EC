DROP TABLE IF EXISTS disconnection_notices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bill_items CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS meter_readings CASCADE;
DROP TABLE IF EXISTS meters CASCADE;
DROP TABLE IF EXISTS members CASCADE;

CREATE TABLE members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    account_number  TEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    address         TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    meter_number    TEXT NOT NULL UNIQUE,
    installed_at    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meter_readings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id        UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
    reading_date    DATE NOT NULL,
    kwh_reading     NUMERIC(14, 2) NOT NULL, -- cumulative meter reading
    kwh_consumed    NUMERIC(14, 2) NOT NULL, -- consumption since last reading
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (meter_id, reading_date)
);

CREATE TABLE bills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end   DATE NOT NULL,
    due_date        DATE NOT NULL,
    total_amount    NUMERIC(12, 2) NOT NULL,
    amount_paid     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (member_id, billing_period_start, billing_period_end)
);

CREATE TABLE bill_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL, -- e.g. 'generation_charge', 'system_loss_charge', 'transmission_charge'
    amount          NUMERIC(12, 2) NOT NULL
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    amount          NUMERIC(12, 2) NOT NULL,
    payment_method  TEXT
);

CREATE TABLE disconnection_notices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    bill_id         UUID REFERENCES bills(id) ON DELETE SET NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT,
    resolved        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_bills_member_status ON bills (member_id, status);
CREATE INDEX idx_meter_readings_meter_date ON meter_readings (meter_id, reading_date);

-- ============================================
-- Seed: 3 mock members with meters, readings, bills, payments
-- ============================================
WITH b AS (SELECT id FROM branches WHERE name = 'PANELCO I'),
new_members AS (
    INSERT INTO members (branch_id, account_number, full_name, address, status)
    SELECT b.id, v.account_number, v.full_name, v.address, v.status
    FROM b
    JOIN (VALUES
        ('ACC-00001', 'Juan Dela Cruz', 'Brgy. Poblacion, San Fernando', 'active'),
        ('ACC-00002', 'Maria Santos', 'Brgy. San Isidro, San Fernando', 'active'),
        ('ACC-00003', 'Pedro Reyes', 'Brgy. Sto. Rosario, San Fernando', 'disconnected')
    ) AS v(account_number, full_name, address, status) ON true
    RETURNING id, account_number
),
new_meters AS (
    INSERT INTO meters (member_id, meter_number, installed_at)
    SELECT nm.id, 'MTR-' || nm.account_number, '2024-01-15'::DATE
    FROM new_members nm
    RETURNING id, member_id
)
INSERT INTO meter_readings (meter_id, reading_date, kwh_reading, kwh_consumed)
SELECT m.id, d.reading_date, d.kwh_reading, d.kwh_consumed
FROM new_meters m
JOIN (VALUES
    ('2026-07-01'::DATE, 15420::NUMERIC, 310::NUMERIC)
) AS d(reading_date, kwh_reading, kwh_consumed) ON true;

-- Bills + items + payment for each seeded member
WITH m AS (SELECT id, account_number FROM members WHERE account_number IN ('ACC-00001', 'ACC-00002', 'ACC-00003')),
new_bills AS (
    INSERT INTO bills (member_id, billing_period_start, billing_period_end, due_date, total_amount, amount_paid, status)
    SELECT m.id, '2026-07-01', '2026-07-31', '2026-08-15',
        CASE m.account_number
            WHEN 'ACC-00001' THEN 3250.00
            WHEN 'ACC-00002' THEN 4100.00
            ELSE 2780.00
        END,
        CASE m.account_number
            WHEN 'ACC-00001' THEN 3250.00
            WHEN 'ACC-00002' THEN 0.00
            ELSE 0.00
        END,
        CASE m.account_number
            WHEN 'ACC-00001' THEN 'paid'
            WHEN 'ACC-00002' THEN 'unpaid'
            ELSE 'overdue'
        END
    FROM m
    RETURNING id, member_id, total_amount, status
)
INSERT INTO payments (bill_id, amount, payment_method)
SELECT nb.id, nb.total_amount, 'cash'
FROM new_bills nb
WHERE nb.status = 'paid';

-- Disconnection notice for the overdue member
INSERT INTO disconnection_notices (member_id, bill_id, reason, resolved)
SELECT m.id, b.id, 'Overdue balance beyond 30 days', false
FROM members m
JOIN bills b ON b.member_id = m.id
WHERE m.account_number = 'ACC-00003';
