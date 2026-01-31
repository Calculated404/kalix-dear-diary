import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { DiaryEntry, PaginatedResponse } from '@kalix/shared';

type FilterRange = 'week' | 'month' | 'all';

export default function DiaryPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<FilterRange>('week');
  const [search, setSearch] = useState('');
  const [newEntry, setNewEntry] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['diary', range, search],
    queryFn: () => {
      let url = `/diary?range=${range}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return api.get<PaginatedResponse<DiaryEntry>>(url, accessToken!);
    },
  });

  const createMutation = useMutation({
    mutationFn: (rawText: string) =>
      api.post<DiaryEntry>('/diary', { rawText, source: 'web' }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary'] });
      setNewEntry('');
      setIsComposing(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEntry.trim()) {
      createMutation.mutate(newEntry.trim());
    }
  };

  const entries = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Diary</h1>
        <p className="text-gray-500">Your thoughts and reflections</p>
      </div>

      {/* New entry form */}
      {isComposing ? (
        <form onSubmit={handleSubmit} className="card">
          <div className="card-body space-y-3">
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              placeholder="Write your thoughts..."
              className="input min-h-[150px] resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">
                {newEntry.split(/\s+/).filter(Boolean).length} words
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsComposing(false);
                    setNewEntry('');
                  }}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newEntry.trim()}
                  className="btn-primary"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsComposing(true)}
          className="card w-full text-left hover:border-primary-300 transition-colors"
        >
          <div className="card-body flex items-center gap-3 text-gray-400">
            <span className="text-2xl">✏️</span>
            <span>Write a new diary entry...</span>
          </div>
        </button>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex rounded-lg bg-gray-100 p-1">
          {(['week', 'month', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                range === r
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entries..."
          className="input max-w-xs"
        />
      </div>

      {/* Entries list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            No diary entries found. Start writing!
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📔</span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(entry.localDate), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.wordCount} words • {entry.source}
                    </p>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <p className="text-gray-700 whitespace-pre-wrap">{entry.rawText}</p>
                {entry.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.hasMore && (
        <div className="text-center">
          <span className="text-sm text-gray-500">
            Showing {entries.length} of {data.total} entries
          </span>
        </div>
      )}
    </div>
  );
}
