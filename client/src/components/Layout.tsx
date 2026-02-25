import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Settings, LogOut, BarChart3, LayoutDashboard, BellRing, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { t, i18n } = useTranslation();
    const toggleLanguage = () => {
        const nextLng = i18n.language === 'en' ? 'pt-BR' : 'en';
        i18n.changeLanguage(nextLng);
    };

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
                                {t('nav.admin')}
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/app')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title={t('nav.dashboard')}
                        >
                            <LayoutDashboard size={20} /> <span className="hidden md:inline font-medium text-sm">{t('nav.dashboard')}</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/watchlists')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/watchlists' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title={t('nav.watchlists')}
                        >
                            <Layers size={20} /> <span className="hidden md:inline font-medium text-sm">{t('nav.watchlists')}</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/alerts')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/alerts' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title={t('nav.alerts')}
                        >
                            <BellRing size={20} /> <span className="hidden md:inline font-medium text-sm">{t('nav.alerts')}</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/screener')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/screener' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title={t('nav.screener')}
                        >
                            <BarChart3 size={20} /> <span className="hidden md:inline font-medium text-sm">{t('nav.screener')}</span>
                        </button>

                        <div className="h-6 w-px bg-neutral-800 mx-2 hidden sm:block"></div>

                        <button
                            onClick={toggleLanguage}
                            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                            title="Toggle Language"
                        >
                            <span className="text-lg">{i18n.language === 'en' ? '🇺🇸' : '🇧🇷'}</span>
                        </button>

                        <button
                            onClick={() => navigate('/app/settings')}
                            className={`flex items-center gap-2 transition-colors ${location.pathname === '/app/settings' ? 'text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                            title={t('nav.settings')}
                        >
                            <Settings size={20} /> <span className="hidden md:inline font-medium text-sm">{t('nav.settings')}</span>
                        </button>
                        <button
                            onClick={async () => {
                                await logout();
                                navigate('/');
                            }}
                            className="text-neutral-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
                        >
                            <LogOut size={16} /> <span className="hidden sm:inline">{t('nav.logout')}</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8 relative">
                <Outlet />
            </main>

            <footer className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-neutral-600">
                <p>Disclaimer: Educational analysis only — not financial advice.</p>
                <p>Predictions are uncertain and may be wrong. AI-generated commentary may be inaccurate.</p>
            </footer>
        </div >
    );
}
