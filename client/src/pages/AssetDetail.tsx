import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Cpu, AlertTriangle, Sparkles, Activity, ShieldAlert, BarChart3, Database, FlaskConical, Blocks, Server, Newspaper } from 'lucide-react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../utils';

const CustomizedCandlestick = (props: any) => {
    const { x, y, width, height, payload } = props;
    const { open, close, high, low } = payload;

    const isGrowing = close >= open;
    const color = isGrowing ? '#34d399' : '#fb7185'; // emerald-400 : rose-400

    const priceRange = high - low;
    let openY = y;
    let closeY = y + height;

    if (priceRange > 0) {
        openY = y + ((high - open) / priceRange) * height;
        closeY = y + ((high - close) / priceRange) * height;
    } else {
        openY = y;
        closeY = y;
    }

    const rectTop = Math.min(openY, closeY);
    let rectHeight = Math.abs(openY - closeY);
    if (rectHeight < 1) rectHeight = 1;

    const centerX = x + width / 2;

    return (
        <g>
            <line stroke={color} x1={centerX} x2={centerX} y1={y} y2={y + height} />
            <rect fill={color} stroke={color} x={x} y={rectTop} width={width} height={rectHeight} />
        </g>
    );
};

export default function AssetDetail({ symbol, assetType, onBack }: { symbol: string, assetType: 'STOCK' | 'CRYPTO', onBack: () => void }) {
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [generatedNarratives, setGeneratedNarratives] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'CHART' | 'TECHNICAL' | 'FUNDAMENTALS' | 'EARNINGS' | 'NEWS' | 'RISK' | 'FIRM_VIEW' | 'EVIDENCE'>('CHART');
    const [range, setRange] = useState<string>('6m');
    const [realtimeAnalysis, setRealtimeAnalysis] = useState<any>(null);
    const [isLoadingRealtime, setIsLoadingRealtime] = useState(false);

    const { data: summary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['assetSummary', symbol, assetType, range],
        queryFn: async () => {
            const res = await fetch(`/api/asset/summary?symbol=${symbol}&assetType=${assetType}&range=${range}`);
            if (!res.ok) throw new Error('Failed to fetch summary');
            return res.json();
        }
    });

    const { data: analysisConfigs } = useQuery({
        queryKey: ['analysisConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/analysis');
            if (!res.ok) return [];
            return res.json();
        }
    });
    const activePresetName = analysisConfigs?.find((c: any) => c.isActive)?.name || 'Default Strategy';

    const { data: fundamentals, isLoading: isLoadingFundamentals } = useQuery({
        queryKey: ['assetFundamentals', symbol, assetType],
        queryFn: async () => {
            const res = await fetch(`/api/data/fundamentals?symbol=${symbol}&assetType=${assetType}`);
            if (!res.ok) return null;
            return res.json();
        }
    });

    const { data: earnings, isLoading: isLoadingEarnings } = useQuery({
        queryKey: ['assetEarnings', symbol, assetType],
        queryFn: async () => {
            const res = await fetch(`/api/data/earnings?symbol=${symbol}&assetType=${assetType}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: news, isLoading: isLoadingNews } = useQuery({
        queryKey: ['assetNews', symbol, assetType],
        queryFn: async () => {
            const res = await fetch(`/api/data/news?symbol=${symbol}&assetType=${assetType}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const aiMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    symbols: [symbol],
                    llmConfigIds: selectedProviders,
                    force: false
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate AI narrative');
            return data;
        },
        onSuccess: (data) => {
            setGeneratedNarratives(data.results || data);
            if (data.errors?.length > 0) {
                console.warn('[AI] Some providers failed:', data.errors);
            }
        }
    });

    const toggleProvider = (id: string) => {
        if (selectedProviders.includes(id)) {
            setSelectedProviders(v => v.filter(i => i !== id));
        } else {
            setSelectedProviders(v => [...v, id]);
        }
    };

    // Prefer DB snapshot, fallback to realtime
    const effectiveIndicators = summary?.indicators || realtimeAnalysis?.indicators || null;
    const effectiveFirmView = (summary?.firmView && Object.keys(summary.firmView).length > 0)
        ? summary.firmView : realtimeAnalysis?.firmView || null;
    const effectiveEvidencePack = summary?.evidencePack || realtimeAnalysis?.evidencePack || null;

    const fetchRealtimeAnalysis = async () => {
        if (realtimeAnalysis || isLoadingRealtime) return;
        setIsLoadingRealtime(true);
        try {
            const res = await fetch(`/api/asset/realtime-analysis?symbol=${symbol}&assetType=${assetType}`);
            if (res.ok) setRealtimeAnalysis(await res.json());
        } catch { }
        finally { setIsLoadingRealtime(false); }
    };

    // Auto-trigger analysis when page loads if no cached summary exists
    useEffect(() => {
        if (!isLoadingSummary && !summary?.indicators) {
            fetchRealtimeAnalysis();
        }
    }, [isLoadingSummary, symbol, assetType]);

    // Prepare chart data format
    const chartData = summary?.candles?.c ? summary.candles.t.map((timestamp: number, idx: number) => {
        const dt = new Date(timestamp * 1000);
        return {
            date: dt.toLocaleDateString(),
            price: summary.candles.c[idx],
            open: summary.candles.o[idx],
            close: summary.candles.c[idx],
            high: summary.candles.h[idx],
            low: summary.candles.l[idx],
            bounds: [summary.candles.l[idx], summary.candles.h[idx]],
            volume: summary.candles.v?.[idx] || 0
        };
    }) : [];

    // Deterministic Algorithm Signal from backend
    const oneDayPrediction = summary?.predictions?.find((p: any) => p.horizonDays === 1);
    const algoAction = oneDayPrediction ? (oneDayPrediction.predictedReturnPct > 0.05 ? 'BUY' : oneDayPrediction.predictedReturnPct < -0.05 ? 'SELL' : 'HOLD') : 'HOLD';
    const algoConfidence = oneDayPrediction ? `${Math.round(oneDayPrediction.confidence * 100)}%` : 'N/A';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={onBack} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                &larr; Back to Dashboard
            </button>

            {isLoadingSummary ? (
                <div className="h-64 flex items-center justify-center animate-pulse text-neutral-500">Loading comprehensive analytics...</div>
            ) : summary ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-4xl font-bold flex items-center gap-3">
                                {symbol}
                                <span className={cn("text-sm px-2 py-0.5 rounded-full font-semibold", assetType === 'CRYPTO' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400')}>{assetType}</span>
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-2xl font-mono">${summary.quote?.price != null ? summary.quote.price.toFixed(2) : '---'}</span>
                                <span className={cn("text-lg font-medium", (summary.quote?.changePct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                    {(summary.quote?.changePct || 0) >= 0 ? '+' : ''}{summary.quote?.changePct != null ? summary.quote.changePct.toFixed(2) : '0.00'}%
                                </span>
                                <span className="text-xs text-neutral-500 flex items-center gap-1"><Database size={12} /> {summary.quote?.source || 'N/A'}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-xs font-medium">
                                    Analyzing via: {activePresetName}
                                </span>
                                {oneDayPrediction && (
                                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-0.5" title={oneDayPrediction.explanationText}>
                                        <Cpu size={12} className="text-amber-400" />
                                        <span className="text-xs text-neutral-400 font-semibold tracking-wide uppercase">AI Bias (1D):</span>
                                        <span className={cn("text-xs font-bold", algoAction === 'BUY' ? "text-emerald-400" : algoAction === 'SELL' ? "text-rose-400" : "text-neutral-300")}>
                                            {algoAction} ({algoConfidence})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Deterministic Panel */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Tabs */}
                            <div className="flex flex-wrap gap-2 pb-2 border-b border-neutral-800">
                                <TabButton active={activeTab === 'CHART'} onClick={() => setActiveTab('CHART')} icon={<BarChart3 size={16} />}>Price Action</TabButton>
                                <TabButton active={activeTab === 'TECHNICAL'} onClick={() => setActiveTab('TECHNICAL')} icon={<Activity size={16} />}>Technicals</TabButton>
                                {assetType === 'STOCK' && (
                                    <>
                                        <TabButton active={activeTab === 'FUNDAMENTALS'} onClick={() => setActiveTab('FUNDAMENTALS')} icon={<Blocks size={16} />}>Fundamentals</TabButton>
                                        <TabButton active={activeTab === 'EARNINGS'} onClick={() => setActiveTab('EARNINGS')} icon={<Server size={16} />}>Earnings</TabButton>
                                    </>
                                )}
                                {assetType === 'STOCK' && (
                                    <TabButton active={activeTab === 'NEWS'} onClick={() => setActiveTab('NEWS')} icon={<Newspaper size={16} />}>Market News</TabButton>
                                )}
                                <TabButton active={activeTab === 'RISK'} onClick={() => setActiveTab('RISK')} icon={<ShieldAlert size={16} />}>Risk Flags</TabButton>
                                <TabButton active={activeTab === 'FIRM_VIEW'} onClick={() => setActiveTab('FIRM_VIEW')} icon={<Database size={16} />}>Firm View Roles</TabButton>
                                <TabButton active={activeTab === 'EVIDENCE'} onClick={() => setActiveTab('EVIDENCE')} icon={<FlaskConical size={16} className="text-amber-500" />}>
                                    <span className="text-amber-500">Evidence Pack</span>
                                </TabButton>
                            </div>

                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 min-h-[400px]">
                                {activeTab === 'CHART' && (
                                    <div className="flex flex-col w-full space-y-4">
                                        <div className="flex justify-between items-center bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                                            <div className="text-xs text-neutral-500 font-semibold px-2 uppercase tracking-wider">Historical Range</div>
                                            <div className="flex gap-1">
                                                {['1m', '3m', '6m', '1y', '2y', '5y', 'all'].map(r => (
                                                    <button
                                                        key={r}
                                                        onClick={() => setRange(r)}
                                                        className={cn("px-3 py-1 text-xs font-bold rounded transition-colors", range === r ? "bg-indigo-500 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white")}
                                                    >
                                                        {r.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-[350px] w-full mt-4">
                                            {chartData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                                        <XAxis dataKey="date" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                                        <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} tickFormatter={v => `$${v}`} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                                            itemStyle={{ color: '#a78bfa' }}
                                                            content={({ active, payload, label }) => {
                                                                if (active && payload && payload.length) {
                                                                    const data = payload[0].payload;
                                                                    return (
                                                                        <div className="bg-neutral-900 border border-neutral-700 p-3 rounded-lg shadow-xl text-sm">
                                                                            <div className="text-neutral-400 mb-2 font-bold">{label}</div>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                                                <span className="text-neutral-500">Open:</span><span className="text-neutral-200 font-mono">${data.open.toFixed(2)}</span>
                                                                                <span className="text-neutral-500">High:</span><span className="text-neutral-200 font-mono">${data.high.toFixed(2)}</span>
                                                                                <span className="text-neutral-500">Low:</span><span className="text-neutral-200 font-mono">${data.low.toFixed(2)}</span>
                                                                                <span className="text-neutral-500">Close:</span><span className={cn("font-mono font-medium", data.close >= data.open ? 'text-emerald-400' : 'text-rose-400')}>${data.close.toFixed(2)}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                        <Bar dataKey="bounds" shape={<CustomizedCandlestick />} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-neutral-500">
                                                    <AlertTriangle className="mb-2 h-8 w-8 text-neutral-600" />
                                                    {isLoadingSummary ? <p>Loading Data...</p> : <p>Chart data unavailable from provider for this range</p>}
                                                </div>
                                            )}
                                        </div>

                                        {chartData.length > 0 && (
                                            <div className="h-[150px] w-full pt-4 border-t border-neutral-800">
                                                <div className="text-xs text-neutral-500 font-bold mb-2 uppercase tracking-wider">Volume</div>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis stroke="#525252" fontSize={10} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                                            formatter={(value: number) => [value ? value.toLocaleString() : '0', 'Volume']}
                                                        />
                                                        <Bar dataKey="volume" fill="#525252" />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'TECHNICAL' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Technical Indicators</h3>
                                        {effectiveIndicators ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                <MetricCard label="RSI (14)" value={effectiveIndicators.rsi14?.toFixed(2)} tooltip="Relative Strength Index: Momentum oscillator measuring the speed and change of price movements." />
                                                <MetricCard label="Volatility (20d)" value={effectiveIndicators.vol20 != null ? `${(effectiveIndicators.vol20 * 100).toFixed(2)}%` : '---'} tooltip="Annualized variance over the last 20 days." />
                                                <MetricCard label="Trend (20/50)" value={effectiveIndicators.sma20 > effectiveIndicators.sma50 ? 'BULLISH' : 'BEARISH'} tooltip="Simple Moving Average crossover trend state." />

                                                <MetricCard label="MACD" value={effectiveIndicators.macd?.macd?.toFixed(3)} tooltip="Moving Average Convergence Divergence." />
                                                <MetricCard label="Stochastic K" value={effectiveIndicators.stochastic?.k?.toFixed(1)} tooltip="Stochastic Oscillator %K: Momentum indicator showing closing price relative to high-low range." />
                                                <MetricCard label="ATR (14)" value={effectiveIndicators.atr14?.toFixed(2)} tooltip="Average True Range: Measure of daily volatility amplitude." />
                                                <MetricCard label="Bollinger Width" value={effectiveIndicators.bollinger ? (effectiveIndicators.bollinger.upper - effectiveIndicators.bollinger.lower).toFixed(2) : '-'} tooltip="Distance between upper and lower Bollinger Bands." />

                                                <MetricCard label="ADX (14)" value={effectiveIndicators.adx14?.toFixed(1)} tooltip="Average Directional Index: Measures the absolute strength of a trend." />
                                                <MetricCard label="OBV" value={effectiveIndicators.obv != null ? (effectiveIndicators.obv > 1000000 ? `${(effectiveIndicators.obv / 1000000).toFixed(1)}M` : effectiveIndicators.obv.toLocaleString()) : '-'} tooltip="On-Balance Volume: Cumulative volume tracking buying vs selling pressure." />
                                                <MetricCard label="MFI (14)" value={effectiveIndicators.mfi14?.toFixed(1)} tooltip="Money Flow Index: Volume-weighted version of RSI indicating buying/selling pressure." />
                                                <MetricCard label="VWAP (14)" value={effectiveIndicators.vwap ? `$${effectiveIndicators.vwap.toFixed(2)}` : '-'} tooltip="Volume Weighted Average Price over a trailing 14-day window." />
                                                <MetricCard label="ROC (14)" value={effectiveIndicators.roc14 ? `${effectiveIndicators.roc14.toFixed(2)}%` : '-'} tooltip="Rate of Change: Percentage change in price over the last 14 days." />
                                                <MetricCard label="CCI (20)" value={effectiveIndicators.cci20?.toFixed(1)} tooltip="Commodity Channel Index: Helps identify new trends or extreme conditions." />
                                                <MetricCard label="Williams %R" value={effectiveIndicators.williamsR14?.toFixed(1)} tooltip="Momentum indicator measuring overbought and oversold levels (-0 to -100)." />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500 animate-pulse">
                                                {isLoadingRealtime ? 'Computing analysis...' : 'No indicators available.'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'FUNDAMENTALS' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Fundamental Metrics</h3>
                                        {isLoadingFundamentals ? (
                                            <div className="text-center py-8 text-neutral-500 animate-pulse">Loading financials...</div>
                                        ) : fundamentals ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                <MetricCard label="P/E Ratio (Ann)" value={fundamentals.peRatio?.toFixed(2) || 'N/A'} />
                                                <MetricCard label="EPS (Ann)" value={fundamentals.eps ? `$${fundamentals.eps.toFixed(2)}` : 'N/A'} />
                                                <MetricCard label="Market Cap" value={fundamentals.marketCap ? `$${(fundamentals.marketCap / 1000).toFixed(2)}B` : 'N/A'} />
                                                <MetricCard label="52W High" value={fundamentals.fiftyTwoWeekHigh ? `$${fundamentals.fiftyTwoWeekHigh.toFixed(2)}` : 'N/A'} />
                                                <MetricCard label="52W Low" value={fundamentals.fiftyTwoWeekLow ? `$${fundamentals.fiftyTwoWeekLow.toFixed(2)}` : 'N/A'} />
                                                <MetricCard label="Target Price" value={fundamentals.targetPrice ? `$${fundamentals.targetPrice.toFixed(2)}` : 'N/A'} />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500">Fundamental data unavailable.</div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'EARNINGS' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Earnings Calendar</h3>
                                        {isLoadingEarnings ? (
                                            <div className="text-center py-8 text-neutral-500 animate-pulse">Loading schedule...</div>
                                        ) : earnings && earnings.length > 0 ? (
                                            <div className="space-y-4">
                                                {earnings.map((e: any, idx: number) => (
                                                    <div key={idx} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-lg text-white mb-1">{e.date}</div>
                                                            <div className="text-xs text-neutral-500">EPS Est: <span className="text-neutral-300 font-mono">{e.epsEstimate || '-'}</span> | Rev Est: <span className="text-neutral-300 font-mono">{e.revenueEstimate ? `$${(e.revenueEstimate / 1e6).toFixed(1)}M` : '-'}</span></div>
                                                        </div>
                                                        <div className="text-right">
                                                            {e.epsActual ? (
                                                                <span className={cn("px-3 py-1 text-xs font-bold rounded", Number(e.epsActual) >= Number(e.epsEstimate) ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                                                                    Actual EPS: {e.epsActual}
                                                                </span>
                                                            ) : (
                                                                <span className="px-3 py-1 text-xs font-bold rounded bg-blue-500/20 text-blue-400">Upcoming</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500">No upcoming earnings events scheduled.</div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'NEWS' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-neutral-300 border-b border-neutral-800 pb-2">Recent News & Sentiment</h3>
                                        {isLoadingNews ? (
                                            <div className="text-center py-8 text-neutral-500 animate-pulse">Loading news feed...</div>
                                        ) : news && news.length > 0 ? (
                                            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                                {news.map((n: any) => (
                                                    <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-neutral-950 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-colors group">
                                                        <div className="flex justify-between items-start gap-4 mb-2">
                                                            <div className="flex-1">
                                                                <h4 className="font-bold text-sm text-neutral-200 group-hover:text-indigo-400 transition-colors line-clamp-2">{n.headline}</h4>
                                                                <div className="flex gap-2 items-center mt-1 text-xs text-neutral-500">
                                                                    <span>{n.source}</span>
                                                                    <span>&bull;</span>
                                                                    <span>{new Date(n.publishedAt).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Sentiment</span>
                                                                <div className={cn("px-2 py-0.5 rounded text-xs font-bold w-16 text-center shadow-inner",
                                                                    n.sentimentScore > 0.2 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                                                        n.sentimentScore < -0.2 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                                                                            "bg-neutral-800 text-neutral-400 border border-neutral-700")}>
                                                                    {n.sentimentScore > 0.2 ? 'BULL' : n.sentimentScore < -0.2 ? 'BEAR' : 'NEUTRAL'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed">{n.summary}</p>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500">No recent news available.</div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'RISK' && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-rose-400 border-b border-rose-900/50 pb-2">Risk Analysis</h3>
                                        {effectiveIndicators ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <MetricCard label="Drawdown from Peak" value={effectiveIndicators.drawdown90 != null ? `${(effectiveIndicators.drawdown90 * 100).toFixed(2)}%` : '---'} isNegative={true} />
                                                <MetricCard label="Data Freshness" value={summary.quote?.isStale ? "STALE" : "LIVE"} isNegative={summary.quote?.isStale} />

                                                {effectiveIndicators.dataQualityScore !== undefined && (
                                                    <MetricCard label="Data Quality Score" value={`${effectiveIndicators.dataQualityScore}/100`} isNegative={effectiveIndicators.dataQualityScore < 80} />
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500">No risk metrics computed yet.</p>
                                        )}

                                        {summary?.predictions?.[0]?.riskSignals && summary.predictions[0].riskSignals.length > 0 && (
                                            <div className="mt-6 space-y-3">
                                                <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-3 border-t border-neutral-800 pt-4">Identified Risk Factors</h4>
                                                {summary.predictions[0].riskSignals.map((signal: any, idx: number) => (
                                                    <div key={idx} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex flex-col md:flex-row gap-4 items-start md:items-center leading-relaxed">
                                                        <div className={cn("px-3 py-1 rounded text-xs font-bold w-full md:w-24 text-center shrink-0 shadow-inner",
                                                            signal.severity === 'HIGH' ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                                                                signal.severity === 'MEDIUM' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                                                    "bg-blue-500/20 text-blue-400 border border-blue-500/30")}>
                                                            {signal.severity} RISK
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-neutral-500 font-bold mb-1 uppercase tracking-wider">{signal.category}</div>
                                                            <div className="text-sm text-neutral-200">{signal.message}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'FIRM_VIEW' && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <h3 className="text-lg font-semibold text-indigo-400 border-b border-indigo-900/50 pb-2">Analysis Snapshot (Deterministic)</h3>
                                        {effectiveFirmView && Object.keys(effectiveFirmView).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {Object.entries(effectiveFirmView).map(([role, payloadStr]) => {
                                                    let parsed: Record<string, any>;
                                                    try { parsed = JSON.parse(payloadStr as string); } catch { parsed = { raw: payloadStr }; }
                                                    return (
                                                        <div key={role} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                                            <div className="text-xs uppercase font-bold text-indigo-400 mb-3 tracking-wider">{role.replace(/_/g, ' ')}</div>
                                                            <div className="space-y-2">
                                                                {Object.entries(parsed).map(([k, v]) => (
                                                                    <div key={k} className="flex justify-between items-center text-sm">
                                                                        <span className="text-neutral-500 capitalize">{k.replace(/_/g, ' ')}</span>
                                                                        <span className={cn('font-medium', String(v).toLowerCase().includes('bull') || String(v).toLowerCase().includes('positive') || String(v).toLowerCase().includes('low') ? 'text-emerald-400' : String(v).toLowerCase().includes('bear') || String(v).toLowerCase().includes('negative') || String(v).toLowerCase().includes('high') ? 'text-rose-400' : 'text-neutral-200')}>
                                                                            {String(v)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-neutral-500 animate-pulse">
                                                {isLoadingRealtime ? 'Computing analysis...' : 'No analysis snapshots available.'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'EVIDENCE' && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <h3 className="text-lg font-semibold text-amber-500 border-b border-amber-900/50 pb-2 flex items-center gap-2">
                                            <FlaskConical size={18} /> Evidence Pack
                                        </h3>
                                        {effectiveEvidencePack ? (
                                            <div className="bg-neutral-950 p-6 rounded-xl border border-neutral-800 text-sm font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                                                {effectiveEvidencePack}
                                            </div>
                                        ) : (
                                            <p className="text-neutral-500">No evidence pack generated for this asset yet.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Panel */}
                        <div className="bg-neutral-900/50 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)] rounded-2xl p-6 flex flex-col h-[600px] overflow-hidden">
                            <h3 className="text-lg font-semibold mb-4 border-b border-indigo-500/20 pb-2 flex items-center gap-2">
                                <Cpu className="text-indigo-400" size={18} /> LLM Intelligence
                            </h3>

                            {(!configs || configs.length === 0) ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                                    <p className="text-sm text-neutral-400">No external AI providers configured.</p>
                                    <p className="text-xs text-neutral-500">Add BYOK setups in settings to enable narrative generation safely via backend proxy.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="mb-4 space-y-2">
                                        <label className="text-sm text-neutral-400 font-medium">Select Providers to Compare</label>
                                        <div className="flex flex-wrap gap-2">
                                            {configs.map((cfg: any) => (
                                                <button
                                                    key={cfg.id}
                                                    onClick={() => toggleProvider(cfg.id)}
                                                    className={cn(
                                                        "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                                                        selectedProviders.includes(cfg.id)
                                                            ? "bg-indigo-500 border-indigo-500 text-white"
                                                            : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
                                                    )}
                                                >
                                                    {cfg.name} ({cfg.provider})
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => aiMutation.mutate()}
                                        disabled={selectedProviders.length === 0 || aiMutation.isPending}
                                        className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all w-full flex items-center justify-center gap-2"
                                    >
                                        {aiMutation.isPending ? 'Generating...' : <><Sparkles size={16} /> Compare Narratives</>}
                                    </button>

                                    {aiMutation.isError && (
                                        <p className="text-rose-400 text-sm mt-2 font-medium">Error: {(aiMutation.error as any).message}</p>
                                    )}

                                    <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                        {generatedNarratives.length > 0 ? (
                                            generatedNarratives.map((n: any, idx) => {
                                                let parsedAction = null;
                                                let narrativeText = n.contentText;

                                                try {
                                                    const maybeJSON = JSON.parse(n.contentText);
                                                    if (maybeJSON && maybeJSON.action && maybeJSON.narrative) {
                                                        parsedAction = maybeJSON.action.toUpperCase();
                                                        narrativeText = maybeJSON.narrative;
                                                    }
                                                } catch (e) {
                                                    // Not JSON, just normal text
                                                }

                                                return (
                                                    <div key={idx} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                                                                {n.providerUsed}
                                                            </div>
                                                            {parsedAction && (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className="flex gap-2">
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-[9px] text-neutral-500 uppercase">Algorithm</span>
                                                                            <span className={cn("px-2 py-0.5 text-xs font-bold rounded", algoAction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : algoAction === 'SELL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20')}>
                                                                                {algoAction}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-[9px] text-indigo-500 uppercase">LLM Signal</span>
                                                                            <span className={cn("px-2 py-0.5 text-xs font-bold rounded", parsedAction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : parsedAction === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50')}>
                                                                                {parsedAction}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {algoAction !== parsedAction && (
                                                                        <span className="text-[10px] text-rose-400 animate-pulse font-medium">DISAGREEMENT</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="prose prose-invert prose-sm">
                                                            {narrativeText}
                                                        </div>
                                                        {parsedAction && (
                                                            <div className="mt-4 pt-2 border-t border-neutral-800 flex items-center gap-1.5 opacity-70">
                                                                <AlertTriangle size={12} className="text-amber-500" />
                                                                <span className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">Strictly Educational. Not Financial Advice.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-center px-4">
                                                <p className="text-xs text-neutral-500 italic">
                                                    Prompts are composed strictly of deterministic numerical data. No secret keys are exposed client-side.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-20 text-rose-400">Failed to load asset data.</div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, children, icon }: { active: boolean, onClick: () => void, children: React.ReactNode, icon?: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-2 font-medium text-sm whitespace-nowrap rounded-t-lg border-b-2 flex items-center gap-2 transition-colors",
                active ? "border-indigo-500 text-indigo-400 bg-indigo-500/10" : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
            )}
        >
            {icon}
            {children}
        </button>
    );
}

function MetricCard({ label, value, isNegative, tooltip }: { label: string, value: string | undefined, isNegative?: boolean, tooltip?: string }) {
    return (
        <div className={cn("p-4 rounded-xl border bg-neutral-900/50 hover:bg-neutral-800/80 transition-colors", isNegative ? "border-rose-900/30" : "border-neutral-800")} title={tooltip}>
            <div className={cn("text-xs text-neutral-500 uppercase font-semibold tracking-wider mb-1", tooltip ? "cursor-help underline decoration-neutral-700 decoration-dotted underline-offset-4" : "")}>{label}</div>
            <div className={cn("text-lg font-medium", isNegative ? "text-rose-400" : "text-neutral-200")}>{value || '-'}</div>
        </div>
    );
}
