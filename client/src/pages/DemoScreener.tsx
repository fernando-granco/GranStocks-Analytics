import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ShieldCheck, BarChart3, Play } from 'lucide-react';
import { cn } from '../utils';
import { useTranslation } from 'react-i18next';

export default function DemoScreener() {
    const navigate = useNavigate();
    const [meta, setMeta] = useState<any>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const nextLng = i18n.language === 'en' ? 'pt-BR' : 'en';
        i18n.changeLanguage(nextLng);
    };

    useEffect(() => {
        // Fetch SP500 demo screener
        fetch('/api/demo/screener/SP500')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.topCandidates) {
                    setCandidates(data.topCandidates);
                }
            });

        fetch('/api/demo/meta')
            .then(res => res.ok ? res.json() : null)
            .then(data => setMeta(data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-neutral-400 animate-pulse">Loading offline screener results...</div>;

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
            <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 p-2 text-center text-sm font-medium flex items-center justify-center gap-2">
                <AlertTriangle size={16} />
                <span>{t('demo.warning')}</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => navigate('/demo')}
                        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={16} /> {t('demo.back')}
                    </button>
                    <button
                        onClick={toggleLanguage}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
                        title="Toggle Language"
                    >
                        <span className="text-xl leading-none">{i18n.language === 'en' ? '🇺🇸' : '🇧🇷'}</span>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-4xl font-bold flex items-center gap-3">
                            <BarChart3 className="text-indigo-400" size={32} />
                            {t('screener.title')} <span className="text-xl font-normal text-neutral-500 ml-2">{t('screener.subtitle')}</span>
                        </h1>
                        <p className="text-neutral-400 mt-2">{t('screener.desc')}</p>
                    </div>

                    <button
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shrink-0 opacity-50 cursor-not-allowed"
                        disabled
                        title="Disabled in Demo"
                    >
                        <Play size={16} /> {t('screener.force_run')}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-full max-w-sm">
                    <button
                        className={cn(
                            "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors bg-neutral-800 text-white"
                        )}
                    >
                        {t('screener.tabs.sp500')}
                    </button>
                    <button
                        className={cn(
                            "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors opacity-50 text-neutral-400 cursor-not-allowed"
                        )}
                    >
                        {t('screener.tabs.nasdaq100')}
                    </button>
                    <button
                        className={cn(
                            "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors opacity-50 text-neutral-400 cursor-not-allowed"
                        )}
                    >
                        {t('screener.tabs.crypto')}
                    </button>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900/50">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-emerald-500 w-5 h-5" />
                            <h2 className="font-semibold">Top SP500 Candidates</h2>
                        </div>
                        <span className="text-xs font-mono text-neutral-500">
                            Snapshot: {meta?.snapshotAnchorDate || 'Unknown'}
                        </span>
                    </div>

                    <div className="divide-y divide-neutral-800">
                        {candidates.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500">No candidates analyzed in this offline snapshot.</div>
                        ) : (
                            candidates.map((c, i) => {
                                const metrics = JSON.parse(c.metricsJson || '{}');
                                const flags = JSON.parse(c.riskFlagsJson || '[]');
                                return (
                                    <div
                                        key={c.symbol}
                                        className="p-4 hover:bg-neutral-800/50 transition-colors flex items-center justify-between cursor-pointer"
                                        onClick={() => navigate(`/demo/asset/${c.assetType.toLowerCase()}/${c.symbol.toLowerCase()}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 text-center font-mono text-neutral-500">#{i + 1}</div>
                                            <div>
                                                <div className="font-bold text-lg">{c.symbol}</div>
                                                <div className="text-xs text-neutral-500">Score: {c.score.toFixed(1)}</div>
                                            </div>
                                        </div>

                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm">Ret 6m: <span className={metrics.return6m >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{metrics.return6m?.toFixed(2)}%</span></div>
                                            <div className="flex gap-2 justify-end mt-1">
                                                {flags.map((f: string) => <span key={f} className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">{f}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="mt-12 text-center text-sm text-neutral-500">
                    Screener limits, custom universes, and multi-model consensus reports are available in the Live app.
                </div>
            </div>
        </div>
    );
}
