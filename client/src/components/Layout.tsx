import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Settings, LogOut, BarChart3, Globe, LayoutDashboard, BellRing } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
            <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/app')}>
                        <TrendingUp className="text-indigo-400" />
                        <span className="font-bold text-lg tracking-tight">GranStocks <span className="text-neutral-500 font-normal">Analytics</span></span>
                    </div>
                    <div className="flex items-center gap-6">
                        {['ADMIN', 'SUPERADMIN'].includes(user?.role || '') && (
                            <button
                                onClick={() => navigate('/app/admin')}
                                className={`px-3 py-1 text-xs uppercase tracking-wider font-bold border rounded transition-colors ${location.pathname.startsWith('/app/admin') ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}
                            >
                                Admin Panel
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/app')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Dashboard"
                        >
                            <LayoutDashboard size={20} /> <span className="hidden md:inline font-medium text-sm">Dashboard</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/portfolio')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/portfolio' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Portfolio"
                        >
                            <TrendingUp size={20} /> <span className="hidden md:inline font-medium text-sm">Portfolio</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/watchlists')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/watchlists' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Watchlists"
                        >
                            <Globe size={20} /> <span className="hidden md:inline font-medium text-sm">Watchlists</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/alerts')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/alerts' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Alerts"
                        >
                            <BellRing size={20} /> <span className="hidden md:inline font-medium text-sm">Alerts</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/screener')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/screener' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Screener"
                        >
                            <BarChart3 size={20} /> <span className="hidden md:inline font-medium text-sm">Screener</span>
                        </button>
                        <button
                            onClick={() => navigate('/app/settings')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/settings' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title="Settings"
                        >
                            <Settings size={20} /> <span className="hidden md:inline font-medium text-sm">Settings</span>
                        </button>
                        <button
                            onClick={async () => {
                                await logout();
                                navigate('/');
                            }}
                            className="text-neutral-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
                        >
                            <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <Outlet />
            </main>

            <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-neutral-600">
                <p>Disclaimer: Educational analysis only — not financial advice.</p>
                <p>Predictions are uncertain and may be wrong. AI-generated commentary may be inaccurate.</p>
            </footer>
        </div >
    );
}
