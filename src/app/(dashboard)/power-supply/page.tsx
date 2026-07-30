'use client';

import PowerSupplyDashboard from '../../../components/dashboard/power-supply/PowerSupplyDashboard';
import { useAuthContext } from '../../../context/AuthContext';

export default function PowerSupplyDashboardPage() {
  const { branchId } = useAuthContext();

  if (!branchId) {
    return <div className="card">No branch is assigned to your account yet. Ask an admin to set your branch.</div>;
  }

  return <PowerSupplyDashboard branchId={branchId} />;
}
