import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import type { PaginatedResponse, Todo, DiaryEntry, MoodLog } from '@kalix/shared';

const TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'UTC',
];

export default function SettingsPage() {
  const { user, accessToken, logout } = useAuth();
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Europe/Berlin');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch data for export
  const { data: todosData } = useQuery({
    queryKey: ['todos', 'all', 'all'],
    queryFn: () => api.get<PaginatedResponse<Todo>>('/todos?range=all&limit=1000', accessToken!),
  });

  const { data: diaryData } = useQuery({
    queryKey: ['diary', 'all'],
    queryFn: () => api.get<PaginatedResponse<DiaryEntry>>('/diary?range=all&limit=1000', accessToken!),
  });

  const { data: moodsData } = useQuery({
    queryKey: ['moods', 'all'],
    queryFn: () => api.get<PaginatedResponse<MoodLog>>('/moods?range=all&limit=1000', accessToken!),
  });

  const handleSaveTimezone = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await api.patch('/auth/me', { timezone }, accessToken!);
      setMessage({ type: 'success', text: 'Timezone updated successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update timezone',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        displayName: user?.displayName,
        timezone: user?.timezone,
      },
      todos: todosData?.items ?? [],
      diaryEntries: diaryData?.items ?? [],
      moodLogs: moodsData?.items ?? [],
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalix-diary-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // Export todos as CSV
    const todosCsv = [
      ['id', 'title', 'status', 'priority', 'dueDate', 'completedAt', 'createdAt', 'source'].join(','),
      ...(todosData?.items ?? []).map((t) =>
        [
          t.id,
          `"${t.title.replace(/"/g, '""')}"`,
          t.status,
          t.priority,
          t.dueDate ?? '',
          t.completedAt ?? '',
          t.createdAt,
          t.source,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([todosCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalix-todos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Profile section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Profile</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <p className="text-gray-900">{user?.displayName || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <p className="text-gray-500 text-sm font-mono">{user?.id}</p>
          </div>
        </div>
      </div>

      {/* Timezone section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Timezone</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Your timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="input"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Used for calculating local dates in your dashboard and entries
            </p>
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleSaveTimezone}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Timezone'}
          </button>
        </div>
      </div>

      {/* Export section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Export Data</h3>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-gray-600">
            Download all your data including todos, diary entries, and mood logs.
          </p>
          <div className="flex gap-3">
            <button onClick={handleExportJSON} className="btn-outline">
              Export JSON
            </button>
            <button onClick={handleExportCSV} className="btn-outline">
              Export CSV (Todos)
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Data loaded: {todosData?.items.length ?? 0} todos,{' '}
            {diaryData?.items.length ?? 0} diary entries,{' '}
            {moodsData?.items.length ?? 0} mood logs
          </p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-red-200">
        <div className="card-header bg-red-50">
          <h3 className="font-semibold text-red-900">Danger Zone</h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Sign out</h4>
            <p className="text-sm text-gray-500 mb-2">
              Sign out of your account on this device.
            </p>
            <button onClick={() => logout()} className="btn-outline text-red-600 border-red-300 hover:bg-red-50">
              Sign Out
            </button>
          </div>

          <hr />

          <div>
            <h4 className="text-sm font-medium text-gray-900">Delete Account</h4>
            <p className="text-sm text-gray-500 mb-2">
              Permanently delete your account and all associated data.
            </p>
            <button
              className="btn-outline text-red-600 border-red-300 hover:bg-red-50 opacity-50 cursor-not-allowed"
              disabled
            >
              Delete Account (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
