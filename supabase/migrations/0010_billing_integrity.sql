-- ============================================================================
-- 0010_billing_integrity.sql
--
-- Three integrity fixes for the billing module:
--   A. Constrain bill_items.item_type to a known set (was free TEXT).
--   B. record_payment(): atomic payment insert + bill reconciliation, replacing
--      the multi-round-trip client logic in billingService.createPayment.
--   C. mark_overdue_bills(): derive the 'overdue' status instead of relying on
--      whoever calls updateBill to set it by hand. Intended to run on a schedule.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- A. bill_items.item_type — enum-style CHECK
--    (bill_items is empty in seed data, so this is safe to add unconditionally)
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- B. record_payment — atomic, single-transaction payment + reconciliation
--
-- Runs as the calling user (SECURITY INVOKER), so the branch RLS policies on
-- `payments` (insert) and `bills` (update) still apply. The whole function body
-- executes in one transaction, so a failure at any step rolls the payment back.
-- FOR UPDATE locks the bill row to prevent concurrent double-counting.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- C. mark_overdue_bills — derive 'overdue' from due_date + balance
--
-- Flips any past-due bill that still has an outstanding balance to 'overdue',
-- so the stored status can no longer silently disagree with the due date.
-- Schedule it daily (e.g. via pg_cron):
--   SELECT cron.schedule('mark-overdue', '0 1 * * *', 'SELECT public.mark_overdue_bills()');
-- Returns the number of rows updated.
-- ----------------------------------------------------------------------------
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
