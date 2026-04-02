import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import UploadField from '../../components/admin/UploadField.jsx';
import AdminRoute from '../../components/auth/AdminRoute.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function AdminUploads() {
  const { getToken } = useAuth();
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadUploads() {
      const token = await getToken?.();
      if (!token || cancelled) return;
      try {
        const res = await fetch('/api/admin/uploads', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setUploads(data.uploads || []);
      } catch (e) {
        console.error('[AdminUploads] load failed', e);
      }
    }

    loadUploads();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const handleUploaded = () => {
    getToken?.().then(async (token) => {
      if (!token) return;
      try {
        const res = await fetch('/api/admin/uploads', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setUploads(data.uploads || []);
      } catch (e) {
        console.error('[AdminUploads] refresh failed', e);
      }
    });
  };

  return (
    <AdminRoute>
      <AdminLayout>
        <h2 className="text-lg font-black text-slate-900">Uploads</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload cover images and audio files, then paste the URLs into stories and episodes.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <UploadField
            label="Cover / story image"
            kind="image"
            bucket="covers"
            onUploaded={handleUploaded}
          />
          <UploadField
            label="Episode audio (MP3)"
            kind="audio"
            bucket="audio"
            onUploaded={handleUploaded}
          />
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Recent uploads
          </h3>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-700">{u.file_name}</div>
                  <div className="truncate text-[11px] text-slate-500">{u.file_url}</div>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {u.file_type?.startsWith('image') ? 'Image' : 'Audio'}
                </div>
              </div>
            ))}
            {uploads.length === 0 && (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                No uploads yet.
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminRoute>
  );
}
