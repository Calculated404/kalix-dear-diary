import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Todo, PaginatedResponse } from '@kalix/shared';

type FilterRange = 'week' | 'month' | 'all';
type FilterStatus = 'open' | 'done' | 'all';

export default function TodosPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<FilterRange>('week');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [newTodoTitle, setNewTodoTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['todos', range, status],
    queryFn: () =>
      api.get<PaginatedResponse<Todo>>(
        `/todos?range=${range}&status=${status}`,
        accessToken!
      ),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.post<Todo>('/todos', { title, source: 'web' }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      setNewTodoTitle('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<Todo>(`/todos/${id}/complete`, {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoTitle.trim()) {
      createMutation.mutate(newTodoTitle.trim());
    }
  };

  const todos = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Todos</h1>
        <p className="text-gray-500">Manage your tasks</p>
      </div>

      {/* Add todo form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="card-body flex gap-3">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="Add a new todo..."
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newTodoTitle.trim()}
            className="btn-primary whitespace-nowrap"
          >
            {createMutation.isPending ? 'Adding...' : 'Add Todo'}
          </button>
        </div>
      </form>

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

        <div className="flex rounded-lg bg-gray-100 p-1">
          {(['all', 'open', 'done'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                status === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : todos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No todos found. Add one above!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todos.map((todo) => (
              <li key={todo.id} className="px-6 py-4 flex items-start gap-3">
                <button
                  onClick={() => {
                    if (todo.status !== 'done') {
                      completeMutation.mutate(todo.id);
                    }
                  }}
                  disabled={completeMutation.isPending || todo.status === 'done'}
                  className={clsx(
                    'mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors',
                    todo.status === 'done'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-primary-500'
                  )}
                >
                  {todo.status === 'done' && (
                    <svg className="w-full h-full p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={clsx(
                      'text-sm',
                      todo.status === 'done'
                        ? 'text-gray-400 line-through'
                        : 'text-gray-900'
                    )}
                  >
                    {todo.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{format(new Date(todo.createdAt), 'MMM d')}</span>
                    {todo.dueDate && (
                      <span className="text-orange-500">
                        Due: {format(new Date(todo.dueDate), 'MMM d')}
                      </span>
                    )}
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-xs',
                        todo.source === 'telegram' && 'bg-blue-100 text-blue-700',
                        todo.source === 'web' && 'bg-purple-100 text-purple-700',
                        todo.source === 'api' && 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {todo.source}
                    </span>
                  </div>
                </div>
                {todo.priority > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                    P{todo.priority}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {data && data.hasMore && (
          <div className="px-6 py-3 border-t border-gray-100 text-center">
            <span className="text-sm text-gray-500">
              Showing {todos.length} of {data.total} todos
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
