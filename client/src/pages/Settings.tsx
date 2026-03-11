import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Copy, Info } from 'lucide-react';
import { AccountProfile } from '../components/AccountProfile';
import { useTranslation } from 'react-i18next';

export const RISK_PROFILES: Record<string, { name: string, description: string, req: string, screener: any, predict: any }> = {
    CONSERVATIVE: {
        name: 'Conservative Profile',
        description: 'Capital Preservation Focus',
        req: 'CONSERVATIVE',
        screener: { volatilityThreshold: 20, drawdownThreshold: 10, volatilityPenalty: 25, drawdownPenalty: 30, trendStrengthReward: 2, trendStrengthPenalty: 10 },
        predict: { rsiOverbought: 65, rsiOversold: 35, highVolatilityThreshold: 30, severeDrawdownThreshold: 0.15 }
    },
    MODERATELY_CONSERVATIVE: {
        name: 'Moderately Conservative Profile',
        description: 'Low Risk',
        req: 'MODERATELY_CONSERVATIVE',
        screener: { volatilityThreshold: 30, drawdownThreshold: 15, volatilityPenalty: 20, drawdownPenalty: 25, trendStrengthReward: 4, trendStrengthPenalty: 8 },
        predict: { rsiOverbought: 70, rsiOversold: 30, highVolatilityThreshold: 40, severeDrawdownThreshold: 0.20 }
    },
    MODERATE: {
        name: 'Moderate Profile',
        description: 'Balanced',
        req: 'MODERATE',
        screener: { volatilityThreshold: 40, drawdownThreshold: 20, volatilityPenalty: 15, drawdownPenalty: 20, trendStrengthReward: 6, trendStrengthPenalty: 6 },
        predict: { rsiOverbought: 70, rsiOversold: 30, highVolatilityThreshold: 50, severeDrawdownThreshold: 0.25 }
    },
    MODERATELY_AGGRESSIVE: {
        name: 'Moderately Aggressive Profile',
        description: 'Growth Focus',
        req: 'MODERATELY_AGGRESSIVE',
        screener: { volatilityThreshold: 55, drawdownThreshold: 28, volatilityPenalty: 10, drawdownPenalty: 12, trendStrengthReward: 8, trendStrengthPenalty: 4 },
        predict: { rsiOverbought: 75, rsiOversold: 25, highVolatilityThreshold: 60, severeDrawdownThreshold: 0.35 }
    },
    AGGRESSIVE: {
        name: 'Aggressive Profile',
        description: 'High Volatility Tolerance',
        req: 'AGGRESSIVE',
        screener: { volatilityThreshold: 70, drawdownThreshold: 35, volatilityPenalty: 5, drawdownPenalty: 5, trendStrengthReward: 10, trendStrengthPenalty: 2 },
        predict: { rsiOverbought: 80, rsiOversold: 20, highVolatilityThreshold: 75, severeDrawdownThreshold: 0.45 }
    },
    SPECULATIVE: {
        name: 'Speculative Profile',
        description: 'Maximum Risk Tolerance',
        req: 'SPECULATIVE',
        screener: { volatilityThreshold: 100, drawdownThreshold: 60, volatilityPenalty: 0, drawdownPenalty: 0, trendStrengthReward: 15, trendStrengthPenalty: 0 },
        predict: { rsiOverbought: 90, rsiOversold: 15, highVolatilityThreshold: 90, severeDrawdownThreshold: 0.60 }
    }
};

export default function Settings() {
    const [configId, setConfigId] = useState<string | null>(null);
    const [configName, setConfigName] = useState('');
    const [configProvider, setConfigProvider] = useState('OPENAI');
    const [configApiKey, setConfigApiKey] = useState('');
    const [configModel, setConfigModel] = useState('');
    const [configBaseUrl, setConfigBaseUrl] = useState('');

    const [isActionLabels, setIsActionLabels] = useState(true);
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'ANALYSIS' | 'PROVIDERS'>('ACCOUNT');

    const { data: prefsData } = useQuery({
        queryKey: ['preferences'],
        queryFn: async () => {
            const res = await fetch('/api/settings/preferences');
            if (!res.ok) return null;
            return res.json();
        }
    });

    const [selectedUniverses, setSelectedUniverses] = useState<string[]>(['SP500', 'NASDAQ100', 'CRYPTO']);
    useEffect(() => {
        if (prefsData?.screenerUniverses && Array.isArray(prefsData.screenerUniverses)) {
            setSelectedUniverses(prefsData.screenerUniverses);
        }
    }, [prefsData]);

    const saveScreenerPrefsMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ screenerUniverses: selectedUniverses })
            });
            if (!res.ok) throw new Error('Falha ao salvar presets do Screener');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['preferences'] });
            alert('Preferências de mercado do Screener salvas!');
        }
    });

    const [analysisMode, setAnalysisMode] = useState<'BASIC' | 'ADVANCED'>('BASIC');
    const [selectedRiskProfile, setSelectedRiskProfile] = useState('CONSERVATIVE');
    const [analysisConfigJson, setAnalysisConfigJson] = useState(JSON.stringify({
        screener: { volatilityThreshold: 20, drawdownThreshold: 10, volatilityPenalty: 25, drawdownPenalty: 30, trendStrengthReward: 2, trendStrengthPenalty: 10 },
        predict: { rsiOverbought: 65, rsiOversold: 35, highVolatilityThreshold: 30, severeDrawdownThreshold: 0.15 }
    }, null, 2));

    const DEFAULT_PROMPTS: Record<string, string> = {
        CONSENSUS: 'Please review this deterministic market data for {{ASSET_SYMBOL}} on {{DATE}}:\n\n{{EVIDENCE_PACK}}\n\nProvide a short, 2-3 sentence financial analysis.',
        SCREENER: 'Analyze the following screener data for {{ASSET_SYMBOL}}:\n\n{{EVIDENCE_PACK}}\n\nProvide a brief investment rationale.',
        RISK: 'Assess the risk profile for {{ASSET_SYMBOL}} based on the following indicators:\n\n{{EVIDENCE_PACK}}\n\nHighlight key risk factors and potential downside.',
        PORTFOLIO: 'You are analyzing a portfolio of assets. Evaluate concentration, volatility, and leaders/laggards. Discuss breadth and diversification based on the following data:\n\n{{EVIDENCE_PACK}}\n\nProvide a high-level summary of the portfolio health and specific actions if any.',
        UNIVERSE: 'You are analyzing a group of assets in a specific market universe. Evaluate concentration, volatility, and leaders/laggards. Discuss breadth and diversification based on the following data:\n\n{{EVIDENCE_PACK}}\n\nHighlight key market trends, sector performance, and which assets represent the best immediate opportunities.'
    };

    const [promptRole, setPromptRole] = useState('CONSENSUS');
    const [promptText, setPromptText] = useState(DEFAULT_PROMPTS['CONSENSUS']);
    const [promptOutputMode, setPromptOutputMode] = useState('TEXT_ONLY');

    const { data: configs } = useQuery({
        queryKey: ['llmConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/llm');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const saveConfigMutation = useMutation({
        mutationFn: async () => {
            const payload: any = {
                name: configName,
                provider: configProvider,
                model: configModel,
                baseUrl: configBaseUrl || undefined
            };
            // Only send API key if it has been updated
            if (configApiKey && !configApiKey.startsWith('****')) {
                payload.apiKey = configApiKey;
            }

            const url = configId ? `/api/settings/llm/${configId}` : '/api/settings/llm';
            const method = configId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Falha ao salvar configuração');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
            setConfigId(null); setConfigName(''); setConfigApiKey(''); setConfigModel(''); setConfigBaseUrl('');
        }
    });

    const deleteConfigMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/llm/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao excluir configuração');
            return id;
        },
        onSuccess: (deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['llmConfigs'] });
            if (configId === deletedId) {
                setConfigId(null);
                setConfigName('');
                setConfigApiKey('');
                setConfigModel('');
                setConfigBaseUrl('');
                document.getElementById('provider-modal')?.classList.add('hidden');
            }
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

    const saveAnalysisMutation = useMutation({
        mutationFn: async () => {
            let finalizedJson = analysisConfigJson;
            let name = 'Custom Avançado';
            if (analysisMode === 'BASIC') {
                const profile = RISK_PROFILES[selectedRiskProfile];
                if (profile) {
                    name = profile.name;
                    finalizedJson = JSON.stringify({ screener: profile.screener, predict: profile.predict });
                }
            }

            const res = await fetch('/api/settings/analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    assetTypeScope: 'BOTH',
                    configJson: finalizedJson,
                    isActive: true
                })
            });
            if (!res.ok) throw new Error('Falha ao salvar configuração de análise');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analysisConfigs'] });
            alert('Configuração de análise salva com sucesso!');
        }
    });

    const { data: promptConfigs } = useQuery({
        queryKey: ['promptConfigs'],
        queryFn: async () => {
            const res = await fetch('/api/settings/prompts');
            if (!res.ok) return [];
            return res.json();
        }
    });

    const savePromptMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/settings/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: promptRole,
                    templateText: promptText,
                    outputMode: isActionLabels ? 'ACTION_LABELS' : promptOutputMode,
                    enabled: true
                })
            });
            if (!res.ok) throw new Error('Falha ao salvar configuração de prompt');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
            alert('Modelo de prompt salvo com sucesso!');
        }
    });

    const deletePromptMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/settings/prompts/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Falha ao restaurar modelo padrão');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promptConfigs'] });
            alert('Modelo redefinido para o padrão com sucesso!');
        }
    });

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold mb-6">{t('settings.title')}</h1>
            </div>

            <div className="flex border-b border-neutral-800 mb-6 gap-2">
                <button
                    onClick={() => setActiveTab('ACCOUNT')}
                    className={`px-4 py-2 font-medium ${activeTab === 'ACCOUNT' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    {t('settings.tabs.account')}
                </button>
                <button
                    onClick={() => setActiveTab('ANALYSIS')}
                    className={`px-4 py-2 font-medium ${activeTab === 'ANALYSIS' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    {t('settings.tabs.analysis')}
                </button>
                <button
                    onClick={() => setActiveTab('PROVIDERS')}
                    className={`px-4 py-2 font-medium ${activeTab === 'PROVIDERS' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}
                >
                    {t('settings.tabs.providers')}
                </button>
            </div>

            {activeTab === 'ACCOUNT' && (
                <AccountProfile />
            )}

            {activeTab === 'PROVIDERS' && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">{t('settings.providers.title')}</h3>
                            <p className="text-neutral-500 text-sm">{t('settings.providers.desc')}</p>
                        </div>
                        <button
                            onClick={() => { setConfigId(null); setConfigName(''); setConfigApiKey(''); setConfigModel(''); setConfigBaseUrl(''); document.getElementById('provider-modal')?.classList.remove('hidden'); }}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
                        >
                            + Adicionar provedor
                        </button>
                    </div>

                    {/* Modal Overlay */}
                    <div id="provider-modal" className={`hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4`}>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
                            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950/50">
                                <h3 className="text-xl font-semibold">{configId ? 'Editarar configuração' : 'Adicionar nova configuração'}</h3>
                                <button onClick={() => document.getElementById('provider-modal')?.classList.add('hidden')} className="text-neutral-500 hover:text-white transition-colors">✕</button>
                            </div>

                            <form className="p-6 space-y-5" onSubmit={(e) => { e.preventDefault(); saveConfigMutation.mutate(); document.getElementById('provider-modal')?.classList.add('hidden'); }}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400">Nome de referência</label>
                                        <input type="text" placeholder="e.g. My ChatGPT" value={configName} onChange={e => setConfigName(e.target.value)} required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400">Interface do provedor</label>
                                        <select value={configProvider} onChange={e => {
                                            setConfigProvider(e.target.value);
                                            if (!configId) setConfigModel(''); // reset model only if creating new
                                        }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors">
                                            <option value="OPENAI">OpenAI</option>
                                            <option value="ANTHROPIC">Anthropic</option>
                                            <option value="GEMINI">Google Gemini</option>
                                            <option value="XAI">xAI (Grok)</option>
                                            <option value="DEEPSEEK">DeepSeek</option>
                                            <option value="GROQ">Groq</option>
                                            <option value="TOGETHER">Together AI</option>
                                            <option value="OPENAI_COMPAT">OpenAI Compatible (v1)</option>
                                        </select>
                                    </div>
                                </div>

                                {configProvider === 'OPENAI_COMPAT' && (
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                                        <p className="text-xs text-indigo-400">
                                            Use isto para conectar qualquer API compatível com o formato OpenAI (LM Studio, vLLM, clusters próprios). Informe seu endpoint personalizado abaixo.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-neutral-400">API Key {configId && '(Leave blank to keep existing)'}</label>
                                    <input type="password" placeholder={configId ? "••••••••••••••••" : "Sua API Key..."} value={configApiKey} onChange={e => setConfigApiKey(e.target.value)} required={!configId} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400">Modelo</label>
                                        <input list="model-options" type="text" placeholder={configProvider === 'ANTHROPIC' ? 'claude-3-5-sonnet-20241022' : configProvider === 'DEEPSEEK' ? 'deepseek-chat' : configProvider === 'GROQ' ? 'llama3-70b-8192' : configProvider === 'GEMINI' ? 'gemini-1.5-flash' : configProvider === 'XAI' ? 'grok-beta' : 'Identificador do modelo'} value={configModel} onChange={e => setConfigModel(e.target.value)} required className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors" />
                                        <datalist id="model-options">
                                            {configProvider === 'OPENAI' && <><option value="gpt-4o" /><option value="gpt-4o-mini" /><option value="o1-preview" /></>}
                                            {configProvider === 'ANTHROPIC' && <><option value="claude-3-5-sonnet-20241022" /><option value="claude-3-5-haiku-20241022" /><option value="claude-3-opus-20240229" /></>}
                                            {configProvider === 'GEMINI' && <><option value="gemini-1.5-flash" /><option value="gemini-1.5-pro" /><option value="gemini-2.0-flash-exp" /></>}
                                            {configProvider === 'XAI' && <><option value="grok-beta" /><option value="grok-vision-beta" /><option value="grok-2" /></>}
                                            {configProvider === 'DEEPSEEK' && <><option value="deepseek-chat" /><option value="deepseek-reasoner" /></>}
                                            {configProvider === 'GROQ' && <><option value="llama3-70b-8192" /><option value="llama3-8b-8192" /><option value="mixtral-8x7b-32768" /></>}
                                            {configProvider === 'TOGETHER' && <><option value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo" /><option value="mistralai/Mixtral-8x7B-Instruct-v0.1" /></>}
                                        </datalist>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-neutral-400">Base URL (Overrides Default)</label>
                                        <input type="text" placeholder="Optional" value={configBaseUrl} onChange={e => setConfigBaseUrl(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors" />
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => document.getElementById('provider-modal')?.classList.add('hidden')} className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 font-medium text-white rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saveConfigMutation.isPending} className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg transition-colors">
                                        {saveConfigMutation.isPending ? 'Salvando...' : configId ? 'Atualizar provedor' : 'Salvar novo provedor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <select value={configProvider} onChange={e => {
                            setConfigProvider(e.target.value);
                            if (!configId) setConfigModel(''); // reset model only if creating new
                        }} className="bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500">
                            <option value="OPENAI">OpenAI</option>
                            <option value="ANTHROPIC">Anthropic</option>
                            <option value="GEMINI">Google Gemini</option>
                            <option value="XAI">xAI (Grok)</option>
                            <option value="DEEPSEEK">DeepSeek</option>
                            <option value="GROQ">Groq</option>
                            <option value="TOGETHER">Together AI</option>
                            <option value="OPENAI_COMPAT">OpenAI Compatible (v1)</option>
                        </select>
                    </div>
                    {configs?.map((cfg: any) => (
                        <div key={cfg.id} className="flex items-center justify-between bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors rounded-xl px-5 py-4">
                            <div>
                                <div className="font-medium text-white text-base mb-1">{cfg.name} <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded ml-2 font-semibold tracking-wide uppercase">{cfg.provider}</span></div>
                                <div className="text-sm text-neutral-500 font-mono">Model: {cfg.model} | Key: ****{cfg.keyLast4}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setConfigId(cfg.id);
                                        setConfigName(cfg.name);
                                        setConfigProvider(cfg.provider);
                                        setConfigModel(cfg.model);
                                        setConfigApiKey('');
                                        setConfigBaseUrl(cfg.baseUrl || '');
                                        document.getElementById('provider-modal')?.classList.remove('hidden');
                                    }}
                                    className="text-neutral-400 hover:text-indigo-400 px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-indigo-500/50 bg-neutral-900 transition-colors text-sm font-medium"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={() => { if (window.confirm('Excluir este provedor?')) deleteConfigMutation.mutate(cfg.id); }}
                                    disabled={deleteConfigMutation.isPending}
                                    className="text-neutral-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                                    title="Delete provider"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'ANALYSIS' && (
                <div className="space-y-8">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4">Mercados do Screener</h3>
                        <p className="text-neutral-500 text-sm mb-4">Selecione quais mercados aparecem como abas no Screener.</p>
                        <div className="flex flex-wrap gap-3 mb-6">
                            {[
                                { id: 'SP500', label: 'S&P 500' },
                                { id: 'NASDAQ100', label: 'NASDAQ 100' },
                                { id: 'TSX60', label: 'TSX 60' },
                                { id: 'IBOV', label: 'IBOVESPA' },
                                { id: 'CRYPTO', label: 'Crypto Top 100' }
                            ].map(u => {
                                const isSelected = selectedUniverses.includes(u.id);
                                return (
                                    <label key={u.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${isSelected ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-300" : "bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:bg-neutral-800"}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedUniverses(prev => [...prev, u.id]);
                                                else setSelectedUniverses(prev => prev.filter(x => x !== u.id));
                                            }}
                                        />
                                        {u.label}
                                    </label>
                                );
                            })}
                        </div>
                        <button onClick={() => saveScreenerPrefsMutation.mutate()} disabled={saveScreenerPrefsMutation.isPending} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                            {saveScreenerPrefsMutation.isPending ? 'Salvando...' : 'Salvar preferências de mercado'}
                        </button>
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4">{t('settings.analysis.title')}</h3>
                        <p className="text-neutral-500 text-sm mb-6">{t('settings.analysis.desc')}</p>

                        <div className="flex border-b border-neutral-800 mb-6">
                            <button onClick={() => setAnalysisMode('BASIC')} className={`px-4 py-2 font-medium ${analysisMode === 'BASIC' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}>Básico</button>
                            <button onClick={() => setAnalysisMode('ADVANCED')} className={`px-4 py-2 font-medium ${analysisMode === 'ADVANCED' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-neutral-500 hover:text-neutral-300'}`}>Avançado</button>
                        </div>

                        {analysisMode === 'BASIC' ? (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Selecione um perfil de risco predefinido:</label>
                                <select value={selectedRiskProfile} onChange={e => setSelectedRiskProfile(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500">
                                    {Object.entries(RISK_PROFILES).map(([key, p]) => (
                                        <option key={key} value={key}>{p.name.replace(' Profile', '')} ({p.description})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-neutral-500">Isso altera os pesos de backend para limites de RSI, médias móveis e penalidades de volatilidade.</p>

                                {selectedRiskProfile && RISK_PROFILES[selectedRiskProfile] && (
                                    <div className="mt-4 bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                                                <Info className="w-4 h-4" /> Pesos ativos do preset
                                            </h4>
                                            <button
                                                onClick={() => {
                                                    const p = RISK_PROFILES[selectedRiskProfile];
                                                    setAnalysisConfigJson(JSON.stringify({ screener: p.screener, predict: p.predict }, null, 2));
                                                    setAnalysisMode('ADVANCED');
                                                }}
                                                className="text-xs flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-1 rounded transition-colors"
                                            >
                                                <Copy className="w-3 h-3" /> Copiar para personalizado
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-neutral-300">
                                            <div>
                                                <span className="text-neutral-500 block mb-1">=== Screener ===</span>
                                                {Object.entries(RISK_PROFILES[selectedRiskProfile].screener).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between"><span className="text-neutral-400">{k}:</span> <span className="text-white">{String(v)}</span></div>
                                                ))}
                                            </div>
                                            <div>
                                                <span className="text-neutral-500 block mb-1">=== Predict ===</span>
                                                {Object.entries(RISK_PROFILES[selectedRiskProfile].predict).map(([k, v]) => (
                                                    <div key={k} className="flex justify-between"><span className="text-neutral-400">{k}:</span> <span className="text-white">{String(v)}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Configuração JSON bruta:</label>
                                <textarea
                                    value={analysisConfigJson}
                                    onChange={e => setAnalysisConfigJson(e.target.value)}
                                    className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
                                    placeholder="Digite um JSON válido para os pesos..."
                                />
                                <p className="text-xs text-neutral-500">Chaves disponíveis: screener (volatilityThreshold, drawdownThreshold etc.), predict (rsiOverbought, rsiOversold etc.).</p>
                            </div>
                        )}

                        <button
                            onClick={() => saveAnalysisMutation.mutate()}
                            disabled={saveAnalysisMutation.isPending}
                            className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors"
                        >
                            {saveAnalysisMutation.isPending ? 'Aplicando...' : 'Aplicar configuração de análise'}
                        </button>

                        {analysisConfigs && analysisConfigs.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-neutral-800">
                                <h4 className="text-sm font-medium text-neutral-400 mb-3">Perfil ativo:</h4>
                                {analysisConfigs.filter((c: any) => c.isActive).map((c: any) => (
                                    <div key={c.id} className="bg-neutral-950/50 p-3 rounded border border-indigo-500/30">
                                        <span className="text-indigo-400 text-sm font-medium">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h3 className="text-xl font-semibold mb-4">{t('settings.prompts.title')} <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded ml-2 uppercase">Avançado</span></h3>
                        <p className="text-neutral-500 text-sm mb-6">{t('settings.prompts.desc')}</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Tipo de análise:</label>
                                    <select value={promptRole} onChange={e => {
                                        const newRole = e.target.value;
                                        setPromptRole(newRole);
                                        setPromptText(DEFAULT_PROMPTS[newRole] || DEFAULT_PROMPTS['CONSENSUS']);
                                    }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500">
                                        <option value="CONSENSUS">Consenso / Snapshot diário</option>
                                        <option value="SCREENER">Narrativa do Screener</option>
                                        <option value="RISK">Avaliação de risco</option>
                                        <option value="PORTFOLIO">Análise de carteira</option>
                                        <option value="UNIVERSE">Análise de universo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Formato de saída:</label>
                                    <select value={promptOutputMode} onChange={e => setPromptOutputMode(e.target.value)} disabled={isActionLabels} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50">
                                        <option value="TEXT_ONLY">Somente texto</option>
                                        <option value="MARKDOWN">Markdown</option>
                                        <option value="JSON_STRICT">JSON estrito (Beta)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Modelo de prompt:</label>
                                <textarea
                                    value={promptText}
                                    onChange={e => setPromptText(e.target.value)}
                                    className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed"
                                    placeholder="Digite sua instrução de prompt personalizada aqui..."
                                />
                                {promptText.includes('{{') && (
                                    <div className="mt-2 p-3 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-400 font-mono whitespace-pre-wrap">
                                        <div className="font-bold text-neutral-300 mb-1 uppercase tracking-wider text-[10px]">Pré-visualização</div>
                                        {promptText
                                            .replace(/{{ASSET_SYMBOL}}/g, 'AAPL')
                                            .replace(/{{DATE}}/g, new Date().toISOString().split('T')[0])
                                            .replace(/{{EVIDENCE_PACK}}/g, '{"vol": 0.2, "rsi": 45, "trend": "BULLISH"}')
                                            .replace(/{{EVIDENCE_PACK_JSON}}/g, '{"vol": 0.2, "rsi": 45, "trend": "BULLISH"}')}
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 border border-neutral-800 rounded-lg p-5 bg-neutral-950/50">
                                <h4 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Avançado Modules
                                </h4>
                                <label className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer select-none">
                                    <input type="checkbox" checked={isActionLabels} onChange={e => setIsActionLabels(e.target.checked)} className="rounded border-neutral-700 text-indigo-500 focus:ring-indigo-500 bg-neutral-900 w-4 h-4 cursor-pointer" />
                                    Forçar rótulos de ação (BUY / HOLD / SELL)
                                </label>

                                {isActionLabels && (
                                    <p className="text-xs text-amber-400 bg-amber-500/10 p-3 rounded border border-amber-500/20 mt-3">
                                        <b>{t('settings.prompts.disclaimer_title')}</b> {t('settings.prompts.disclaimer_body')}
                                    </p>
                                )}
                            </div>

                        </div>

                        <button
                            onClick={() => savePromptMutation.mutate()}
                            disabled={savePromptMutation.isPending}
                            className="mt-6 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 font-medium text-white rounded-lg w-full transition-colors"
                        >
                            {savePromptMutation.isPending ? 'Salvando...' : 'Salvar modelo de prompt'}
                        </button>

                        {promptConfigs && promptConfigs.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-neutral-800">
                                <h4 className="text-sm font-medium text-neutral-400 mb-3">Modelos de prompt salvos:</h4>
                                {promptConfigs.filter((c: any) => c.enabled).map((c: any) => (
                                    <div key={c.id} className="bg-neutral-950/50 p-3 rounded border border-indigo-500/30 flex justify-between items-center mb-2">
                                        <div className="flex-1 mr-4 overflow-hidden">
                                            <span className="text-indigo-400 text-sm font-medium block">{c.role}</span>
                                            <span className="text-xs text-neutral-500 font-mono inline-block truncate w-full">{c.templateText}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {c.outputMode === 'ACTION_LABELS' && (
                                                <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded uppercase font-semibold">Rótulos de ação</span>
                                            )}
                                            {c.outputMode === 'MARKDOWN' && (
                                                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase font-semibold">Markdown</span>
                                            )}
                                            {c.outputMode === 'JSON_STRICT' && (
                                                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase font-semibold">JSON</span>
                                            )}
                                            <button
                                                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-indigo-400 text-xs rounded transition-colors ml-2"
                                                onClick={() => {
                                                    setPromptRole(c.role);
                                                    setPromptText(c.templateText);
                                                    setPromptOutputMode(c.outputMode === 'ACTION_LABELS' ? 'TEXT_ONLY' : c.outputMode);
                                                    setIsActionLabels(c.outputMode === 'ACTION_LABELS');
                                                    window.scrollTo({ top: 400, behavior: 'smooth' });
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs rounded border border-rose-500/20 transition-colors disabled:opacity-50"
                                                onClick={() => {
                                                    if (window.confirm('Redefinir este modelo para o padrão do sistema?')) {
                                                        deletePromptMutation.mutate(c.id);
                                                    }
                                                }}
                                                disabled={deletePromptMutation.isPending}
                                                title="Redefinir para o padrão"
                                            >
                                                Redefinir
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
