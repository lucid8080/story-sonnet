import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import AdminStatsCard from '../../components/admin/AdminStatsCard.jsx';
import AdminRoute from '../../components/auth/AdminRoute.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState({
    stories: 0,
    episodes: 0,
    users: 0,
    activeSubscribers: 0,
    uploads: 0,
  });

  useEffect(() => {
    async function load() {
      const token = await getToken?.();
      if (!token) return;
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setStats({
          stories: data.stories ?? 0,
          episodes: data.episodes ?? 0,
          users: data.users ?? 0,
          activeSubscribers: data.activeSubscribers ?? 0,
          uploads: data.uploads ?? 0,
        });
      } catch (e) {
        console.error('[AdminDashboard] stats load failed', e);
      }
    }
    load();
  }, [getToken]);

  return (
    <AdminRoute>
      <AdminLayout>
        <div className="grid gap-4 md:grid-cols-3">
          <AdminStatsCard label="Stories" value={stats.stories} hint="Total story series" />
          <AdminStatsCard label="Episodes" value={stats.episodes} hint="All episodes" />
          <AdminStatsCard
            label="Active subscribers"
            value={stats.activeSubscribers}
            hint="Profiles with active subscription"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AdminStatsCard label="Users" value={stats.users} />
          <AdminStatsCard label="Uploads" value={stats.uploads} />
        </div>
      </AdminLayout>
    </AdminRoute>
  );
}
