import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function DemoDashboard() {
    const navigate = useNavigate();
    const [meta, setMeta] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Mock dashboard view for demo
    const portfolioAssets = [
        { symbol: 'NVDA', type: 'STOCK', entry: 120 },
        { symbol: 'TSLA', type: 'STOCK', entry: 350 }
    ];

    const marketOverview = [
        { symbol: 'MSFT', type: 'STOCK' },
        { symbol: 'META', type: 'STOCK' }
    ];

    const techAUniverse = [
        { symbol: 'AAPL', type: 'STOCK' },
        { symbol: 'GOOG', type: 'STOCK' },
        { symbol: 'AMZN', type: 'STOCK' }
    ];

    useEffect(() => {
        fetch('/api/demo/meta')
            .then(res => res.ok ? res.json() : null)
            .then(data => setMeta(data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-neutral-400 font-mono animate-pulse">Loading static demo environment...</div>;

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
            <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 p-2 text-center text-sm font-medium flex items-center justify-center gap-2">
                <AlertTriangle size={16} />
                <span>DEMO MODE: Static snapshot locked on January 1, 2026. Data is completely offline.</span>
            </div>

            <nav className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <TrendingUp className="text-indigo-400" />
                        <span className="font-bold text-lg tracking-tight">GranStocks <span className="text-neutral-500 font-normal">Demo</span></span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/demo/screener')} className="text-sm text-neutral-400 hover:text-white transition-colors">Screener Preview</button>
                        <button onClick={() => navigate('/register')} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors font-medium">Create Live Account</button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-2">Static Snapshot Overview</h1>
                <p className="text-neutral-400 mb-8 max-w-2xl">
                    This offline environment demonstrates deterministic analytics frozen in time.
                    {meta?.snapshotAnchorDate && ` All calculations are anchored to ${meta.snapshotAnchorDate}.`}
                </p>

                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><TrendingUp className="text-emerald-400 w-5 h-5" /> Portfolio Holdings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {portfolioAssets.map(asset => (
                            <div
                                key={asset.symbol}
                                onClick={() => navigate(`/demo/asset/${asset.type.toLowerCase()}/${asset.symbol.toLowerCase()}`)}
                                className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 cursor-pointer hover:border-indigo-500/50 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] flex justify-between items-center"
                            >
                                <div>
                                    <h3 className="text-2xl font-bold flex items-center gap-2">{asset.symbol} <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase tracking-wider">{asset.type}</span></h3>
                                    <p className="text-sm text-neutral-500 mt-1">Bought at ${asset.entry.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-indigo-400 text-sm font-medium">View Analysis &rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Market Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {marketOverview.map(asset => (
                            <div
                                key={asset.symbol}
                                onClick={() => navigate(`/demo/asset/${asset.type.toLowerCase()}/${asset.symbol.toLowerCase()}`)}
                                className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 transition-all"
                            >
                                <h3 className="text-lg font-bold mb-1">{asset.symbol}</h3>
                                <p className="text-xs text-neutral-500">View deterministic charts and consensus</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Universe: Tech A</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {techAUniverse.map(asset => (
                            <div
                                key={asset.symbol}
                                onClick={() => navigate(`/demo/asset/${asset.type.toLowerCase()}/${asset.symbol.toLowerCase()}`)}
                                className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 cursor-pointer hover:border-indigo-500/50 transition-all"
                            >
                                <h3 className="text-lg font-bold mb-1">{asset.symbol}</h3>
                                <p className="text-xs text-neutral-500">View deterministic charts and consensus</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
