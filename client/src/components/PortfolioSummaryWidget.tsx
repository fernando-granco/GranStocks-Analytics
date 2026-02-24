import { useEffect, useState } from 'react';
import { PortfolioPosition } from './PortfolioTracker';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

export function PortfolioSummaryWidget() {
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        fetchPositions();
    }, []);

    const totalValue = positions.reduce((acc, p) => acc + p.currentValue, 0);
    const costBasis = positions.reduce((acc, p) => acc + (p.averageCost * p.quantity), 0);
    const totalPnL = totalValue - costBasis;
    const pnlPercent = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0;
    const isProfit = totalPnL >= 0;

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
        return null; // hide entirely if empty
    }

    return (
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
                    {worstPerformer && worstPerformer.unrealizedPnL < 0 && (
                        <div className="bg-black/20 rounded-lg p-3 min-w-[120px] border border-rose-900/30">
                            <p className="text-xs text-neutral-500 mb-1">Top Loser</p>
                            <p className="font-bold text-white">{worstPerformer.symbol}</p>
                            <p className="text-rose-400 text-sm font-semibold">{worstPerformer.pnlPercent.toFixed(2)}%</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
