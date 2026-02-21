import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Settings, LogOut, BarChart3, FlaskConical, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { mode, setMode } = usePreferences();

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
            <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/app')}>
                        <TrendingUp className="text-indigo-400" />
                        <span className="font-bold text-lg tracking-tight">GranStocks <span className="text-neutral-500 font-normal">Analytics</span></span>
                    </div>
                    <div className="flex items-center gap-6">
                        {user?.role === 'ADMIN' && (
                            <button
                                onClick={() => navigate('/app/admin/users')}
                                className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 transition-colors"
                            >
                                Admin
                            </button>
                        )}

                        <button
                            onClick={() => setMode(mode === 'BASIC' ? 'ADVANCED' : 'BASIC')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-colors ${mode === 'ADVANCED' ? 'bg-amber-500 text-neutral-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'}`}
                            title={`Current Mode: ${mode}`}
                        >
                            <FlaskConical size={14} className={mode === 'ADVANCED' ? 'animate-pulse' : ''} />
                            {mode === 'ADVANCED' ? 'Pro' : 'Basic'}
                        </button>

                        {mode === 'ADVANCED' && (
                            <button
                                onClick={() => navigate('/app/universes')}
                                className={`transition-colors ${location.pathname === '/app/universes' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                                title="Universe Builder"
                            >
                                <Globe size={20} />
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/app/screener')}
                            className={`transition-colors ${location.pathname === '/app/screener' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                        >
                            <BarChart3 size={20} />
                        </button>
                        <button
                            onClick={() => navigate('/app/settings')}
                            className={`transition-colors ${location.pathname === '/app/settings' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                        >
                            <Settings size={20} />
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
        </div>
    );
}
