import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Play, AlertTriangle, Info, Star } from 'lucide-react';
import { cn } from '../utils';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function Screener() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedUniverses, setSelectedUniverses] = useState<string[]>(['SP500', 'NASDAQ100', 'CRYPTO']);
    const [activeTab, setActiveTab] = useState<string>('SP500');
    const [livePrices, setLivePrices] = useState<Record<string, number | null>>({});
    const { user } = useAuth();

    const { data: prefsData } = useQuery({
        queryKey: ['preferences'],
        queryFn: async () => {
            const res = await fetch('/api/settings/preferences');
            if (!res.ok) return null;
            return res.json();
        }
    });

    useEffect(() => {
        if (prefsData?.screenerUniverses && prefsData.screenerUniverses.length > 0) {
            setSelectedUniverses(prefsData.screenerUniverses);
            if (!prefsData.screenerUniverses.includes(activeTab)) {
                setActiveTab(prefsData.screenerUniverses[0]);
            }
        }
    }, [prefsData]);

    useEffect(() => {
        if (!selectedUniverses.includes(activeTab) && selectedUniverses.length > 0) {
            setActiveTab(selectedUniverses[0]);
        }
    }, [selectedUniverses, activeTab]);

    const { data, isLoading } = useQuery({
        queryKey: ['screener_top', activeTab],
        queryFn: async () => {
            const res = await fetch(`/api/screener/top/all?universes=${activeTab}`);
            if (!res.ok) throw new Error('Failed to fetch screener data');
            return res.json();
        },
        enabled: !!activeTab,
        refetchInterval: (query: any) => query.state.data?.state?.status === 'RUNNING' ? 3000 : false
    });

    const { data: trackedAssets = [] } = useQuery({
        queryKey: ['tracked-assets'],
        queryFn: async () => {
            const res = await fetch('/api/tracked-assets');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const trackMutation = useMutation({
        mutationFn: async (symbol: string) => {
            // Determine assetType based on the universe of the asset being tracked
            const assetUniverse = data?.topCandidates.find((c: any) => c.symbol === symbol)?.universeType;
            const assetType = assetUniverse === 'CRYPTO' ? 'CRYPTO' : 'STOCK';

            const res = await fetch('/api/tracked-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, assetType })
            });
            if (!res.ok) throw new Error('Failed to track asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
        }
    });

    const untrackMutation = useMutation({
        mutationFn: async (symbol: string) => {
            const res = await fetch(`/api/tracked-assets/${symbol}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to untrack asset');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracked-assets'] });
        }
    });

    const isTracked = (symbol: string) => trackedAssets.some((a: any) => a.symbol === symbol);

    const runJobMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/admin/screener/run?universe=${activeTab}`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error('Trigger failed');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screener_top', activeTab] });
            toast.success('Screener job triggered in background');
        }
    });


    useEffect(() => {
        if (!data?.topCandidates || data.topCandidates.length === 0) return;

        data.topCandidates.forEach((c: any) => {
            if (livePrices[c.symbol] !== undefined) return;

            const assetType = c.universeType === 'CRYPTO' ? 'CRYPTO' : 'STOCK';
            const isForeign = c.universeName === 'TSX60' || c.universeName === 'IBOV';

            // Fetch price for each candidate
            fetch(`/api/data/quote?symbol=${c.symbol}&assetType=${assetType}`)
                .then(res => res.json())
                .then(quote => {
                    setLivePrices(prev => ({ ...prev, [c.symbol]: quote.price }));

                    if (isForeign) {
                        // Fetch USD equivalent
                        const currency = c.universeName === 'TSX60' ? 'CAD' : 'BRL';
                        fetch(`/api/data/quote?symbol=${currency}USD=X&assetType=STOCK`)
                            .then(r => r.json())
                            .then(fx => {
                                if (fx?.price) {
                                    setLivePrices(prev => ({ ...prev, [`${c.symbol}_USD`]: quote.price * fx.price }));
                                }
                            }).catch(() => { });
                    }
                })
                .catch(() => {
                    setLivePrices(prev => ({ ...prev, [c.symbol]: null }));
                });
        });
    }, [data?.topCandidates, selectedUniverses]); // Changed dependency from universe to selectedUniverses

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <BarChart3 className="text-indigo-400" size={32} />
                        {t('screener.title')} <span className="text-xl font-normal text-neutral-500 ml-2">{t('screener.subtitle')}</span>
                    </h1>
                    <p className="text-neutral-400 mt-2">{t('screener.desc')}</p>
                </div>

                {['ADMIN', 'SUPERADMIN'].includes(user?.role || '') && (
                    <button
                        onClick={() => runJobMutation.mutate()}
                        disabled={runJobMutation.isPending || data?.state?.status === 'RUNNING'}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shrink-0"
                    >
                        <Play size={16} /> {t('screener.force_run')}
                    </button>
                )}
            </div>

            {/* Display Tabs */}
            {selectedUniverses.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-px">
                    {[
                        { id: 'SP500', label: '🇺🇸 S&P 500' },
                        { id: 'NASDAQ100', label: '🇺🇸 NASDAQ 100' },
                        { id: 'TSX60', label: '🇨🇦 TSX 60' },
                        { id: 'IBOV', label: '🇧🇷 IBOVESPA' },
                        { id: 'CRYPTO', label: '🪙 Crypto' }
                    ].filter(u => selectedUniverses.includes(u.id)).map(u => (
                        <button
                            key={u.id}
                            onClick={() => setActiveTab(u.id)}
                            className={cn(
                                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === u.id
                                    ? "border-indigo-500 text-indigo-400"
                                    : "border-transparent text-neutral-500 hover:text-neutral-300 hover:border-neutral-700"
                            )}
                        >
                            {u.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Job State Banner */}
            {data?.state && data.state.status === 'RUNNING' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        <span className="text-indigo-400 font-medium">{t('screener.run_state.running')}</span>
                    </div>
                    <div className="text-indigo-300 font-mono text-sm">
                        {data.state.cursorIndex} / {data.state.total}
                    </div>
                </div>
            )}

            {data?.state?.status === 'FAILED' && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle className="text-rose-400" size={20} />
                    <span className="text-rose-400 font-medium">Job failed: {data.state.lastError}</span>
                </div>
            )}

            {/* Results Grid */}
            {isLoading ? (
                <div className="text-center py-20 text-neutral-500 animate-pulse">Loading rankings...</div>
            ) : (data?.topCandidates?.length ?? 0) === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20">
                    <Info className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">No cached results for selected markets</h3>
                    <p className="text-neutral-500 mt-1">Admin must run the screener job to populate the database.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.topCandidates.map((c: any, index: number) => {
                        const metrics = JSON.parse(c.metricsJson);
                        const flags = c.riskFlagsJson ? JSON.parse(c.riskFlagsJson) : [];
                        const isCrypto = c.universeType === 'CRYPTO';

                        let marketBadge = '🇺🇸 US';
                        let currencyBadge = 'USD';
                        if (c.universeName === 'TSX60') { marketBadge = '🇨🇦 CA'; currencyBadge = 'CAD'; }
                        else if (c.universeName === 'IBOV') { marketBadge = '🇧🇷 BR'; currencyBadge = 'BRL'; }
                        else if (isCrypto) { marketBadge = '🪙 Crypto'; currencyBadge = 'USDT'; }

                        return (
                            <div
                                key={c.id}
                                onClick={() => navigate(`/app/asset/${c.universeType === 'CRYPTO' ? 'crypto' : 'stock'}/${c.symbol.toLowerCase()}`)}
                                className="group bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer relative overflow-hidden transition-all"
                            >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-indigo-500/10 to-transparent -mr-8 -mt-8 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />

                                <div className="flex justify-between items-start mb-6 relative">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-neutral-500 font-mono text-sm w-4">#{index + 1}</span>
                                            <h2 className="text-2xl font-bold">{c.symbol}</h2>
                                        </div>
                                        <div className="flex items-center gap-2 pl-6">
                                            <span className="font-mono text-xl text-neutral-200 font-medium">
                                                {livePrices[c.symbol] !== undefined ? (
                                                    livePrices[c.symbol] !== null ? (
                                                        <span>
                                                            {currencyBadge !== 'USD' && <span className="text-xs text-neutral-500 mr-1">{currencyBadge}</span>}
                                                            {livePrices[c.symbol]!.toFixed(2)}
                                                            {currencyBadge !== 'USD' && (
                                                                <span className="text-sm text-indigo-400/80 ml-2" title="USD Equivalent">
                                                                    ≈ ${typeof livePrices[`${c.symbol}_USD`] === 'number' ? livePrices[`${c.symbol}_USD`]!.toFixed(2) : '...'}
                                                                </span>
                                                            )}
                                                            {currencyBadge === 'USD' && <span className="text-xs text-neutral-500 ml-1">USD</span>}
                                                        </span>
                                                    ) : 'N/A'
                                                ) : (
                                                    <span className="animate-pulse opacity-50">...</span>
                                                )}
                                            </span>
                                            {c.ts && (
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                                                    (new Date().getTime() - new Date(c.ts).getTime()) < 24 * 60 * 60 * 1000 ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"
                                                )}>
                                                    {(new Date().getTime() - new Date(c.ts).getTime()) < 24 * 60 * 60 * 1000 ? 'LIVE' : 'DELAYED'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-bold">{marketBadge}</span>
                                            {currencyBadge !== 'USD' && (
                                                <span className="text-[9px] text-indigo-400/60 font-mono uppercase">Normalized to USD for Rankings</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                            Score: {c.score.toFixed(0)}
                                        </div>
                                        {isTracked(c.symbol) ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); untrackMutation.mutate(c.symbol); }}
                                                className="text-amber-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-colors tooltip z-10"
                                                title="Untrack Asset"
                                            >
                                                <Star className="w-5 h-5 fill-current" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); trackMutation.mutate(c.symbol); }}
                                                className="text-neutral-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-colors tooltip z-10"
                                                title="Track Asset"
                                            >
                                                <Star className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 relative">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">6M Return</span>
                                        <span className={metrics.return6m > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                            {metrics.return6m > 0 ? '+' : ''}{metrics.return6m.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">Trend (20d M.A.)</span>
                                        <span className={metrics.trendStrength > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                            {metrics.trendStrength > 0 ? '+' : ''}{metrics.trendStrength?.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">Volatility (Ann.)</span>
                                        <span className="text-neutral-300">{metrics.volatility?.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">Max Drawdown</span>
                                        <span className="text-neutral-300">-{metrics.maxDrawdown?.toFixed(1)}%</span>
                                    </div>
                                </div>

                                {flags.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap gap-1.5 relative">
                                        {flags.map((f: string) => (
                                            <span key={f} className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                {f}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
