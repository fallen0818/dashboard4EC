'use client';

import OutagesDashboard from '../../../components/dashboard/outages/OutagesDashboard';
import { useAuthContext } from '../../../context/AuthContext';

export default function OutagesDashboardPage() {
  const { branchId } = useAuthContext();

  if (!branchId) {
    return <div className="card">No branch is assigned to your account yet. Ask an admin to set your branch.</div>;
  }

  return <OutagesDashboard branchId={branchId} />;
}
