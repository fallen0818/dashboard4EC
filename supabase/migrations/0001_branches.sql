DROP TABLE IF EXISTS branches CASCADE;

CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    grid_region TEXT NOT NULL CHECK (grid_region IN ('Luzon', 'Visayas', 'Mindanao')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches (name, grid_region) VALUES ('PANELCO I', 'Luzon');
