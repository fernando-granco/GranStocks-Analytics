import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, AlertCircle, LineChart as ChartIcon, Briefcase, Activity, ShieldAlert, PieChart as PieChartIcon, LayoutGrid } from 'lucide-react';
import { usePortfolios } from '../context/PortfolioContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function PortfolioAnalysis() {
    const { i18n } = useTranslation();
    const tr = (en: string, pt: string) => (i18n.language === 'pt-BR' ? pt : en);
    const navigate = useNavigate();
    const { portfolios, selectedPortfolio, setSelectedPortfolioId } = usePortfolios();
    const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
    const [generatedNarratives, setGeneratedNarratives] = useState<any[]>([]);
    const [timeSpan, setTimeSpan] = useState('6M');

    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    useEffect(() => {
        if (configs && configs.length > 0 && selectedProviders.length === 0) {
            setSelectedProviders([configs[0].id]);
        }
    }, [configs]);

    const toggleProvider = (id: string) => {
        if (selectedProviders.includes(id)) {
            setSelectedProviders(v => v.filter(i => i !== id));
        } else {
            setSelectedProviders(v => [...v, id]);
        }
    };

    const { data: analytics, isLoading } = useQuery({
        queryKey: ['portfolio-analytics', selectedPortfolio?.id, timeSpan],
        queryFn: async () => {
            const url = selectedPortfolio ? `/api/portfolio/analytics?portfolioId=${selectedPortfolio.id}&range=${timeSpan}` : `/api/portfolio/analytics?range=${timeSpan}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(tr('Failed to load portfolio analysis', 'Falha ao carregar análise da carteira'));
            return res.json();
        },
        enabled: !!selectedPortfolio
    });

    const { data: analysisConfigs } = useQuery({
        queryKey: ['analysisConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/analysis');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const colors = useMemo(() => ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'], []);

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/portfolio/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ portfolioId: selectedPortfolio?.id, llmConfigIds: selectedProviders })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || tr('Failed to analyze portfolio', 'Falha ao analisar carteira'));
            }
            return res.json();
        },
        onSuccess: (data) => {
            if (data.narratives) {
                setGeneratedNarratives(data.narratives);
            } else if (data.narrative) {
                setGeneratedNarratives([{ contentText: data.narrative }]);
            }
            if (data.errors?.length > 0) {
                console.warn('[AI] Some providers failed:', data.errors);
            }
        },
        onError: (err: any) => alert(err.message)
    });

    if (isLoading) return <div className="p-8 text-neutral-500 animate-pulse text-center">{tr('Loading portfolio analysis...','Carregando análise da carteira...')}</div>;

    if (!analytics || !analytics.positions || analytics.positions.length === 0) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => navigate('/app')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <ArrowLeft size={16} /> {tr('Back to Dashboard', 'Voltar ao Painel')}
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
                    <h3 className="text-lg font-medium text-neutral-300">{tr('Empty portfolio', 'Carteira vazia')}</h3>
                    <p className="text-neutral-500 mt-1">{tr('Add assets to the selected portfolio to see detailed analytics.', 'Adicione ativos à carteira selecionada para obter análises detalhadas.')}</p>
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
                    <ArrowLeft size={16} /> {tr('Back to Dashboard', 'Voltar ao Painel')}
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
                        {selectedPortfolio?.name} {tr('Analysis', 'Análise')}
                    </h1>
                    <div className="text-neutral-500 flex items-center gap-2 flex-wrap">
                        <span>{tr('Institutional-grade analysis', 'Análise em nível institucional')} &bull; {positions.length} {tr('Assets', 'Ativos')}</span>
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-indigo-500/20">Base: {baseCurrency}</span>
                        {(() => {
                            const activeConfig = analysisConfigs?.find((c: any) => c.isActive);
                            const isCustom = activeConfig?.name === 'Custom Advanced';
                            const label = isCustom ? tr('Custom weights', 'Pesos personalizados') : tr('Preset', 'Preset') + ': ' + (activeConfig?.name || tr('Default strategy', 'Estratégia padrão'));

                            return (
                                <div className="group relative flex items-center ml-2">
                                    <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-700 rounded text-xs font-medium cursor-help">
                                        {tr('Weights', 'Pesos')}: {label}
                                    </span>
                                    {activeConfig?.configJson && (
                                        <div className="absolute left-0 top-full mt-2 w-72 p-4 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-[10px] sm:text-xs text-left">
                                            <div className="font-bold text-neutral-300 mb-2 border-b border-neutral-700 pb-2">{tr('Weights configuration', 'Configuração de pesos')}</div>
                                            <pre className="text-neutral-400 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                                                {activeConfig.configJson}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-3">
                        <select
                            value={timeSpan}
                            onChange={(e) => setTimeSpan(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 text-neutral-300 text-sm rounded-lg px-3 py-2 outline-none cursor-pointer hover:text-white transition-colors h-[38px]"
                        >
                            <option value="1M">{tr('1 month', '1 mês')}</option>
                            <option value="3M">{tr('3 months', '3 meses')}</option>
                            <option value="6M">{tr('6 months', '6 meses')}</option>
                            <option value="YTD">YTD</option>
                            <option value="1Y">{tr('1 year', '1 ano')}</option>
                            <option value="ALL_TIME">{tr('All time', 'Todo o período')}</option>
                        </select>
                        <button
                            onClick={() => analyzeMutation.mutate()}
                            disabled={analyzeMutation.isPending || selectedProviders.length === 0}
                            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 disabled:opacity-50 font-bold rounded-lg flex items-center gap-2 transition-colors uppercase text-xs tracking-wider h-[38px]"
                        >
                            <Sparkles size={16} />
                            <span className="hidden sm:inline">{analyzeMutation.isPending ? tr('Generating...', 'Gerando...') : tr('Run AI Analysis', 'Gerar análise com IA')}</span>
                        </button>
                    </div>

                    {configs && configs.length > 0 && (
                        <div className="flex gap-2">
                            {configs.map((cfg: any) => (
                                <button
                                    key={cfg.id}
                                    onClick={() => toggleProvider(cfg.id)}
                                    className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all ${selectedProviders.includes(cfg.id)
                                        ? "bg-indigo-500 border-indigo-500 text-white"
                                        : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-500"
                                        }`}
                                >
                                    {cfg.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {generatedNarratives.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {generatedNarratives.map((n: any, idx) => {
                        let text = n.contentText || '';
                        let isJson = false;
                        let parsedData: any = null;
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed && typeof parsed === 'object') {
                                isJson = true;
                                parsedData = parsed;
                            }
                        } catch { }

                        return (
                            <div key={idx} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-amber-500/5">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Sparkles size={64} className="text-amber-500" />
                                </div>
                                <h2 className="text-lg font-bold text-amber-500 mb-3 flex items-center justify-between pb-2 border-b border-amber-500/20">
                                    <span className="flex items-center gap-2">
                                        <Sparkles size={18} /> {n.providerUsed || tr('AI', 'IA')} ({n.modelUsed || tr('Model', 'Modelo')})
                                    </span>
                                    {isJson && parsedData?.action && (
                                        <span className={`text-xs ml-3 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${parsedData.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : parsedData.action === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                            {parsedData.action}
                                        </span>
                                    )}
                                </h2>
                                <div className="text-neutral-300 text-sm format-markdown leading-relaxed pr-8">
                                    {isJson ? (parsedData?.narrative || text) : text}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><Activity size={12} /> Retorno de {tr('1 month', '1 mês')}</div>
                    <div className={`text-2xl font-bold tracking-tight ${summary.monthlyReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {summary.monthlyReturn > 0 ? '+' : ''}{summary.monthlyReturn.toFixed(2)}%
                    </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><ShieldAlert size={12} /> {tr('Volatility (annualized)', 'Volatilidade (anual)')}</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{(risk.volatility * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><ChartIcon size={12} /> {tr('Max drawdown', 'Drawdown máximo')}</div>
                    <div className="text-2xl font-bold tracking-tight text-rose-500">-{Math.abs(risk.maxDrawdown).toFixed(2)}%</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2 font-mono"><LayoutGrid size={12} /> {tr('Market breadth (>50 MA)', 'Amplitude de mercado (>MM50)')}</div>
                    <div className="text-2xl font-bold tracking-tight text-white">{breadth.aboveSma50.toFixed(0)}%</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 lg:col-span-1 border-t-2 border-t-indigo-500 shadow-sm">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2"><PieChartIcon size={16} className="text-indigo-400" /> {tr('Asset allocation', 'Alocação de ativos')}</h2>
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
                        <ChartIcon size={16} className="text-indigo-400" /> {tr('Aggregate performance', 'Desempenho agregado')}
                    </h2>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis dataKey="dateStr" stroke="#525252" fontSize={10} tickMargin={10} minTickGap={40} />
                                <YAxis stroke="#525252" fontSize={10} domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString(undefined, { style: 'currency', currency: baseCurrency, maximumFractionDigits: 0 })} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                    formatter={(value: any) => [value.toLocaleString(undefined, { style: 'currency', currency: baseCurrency }), tr('Portfolio value', 'Valor da carteira')]}
                                    labelStyle={{ color: '#a3a3a3' }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <ChartIcon size={16} className="text-amber-400" /> {tr('Component return comparison (%)', 'Comparação de retorno por componente (%)')}
                </h2>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performance.history.map((h: any) => ({ ...h, dateStr: new Date(h.timestamp).toLocaleDateString() }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis dataKey="dateStr" stroke="#525252" fontSize={10} tickMargin={10} minTickGap={40} />
                            <YAxis stroke="#525252" fontSize={10} domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(0) + '%'} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                labelStyle={{ color: '#a3a3a3' }}
                                formatter={(value: any) => [Number(value).toFixed(2) + '%']}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            {positions.map((pos: any, i: number) => (
                                <Line
                                    key={pos.symbol}
                                    type="monotone"
                                    dataKey={pos.symbol}
                                    name={pos.symbol}
                                    stroke={colors[i % colors.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-neutral-800">
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Briefcase size={16} className="text-indigo-400" /> {tr('Asset breakdown', 'Detalhamento por ativo')}</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle">
                        <thead className="text-[10px] uppercase font-bold text-neutral-500 bg-black/20">
                            <tr>
                                <th className="px-6 py-4">{tr('Asset', 'Ativo')}</th>
                                <th className="px-6 py-4 text-right">{tr('Native price', 'Preço (nativo)')}</th>
                                <th className="px-6 py-4 text-right">{tr('Price', 'Preço')} ({baseCurrency})</th>
                                <th className="px-6 py-4 text-right">{tr('Value', 'Valor')} ({baseCurrency})</th>
                                <th className="px-6 py-4">{tr('Weight', 'Peso')}</th>
                                <th className="px-6 py-4 text-right">PnL %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {positions.map((pos: any) => (
                                <tr key={pos.symbol} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5 font-bold text-white">{pos.symbol}</td>
                                    <td className="px-6 py-5 text-right font-mono">
                                        {pos.nativePrice?.toLocaleString(undefined, { style: 'currency', currency: pos.nativeCurrency || pos.currency || 'USD' })}
                                    </td>
                                    <td className="px-6 py-5 text-right font-mono">
                                        {pos.baseCurrencyPrice?.toLocaleString(undefined, { style: 'currency', currency: baseCurrency }) || pos.currentPriceBase?.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                    </td>
                                    <td className="px-6 py-5 text-right font-mono font-bold">
                                        {pos.baseCurrencyValue?.toLocaleString(undefined, { style: 'currency', currency: baseCurrency }) || pos.currentValue?.toLocaleString(undefined, { style: 'currency', currency: baseCurrency })}
                                    </td>
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
