import React, { useEffect, useState, useCallback } from 'react';
import { usePortfolios } from '../context/PortfolioContext';
import { Trash2 } from 'lucide-react';

export interface PortfolioPosition {
    id: string;
    symbol: string;
    assetType: 'STOCK' | 'CRYPTO';
    quantity: number;
    averageCost: number;
    acquiredAt: string;
    currentPrice: number;
    currentValue: number;
    unrealizedPnL: number;
    pnlPercent: number;
    fees?: number;
    isInvalid?: boolean;
    currency: string;
    currentPriceBase: number;
    currentValueBase: number;
    unrealizedPnLBase: number;
}

interface PortfolioTrackerProps {
    onPositionsUpdated?: () => void;
}

export function PortfolioTracker({ onPositionsUpdated }: PortfolioTrackerProps) {
    const { selectedPortfolio } = usePortfolios();
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);

    const [formSymbol, setFormSymbol] = useState('');
    const [formQty, setFormQty] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formFees, setFormFees] = useState('');
    const [formAssetType, setFormAssetType] = useState<'STOCK' | 'CRYPTO'>('STOCK');
    const [showAddForm, setShowAddForm] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const fetchPositions = useCallback(async () => {
        if (!selectedPortfolio) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio?portfolioId=${selectedPortfolio.id}`);
            if (res.status === 401) return;
            if (res.ok) {
                const data = await res.json();
                setPositions(data);
            }
        } catch (e) {
            console.error('Failed to fetch portfolio', e);
        } finally {
            setLoading(false);
        }
    }, [selectedPortfolio]);

    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPortfolio) return;
        setErrorMsg('');
        try {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    portfolioId: selectedPortfolio.id,
                    symbol: formSymbol.toUpperCase(),
                    assetType: formAssetType,
                    quantity: parseFloat(formQty),
                    averageCost: parseFloat(formPrice),
                    acquiredAt: new Date(formDate).toISOString(),
                    fees: formFees ? parseFloat(formFees) : 0
                })
            });
            if (res.ok) {
                setFormSymbol('');
                setFormQty('');
                setFormPrice('');
                setFormDate(new Date().toISOString().split('T')[0]);
                setFormFees('');
                fetchPositions();
                if (onPositionsUpdated) onPositionsUpdated();
            } else {
                const data = await res.json();
                setErrorMsg(data.error || 'Failed to add position');
            }
        } catch (e) {
            console.error(e);
            setErrorMsg('A network error occurred');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this position?')) return;
        try {
            const res = await fetch(`/api/portfolio/position/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchPositions();
                if (onPositionsUpdated) onPositionsUpdated();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const baseCurrency = selectedPortfolio?.baseCurrency || 'USD';

    return (
        <div className="bg-neutral-900/40 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">Positions</h3>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold mt-1">Managed in {baseCurrency}</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-all"
                >
                    {showAddForm ? 'Cancel' : '+ New Position'}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-8 p-6 bg-black/40 rounded-xl border border-neutral-800 animate-in fade-in zoom-in-95 duration-200">
                    <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">Symbol</label>
                            <input
                                type="text"
                                placeholder="AAPL / PETR4.SA"
                                className="bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase"
                                value={formSymbol}
                                onChange={e => setFormSymbol(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">Type</label>
                            <select
                                value={formAssetType}
                                onChange={e => setFormAssetType(e.target.value as 'STOCK' | 'CRYPTO')}
                                className="bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="STOCK">Stock</option>
                                <option value="CRYPTO">Crypto</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">Quantity</label>
                            <input
                                type="number"
                                step="any"
                                className="bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                value={formQty}
                                onChange={e => setFormQty(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">Avg Cost (Native)</label>
                            <input
                                type="number"
                                step="any"
                                className="bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                value={formPrice}
                                onChange={e => setFormPrice(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">Date</label>
                            <input
                                type="date"
                                className="bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                value={formDate}
                                onChange={e => setFormDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase">&nbsp;</label>
                            <button
                                type="submit"
                                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 rounded-lg text-sm transition-all"
                            >
                                Add Position
                            </button>
                        </div>
                    </form>
                    {errorMsg && <p className="mt-4 text-xs text-rose-400 font-bold">{errorMsg}</p>}
                </div>
            )}

            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-white/5 rounded w-full"></div>
                    <div className="h-10 bg-white/5 rounded w-full"></div>
                </div>
            ) : positions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl bg-black/10">
                    <p className="text-neutral-500 text-sm">No positions found in this portfolio.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle">
                        <thead className="text-[10px] uppercase font-bold text-neutral-500 border-b border-neutral-800">
                            <tr>
                                <th className="px-4 py-3">Asset</th>
                                <th className="px-4 py-3 text-right">Quantity</th>
                                <th className="px-4 py-3 text-right">Entry Price</th>
                                <th className="px-4 py-3 text-right">Current Price</th>
                                <th className="px-4 py-3 text-right">Market Value ({baseCurrency})</th>
                                <th className="px-4 py-3 text-right">P&L ({baseCurrency})</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {positions.map(p => {
                                const isProfit = p.unrealizedPnL >= 0;
                                const isNativeDiff = p.currency !== baseCurrency;
                                return (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white flex items-center gap-2">
                                                    {p.symbol}
                                                    {isNativeDiff && <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1 py-0.5 rounded uppercase font-black">{p.currency}</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono text-neutral-300">{p.quantity.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right font-mono text-neutral-300">
                                            {p.averageCost.toLocaleString(undefined, { style: 'currency', currency: p.currency })}
                                        </td>
                                        <td className="px-4 py-4 text-right text-white">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono font-bold">{p.currentPrice.toLocaleString(undefined, { style: 'currency', currency: p.currency })}</span>
                                                {isNativeDiff && (
                                                    <span className="text-[10px] text-neutral-500 font-mono">
                                                        ≈ {p.currentPriceBase.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-white">
                                            {p.currentValue.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                        </td>
                                        <td className={`px-4 py-4 text-right font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            <div className="flex flex-col items-end">
                                                <span>{isProfit ? '+' : ''}{p.unrealizedPnL.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}</span>
                                                <span className="text-[10px] opacity-80">{isProfit ? '+' : ''}{p.pnlPercent.toFixed(2)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-2 text-neutral-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
