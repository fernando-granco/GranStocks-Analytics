import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function DemoScreener() {
    const navigate = useNavigate();
    const [meta, setMeta] = useState<any>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                <span>DEMO MODE: Background Screener results are frozen and delayed.</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <button
                    onClick={() => navigate('/demo')}
                    className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Demo Hub
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Offline Screener Preview</h1>
                    <p className="text-neutral-500 max-w-2xl">
                        In production, the GranStocks Background Job runner analyzes your chosen universes every hour to surface the best quantitative candidates based on Return, Volatility, Drawdown, and Trend mechanics.
                    </p>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900/50">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-emerald-500 w-5 h-5" />
                            <h2 className="font-semibold">Top SP500 Candidates (Static)</h2>
                        </div>
                        <span className="text-xs font-mono text-neutral-500">
                            Anchored At: {meta?.snapshotAnchorDate || 'Unknown'}
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
