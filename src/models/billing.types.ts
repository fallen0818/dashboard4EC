export type MemberStatus = 'active' | 'disconnected' | 'closed';
export type BillStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface Member {
  id: string;
  branch_id: string;
  account_number: string;
  full_name: string;
  address: string | null;
  status: MemberStatus;
  created_at: string;
}

export interface Meter {
  id: string;
  member_id: string;
  meter_number: string;
  installed_at: string | null;
  created_at: string;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  reading_date: string;
  kwh_reading: number;
  kwh_consumed: number;
  created_at: string;
}

export interface Bill {
  id: string;
  member_id: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: BillStatus;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  item_type: string;
  amount: number;
}

export interface Payment {
  id: string;
  bill_id: string;
  paid_at: string;
  amount: number;
  payment_method: string | null;
}

export interface DisconnectionNotice {
  id: string;
  member_id: string;
  bill_id: string | null;
  issued_at: string;
  reason: string | null;
  resolved: boolean;
}

// Joined shape used by collection efficiency / receivables aging queries
export interface BillWithMember extends Bill {
  members: Pick<Member, 'account_number' | 'full_name' | 'status'>;
}
