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

                {/* Markets Configuration */}
                <details className="group bg-neutral-900 border border-neutral-800 rounded-xl w-full [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between p-4 cursor-pointer select-none outline-none">
                        <h3 className="text-sm font-medium text-neutral-300 group-open:text-indigo-400 transition-colors">Manage Visible Markets...</h3>
                        <span className="text-xs text-neutral-500 font-medium group-open:hidden">Click to configure</span>
                    </summary>
                    <div className="p-4 pt-0 mt-2 border-t border-neutral-800/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 mb-4 border-b border-neutral-800/50">
                            <p className="text-sm text-neutral-400">Select which markets appear as tabs below.</p>
                            <span className="text-xs text-neutral-500 font-medium">Demo Default Only</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: 'SP500', label: '🇺🇸 S&P 500', active: true },
                                { id: 'NASDAQ100', label: '🇺🇸 NASDAQ 100', active: false },
                                { id: 'TSX60', label: '🇨🇦 TSX 60', active: false },
                                { id: 'IBOV', label: '🇧🇷 IBOVESPA', active: false },
                                { id: 'CRYPTO', label: '🪙 Crypto Top 100', active: false }
                            ].map(u => (
                                <label key={u.id} className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                                    u.active
                                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300"
                                        : "bg-neutral-800/50 border-neutral-700/50 text-neutral-500 opacity-50 cursor-not-allowed"
                                )}>
                                    <input type="checkbox" className="hidden" checked={u.active} disabled />
                                    {u.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </details>

                {/* Display Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-px">
                    <button className="px-4 py-3 text-sm font-medium border-b-2 transition-colors border-indigo-500 text-indigo-400">
                        🇺🇸 S&P 500
                    </button>
                    <button disabled className="px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-neutral-500 opacity-50 cursor-not-allowed">
                        🇨🇦 TSX 60
                    </button>
                    <button disabled className="px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-neutral-500 opacity-50 cursor-not-allowed">
                        🇧🇷 IBOVESPA
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
                                                <div className="font-bold text-lg flex items-center gap-2">
                                                    {c.symbol}
                                                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 rounded font-normal flex items-center h-4">🇺🇸 US</span>
                                                </div>
                                                <div className="text-xs text-neutral-500 mt-0.5">Score: {c.score.toFixed(1)}</div>
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
