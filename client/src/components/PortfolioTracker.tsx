import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    isInvalid?: boolean;
}

export function PortfolioTracker() {
    const [positions, setPositions] = useState<PortfolioPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    const [formSymbol, setFormSymbol] = useState('');
    const [formQty, setFormQty] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formAssetType, setFormAssetType] = useState<'STOCK' | 'CRYPTO'>('STOCK');
    const [showAddForm, setShowAddForm] = useState(false);

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

    const [errorMsg, setErrorMsg] = useState('');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: formSymbol.toUpperCase(),
                    assetType: formAssetType,
                    quantity: parseFloat(formQty),
                    averageCost: parseFloat(formPrice)
                })
            });
            if (res.ok) {
                setFormSymbol('');
                setFormQty('');
                setFormPrice('');
                fetchPositions();
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
                        {t('dashboard.portfolio.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Real-time mock position tracking</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-white/50">{t('dashboard.portfolio.all_time')}</p>
                    <p className="text-2xl font-bold font-mono text-white">${totalValue.toFixed(2)}</p>
                    <p className={`text-sm font-semibold mt-1 ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} P&L
                    </p>
                </div>
            </div>

            <div className="mb-6 border-b border-border pb-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground font-medium">Add manual positions to simulate long-term tracking capability.</p>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="text-sm font-semibold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-white/10"
                >
                    {showAddForm ? t('dashboard.portfolio.cancel') : `+ ${t('dashboard.portfolio.add')}`}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-8 p-4 bg-black/20 rounded-xl border border-white/5">
                    <form onSubmit={handleAdd} className="grid grid-cols-5 gap-4">
                        <input
                            type="text"
                            placeholder="Symbol (e.g. AAPL or BTC)"
                            className="col-span-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase"
                            value={formSymbol}
                            onChange={e => setFormSymbol(e.target.value.toUpperCase())}
                            required
                        />
                        <select
                            value={formAssetType}
                            onChange={e => setFormAssetType(e.target.value as 'STOCK' | 'CRYPTO')}
                            className="col-span-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="STOCK">Stock</option>
                            <option value="CRYPTO">Crypto</option>
                        </select>
                        <input
                            type="number"
                            step="any"
                            placeholder="Quantity"
                            min="0.00000001"
                            className="col-span-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            value={formQty}
                            onChange={e => setFormQty(e.target.value)}
                            required
                        />
                        <input
                            type="number"
                            step="any"
                            placeholder="Avg Cost $"
                            min="0"
                            className="col-span-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            value={formPrice}
                            onChange={e => setFormPrice(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            className="col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
                        >
                            {t('dashboard.portfolio.submit')}
                        </button>
                    </form>
                    {errorMsg && <p className="mt-4 text-sm text-red-400 font-medium">{errorMsg}</p>}
                </div>
            )}
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
                                <th className="px-4 py-3 font-medium rounded-tl-lg">{t('dashboard.portfolio.headers.symbol')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('dashboard.portfolio.qty')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('dashboard.portfolio.headers.entry')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('dashboard.portfolio.headers.price')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('dashboard.portfolio.headers.value')}</th>
                                <th className="px-4 py-3 font-medium text-right">{t('dashboard.portfolio.headers.pnl')}</th>
                                <th className="px-4 py-3 font-medium text-center rounded-tr-lg">{t('dashboard.portfolio.headers.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {positions.map(p => {
                                const isProfit = p.unrealizedPnL >= 0;
                                return (
                                    <tr key={p.id} className={`hover:bg-white/5 transition-colors group ${p.isInvalid ? 'opacity-70' : ''}`}>
                                        <td className="px-4 py-4 font-bold text-white tracking-wide flex items-center gap-2">
                                            {p.symbol}
                                            {p.isInvalid && <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">INVALID</span>}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono">{p.quantity}</td>
                                        <td className="px-4 py-4 text-right font-mono">${p.averageCost.toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-white">${p.currentPrice.toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right font-mono text-white">${p.currentValue.toFixed(2)}</td>
                                        <td className={`px-4 py-4 text-right font-mono font-bold ${p.isInvalid ? 'text-neutral-500' : (isProfit ? 'text-green-400' : 'text-red-400')}`}>
                                            {p.isInvalid ? 'ERR' : `${isProfit ? '+' : ''}${p.unrealizedPnL.toFixed(2)} (${isProfit ? '+' : ''}${p.pnlPercent.toFixed(2)}%)`}
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
