import { Link, Outlet } from 'react-router-dom';
import useAuth from '../context/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3">
            {/* Logo and App Title */}
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md py-1"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                  IT
                </div>
                <span>Issue Tracker</span>
              </Link>

              {/* Mobile Logout (visible on tiny screens) */}
              <div className="sm:hidden">
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-[44px] px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* User Info & Actions */}
            {user && (
              <div className="flex items-center justify-between sm:justify-end gap-3 text-sm">
                <div className="flex flex-col sm:text-right">
                  <span className="font-semibold text-slate-800 leading-tight">
                    {user.name}
                  </span>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {user.email}
                  </span>
                </div>

                <div className="hidden sm:block pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={logout}
                    className="min-h-[44px] px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
