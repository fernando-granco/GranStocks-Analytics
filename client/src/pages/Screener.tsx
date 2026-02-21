import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Play, AlertTriangle, Info, DollarSign } from 'lucide-react';
import { cn } from '../utils';
import { useNavigate } from 'react-router-dom';

export default function Screener() {
    const [universe, setUniverse] = useState<'SP500' | 'NASDAQ100' | 'CRYPTO'>('SP500');
    const [livePrices, setLivePrices] = useState<Record<string, { price: number, loading: boolean }>>({});
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const fetchPrice = async (symbol: string, assetType: 'STOCK' | 'CRYPTO', e: React.MouseEvent) => {
        e.stopPropagation();
        if (livePrices[symbol]) return;
        setLivePrices(prev => ({ ...prev, [symbol]: { price: 0, loading: true } }));
        try {
            const res = await fetch(`/api/data/quote?symbol=${symbol}&assetType=${assetType}`);
            if (res.ok) {
                const data = await res.json();
                setLivePrices(prev => ({ ...prev, [symbol]: { price: data.price, loading: false } }));
            } else {
                setLivePrices(prev => ({ ...prev, [symbol]: { price: -1, loading: false } }));
            }
        } catch {
            setLivePrices(prev => ({ ...prev, [symbol]: { price: -1, loading: false } }));
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ['screener', universe],
        queryFn: async () => {
            const res = await fetch(`/api/screener/${universe}`);
            if (!res.ok) throw new Error('Failed to fetch screener data');
            return res.json();
        },
        refetchInterval: (query: any) => query.state.data?.state?.status === 'RUNNING' ? 3000 : false
    });

    const runJobMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/admin/screener/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ universe, date: new Date().toISOString().split('T')[0] })
            });
            if (!res.ok) throw new Error('Failed to start job');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['screener', universe] });
        }
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-bold flex items-center gap-3">
                        <BarChart3 className="text-indigo-400" size={32} />
                        Best Candidates <span className="text-xl font-normal text-neutral-500 ml-2">6M Screener</span>
                    </h1>
                    <p className="text-neutral-400 mt-2">Aggregating deterministic signals (Return, Volatility, Drawdown, Trend Strategy).</p>
                </div>

                {user?.role === 'ADMIN' && (
                    <button
                        onClick={() => runJobMutation.mutate()}
                        disabled={runJobMutation.isPending || data?.state?.status === 'RUNNING'}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shrink-0"
                    >
                        <Play size={16} /> Force Run Job
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-full max-w-sm">
                <button
                    onClick={() => setUniverse('SP500')}
                    className={cn(
                        "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        universe === 'SP500' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    S&P 500
                </button>
                <button
                    onClick={() => setUniverse('NASDAQ100')}
                    className={cn(
                        "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        universe === 'NASDAQ100' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    NASDAQ 100
                </button>
                <button
                    onClick={() => setUniverse('CRYPTO')}
                    className={cn(
                        "flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors",
                        universe === 'CRYPTO' ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
                    )}
                >
                    CRYPTO (Volume)
                </button>
            </div>

            {/* Job State Banner */}
            {data?.state && data.state.status === 'RUNNING' && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        <span className="text-indigo-400 font-medium">Screener job is currently running on the server...</span>
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
                    <h3 className="text-lg font-medium text-neutral-300">No cached results for {universe}</h3>
                    <p className="text-neutral-500 mt-1">Admin must run the screener job to populate the database.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.topCandidates.map((c: any, index: number) => {
                        const metrics = JSON.parse(c.metricsJson);
                        const flags = JSON.parse(c.riskFlagsJson);

                        return (
                            <div
                                key={c.symbol}
                                onClick={() => navigate(`/app/asset/${universe === 'CRYPTO' ? 'crypto' : 'stock'}/${c.symbol.toLowerCase()}`)}
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
                                            {livePrices[c.symbol] ? (
                                                <span className="text-sm font-mono text-neutral-300">
                                                    {livePrices[c.symbol].loading ? '...' : livePrices[c.symbol].price > 0 ? `$${livePrices[c.symbol].price.toFixed(2)}` : 'N/A'}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={(e) => fetchPrice(c.symbol, universe === 'CRYPTO' ? 'CRYPTO' : 'STOCK', e)}
                                                    className="text-neutral-600 hover:text-indigo-400 transition-colors flex items-center gap-1 text-xs"
                                                    title="Load live price"
                                                >
                                                    <DollarSign size={13} /> Price
                                                </button>
                                            )}
                                            {c.ts && (
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                                                    (new Date().getTime() - new Date(c.ts).getTime()) < 24 * 60 * 60 * 1000 ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"
                                                )}>
                                                    {(new Date().getTime() - new Date(c.ts).getTime()) < 24 * 60 * 60 * 1000 ? 'LIVE' : 'DELAYED'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                                        Score: {c.score.toFixed(0)}
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
