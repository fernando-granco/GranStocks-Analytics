import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Star, Play, Blocks } from 'lucide-react';
import { cn } from '../utils';

export default function DemoDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Mock dashboard view for demo
    const portfolioAssets = [
        { symbol: 'NVDA', type: 'STOCK', entry: 120, current: 186.50, qty: 100 },
        { symbol: 'TSLA', type: 'STOCK', entry: 350, current: 449.72, qty: 50 }
    ];

    const marketOverview = [
        { symbol: 'MSFT', type: 'STOCK', lastPrice: 483.62, rsi14: 65.2, vol20: 0.18, bias: 'Bullish' },
        { symbol: 'META', type: 'STOCK', lastPrice: 660.09, rsi14: 72.1, vol20: 0.22, bias: 'Bullish' }
    ];

    const techAUniverse = [
        { symbol: 'AAPL', type: 'STOCK' },
        { symbol: 'GOOG', type: 'STOCK' },
        { symbol: 'AMZN', type: 'STOCK' }
    ];

    useEffect(() => {
        fetch('/api/demo/meta')
            .finally(() => setLoading(false));
    }, []);

    const totalValue = portfolioAssets.reduce((acc, p) => acc + (p.current * p.qty), 0);
    const costBasis = portfolioAssets.reduce((acc, p) => acc + (p.entry * p.qty), 0);
    const totalPnL = totalValue - costBasis;
    const pnlPercent = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0;
    const isProfit = totalPnL >= 0;

    let bestPerformer = { symbol: 'TSLA', pnlPercent: 28.49, unrealizedPnL: 4986 };

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

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">

                <div className="mb-2">
                    <p className="text-neutral-400 font-medium">Welcome, Demo User</p>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">Overview Dashboard</h1>
                </div>

                {/* Simulated Portfolio Summary Widget */}
                <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-6 shadow-lg mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <Activity size={120} />
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                        <div>
                            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-1">Total Portfolio Value</h2>
                            <p className="text-4xl font-mono font-bold text-white">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <div className="flex items-center gap-2 mt-2">
                                {isProfit ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-rose-400" />}
                                <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isProfit ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
                                </span>
                                <span className="text-xs text-neutral-500 ml-2 border-l border-neutral-700 pl-2">All Time</span>
                            </div>
                        </div>

                        <div className="flex gap-4 md:border-l md:border-neutral-800 md:pl-6 w-full md:w-auto overflow-x-auto">
                            {bestPerformer && bestPerformer.unrealizedPnL > 0 && (
                                <div className="bg-black/20 rounded-lg p-3 min-w-[120px] border border-emerald-900/30">
                                    <p className="text-xs text-neutral-500 mb-1">Top Gainer</p>
                                    <p className="font-bold text-white">{bestPerformer.symbol}</p>
                                    <p className="text-emerald-400 text-sm font-semibold">+{bestPerformer.pnlPercent.toFixed(2)}%</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold tracking-tight">Market Overview</h2>
                    <button
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors opacity-50 cursor-not-allowed"
                        title="Disabled in Demo"
                    >
                        <Play size={16} /> Run Daily Job
                    </button>
                </div>

                {/* Simulated SortableCards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {marketOverview.map(asset => (
                        <div
                            key={asset.symbol}
                            onClick={() => navigate(`/demo/asset/${asset.type.toLowerCase()}/${asset.symbol.toLowerCase()}`)}
                            className={cn(
                                "group p-6 rounded-2xl bg-neutral-900 border transition-all cursor-pointer relative overflow-hidden flex flex-col h-full border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800/80"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="text-neutral-600 p-1 -ml-2 cursor-pointer transition-colors">
                                        <Activity size={18} />
                                    </div>
                                    <h1 className="text-2xl font-bold">{asset.symbol}</h1>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-full",
                                        asset.bias === 'Bullish' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {asset.bias} Bias
                                    </span>
                                    <button
                                        className="text-amber-500 opacity-50 tooltip z-10 p-1 cursor-not-allowed"
                                        title="Untrack Asset (Disabled)"
                                    >
                                        <Star size={16} className="fill-current" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm text-neutral-500 mb-0.5">Last Price</div>
                                    <div className="text-xl font-mono">${asset.lastPrice.toFixed(2)}</div>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-neutral-400">RSI: {asset.rsi14.toFixed(1)}</span>
                                    <span className="text-neutral-400">Vol: {(asset.vol20 * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Custom Universes Section */}
                <div className="pt-8 mt-8 border-t border-neutral-800">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold tracking-tight">Your Custom Universes</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div
                            onClick={() => navigate('/demo/screener')}
                            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 cursor-pointer hover:border-indigo-500/50 transition-all hover:bg-neutral-800/80 group flex flex-col h-full"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                                        <Blocks size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Tech A</h3>
                                        <div className="text-sm text-neutral-500 mt-1">3 symbols</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 flex flex-wrap gap-2">
                                {techAUniverse.map((s) => (
                                    <span key={s.symbol} onClick={(e) => { e.stopPropagation(); navigate(`/demo/asset/${s.type.toLowerCase()}/${s.symbol.toLowerCase()}`); }} className="text-xs bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-md border border-neutral-700 hover:border-indigo-500 transition-colors cursor-pointer">
                                        {s.symbol}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
