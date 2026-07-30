export type OutageType = 'scheduled' | 'unscheduled' | 'force_majeure';

export interface OutageRecord {
  id: string;
  branch_id: string;
  feeder_name: string;
  outage_type: OutageType;
  cause: string | null;
  start_time: string;
  end_time: string | null;
  affected_consumers: number;
  created_at: string;
}
