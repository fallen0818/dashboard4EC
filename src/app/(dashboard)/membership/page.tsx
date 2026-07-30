'use client';

import MembershipDashboard from '../../../components/dashboard/membership/MembershipDashboard';
import { useAuthContext } from '../../../context/AuthContext';

export default function MembershipDashboardPage() {
  const { branchId } = useAuthContext();

  if (!branchId) {
    return <div className="card">No branch is assigned to your account yet. Ask an admin to set your branch.</div>;
  }

  return <MembershipDashboard branchId={branchId} />;
}
