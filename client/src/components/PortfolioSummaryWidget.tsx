import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortfolioPosition } from './PortfolioTracker';
import { Activity, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Sparkles, FolderDot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { PortfolioTracker } from './PortfolioTracker';
import { usePreferences } from '../context/PreferencesContext';

export function PortfolioSummaryWidget() {
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [timeSpan, setTimeSpan] = useState('ALL_TIME');
    const { hideEmptyPortfolio } = usePreferences();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [history, setHistory] = useState<any[]>([]);

    const fetchPositions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/portfolio');
            if (res.ok) setPositions(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/portfolio/historical?range=${timeSpan}`);
            if (res.ok) setHistory(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [timeSpan]); // Refetch chart history when timespan changes

    const liveTotalValue = positions.reduce((acc, p) => acc + p.currentValue, 0);
    const liveCostBasis = positions.reduce((acc, p) => acc + (p.averageCost * p.quantity), 0);

    let displayValue = liveTotalValue;
    let displayPnL = liveTotalValue - liveCostBasis;
    let displayPercent = liveCostBasis > 0 ? (displayPnL / liveCostBasis) * 100 : 0;

    if (timeSpan !== 'ALL_TIME' && history.length > 0) {
        // Range-bound PnL calculation
        const startValue = history[0].totalValue || liveCostBasis;
        displayPnL = liveTotalValue - startValue;
        displayPercent = startValue > 0 ? (displayPnL / startValue) * 100 : 0;
    }

    const isProfit = displayPnL >= 0;

    let bestPerformer = positions.length > 0 ? positions.reduce((prev, curr) => (prev.pnlPercent > curr.pnlPercent) ? prev : curr) : null;
    let worstPerformer = positions.length > 0 ? positions.reduce((prev, curr) => (prev.pnlPercent < curr.pnlPercent) ? prev : curr) : null;

    if (loading) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm animate-pulse h-32">
                <div className="h-4 bg-white/10 w-32 rounded mb-4"></div>
                <div className="h-8 bg-white/10 w-48 rounded"></div>
            </div>
        );
    }

    if (positions.length === 0) {
        if (hideEmptyPortfolio) return null;

        return (
            <div className="mb-8 relative p-8 md:p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 flex flex-col items-center justify-center">
                <FolderDot className="h-10 w-10 text-neutral-600 mb-3" />
                <h3 className="text-base font-medium text-neutral-300">No Portfolio Data</h3>
                <p className="text-sm text-neutral-500 mt-1 mb-6">Add assets to start tracking P&L and generating AI analysis.</p>

                {isExpanded ? (
                    <div className="w-full text-left animate-in fade-in zoom-in-95 duration-200">
                        <PortfolioTracker />
                    </div>
                ) : (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        {t('dashboard.portfolio.add', 'Add Position')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mb-8 relative">
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="group bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-6 pb-8 shadow-lg relative overflow-hidden cursor-pointer hover:border-neutral-700 transition-colors"
                title="Click to toggle Portfolio Tracker"
            >
                {/* Background Chart */}
                {history.length > 0 ? (
                    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ left: '-10px', right: '-10px', bottom: '-10px' }}>
                        <ResponsiveContainer width="105%" height="110%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isProfit ? '#34d399' : '#f87171'} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={isProfit ? '#34d399' : '#f87171'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <YAxis domain={['dataMin - (dataMin * 0.01)', 'dataMax + (dataMax * 0.01)']} hide />
                                <Area type="monotone" dataKey="totalValue" stroke={isProfit ? '#10b981' : '#ef4444'} fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <Activity size={120} />
                    </div>
                )}

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-1">{t('dashboard.portfolio.title')}</h2>
                        <p className="text-4xl font-mono font-bold text-white">${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <div className="flex items-center gap-2 mt-2">
                            {isProfit ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-rose-400" />}
                            <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isProfit ? '+' : ''}${displayPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? '+' : ''}{displayPercent.toFixed(2)}%)
                            </span>
                            <select
                                value={timeSpan}
                                onChange={(e) => { e.stopPropagation(); setTimeSpan(e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-transparent text-xs text-neutral-500 ml-2 border-l border-neutral-700 pl-2 outline-none cursor-pointer hover:text-white transition-colors"
                            >
                                <option value="1M" className="bg-neutral-900 text-white">1 Month</option>
                                <option value="6M" className="bg-neutral-900 text-white">6 Months</option>
                                <option value="YTD" className="bg-neutral-900 text-white">YTD</option>
                                <option value="1Y" className="bg-neutral-900 text-white">1 Year</option>
                                <option value="ALL_TIME" className="bg-neutral-900 text-white">{t('dashboard.portfolio.all_time')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4 md:border-l md:border-neutral-800 md:pl-6 w-full md:w-auto overflow-x-auto">
                        {bestPerformer && bestPerformer.unrealizedPnL > 0 && (
                            <div className="bg-black/20 rounded-lg p-3 min-w-[120px] border border-emerald-900/30">
                                <p className="text-xs text-neutral-500 mb-1">{t('dashboard.portfolio.top_gainer')}</p>
                                <p className="font-bold text-white">{bestPerformer.symbol}</p>
                                <p className="text-emerald-400 text-sm font-semibold">+{bestPerformer.pnlPercent.toFixed(2)}%</p>
                            </div>
                        )}
                        {worstPerformer && worstPerformer.unrealizedPnL < 0 && (
                            <div className="bg-black/20 rounded-lg p-3 min-w-[120px] border border-rose-900/30">
                                <p className="text-xs text-neutral-500 mb-1">{t('dashboard.portfolio.top_loser')}</p>
                                <p className="font-bold text-white">{worstPerformer.symbol}</p>
                                <p className="text-rose-400 text-sm font-semibold">{worstPerformer.pnlPercent.toFixed(2)}%</p>
                            </div>
                        )}

                        <button
                            onClick={(e) => { e.stopPropagation(); navigate('/app/portfolio-analysis'); }}
                            className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-lg p-3 min-w-[120px] transition-colors flex flex-col items-center justify-center gap-1 h-full"
                        >
                            <Sparkles size={16} />
                            <span className="text-xs font-bold leading-tight text-center">AI Analysis<br />& Charts</span>
                        </button>
                    </div>

                    {/* Toggle Icon */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-neutral-500 transition-colors group-hover:text-white hidden sm:block">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            {/* Dropped down Portfolio Tracker */}
            {isExpanded && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <PortfolioTracker />
                </div>
            )}
        </div>
    );
}
