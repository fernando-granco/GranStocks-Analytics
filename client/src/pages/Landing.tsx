import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
    TrendingUp,
    ShieldCheck,
    Bot,
    Activity,
    Search,
    Globe,
    ArrowRight
} from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();
    const { user, isLoading } = useAuth();
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const nextLng = i18n.language === 'en' ? 'pt-BR' : 'en';
        i18n.changeLanguage(nextLng);
    };

    React.useEffect(() => {
        if (!isLoading && user) {
            navigate('/app');
        }
    }, [user, isLoading, navigate]);

    if (isLoading || user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
            <header className="px-6 py-4 flex items-center justify-between border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2 text-blue-400">
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-xl font-bold tracking-tight text-white">GranStocks<span className="text-blue-500">Analytics</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleLanguage}
                        className="text-lg hover:opacity-80 transition-opacity"
                        title="Toggle Language"
                    >
                        {i18n.language === 'en' ? '🇺🇸' : '🇧🇷'}
                    </button>
                    {user ? (
                        <button
                            onClick={() => navigate('/app')}
                            className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            Dashboard
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/login')}
                                className="text-sm font-medium hover:text-white transition-colors text-gray-400"
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => navigate('/register')}
                                className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                Get Started
                            </button>
                        </>
                    )}
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="py-20 px-6 text-center max-w-5xl mx-auto">
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        {t('landing.hero_title')}
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
                        {t('landing.hero_subtitle')}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/register')}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
                        >
                            {t('landing.btn_create_account')} <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/demo')}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all"
                        >
                            {t('landing.btn_view_demo')}
                        </button>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-20 px-6 bg-gray-900/50">
                    <div className="max-w-6xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                            <FeatureCard
                                icon={<Activity className="w-8 h-8 text-blue-400" />}
                                title={t('landing.features.market_overview.title')}
                                description={t('landing.features.market_overview.desc')}
                            />

                            <FeatureCard
                                icon={<TrendingUp className="w-8 h-8 text-emerald-400" />}
                                title={t('landing.features.portfolio.title')}
                                description={t('landing.features.portfolio.desc')}
                            />

                            <FeatureCard
                                icon={<Globe className="w-8 h-8 text-purple-400" />}
                                title={t('landing.features.watchlists.title')}
                                description={t('landing.features.watchlists.desc')}
                            />

                            <FeatureCard
                                icon={<Search className="w-8 h-8 text-orange-400" />}
                                title={t('landing.features.screener.title')}
                                description={t('landing.features.screener.desc')}
                            />

                            <FeatureCard
                                icon={<Bot className="w-8 h-8 text-cyan-400" />}
                                title={t('landing.features.ai.title')}
                                description={t('landing.features.ai.desc')}
                            />

                            <FeatureCard
                                icon={<ShieldCheck className="w-8 h-8 text-amber-400" />}
                                title={t('landing.features.admin.title')}
                                description={t('landing.features.admin.desc')}
                            />

                        </div>
                    </div>
                </section>
            </main>

            <footer className="py-8 px-6 border-t border-gray-800 text-center text-gray-500 text-sm">
                <p>&copy; {new Date().getFullYear()} {t('landing.footer')}</p>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="bg-gray-800/40 border border-gray-700/50 p-6 rounded-2xl hover:bg-gray-800/60 transition-colors">
            <div className="bg-gray-900 w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-md border border-gray-700/50">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-gray-100 mb-3">{title}</h3>
            <p className="text-gray-400 leading-relaxed">{description}</p>
        </div>
    );
}
