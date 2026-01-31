import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { OverviewStats, TodosTimeSeries, MoodTimeSeries } from '@kalix/shared';

interface ActivityItem {
  type: 'todo' | 'diary' | 'mood';
  id: string;
  title: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export default function DashboardPage() {
  const { accessToken } = useAuth();

  // Overview stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', 'overview', 'week'],
    queryFn: () => api.get<OverviewStats>('/stats/overview?range=week', accessToken!),
  });

  // Todos timeseries
  const { data: todosTimeseries } = useQuery({
    queryKey: ['stats', 'todos', 'timeseries', 'week'],
    queryFn: () => api.get<TodosTimeSeries>('/stats/todos/timeseries?range=week', accessToken!),
  });

  // Mood timeseries
  const { data: moodTimeseries } = useQuery({
    queryKey: ['stats', 'moods', 'timeseries', 'month'],
    queryFn: () => api.get<MoodTimeSeries>('/stats/moods/timeseries?range=month', accessToken!),
  });

  // Recent activity
  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get<ActivityItem[]>('/stats/activity?limit=10', accessToken!),
  });

  // Combine todos data for chart
  const todosChartData = todosTimeseries?.created.map((item, i) => ({
    date: format(new Date(item.date), 'MMM d'),
    created: item.value,
    completed: todosTimeseries.completed[i]?.value ?? 0,
  })) ?? [];

  // Mood chart data
  const moodChartData = moodTimeseries?.average.map((item) => ({
    date: format(new Date(item.date), 'MMM d'),
    mood: item.value,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Your productivity at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Tasks Completed"
          value={stats?.todosCompleted ?? 0}
          subtitle={`of ${stats?.todosCreated ?? 0} this week`}
          icon="✅"
          loading={statsLoading}
        />
        <KPICard
          title="Completion Rate"
          value={`${Math.round((stats?.completionRate ?? 0) * 100)}%`}
          subtitle="this week"
          icon="📈"
          loading={statsLoading}
        />
        <KPICard
          title="Diary Entries"
          value={stats?.diaryEntryCount ?? 0}
          subtitle={`${stats?.wordCount ?? 0} words`}
          icon="📔"
          loading={statsLoading}
        />
        <KPICard
          title="Avg Mood"
          value={stats?.moodAvg?.toFixed(1) ?? '-'}
          subtitle="out of 5"
          icon={getMoodEmoji(stats?.moodAvg)}
          loading={statsLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Todos Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Tasks This Week</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todosChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="created" fill="#94a3b8" name="Created" />
                  <Bar dataKey="completed" fill="#22c55e" name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Mood Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Mood Trend</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Mood Distribution */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Mood Distribution This Week</h3>
        </div>
        <div className="card-body">
          <div className="flex items-end gap-2 h-24">
            {[1, 2, 3, 4, 5].map((score) => {
              const count = stats?.moodDistribution?.[score.toString() as '1' | '2' | '3' | '4' | '5'] ?? 0;
              const maxCount = Math.max(...Object.values(stats?.moodDistribution ?? { '1': 1 }));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              
              return (
                <div key={score} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${height}%`,
                      backgroundColor: getMoodColor(score),
                      minHeight: count > 0 ? '8px' : '0',
                    }}
                  />
                  <span className="text-lg">{getMoodEmoji(score)}</span>
                  <span className="text-xs text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {activity?.map((item) => (
            <div key={`${item.type}-${item.id}`} className="px-6 py-3 flex items-start gap-3">
              <span className="text-xl">
                {item.type === 'todo' ? '✅' : item.type === 'diary' ? '📔' : '🎭'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          ))}
          {(!activity || activity.length === 0) && (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  loading?: boolean;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          </div>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function getMoodEmoji(mood: number | null | undefined): string {
  if (!mood) return '😐';
  const rounded = Math.round(mood);
  switch (rounded) {
    case 1: return '😢';
    case 2: return '😔';
    case 3: return '😐';
    case 4: return '🙂';
    case 5: return '😄';
    default: return '😐';
  }
}

function getMoodColor(mood: number): string {
  switch (mood) {
    case 1: return '#ef4444';
    case 2: return '#f97316';
    case 3: return '#eab308';
    case 4: return '#84cc16';
    case 5: return '#22c55e';
    default: return '#9ca3af';
  }
}
