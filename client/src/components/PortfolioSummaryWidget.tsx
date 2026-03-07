import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortfolioPosition } from './PortfolioTracker';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, FolderDot, Plus, BarChart3 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { PortfolioTracker } from './PortfolioTracker';
import { usePortfolios } from '../context/PortfolioContext';

function PortfolioSummaryCard({ portfolio }: { portfolio: any }) {
    const navigate = useNavigate();
    const { setSelectedPortfolioId } = usePortfolios();
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [timeSpan, setTimeSpan] = useState('ALL_TIME');
    const [history, setHistory] = useState<any[]>([]);

    const fetchPositions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio?portfolioId=${portfolio.id}`);
            if (res.status === 401) return;
            if (res.ok) setPositions(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/portfolio/historical?range=${timeSpan}&portfolioId=${portfolio.id}`);
            if (res.ok) setHistory(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [portfolio.id]);

    useEffect(() => {
        fetchHistory();
    }, [timeSpan, portfolio.id]);

    const liveTotalValue = positions.reduce((acc, p) => acc + (p.currentValue || 0), 0);
    const livePnL = positions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
    const liveCostBasis = liveTotalValue - livePnL;

    let displayValue = liveTotalValue;
    let displayPnL = livePnL;
    let displayPercent = liveCostBasis > 0 ? (displayPnL / liveCostBasis) * 100 : 0;

    if (timeSpan !== 'ALL_TIME' && history.length > 0) {
        const startValue = history[0].totalValue || liveCostBasis;
        displayPnL = liveTotalValue - startValue;
        displayPercent = startValue > 0 ? (displayPnL / startValue) * 100 : 0;
    }

    const isProfit = displayPnL >= 0;
    const baseCurrency = portfolio.baseCurrency || 'USD';
    let bestPerformer = positions.length > 0 ? positions.reduce((prev, curr) => (prev.pnlPercent > curr.pnlPercent) ? prev : curr) : null;

    if (loading && positions.length === 0) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm animate-pulse h-32 mb-6">
                <div className="h-4 bg-white/10 w-32 rounded mb-4"></div>
                <div className="h-8 bg-white/10 w-48 rounded"></div>
            </div>
        );
    }

    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold tracking-tight text-neutral-100">{portfolio.name}</h2>
                    <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border border-indigo-500/20">{baseCurrency}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1 hidden sm:flex">
                        {['1M', '3M', '6M', 'YTD', '1Y', 'ALL_TIME'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeSpan(range)}
                                className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${timeSpan === range ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                            >
                                {range === 'ALL_TIME' ? 'All Time' : range}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            setSelectedPortfolioId(portfolio.id);
                            navigate('/app/portfolio-analysis');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500 rounded-lg transition-all"
                    >
                        <BarChart3 className="w-4 h-4" /> Analyze
                    </button>
                </div>
            </div>

            {positions.length === 0 ? (
                <div className="relative p-6 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 flex flex-col items-center justify-center">
                    <FolderDot className="h-8 w-8 text-neutral-600 mb-2" />
                    <h3 className="text-sm font-medium text-neutral-300">Portfolio Empty</h3>
                    <p className="text-xs text-neutral-500 mt-1 mb-4">Add assets to start tracking.</p>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsExpanded(!isExpanded)} className="px-5 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                            {isExpanded ? 'Close' : 'Add Position'}
                        </button>
                        <button onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this empty portfolio?')) {
                                try {
                                    const res = await fetch(`/api/portfolio/${portfolio.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                        window.location.reload();
                                    } else {
                                        const data = await res.json();
                                        alert(data.error || 'Failed to delete portfolio');
                                    }
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                        }} className="px-4 py-2 text-sm text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 font-medium rounded-lg transition-colors">
                            Delete Portfolio
                        </button>
                    </div>
                    {isExpanded && (
                        <div className="w-full mt-6 text-left animate-in fade-in zoom-in-95 duration-200">
                            <PortfolioTracker portfolio={portfolio} onPositionsUpdated={fetchPositions} />
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm relative group transition-all hover:border-neutral-700">
                    <div className="p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="z-10 relative">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Market Value</span>
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
                                    {displayValue.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                </span>
                                <div className={`flex items-center gap-1 text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                    <span>{isProfit ? '+' : ''}{displayPercent.toFixed(2)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 z-10 relative">
                            {bestPerformer && (
                                <div className="hidden lg:block text-right">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Top Gain</span>
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="text-xs font-bold text-white">{bestPerformer.symbol}</span>
                                        <span className="text-xs font-bold text-emerald-400">+{bestPerformer.pnlPercent.toFixed(1)}%</span>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-transparent hover:border-white/10">
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="h-24 w-full relative -mt-4 opacity-80 pointer-events-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history.length > 0 ? history : [{ totalValue: 0 }, { totalValue: 0 }]}>
                                <defs>
                                    <linearGradient id={`gradientVal-${portfolio.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isProfit ? "#10b981" : "#f43f5e"} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={isProfit ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="totalValue" stroke={isProfit ? "#10b981" : "#f43f5e"} strokeWidth={2} fillOpacity={1} fill={`url(#gradientVal-${portfolio.id})`} animationDuration={1000} />
                                <YAxis hide domain={['auto', 'auto']} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {isExpanded && (
                        <div className="border-t border-neutral-800 bg-black/40 p-4 animate-in slide-in-from-top-2 duration-300 z-10 relative">
                            <div className="mb-2 sm:hidden flex items-center justify-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                                {['1M', '3M', '6M', 'YTD', '1Y', 'ALL_TIME'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeSpan(range)}
                                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${timeSpan === range ? 'bg-indigo-500/20 text-indigo-400' : 'text-neutral-400 hover:text-white'}`}
                                    >
                                        {range === 'ALL_TIME' ? 'All Time' : range}
                                    </button>
                                ))}
                            </div>
                            <PortfolioTracker portfolio={portfolio} onPositionsUpdated={fetchPositions} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function PortfolioSummaryWidget() {
    const { portfolios, refreshPortfolios } = usePortfolios();
    const [isCreating, setIsCreating] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('USD');

    const handleCreatePortfolio = async () => {
        if (!newPortfolioName) return;
        try {
            const res = await fetch('/api/portfolio/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPortfolioName, baseCurrency: newPortfolioCurrency })
            });
            if (res.ok) {
                await refreshPortfolios();
                setIsCreating(false);
                setNewPortfolioName('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="mb-10 w-full flex flex-col gap-2 relative z-0">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-neutral-400 font-bold tracking-tight uppercase text-xs">Your Portfolios</h3>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> New
                </button>
            </div>

            {isCreating && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="Portfolio Name"
                            value={newPortfolioName}
                            onChange={(e) => setNewPortfolioName(e.target.value)}
                            className="flex-1 bg-black/40 border border-neutral-700 text-sm py-1.5 px-3 rounded-lg focus:border-indigo-500 outline-none text-white"
                        />
                        <select
                            value={newPortfolioCurrency}
                            onChange={(e) => setNewPortfolioCurrency(e.target.value)}
                            className="bg-black/40 border border-neutral-700 text-sm py-1.5 px-3 rounded-lg focus:border-indigo-500 outline-none text-white"
                        >
                            <option value="USD">USD</option>
                            <option value="BRL">BRL</option>
                            <option value="CAD">CAD</option>
                        </select>
                        <div className="flex gap-2">
                            <button onClick={handleCreatePortfolio} className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all">Create</button>
                            <button onClick={() => setIsCreating(false)} className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-sm font-medium rounded-lg transition-all">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col">
                {portfolios.map(p => (
                    <PortfolioSummaryCard key={p.id} portfolio={p} />
                ))}
            </div>
        </div>
    );
}
