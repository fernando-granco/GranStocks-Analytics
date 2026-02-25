import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, AlertCircle, LineChart as ChartIcon, Briefcase } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function PortfolioAnalysis() {
    const navigate = useNavigate();
    const { mode } = usePreferences();
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    const { data: positions = [], isLoading } = useQuery({
        queryKey: ['portfolio'],
        queryFn: async () => {
            const res = await fetch(`/api/portfolio`);
            if (!res.ok) throw new Error('Failed to load portfolio');
            return res.json();
        }
    });

    const { data: historicalData } = useQuery({
        queryKey: ['portfolio-historical'],
        queryFn: async () => {
            const res = await fetch(`/api/portfolio/historical`);
            if (!res.ok) return [];
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

    if (isLoading) return <div className="p-8 text-neutral-500 animate-pulse text-center">Loading portfolio data...</div>;

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
                    <p className="text-neutral-500">AI Narrative & Historical Correlation &bull; {positions.length} Assets</p>
                </div>
                {mode === 'ADVANCED' && (
                    <button
                        onClick={() => analyzeMutation.mutate()}
                        disabled={analyzeMutation.isPending || positions.length === 0}
                        className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 disabled:opacity-50 font-medium rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Sparkles size={16} />
                        {analyzeMutation.isPending ? 'Analyzing Portfolio...' : 'Run Portfolio AI Analysis'}
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

            {/* Historical Plot */}
            {historicalData && historicalData.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <ChartIcon size={18} className="text-indigo-400" />
                        Historical Performance (Normalized %)
                    </h2>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historicalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                                {positions.map((item: any, idx: number) => (
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

            {!positions || positions.length === 0 ? (
                <div className="p-12 border border-dashed border-neutral-800 rounded-2xl text-center bg-neutral-900/20 mt-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-neutral-600 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300">Portfolio is empty</h3>
                    <p className="text-neutral-500 mt-1">Add assets from Watchlists to track them here.</p>
                </div>
            ) : null}
        </div>
    );
}
