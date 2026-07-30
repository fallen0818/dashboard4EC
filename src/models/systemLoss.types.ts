export interface SystemLossRecord {
  id: string;
  branch_id: string;
  period_start: string;
  period_end: string;
  kwh_input: number;
  kwh_billed: number;
  system_loss_kwh: number;
  system_loss_percent: number;
  cap_percent: number;
  created_at: string;
}
