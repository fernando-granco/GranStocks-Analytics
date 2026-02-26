import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Blocks, ArrowLeft, Sparkles, AlertCircle, LineChart as ChartIcon, Activity, ShieldAlert, LayoutGrid, Award } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableCard } from '../components/SortableCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function UniverseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { mode } = usePreferences();
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [timeSpan, setTimeSpan] = useState('1Y');

    const queryClient = useQueryClient();

    const { data: overviewData, isLoading } = useQuery({
        queryKey: ['universe-overview', id],
        queryFn: async () => {
            const res = await fetch(`/api/universes/${id}/overview`);
            if (!res.ok) throw new Error('Failed to load overview');
            return res.json();
        }
    });

    const { data: resolveData } = useQuery({
        queryKey: ['universe-resolve', id],
        queryFn: async () => {
            const res = await fetch(`/api/universes/${id}/resolve`);
            if (!res.ok) throw new Error('Failed to resolve universe');
            return res.json();
        }
    });

    const { data: analytics, isLoading: analyticsLoading } = useQuery({
        queryKey: ['universe-analytics', id, timeSpan],
        queryFn: async () => {
            const res = await fetch(`/api/universes/${id}/analytics?range=${timeSpan}`);
            if (!res.ok) return null;
            return res.json();
        }
    });

    const timeSpanLabel = {
        '1M': '1-Month',
        '3M': '3-Month',
        '6M': '6-Month',
        'YTD': 'YTD',
        '1Y': '1-Year',
        'ALL_TIME': 'All Time'
    }[timeSpan] || '1-Year';

    const [items, setItems] = useState<any[]>([]);
    useEffect(() => {
        if (overviewData) setItems(overviewData);
    }, [overviewData]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const reorderMutation = useMutation({
        mutationFn: async (newSymbols: { symbol: string, assetType: string }[]) => {
            await fetch(`/api/universes/${id}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSymbols)
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['universe-overview', id] })
    });

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setItems((prevItems) => {
                const oldIndex = prevItems.findIndex(i => i.symbol === active.id);
                const newIndex = prevItems.findIndex(i => i.symbol === over.id);
                const newItems = arrayMove(prevItems, oldIndex, newIndex);
                reorderMutation.mutate(newItems.map(i => ({ symbol: i.symbol, assetType: i.assetType })));
                return newItems;
            });
        }
    };

    const untrackMutation = useMutation({
        mutationFn: async (symbol: string) => {
            await fetch(`/api/tracked-assets/${symbol}`, { method: 'DELETE' });
        }
    });

    // Generate colors for charts
    const colors = useMemo(() => ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'], []);

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/universes/${id}/analyze`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to analyze universe');
            }
            return res.json();
        },
        onSuccess: (data) => setAnalysisResult(data.narrative),
        onError: (err: any) => alert(err.message)
    });

    if (isLoading || analyticsLoading) return <div className="p-8 text-neutral-500 animate-pulse text-center">Loading universe data...</div>;

    const universe = resolveData?.universe;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mb-4">
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Blocks className="text-indigo-500" />
                        {universe?.name}
                    </h1>
                    <p className="text-neutral-500">Custom Universe &bull; {items.length} Assets</p>
                </div>
                {mode === 'ADVANCED' && (
                    <button
                        onClick={() => analyzeMutation.mutate()}
                        disabled={analyzeMutation.isPending || items.length === 0}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 disabled:opacity-50 font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Sparkles size={16} />
                        {analyzeMutation.isPending ? 'Analyzing Group...' : 'Run Group AI Analysis'}
                    </button>
                )}
            </div>

            {analysisResult && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={64} className="text-amber-500" />
                    </div>
                    <h2 className="text-lg font-bold text-amber-500 mb-3 flex items-center gap-2">
                        <Sparkles size={18} /> AI Group Analysis
                    </h2>
                    <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed text-sm format-markdown">
                        {analysisResult}
                    </div>
                </div>
            )}

            {analytics && analytics.summary && (
                <>
                    {/* Quantitative Summary Cards */}
                    <div className="flex justify-between items-center mb-2 mt-8">
                        <h2 className="text-xl font-bold tracking-tight">Group Analytics</h2>
                        <select
                            value={timeSpan}
                            onChange={(e) => setTimeSpan(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:text-white transition-colors"
                        >
                            <option value="1M">1 Month</option>
                            <option value="3M">3 Months</option>
                            <option value="6M">6 Months</option>
                            <option value="YTD">YTD</option>
                            <option value="1Y">1 Year</option>
                            <option value="ALL_TIME">All Time</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                            <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><Activity size={14} /> {timeSpanLabel} Return</div>
                            <div className={`text-2xl font-bold tracking-tight ${analytics.summary.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {analytics.summary.pnlPercent > 0 ? '+' : ''}{analytics.summary.pnlPercent.toFixed(2)}%
                            </div>
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                            <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><ShieldAlert size={14} /> Volatility (Ann.)</div>
                            <div className="text-2xl font-bold tracking-tight text-white">{(analytics.risk.volatility * 100).toFixed(2)}%</div>
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                            <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><ChartIcon size={14} /> Max Drawdown</div>
                            <div className="text-2xl font-bold tracking-tight text-rose-500">-{Math.abs(analytics.risk.maxDrawdown).toFixed(2)}%</div>
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                            <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><LayoutGrid size={14} /> Breadth (Above 50 MA)</div>
                            <div className="text-2xl font-bold tracking-tight text-white">{(analytics.breadth.aboveSma50).toFixed(0)}%</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Leaders and Laggards */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-1 border-l-4 border-l-emerald-500">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Award size={18} className="text-emerald-400" /> Leaders & Laggards</h2>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xs uppercase text-neutral-500 font-bold mb-2">Top Performers ({timeSpan})</h3>
                                    {analytics.positions.slice(0, 3).map((p: any) => (
                                        <div key={p.symbol} className="flex justify-between text-sm py-1 border-b border-neutral-800/50 last:border-0">
                                            <span className="font-medium text-white">{p.symbol}</span>
                                            <span className="text-emerald-400">+{p.pnlPercent.toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h3 className="text-xs uppercase text-neutral-500 font-bold mb-2 mt-4">Bottom Performers ({timeSpan})</h3>
                                    {analytics.positions.slice(-3).reverse().map((p: any) => (
                                        <div key={p.symbol} className="flex justify-between text-sm py-1 border-b border-neutral-800/50 last:border-0">
                                            <span className="font-medium text-white">{p.symbol}</span>
                                            <span className="text-rose-400">{p.pnlPercent.toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Group Value AreaChart */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <ChartIcon size={18} className="text-indigo-400" /> Group Aggregate Performance ({timeSpan})
                            </h2>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={analytics.performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                        <XAxis dataKey="dateStr" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                        <YAxis stroke="#525252" fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Equal Weight Group Index']}
                                            labelStyle={{ color: '#a3a3a3' }}
                                        />
                                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* Historical Compare Plot */}
            {analytics && analytics.performance && analytics.performance.history && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <ChartIcon size={18} className="text-indigo-400" />
                        Component Return Comparison (Normalized %)
                    </h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis dataKey="dateStr" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                <YAxis stroke="#525252" fontSize={12} tickFormatter={(val) => `${val.toFixed(0)}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                    labelStyle={{ color: '#a3a3a3', marginBottom: '8px' }}
                                    formatter={(value: any) => [`${Number(value).toFixed(2)}%`, undefined]}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                {items.map((item, idx) => (
                                    <Line
                                        key={item.symbol}
                                        type="monotone"
                                        dataKey={item.symbol}
                                        stroke={colors[idx % colors.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {!items || items.length === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 mt-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">No assets tracked</h3>
                    <p className="text-neutral-500 mt-1">This universe definition did not match any active symbols.</p>
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(i => i.symbol)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                            {items.map((item: any) => (
                                <SortableCard
                                    key={item.symbol}
                                    item={item}
                                    onClick={() => navigate(`/app/asset/${item.assetType}/${item.symbol}`)}
                                    onUntrack={(s) => untrackMutation.mutate(s)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
