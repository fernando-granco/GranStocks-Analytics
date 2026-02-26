import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, AlertCircle, LineChart as ChartIcon, Briefcase, Activity, ShieldAlert, PieChart as PieChartIcon, LayoutGrid } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

export default function PortfolioAnalysis() {
    const navigate = useNavigate();
    const { mode } = usePreferences();
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const { data: analytics, isLoading } = useQuery({
        queryKey: ['portfolio-analytics'],
        queryFn: async () => {
            const res = await fetch(`/api/portfolio/analytics`);
            if (!res.ok) throw new Error('Failed to load portfolio analytics');
            return res.json();
        }
    });

    // Generate colors for charts
    const colors = useMemo(() => ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'], []);

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/portfolio/analyze`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to analyze portfolio');
            }
            return res.json();
        },
        onSuccess: (data) => setAnalysisResult(data.narrative),
        onError: (err: any) => alert(err.message)
    });

    if (isLoading) return <div className="p-8 text-neutral-500 animate-pulse text-center">Loading portfolio analytics...</div>;

    if (!analytics || !analytics.positions || analytics.positions.length === 0) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mb-4">
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 mt-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">Portfolio is empty</h3>
                    <p className="text-neutral-500 mt-1">Add assets from the Dashboard to gain deep insights.</p>
                </div>
            </div>
        );
    }

    const { summary, allocation, performance, risk, breadth, positions } = analytics;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mb-4">
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Briefcase className="text-indigo-500" />
                        My Portfolio Analysis
                    </h1>
                    <p className="text-neutral-500">Institution-Grade Analytics & AI Narrative &bull; {positions.length} Assets</p>
                </div>
                {mode === 'ADVANCED' && (
                    <button
                        onClick={() => analyzeMutation.mutate()}
                        disabled={analyzeMutation.isPending}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 disabled:opacity-50 font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Sparkles size={16} />
                        {analyzeMutation.isPending ? 'Generating AI Report...' : 'Generated AI Report'}
                    </button>
                )}
            </div>

            {analysisResult && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={64} className="text-amber-500" />
                    </div>
                    <h2 className="text-lg font-bold text-amber-500 mb-3 flex items-center gap-2">
                        <Sparkles size={18} /> AI Portfolio Analysis
                    </h2>
                    <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed text-sm format-markdown">
                        {analysisResult}
                    </div>
                </div>
            )}

            {/* Quantitative Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><Activity size={14} /> 1-Month Return</div>
                    <div className={`text-2xl font-bold tracking-tight ${summary.monthlyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {summary.monthlyReturn > 0 ? '+' : ''}{summary.monthlyReturn.toFixed(2)}%
                    </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><ShieldAlert size={14} /> Volatility (Ann.)</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{(risk.volatility * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><ChartIcon size={14} /> Max Drawdown</div>
                    <div className="text-2xl font-bold tracking-tight text-rose-500">-{Math.abs(risk.maxDrawdown).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <div className="text-sm text-neutral-500 mb-1 flex items-center gap-2"><LayoutGrid size={14} /> Breadth (Above 50 MA)</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{breadth.aboveSma50.toFixed(0)}%</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Allocation Pie Chart */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-1 border-l-4 border-l-indigo-500">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><PieChartIcon size={18} className="text-indigo-400" /> Asset Allocation</h2>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocation.byAsset}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value"
                                >
                                    {allocation.byAsset.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#171717', borderColor: '#262626' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Historical Value AreaChart */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <ChartIcon size={18} className="text-indigo-400" /> Aggregate Market Value (1 YR)
                    </h2>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis dataKey="dateStr" stroke="#525252" fontSize={12} tickMargin={10} minTickGap={30} />
                                <YAxis stroke="#525252" fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Portfolio Value']}
                                    labelStyle={{ color: '#a3a3a3' }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Positions Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 overflow-hidden">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Briefcase size={18} className="text-indigo-400" /> Position Level Contributions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Asset</th>
                                <th className="px-4 py-3">Price</th>
                                <th className="px-4 py-3">Value</th>
                                <th className="px-4 py-3">Weight</th>
                                <th className="px-4 py-3 rounded-r-lg text-right">PnL %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {positions.map((pos: any) => (
                                <tr key={pos.symbol} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                                    <td className="px-4 py-4 font-bold text-white">{pos.symbol}</td>
                                    <td className="px-4 py-4">${pos.currentPrice.toFixed(2)}</td>
                                    <td className="px-4 py-4">${pos.currentValue.toFixed(2)}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${pos.weight}%` }}></div>
                                            </div>
                                            <span>{pos.weight.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td className={`px-4 py-4 text-right font-medium ${pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {pos.pnlPercent > 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
