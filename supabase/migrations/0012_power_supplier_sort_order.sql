-- ============================================================================
-- 0012_power_supplier_sort_order.sql
--
-- Add an explicit display order to power_suppliers so the power_supply
-- records list can be sorted by period desc, then a stable supplier order
-- (instead of alphabetical by code, which put WESM/NETMETER ahead of the
-- larger bilateral PSAs).
--
--   A. Add sort_order, backfill from current effective order
--      (supplier_type, code), enforce NOT NULL, index for the ORDER BY.
--   B. Trigger: auto-assign the next sort_order per branch when a new
--      supplier is inserted without one specified.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. sort_order column
-- ----------------------------------------------------------------------------
ALTER TABLE power_suppliers
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill preserving today's effective order (bilateral/wesm/net_metering,
-- then code) so existing displays don't visibly reshuffle.
UPDATE power_suppliers ps
SET sort_order = ranked.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY branch_id
    ORDER BY supplier_type, code
  ) AS rn
  FROM power_suppliers
) ranked
WHERE ranked.id = ps.id
  AND ps.sort_order IS NULL;

ALTER TABLE power_suppliers
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_power_suppliers_branch_sort
  ON power_suppliers (branch_id, sort_order);

-- ----------------------------------------------------------------------------
-- B. Auto-assign sort_order on insert when omitted
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_power_supplier_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1
    INTO NEW.sort_order
    FROM power_suppliers
    WHERE branch_id = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_power_supplier_sort_order ON power_suppliers;

CREATE TRIGGER set_power_supplier_sort_order
  BEFORE INSERT ON power_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_power_supplier_sort_order();
