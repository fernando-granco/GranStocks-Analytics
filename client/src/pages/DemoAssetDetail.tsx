import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Activity, ShieldAlert, BarChart3, Database, FlaskConical, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cn } from '../utils';

const TabButton = ({ active, onClick, icon, children }: any) => (
    <button
        onClick={onClick}
        className={cn("flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium whitespace-nowrap transition-all border-b-2", active ? "border-indigo-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50")}
    >
        {icon}
        {children}
    </button>
);

const MetricCard = ({ label, value, isNegative, isPositive }: { label: string, value: string | number, isNegative?: boolean, isPositive?: boolean }) => (
    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
        <div className="text-xs text-neutral-500 font-medium mb-1 uppercase tracking-wider">{label}</div>
        <div className={cn("text-xl font-bold font-mono tracking-tight", isNegative ? 'text-rose-400' : isPositive ? 'text-emerald-400' : 'text-neutral-200')}>
            {value}
        </div>
    </div>
);

export default function DemoAssetDetail() {
    const { assetType, symbol } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'CHART' | 'TECHNICAL' | 'RISK' | 'FIRM_VIEW' | 'EVIDENCE'>('CHART');

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
        volume: data.candles.v[idx]
    })) : [];

    const ind = data.indicators;
    const risk = data.riskFlags;
    const firm = data.firmView;

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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Deterministic Panel */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-0 custom-scrollbar border-b border-neutral-800">
                            <TabButton active={activeTab === 'CHART'} onClick={() => setActiveTab('CHART')} icon={<BarChart3 size={16} />}>Price Action</TabButton>
                            <TabButton active={activeTab === 'TECHNICAL'} onClick={() => setActiveTab('TECHNICAL')} icon={<Activity size={16} />}>Technicals</TabButton>
                            <TabButton active={activeTab === 'RISK'} onClick={() => setActiveTab('RISK')} icon={<ShieldAlert size={16} />}>Risk Flags</TabButton>
                            <TabButton active={activeTab === 'FIRM_VIEW'} onClick={() => setActiveTab('FIRM_VIEW')} icon={<Database size={16} />}>Firm View Roles</TabButton>
                            <TabButton active={activeTab === 'EVIDENCE'} onClick={() => setActiveTab('EVIDENCE')} icon={<FlaskConical size={16} className="text-amber-500" />}>
                                <span className="text-amber-500">Evidence Pack</span>
                            </TabButton>
                        </div>

                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 min-h-[400px]">
                            {activeTab === 'CHART' && (
                                <div className="h-[350px] w-full">
                                    {chartData.length > 0 ? (
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
                                    ) : (
                                        <p className="text-neutral-500">No candle data available in snapshot.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'TECHNICAL' && ind && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Technical Indicators</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <MetricCard label="RSI (14)" value={ind.rsi14?.toFixed(2)} />
                                        <MetricCard label="Volatility (20d)" value={ind.vol20 != null ? `${(ind.vol20 * 100).toFixed(2)}%` : '---'} />
                                        <MetricCard label="Trend (20/50)" value={ind.sma20 > ind.sma50 ? 'BULLISH' : 'BEARISH'} isPositive={ind.sma20 > ind.sma50} isNegative={ind.sma20 <= ind.sma50} />

                                        <MetricCard label="MACD" value={ind.macd?.macd?.toFixed(3)} />
                                        <MetricCard label="Stochastic K" value={ind.stochastic?.k?.toFixed(1)} />
                                        <MetricCard label="ATR (14)" value={ind.atr14?.toFixed(2)} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'RISK' && risk && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-rose-400 border-b border-rose-900/50 pb-2">Risk Analysis</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <MetricCard label="Drawdown from Peak" value={ind.drawdown90 != null ? `${(ind.drawdown90 * 100).toFixed(2)}%` : '---'} isNegative={true} />
                                        <MetricCard label="Data Freshness" value="FROZEN" isNegative={true} />
                                        {ind.dataQualityScore !== undefined && (
                                            <MetricCard label="Data Quality Score" value={`${ind.dataQualityScore}/100`} isNegative={ind.dataQualityScore < 80} />
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'FIRM_VIEW' && firm && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-indigo-400 border-b border-indigo-900/50 pb-2">Analysis Snapshot (Deterministic)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(firm).map(([role, payload]: any) => (
                                            <div key={role} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-sm text-indigo-400">{role}</span>
                                                    <span className={cn("text-xs px-2 py-0.5 rounded font-bold", payload.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : payload.signal === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'bg-neutral-800 text-neutral-400')}>
                                                        {payload.signal}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-neutral-400 leading-relaxed">{payload.reasoning}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'EVIDENCE' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-amber-500 border-b border-amber-900/50 pb-2">Raw Evidence Pack</h3>
                                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                        <p className="text-neutral-500 mb-4">This is the exact JSON payload sent to the LLM. In Demo mode, this is a simulated static view.</p>
                                        <pre className="text-xs text-amber-500/80 font-mono overflow-auto max-h-[400px]">
                                            {JSON.stringify({
                                                asset: symbol,
                                                assetType,
                                                indicators: ind,
                                                firmViews: firm
                                            }, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI / Unlock Panel */}
                    <div className="space-y-6">
                        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-indigo-400">
                                <Sparkles size={20} /> AI Perspectives
                            </h3>
                            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                                Unlock dynamic LLM generation using your own API keys. Compare signals from ChatGPT, Claude, Grok, and DeepSeek against the deterministic models.
                            </p>

                            <button onClick={() => navigate('/register')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 mb-4">
                                Unlock Live Analytics
                            </button>

                            <button onClick={() => navigate('/login')} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white px-8 py-3 rounded-xl font-bold transition-all">
                                Log In
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
