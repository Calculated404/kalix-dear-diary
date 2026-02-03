import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'email' | 'code' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, loginWithCode } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        await api.post('/auth/register', { email, password, displayName: displayName || undefined });
        setSuccess('Account created. You can now sign in.');
        setMode('email');
        setPassword('');
      } else if (mode === 'email') {
        await login(email, password);
        navigate('/dashboard');
      } else {
        await loginWithCode(loginCode);
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📔</div>
          <h1 className="text-3xl font-bold text-gray-900">Kalix Dear Diary</h1>
          <p className="text-gray-600 mt-2">Your personal diary and task manager</p>
        </div>

        {/* Login card */}
        <div className="card">
          <div className="card-body">
            {/* Mode toggle */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'email'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('code')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'code'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Telegram Code
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' ? (
                <>
                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-displayName" className="block text-sm font-medium text-gray-700 mb-1">
                      Display name (optional)
                    </label>
                    <input
                      id="reg-displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="input"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password (min 8 characters)
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                </>
              ) : mode === 'email' ? (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                    Login Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Send /login to the Telegram bot to receive your code
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    {mode === 'register' ? 'Creating...' : 'Signing in...'}
                  </span>
                ) : mode === 'register' ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {success && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* Demo credentials hint */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Demo (after seed): demo@kalix.local / demo123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
