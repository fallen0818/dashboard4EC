'use client';

import SystemLossDashboard from '../../../components/dashboard/system-loss/SystemLossDashboard';
import { useAuthContext } from '../../../context/AuthContext';

export default function SystemLossDashboardPage() {
  const { branchId } = useAuthContext();

  if (!branchId) {
    return <div className="card">No branch is assigned to your account yet. Ask an admin to set your branch.</div>;
  }

  return <SystemLossDashboard branchId={branchId} />;
}
