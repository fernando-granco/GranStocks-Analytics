import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, AlertCircle, LineChart as ChartIcon, Briefcase, Activity, ShieldAlert, PieChart as PieChartIcon, LayoutGrid } from 'lucide-react';
import { usePortfolios } from '../context/PortfolioContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

export default function PortfolioAnalysis() {
    const navigate = useNavigate();
    const { portfolios, selectedPortfolio, setSelectedPortfolioId } = usePortfolios();
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const { data: analytics, isLoading } = useQuery({
        queryKey: ['portfolio-analytics', selectedPortfolio?.id],
        queryFn: async () => {
            const url = selectedPortfolio ? `/api/portfolio/analytics?portfolioId=${selectedPortfolio.id}` : '/api/portfolio/analytics';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load portfolio analytics');
            return res.json();
        },
        enabled: !!selectedPortfolio
    });

    const colors = useMemo(() => ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'], []);

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/portfolio/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolioId: selectedPortfolio?.id })
            });
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
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    <select
                        value={selectedPortfolio?.id || ''}
                        onChange={(e) => setSelectedPortfolioId(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                        {portfolios.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.baseCurrency})</option>
                        ))}
                    </select>
                </div>
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 mt-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">Portfolio is empty</h3>
                    <p className="text-neutral-500 mt-1">Add assets to the selected portfolio to gain deep insights.</p>
                </div>
            </div>
        );
    }

    const { summary, allocation, performance, risk, breadth, positions } = analytics;
    const baseCurrency = selectedPortfolio?.baseCurrency || 'USD';

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
                <select
                    value={selectedPortfolio?.id || ''}
                    onChange={(e) => setSelectedPortfolioId(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                >
                    {portfolios.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.baseCurrency})</option>
                    ))}
                </select>
            </div>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Briefcase className="text-indigo-500" />
                        {selectedPortfolio?.name} Analysis
                    </h1>
                    <p className="text-neutral-500 flex items-center gap-2">
                        <span>Institution-Grade Analytics &bull; {positions.length} Assets</span>
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-indigo-500/20">Base: {baseCurrency}</span>
                    </p>
                </div>
                <button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 disabled:opacity-50 font-bold rounded-lg flex items-center gap-2 transition-colors uppercase text-xs tracking-wider"
                >
                    <Sparkles size={16} />
                    {analyzeMutation.isPending ? 'Generating...' : 'Run AI Analysis'}
                </button>
            </div>

            {analysisResult && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-500/5">
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><Activity size={12} /> 1-Month Return</div>
                    <div className={`text-2xl font-bold tracking-tight ${summary.monthlyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {summary.monthlyReturn > 0 ? '+' : ''}{summary.monthlyReturn.toFixed(2)}%
                    </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><ShieldAlert size={12} /> Volatility (Ann.)</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{(risk.volatility * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><ChartIcon size={12} /> Max Drawdown</div>
                    <div className="text-2xl font-bold tracking-tight text-rose-500">-{Math.abs(risk.maxDrawdown).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><LayoutGrid size={12} /> Breadth (&gt;50 MA)</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{breadth.aboveSma50.toFixed(0)}%</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 lg:col-span-1 border-t-2 border-t-indigo-500 shadow-sm">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2"><PieChartIcon size={16} className="text-indigo-400" /> Asset Allocation</h2>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={allocation.byAsset} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                                    {allocation.byAsset.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => value.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })} contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 lg:col-span-2 shadow-sm">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ChartIcon size={16} className="text-indigo-400" /> Aggregate Performance (1 YR)
                    </h2>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis dataKey="dateStr" stroke="#525252" fontSize={10} tickMargin={10} minTickGap={40} />
                                <YAxis stroke="#525252" fontSize={10} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString(undefined, { style: 'currency', currency: baseCurrency, maximumFractionDigits: 0 })} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                    formatter={(value: any) => [value.toLocaleString(undefined, { style: 'currency', currency: baseCurrency }), 'Portfolio Value']}
                                    labelStyle={{ color: '#a3a3a3' }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-neutral-800">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Briefcase size={16} className="text-indigo-400" /> Asset Level Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle">
                        <thead className="text-[10px] uppercase font-bold text-neutral-500 bg-black/20">
                            <tr>
                                <th className="px-6 py-4">Asset</th>
                                <th className="px-6 py-4 text-right">Price ({baseCurrency})</th>
                                <th className="px-6 py-4 text-right">Value ({baseCurrency})</th>
                                <th className="px-6 py-4">Weight</th>
                                <th className="px-6 py-4 text-right">PnL %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {positions.map((pos: any) => (
                                <tr key={pos.symbol} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5 font-bold text-white">{pos.symbol}</td>
                                    <td className="px-6 py-5 text-right font-mono">{pos.currentPrice.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}</td>
                                    <td className="px-6 py-5 text-right font-mono font-bold">{pos.currentValue.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${pos.weight}%` }}></div>
                                            </div>
                                            <span className="font-mono text-neutral-400">{pos.weight.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-5 text-right font-bold font-mono ${pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
