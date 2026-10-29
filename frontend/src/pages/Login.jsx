import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../context/useAuth';
import Spinner from '../components/Spinner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-12 h-12 rounded-xl bg-indigo-600 items-center justify-center text-white font-black text-xl shadow-md mb-3">
          IT
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to your account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Or{' '}
          <Link
            to="/register"
            className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-4 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div
              className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
              role="alert"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Quick Demo Credentials hint */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">Demo Logins:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-600">
              <span>Owner: owner@demo.com</span>
              <span>Dev: dev@demo.com</span>
            </div>
            <p className="mt-1 text-slate-400">Password: Demo@1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
