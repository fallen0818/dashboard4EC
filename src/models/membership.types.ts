export interface MembershipRecord {
  id: string;
  branch_id: string;
  period_start: string;
  period_end: string;
  total_consumers: number;
  new_connections: number;
  disconnections: number;
  reconnections: number;
  created_at: string;
}
