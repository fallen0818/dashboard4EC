import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRole, AppRole } from "../hooks/useRole";
import {
  listUsers,
  setUserRole,
  removeUserRole,
  UserWithRole,
} from "../services/usersRepository";

const ROLE_LABELS: Record<AppRole, string> = {
  admin:  "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin:  "#8B5CF6",
  editor: "#22F0B0",
  viewer: "#9CA3D9",
};

export default function UsersPage() {
  const { role, isAdmin, loading: roleLoading } = useRole();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listUsers();
        if (!cancelled) { setUsers(list); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  async function changeRole(u: UserWithRole, next: AppRole) {
    try {
      await setUserRole(u.user_id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    }
  }

  async function revoke(u: UserWithRole) {
    try {
      await removeUserRole(u.user_id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setConfirmingId(null);
    }
  }

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center">
        <p className="font-mono text-sm text-[#9CA3D9]">Checking permissions…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#08091C] text-[#F5F0FF] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF4D6D] mb-3">
            Admin only
          </p>
          <p className="font-mono text-sm text-[#9CA3D9] mb-4">
            You&apos;re signed in as <span className="text-[#F5F0FF]">{role ?? "unknown"}</span>.
            Ask an admin to give you access to this page.
          </p>
          <Link href="/" className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] border border-[#2C3168] rounded px-3 py-1.5">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08091C] text-[#F5F0FF]">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <header className="mb-8 border-b border-[#2C3168] pb-6">
          <Link href="/" className="font-mono text-xs uppercase tracking-wide text-[#9CA3D9] hover:text-[#F5F0FF] inline-block mb-4">
            ← Dashboard
          </Link>
          <p className="font-mono text-xs tracking-[0.2em] text-[#9CA3D9] uppercase mb-2">
            Cooperative Report
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Users &amp; Roles</h1>
          <p className="font-mono text-xs text-[#6C74A8] mt-2">
            Admin = full access · Editor = read + create/update · Viewer = read only
          </p>
        </header>

        {error && (
          <div className="mb-6 border border-[#FF4D6D55] bg-[#3A0F1E33] rounded p-3">
            <p className="font-mono text-xs text-[#FF4D6D]">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="font-mono text-sm text-[#9CA3D9]">Loading users…</p>
        ) : users.length === 0 ? (
          <p className="font-mono text-sm text-[#9CA3D9]">No users yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2C3168] font-mono text-xs uppercase tracking-wide text-[#9CA3D9]">
                <th className="text-left  py-2 font-normal">Email</th>
                <th className="text-left  py-2 font-normal">Role</th>
                <th className="text-right py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-[#1F2450]">
                  <td className="py-2.5">
                    <span className="text-[#F5F0FF]">{u.email ?? "(no email)"}</span>
                    <span className="font-mono text-[10px] text-[#6C74A8] block">{u.user_id}</span>
                  </td>
                  <td className="py-2.5">
                    <span
                      className="font-mono text-xs uppercase tracking-wide px-2 py-0.5 rounded-full border"
                      style={{ color: ROLE_COLORS[u.role], borderColor: `${ROLE_COLORS[u.role]}55` }}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as AppRole)}
                      className="bg-[#171A38] border border-[#2C3168] rounded px-2 py-1 font-mono text-xs mr-2 focus:outline-none focus:border-[#4A4F9C]"
                    >
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    {confirmingId === u.user_id ? (
                      <>
                        <button onClick={() => revoke(u)} className="font-mono text-xs text-[#FF4D6D] mr-2">Confirm revoke</button>
                        <button onClick={() => setConfirmingId(null)} className="font-mono text-xs text-[#9CA3D9]">Cancel</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(u.user_id)}
                        className="font-mono text-xs text-[#9CA3D9] hover:text-[#FF4D6D]"
                        title="Delete this user's role row (defaults them back to 'viewer' via row absence)"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
