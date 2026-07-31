-- ============================================================================
-- 0009_outage_restoration.sql
-- Restoration / accomplishment report fields for outages.
--
--   restoration_report — free-text account of the action taken to restore service
--   restored_by        — crew / personnel who carried out the restoration
--   restored_at        — when the restoration was completed / reported
--                        (kept separate from end_time, which is the moment the
--                        interruption ended for duration calculations)
-- All nullable: an ongoing outage simply has none of them yet.
-- ============================================================================
ALTER TABLE outages
  ADD COLUMN IF NOT EXISTS restoration_report text,
  ADD COLUMN IF NOT EXISTS restored_by        text,
  ADD COLUMN IF NOT EXISTS restored_at        timestamptz;
