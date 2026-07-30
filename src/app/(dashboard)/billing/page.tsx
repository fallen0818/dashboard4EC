'use client';

import BillingDashboard from '../../../components/dashboard/billing/BillingDashboard';
import { useAuthContext } from '../../../context/AuthContext';

export default function BillingDashboardPage() {
  const { branchId } = useAuthContext();

  if (!branchId) {
    return <div className="card">No branch is assigned to your account yet. Ask an admin to set your branch.</div>;
  }

  return <BillingDashboard branchId={branchId} />;
}
