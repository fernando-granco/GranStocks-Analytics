import { useEffect, useState } from 'react';
import { PortfolioPosition } from './PortfolioTracker';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, FolderDot, Plus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { PortfolioTracker } from './PortfolioTracker';
import { usePortfolios } from '../context/PortfolioContext';

export function PortfolioSummaryWidget() {
    const { portfolios, selectedPortfolio, setSelectedPortfolioId, refreshPortfolios } = usePortfolios();
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [timeSpan, setTimeSpan] = useState('ALL_TIME');

    const [history, setHistory] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [newPortfolioCurrency, setNewPortfolioCurrency] = useState('USD');

    const fetchPositions = async () => {
        if (!selectedPortfolio) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio?portfolioId=${selectedPortfolio.id}`);
            if (res.status === 401) return;
            if (res.ok) setPositions(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!selectedPortfolio) return;
        try {
            const res = await fetch(`/api/portfolio/historical?range=${timeSpan}&portfolioId=${selectedPortfolio.id}`);
            if (res.ok) setHistory(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, [selectedPortfolio]);

    useEffect(() => {
        fetchHistory();
    }, [timeSpan, selectedPortfolio]);

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
    const baseCurrency = selectedPortfolio?.baseCurrency || 'USD';

    let bestPerformer = positions.length > 0 ? positions.reduce((prev, curr) => (prev.pnlPercent > curr.pnlPercent) ? prev : curr) : null;

    if (loading && !isCreating && positions.length === 0) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm animate-pulse h-32">
                <div className="h-4 bg-white/10 w-32 rounded mb-4"></div>
                <div className="h-8 bg-white/10 w-48 rounded"></div>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <select
                        value={selectedPortfolio?.id || ''}
                        onChange={(e) => setSelectedPortfolioId(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium"
                    >
                        {portfolios.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.baseCurrency})</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setIsCreating(!isCreating)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
                        title="New Portfolio"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {['1M', '3M', '6M', 'YTD', '1Y', 'ALL_TIME'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeSpan(range)}
                            className={`px-2 py-1 text-[10px] font-bold rounded ${timeSpan === range ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-neutral-50'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
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

            {positions.length === 0 ? (
                <div className="relative p-8 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 flex flex-col items-center justify-center">
                    <FolderDot className="h-10 w-10 text-neutral-600 mb-3" />
                    <h3 className="text-base font-medium text-neutral-300">Portfolio Empty</h3>
                    <p className="text-sm text-neutral-500 mt-1 mb-6">Add assets to start tracking.</p>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                        {isExpanded ? 'Close' : 'Add Position'}
                    </button>
                    {isExpanded && (
                        <div className="w-full mt-8 text-left animate-in fade-in zoom-in-95 duration-200">
                            <PortfolioTracker onPositionsUpdated={fetchPositions} />
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm relative group">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Market Value</span>
                                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Base: {baseCurrency}</span>
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
                                    {displayValue.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                </span>
                                <div className={`flex items-center gap-1 text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                    <span>{isProfit ? '+' : ''}{displayPercent.toFixed(2)}%</span>
                                    <span className="opacity-60 font-medium">({displayPnL.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })})</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {bestPerformer && (
                                <div className="hidden lg:block text-right">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Top Gain</span>
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="text-sm font-bold text-white">{bestPerformer.symbol}</span>
                                        <span className="text-sm font-bold text-emerald-400">+{bestPerformer.pnlPercent.toFixed(1)}%</span>
                                    </div>
                                </div>
                            )}
                            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                                {isExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>

                    <div className="h-32 w-full relative -mb-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history.length > 0 ? history : [{ totalValue: 0 }, { totalValue: 0 }]}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isProfit ? "#10b981" : "#f43f5e"} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={isProfit ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="totalValue" stroke={isProfit ? "#10b981" : "#f43f5e"} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" animationDuration={1000} />
                                <YAxis hide domain={['auto', 'auto']} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {isExpanded && (
                        <div className="border-t border-neutral-800 bg-black/20 animate-in slide-in-from-top-2 duration-300">
                            <PortfolioTracker onPositionsUpdated={fetchPositions} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
