import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DemoAssetDetail() {
    const { assetType, symbol } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/demo/asset/${assetType?.toUpperCase()}/${symbol?.toUpperCase()}`)
            .then(res => res.ok ? res.json() : res.json().then(e => Promise.reject(e)))
            .then(d => setData(d))
            .catch(e => setError(e.error || 'Failed to load demo data'))
            .finally(() => setLoading(false));
    }, [assetType, symbol]);

    if (loading) return <div className="p-8 text-neutral-400 animate-pulse">Loading static evidence...</div>;
    if (error) return <div className="p-8 text-rose-500">{error}</div>;
    if (!data) return null;

    const price = data.quote?.price || 0;
    const change = data.quote?.change || 0;
    const isPositive = change >= 0;

    const chartData = data.candles?.t ? data.candles.t.map((timestamp: number, idx: number) => ({
        date: new Date(timestamp * 1000).toLocaleDateString(),
        price: data.candles.c[idx],
    })) : [];

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-20">
            <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 p-2 text-center text-sm font-medium flex items-center justify-center gap-2">
                <AlertTriangle size={16} />
                <span>DEMO MODE: {symbol} data is frozen and delayed.</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <button
                    onClick={() => navigate('/demo')}
                    className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Demo Hub
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
                            <span className="px-2 py-0.5 mt-1 bg-neutral-800 text-neutral-400 rounded text-xs font-bold tracking-widest uppercase">{assetType}</span>
                        </div>
                        <p className="text-neutral-500 text-sm">Offline Analytics Engine Preview</p>
                    </div>

                    <div className="text-left md:text-right">
                        <div className="text-3xl font-bold tracking-tight">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}{change.toFixed(2)}% (Static 6M Return)
                        </div>
                    </div>
                </div>

                <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-6 flex items-center justify-center min-h-[400px]">
                    {chartData.length > 0 ? (
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                    <XAxis dataKey="date" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                    <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} tickFormatter={v => `$${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                        itemStyle={{ color: '#a78bfa' }}
                                    />
                                    <Line type="monotone" dataKey="price" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#818cf8', stroke: '#312e81', strokeWidth: 2 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-neutral-500">No candle data available in snapshot.</p>
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <button onClick={() => navigate('/register')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20">
                        Unlock Live Analytics & BYOK Setup
                    </button>
                </div>
            </div>
        </div>
    );
}
