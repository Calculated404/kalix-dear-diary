import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/todos', label: 'Todos', icon: '✅' },
  { to: '/diary', label: 'Diary', icon: '📔' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { status: wsStatus } = useWebSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">📔</span>
              <span className="font-bold text-xl text-gray-900">Kalix Dear Diary</span>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    wsStatus === 'connected' && 'bg-green-500',
                    wsStatus === 'connecting' && 'bg-yellow-500 animate-pulse',
                    wsStatus === 'disconnected' && 'bg-gray-400',
                    wsStatus === 'error' && 'bg-red-500'
                  )}
                />
                <span className="hidden sm:inline">
                  {wsStatus === 'connected' ? 'Live' : wsStatus}
                </span>
              </div>

              {/* User info */}
              <div className="text-sm text-gray-700">
                {user?.displayName || 'User'}
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] hidden md:block">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-40">
          <div className="flex justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center py-2 px-4 text-xs',
                    isActive
                      ? 'text-primary-600'
                      : 'text-gray-500'
                  )
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 pb-24 md:pb-6">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
