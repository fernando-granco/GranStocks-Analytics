import React, { useEffect, useState } from 'react';

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
}

export function PortfolioTracker() {
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);

    const [formSymbol, setFormSymbol] = useState('');
    const [formQty, setFormQty] = useState('');
    const [formPrice, setFormPrice] = useState('');

    const fetchPositions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/portfolio');
            if (res.ok) {
                const data = await res.json();
                setPositions(data);
            }
        } catch (e) {
            console.error('Failed to fetch portfolio', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPositions();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: formSymbol.toUpperCase(),
                    quantity: parseFloat(formQty),
                    averageCost: parseFloat(formPrice)
                })
            });
            if (res.ok) {
                setFormSymbol('');
                setFormQty('');
                setFormPrice('');
                fetchPositions();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
            if (res.ok) fetchPositions();
        } catch (e) {
            console.error(e);
        }
    };

    const totalValue = positions.reduce((acc, p) => acc + p.currentValue, 0);
    const totalPnL = positions.reduce((acc, p) => acc + p.unrealizedPnL, 0);

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Portfolio Tracker
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Real-time mock position tracking</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-white/50">Total Value</p>
                    <p className="text-2xl font-bold font-mono text-white">${totalValue.toFixed(2)}</p>
                    <p className={`text-sm font-semibold mt-1 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} P&L
                    </p>
                </div>
            </div>

            <form onSubmit={handleAdd} className="grid grid-cols-4 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Symbol (e.g. AAPL)"
                    className="col-span-1 bg-background/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formSymbol}
                    onChange={e => setFormSymbol(e.target.value)}
                    required
                />
                <input
                    type="number"
                    step="any"
                    placeholder="Quantity"
                    className="col-span-1 bg-background/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formQty}
                    onChange={e => setFormQty(e.target.value)}
                    required
                />
                <input
                    type="number"
                    step="any"
                    placeholder="Avg Cost $"
                    className="col-span-1 bg-background/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    required
                />
                <button
                    type="submit"
                    className="col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
                >
                    Add Position
                </button>
            </form>

            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-white/5 rounded w-full"></div>
                    <div className="h-10 bg-white/5 rounded w-full"></div>
                </div>
            ) : positions.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">No positions tracked. Add one above.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle text-muted-foreground">
                        <thead className="text-xs uppercase bg-white/5 text-white/70">
                            <tr>
                                <th className="px-4 py-3 font-medium rounded-tl-lg">Asset</th>
                                <th className="px-4 py-3 font-medium text-right">Qty</th>
                                <th className="px-4 py-3 font-medium text-right">Avg Cost</th>
                                <th className="px-4 py-3 font-medium text-right">Current Price</th>
                                <th className="px-4 py-3 font-medium text-right">Total Value</th>
                                <th className="px-4 py-3 font-medium text-right">Unrealized P&L</th>
                                <th className="px-4 py-3 font-medium text-center rounded-tr-lg">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {positions.map(p => {
                                const isProfit = p.unrealizedPnL >= 0;
                                return (
                                    <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-4 font-bold text-white tracking-wide">{p.symbol}</td>
                                        <td className="px-4 py-4 text-right font-mono">{p.quantity}</td>
                                        <td className="px-4 py-4 text-right font-mono">${p.averageCost.toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-white">${p.currentPrice.toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-white">${p.currentValue.toFixed(2)}</td>
                                        <td className={`px-4 py-4 text-right font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                            {isProfit ? '+' : ''}{p.unrealizedPnL.toFixed(2)} ({isProfit ? '+' : ''}{p.pnlPercent.toFixed(2)}%)
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs uppercase font-bold tracking-wider"
                                            >
                                                Drop
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
